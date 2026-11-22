import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
    const date = new Date(`${dateText} 00:00:00 UTC`).toISOString();
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
  return { reviews: found, url };
}

async function saveFailedPageHtml(page, app, pageNumber, expectedCount, extractedCount, attempts, lastError) {
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const filename = `${app.id}-page-${pageNumber}-${timestamp}.html`;
  const evidenceUrl = file(`artifacts/failed-pages/${filename}`);
  const details = {
    app: app.name,
    app_id: app.id,
    page: pageNumber,
    expected_reviews: expectedCount,
    extracted_reviews: extractedCount,
    attempts,
    captured_at: new Date().toISOString(),
    error: lastError?.message ?? null
  };
  await mkdir(file('artifacts/failed-pages'), { recursive: true });
  const html = await page.content();
  await writeFile(evidenceUrl, `<!-- REVIEW_RADAR_FAILURE_EVIDENCE\n${JSON.stringify(details, null, 2)}\n-->\n${html}`, 'utf8');
  return `artifacts/failed-pages/${filename}`;
}

async function getCompletePage(page, app, pageNumber, expectedCount, initialResult = null) {
  const maxAttempts = 3;
  let bestResult = initialResult;
  let lastError = null;
  let attempts = initialResult ? 1 : 0;

  if (bestResult?.reviews.length >= expectedCount) return bestResult.reviews;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const result = await getReviews(page, app, pageNumber);
      if (!bestResult || result.reviews.length > bestResult.reviews.length) bestResult = result;
      if (result.reviews.length >= expectedCount) return result.reviews;
    } catch (error) {
      lastError = error;
    }
    if (attempts < maxAttempts) await page.waitForTimeout(2500 * attempts);
  }

  const extractedCount = bestResult?.reviews.length ?? 0;
  let evidencePath = 'unavailable';
  try {
    evidencePath = await saveFailedPageHtml(page, app, pageNumber, expectedCount, extractedCount, attempts, lastError);
  } catch (evidenceError) {
    lastError ??= evidenceError;
  }
  throw new Error(`INCOMPLETE_PAGE_COLLECTION: ${app.name} page ${pageNumber} expected at least ${expectedCount} review cards, but extracted ${extractedCount} after ${attempts} attempts. Failure HTML: ${evidencePath}`);
}

async function getTotalReviewCount(page) {
  const text = await page.locator('body').innerText();
  const match = text.match(/Reviews\s*\((\d[\d,]*)\)/i);
  return match ? Number(match[1].replaceAll(',', '')) : 0;
}

const { data: existing, error: existingError } = await db.from('tracker_reviews').select('*');
if (existingError) throw existingError;
const seen = new Map(existing.map(r => [r.id, r]));
const historicCount = (appId) => existing.filter((review) => review.app_id === appId).length;
const browser = await chromium.launch({ headless: true });
let collected = 0;
const scanApps = [];
try {
  for (const app of apps) {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (compatible; GoKwik-Assignment-Review-Radar/1.0; +https://github.com)' });
    const firstResult = await getReviews(page, app, 1);
    const reportedCount = await getTotalReviewCount(page);
    const previousCount = historicCount(app.id);
    if (reportedCount === 0 && previousCount > 0) {
      throw new Error(`UNREADABLE_REVIEW_TOTAL: ${app.name} previously had ${previousCount} reviews, but Shopify's visible review total could not be read.`);
    }
    // Shopify currently exposes ten reviews per page. Use the displayed total so we collect
    // the complete public history, not an arbitrary sample. The cap prevents a malformed page
    // from creating an unbounded job.
    const pagesToVisit = Math.min(100, Math.max(1, Math.ceil(reportedCount / 10)));
    const expectedOnPage = (pageNumber) => Math.min(10, Math.max(0, reportedCount - ((pageNumber - 1) * 10)));
    // Zero public reviews is a valid result for an app that has never had review cards.
    // It is not the same as an unreadable zero total for an app with historic reviews.
    const firstPage = reportedCount === 0 ? firstResult.reviews : await getCompletePage(page, app, 1, expectedOnPage(1), firstResult);
    const reviews = [...firstPage];
    for (let pageNumber = 2; pageNumber <= pagesToVisit; pageNumber++) {
      const batch = await getCompletePage(page, app, pageNumber, expectedOnPage(pageNumber));
      reviews.push(...batch);
    }
    await page.close();
    if (reportedCount > 0 && reviews.length < reportedCount) {
      throw new Error(`INCOMPLETE_APP_COLLECTION: ${app.name} shows ${reportedCount} public reviews, but the scraper extracted ${reviews.length}.`);
    }
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
