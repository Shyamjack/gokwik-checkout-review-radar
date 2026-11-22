import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { db } from './db.mjs';

const file = (path) => new URL(`../${path}`, import.meta.url);
const apps = JSON.parse(await readFile(file('config/apps.json'), 'utf8'));
const { data: reviewRows, error: reviewsError } = await db.from('tracker_reviews').select('*').order('review_date', { ascending: false });
const { data: validationRows, error: validationError } = await db.from('tracker_validation').select('*');
const { data: runRows, error: runsError } = await db.from('tracker_runs').select('*').order('ran_at', { ascending: false });
const { data: runAppRows, error: runAppsError } = await db.from('tracker_run_apps').select('*');
if (reviewsError) throw reviewsError;
if (validationError) throw validationError;
if (runsError) throw runsError;
if (runAppsError) throw runAppsError;

const reviews = reviewRows.map((r) => ({
  id: r.id, appId: r.app_id, app: r.app, merchant: r.merchant,
  date: r.review_date, rating: r.rating, text: r.review_text,
  sourceUrl: r.source_url, firstSeenAt: r.first_seen_at, lastSeenAt: r.last_seen_at,
  week: r.week_start, sentiment: r.sentiment, theme: r.theme, tagger: r.tagger
}));
const validation = validationRows.map((r) => ({
  reviewId: r.review_id, manualSentiment: r.manual_sentiment, manualTheme: r.manual_theme,
  sentiment: r.predicted_sentiment, theme: r.predicted_theme, note: r.note
}));
const runs = runRows.map((r) => ({ id: r.id, ranAt: r.ran_at, collected: r.collected, stored: r.stored, newReviews: r.new_reviews, durationMs: r.duration_ms, status: r.status, detail: r.detail }));
const runApps = runAppRows.map((r) => ({ runId: r.run_id, appId: r.app_id, collected: r.collected, newReviews: r.new_reviews, totalReviews: r.total_reviews, status: r.status, detail: r.detail }));
const mismatches = validation.filter((row) => row.manualSentiment !== row.sentiment || row.manualTheme !== row.theme);
const exampleIds = ['4b5b4fa49f6e7a7d', 'c3d78018c9aae70b'];
const examples = exampleIds.map((id) => mismatches.find((row) => row.reviewId === id)).filter(Boolean);
const audit = validation.length ? {
  total: validation.length,
  sentimentMatches: validation.filter((row) => row.manualSentiment === row.sentiment).length,
  themeMatches: validation.filter((row) => row.manualTheme === row.theme).length,
  examples: examples.length ? examples : mismatches.slice(0, 2)
} : null;
// The detailed human labels remain in private Supabase. The public dashboard
// receives only audit totals and two selected error examples.
const payload = JSON.stringify({ reviews, runs, runApps, apps, audit }).replaceAll('</', '<\\/');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Review Radar — Checkout competitor intelligence</title>
  <meta name="description" content="A public review intelligence dashboard for checkout app competitor signals.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="dashboard.css">
  <link rel="stylesheet" href="nav.css">
  <link rel="stylesheet" href="insights.css">
</head>
<body>
  <script src="data.js"></script>
  <script src="data-overlay.js"></script>
  <script src="app.js"></script>
</body>
</html>
`;
await mkdir(file('public'), { recursive: true });
await writeFile(file('public/data.js'), `window.TRACKER_DATA = ${payload};\n`);
await writeFile(file('public/index.html'), html);
