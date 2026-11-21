// Retains the one valid short, rating-only Shopify card added after the static
// snapshot was generated. The scheduled database build will include it directly.
window.TRACKER_DATA.reviews.push({
  id: '51957362afd0fdf3', appId: 'razorpay', app: 'Razorpay COD & Magic Checkout',
  merchant: 'Shopyogya', date: '2026-06-07T18:30:00.000Z', rating: 5,
  text: '(No written review)', sourceUrl: 'https://apps.shopify.com/razorpay-checkout/reviews?page=4',
  firstSeenAt: '2026-11-21T00:00:00.000Z', lastSeenAt: '2026-11-21T00:00:00.000Z',
  week: '2026-06-01', sentiment: 'positive', theme: 'product / other', tagger: 'deterministic-v1'
});
// Historic scan records. Future scheduled scans are written directly to Supabase.
if (!window.TRACKER_DATA.runs?.length) window.TRACKER_DATA.runs = [
  { id: 2, ranAt: '2026-11-21T10:29:24.548Z', collected: 436, stored: 436, status: 'ok', detail: 'Full public-review history backfill' },
  { id: 1, ranAt: '2026-11-20T13:03:41.211Z', collected: 45, stored: 45, status: 'ok', detail: 'Initial migration from repository JSON' }
];
if (!window.TRACKER_DATA.runApps?.length) window.TRACKER_DATA.runApps = [
  { runId: 2, appId: 'gokwik', collected: 397, newReviews: 387, totalReviews: 397, status: 'ok', detail: 'Full pagination replaced the initial sample.' },
  { runId: 2, appId: 'razorpay', collected: 39, newReviews: 4, totalReviews: 39, status: 'ok', detail: 'Full pagination completed; one short rating-only card was corrected after this run.' },
  { runId: 2, appId: 'simpl', collected: 0, newReviews: 0, totalReviews: 0, status: 'ok', detail: 'No public review cards found.' }
];
