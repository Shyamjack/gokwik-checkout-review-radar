import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { db } from './db.mjs';

const file = (path) => new URL(`../${path}`, import.meta.url);
const apps = JSON.parse(await readFile(file('config/apps.json'), 'utf8'));
const { data: reviewRows, error: reviewsError } = await db.from('tracker_reviews').select('*').order('review_date', { ascending: false });
const { data: validationRows, error: validationError } = await db.from('tracker_validation').select('*');
if (reviewsError) throw reviewsError;
if (validationError) throw validationError;

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
const payload = JSON.stringify({ reviews, validation, apps }).replaceAll('</', '<\\/');
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
