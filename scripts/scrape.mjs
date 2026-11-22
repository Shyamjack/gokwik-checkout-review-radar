import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { db } from './db.mjs';

const root = new URL('..', import.meta.url);
const file = (path) => new URL(`../${path}`, import.meta.url);
const apps = JSON.parse(await readFile(file('config/apps.json'), 'utf8'));
const now = new Date().toISOString();
const startedAt = Date.now();
const week = (date) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const clean = (value = '') => value.replace(/\s+/g, ' ').trim();

function classify(text, rating) {
  const t = text.toLowerCase();
  const negative = /(terrible|worst|bad|bug|issue|slow|unreliable|frustrat|no response|not work|problem|fail)/.test(t);
  const positive = /(great|excellent|helpful|smooth|fast|love|recommend|seamless|resolved|easy)/.test(t);
  const sentiment = rating >= 4 || (positive && !negative) ? 'positive' : rating <= 2 || (negative && !positive) ? 'negative' : 'neutral';
  const theme = /(price|pricing|cost|charge|plan|expensive)/.test(t) ? 'pricing'
    : /(support|response|team|help|service)/.test(t) ? 'support'
    : /(setup|install|integrat|onboard|api)/.test(t) ? 'setup'
    : /(cod|rto|cash on delivery|otp)/.test(t) ? 'COD / RTO'
    : /(conversion|sale|checkout|payment|abandon)/.test(t) ? 'conversion'
    : 'product / other';
  return { sentiment, theme, tagger: 'deterministic-v1' };
}

async function getReviews(page, app, pageNumber = 1) {
  const url = pageNumber === 1 ? app.url : `${app.url}${app.url.includes('?') ? '&' : '?'}page=${pageNumber}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1800);
  // Shopify's review cards are server-rendered today, but this DOM-first extraction also works after JS hydration.
  const rows = await page.locator('div.tw-relative.tw-pb-md').evaluateAll(nodes => nodes.map(node => ({
    text: node.innerText,
    rating: Number(node.querySelector('[aria-label$="stars"]')?.getAttribute('aria-label')?.match(/[1-5]/)?.[0])
  // Rating-only cards can be very short (date + shop + country). They are still
  // public reviews and must be kept in the total and star distribution.
  })).filter(x => x.rating && x.text.length > 15));
  const found = [];
  for (const row of rows) {
    const lines = row.text.split('\n').map(x => x.trim()).filter(Boolean);
    const dateText = lines.find(x => /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/.test(x));
    if (!dateText) continue;
    const rating = row.rating;
    // Shopify shows a calendar date with no timezone. Treat it as that calendar
    // date in UTC so a runner in India and a GitHub runner in UTC create the
    // same stable review ID.
    const date = new Date(`${dateText}T00:00:00.000Z`).toISOString();
    const afterDate = lines.slice(Math.max(0, lines.indexOf(dateText) + 1));
    const merchantOffset = afterDate.findIndex(x => /^(?:India|United States|Canada|United Kingdom)$/i.test(x));
    const merchant = merchantOffset > 0 ? afterDate[merchantOffset - 1] : 'Unknown merchant';
    // A Shopify rating can be valid even when the merchant left no written text.
    // Retain it for accurate totals and label it explicitly in the dashboard.
    const writtenText = clean((merchantOffset > 0 ? afterDate.slice(0, merchantOffset - 1) : afterDate).filter(x => !/^(show more|read more)$/i.test(x)).join(' '));
    const text = writtenText || '(No written review)';
    const id = createHash('sha256').update(`${app.id}|${date.slice(0,10)}|${merchant}|${text}`).digest('hex').slice(0, 16);
    found.push({ id, appId: app.id, app: app.name, merchant, date, rating, text, sourceUrl: url, firstSeenAt: now, lastSeenAt: now, week: week(date), ...classify(text, rating) });
  }
  return found;
}

async function getTotalReviewCount(page) {
  const text = await page.locator('body').innerText();
  const match = text.match(/Reviews\s*\((\d[\d,]*)\)/i);
  return match ? Number(match[1].replaceAll(',', '')) : 0;
}

const { data: existing, error: existingError } = await db.from('tracker_reviews').select('*');
if (existingError) throw existingError;
const seen = new Map(existing.map(r => [r.id, r]));
const browser = await chromium.launch({ headless: true });
let collected = 0;
const scanApps = [];
try {
  for (const app of apps) {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (compatible; GoKwik-Assignment-Review-Radar/1.0; +https://github.com)' });
    const firstPage = await getReviews(page, app, 1);
    const reportedCount = await getTotalReviewCount(page);
    // Shopify currently exposes ten reviews per page. Use the displayed total so we collect
    // the complete public history, not an arbitrary sample. The cap prevents a malformed page
    // from creating an unbounded job.
    const pagesToVisit = Math.min(100, Math.max(1, Math.ceil(reportedCount / 10)));
    const reviews = [...firstPage];
    for (let pageNumber = 2; pageNumber <= pagesToVisit; pageNumber++) {
      const batch = await getReviews(page, app, pageNumber);
      reviews.push(...batch);
    }
    await page.close();
    collected += reviews.length;
    const newReviews = reviews.filter((review) => !seen.has(review.id)).length;
    for (const review of reviews) {
      const prior = seen.get(review.id);
      seen.set(review.id, prior ? { ...prior, last_seen_at: now } : review);
    }
    scanApps.push({ app_id: app.id, collected: reviews.length, new_reviews: newReviews, total_reviews: [...seen.values()].filter((review) => (review.appId ?? review.app_id) === app.id).length, status: 'ok' });
  }
} finally { await browser.close(); }

if (collected === 0) throw new Error('EMPTY_COLLECTION: zero review cards extracted; failing so the workflow opens an alert issue.');
const output = [...seen.values()].map(r => ({
  id: r.id, app_id: r.appId ?? r.app_id, app: r.app, merchant: r.merchant,
  review_date: r.date ?? r.review_date, rating: r.rating, review_text: r.text ?? r.review_text,
  source_url: r.sourceUrl ?? r.source_url, first_seen_at: r.firstSeenAt ?? r.first_seen_at,
  last_seen_at: r.lastSeenAt ?? r.last_seen_at, week_start: r.week ?? r.week_start,
  sentiment: r.sentiment, theme: r.theme, tagger: r.tagger
}));
const { error: upsertError } = await db.from('tracker_reviews').upsert(output, { onConflict: 'id' });
if (upsertError) throw upsertError;
const durationMs = Date.now() - startedAt;
const { data: run, error: runError } = await db.from('tracker_runs').insert({ ran_at: now, collected, stored: output.length, new_reviews: scanApps.reduce((sum, row) => sum + row.new_reviews, 0), duration_ms: durationMs, status: 'ok', detail: 'Scheduled Shopify review scan' }).select('id').single();
if (runError) throw runError;
const { error: appRunError } = await db.from('tracker_run_apps').upsert(scanApps.map((row) => ({ ...row, run_id: run.id })), { onConflict: 'run_id,app_id' });
if (appRunError) throw appRunError;
console.log(JSON.stringify({ collected, stored: output.length, durationMs, persistence: 'supabase' }));
