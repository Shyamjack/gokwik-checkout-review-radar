# Checkout Review Radar

Review intelligence tracker for three Shopify checkout apps:

- Kwik COD & Checkout
- Razorpay COD & Magic Checkout
- Simpl: 1-Click Checkout

It collects public Shopify App Store reviews every day, keeps a deduplicated history, tags each review by sentiment and theme, and publishes a dashboard that marketing, product, and customer-experience teams can use.

## Links

- **Repository:** https://github.com/Shyamjack/gokwik-checkout-review-radar
- **Live dashboard:** https://shyamjack.github.io/gokwik-checkout-review-radar/
- **Alert proof:** https://github.com/Shyamjack/gokwik-checkout-review-radar/issues/1 (a deliberate, simulated empty-collection test)

## What the tracker does

Every scan visits the three public Shopify review pages with Playwright. It captures the merchant/store name where Shopify makes it public, review date, star rating, written review text, and source URL.

A stable SHA-256 ID is created from the app, merchant, review date, and review text. If the same review is found on later days, the existing row is updated with a new `last_seen_at` value instead of being counted again.

Each review receives:

- a sentiment: `positive`, `neutral`, or `negative`;
- one main theme: `pricing`, `support`, `setup`, `conversion`, `COD / RTO`, or `product / other`.

The public dashboard shows company-level review totals, rating distribution, theme mix, weekly review volume, weekly sentiment mix, source reviews with Shopify links, and the most recent scan status.

## How to run it and what runs when

GitHub Actions is scheduled for `.github/workflows/daily-tracker.yml` every day at **02:17 UTC (07:47 IST)**. It can also be triggered manually from the **Actions** tab.

The scheduled job:

1. Checks out the repository and installs Node.js, Playwright, and Chromium.
2. Visits all publicly paginated review pages for the three apps.
3. Deduplicates known reviews and tags new reviews.
4. Writes review and scan-run data to Supabase.
5. Rebuilds the static dashboard.
6. Commits any changed dashboard data and deploys GitHub Pages.

To run the same flow locally:

```bash
npm ci
npx playwright install chromium
npm run scrape
npm run build
open public/index.html
```

The local scrape command needs these environment variables:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Where data and keys live

| Item | Location | Who can see it |
| --- | --- | --- |
| Source code and workflows | Public GitHub repository | Anyone |
| Public dashboard | GitHub Pages | Anyone with the link |
| Canonical review history | Supabase `tracker_reviews` | Supabase project administrators and the server-side workflow |
| Published dashboard copy | Static `public/data.js` on GitHub Pages | Anyone; it deliberately contains the public Shopify review evidence shown in the dashboard |
| Scan history | Supabase `tracker_runs` and `tracker_run_apps`, then the dashboard copy | Administrators/workflow in Supabase; public once shown on the dashboard |
| Detailed human-audit labels | Supabase `tracker_validation` | Supabase project administrators and the server-side workflow |
| Audit totals and two examples | Public dashboard payload | Anyone viewing the dashboard |
| Supabase service-role key | GitHub Actions repository secrets | Its value is injected only into an Actions run; it is never committed or sent to the browser |

Supabase Row Level Security is enabled with no public policies on the tracker tables. The browser never receives a service-level key. The Supabase URL is only the address of the project, not a password: knowing it does not allow someone to read or change the database.

The current dashboard is public. In a production internal version, I would add Google authentication and allow only approved company work-email domains to access the dashboard.

## Tagging approach and manual check

The current tagger is deliberately transparent and free. It uses star ratings plus keyword rules to assign sentiment and a priority keyword map to assign the main theme. This makes the behaviour easy to inspect and change without relying on a paid API.

A fresh, independent human audit of 30 reviews was completed and stored in the private `tracker_validation` table. The public dashboard publishes only the agreement totals and two selected mistakes.

| Check | Result |
| --- | --- |
| Sentiment agreement | 26 / 30 (86.7%) |
| Theme agreement | 18 / 30 (60.0%) |

One useful error cases:

1. A review about a slow KYC activation process was manually labelled **setup**, but the rule tagger labelled it **conversion** because it saw checkout-related wording rather than the onboarding problem.

These cases show why the rule set should be reviewed and improved over time rather than treated as ground truth. The manual labels are the reference point; the automatic tags are a fast first pass.

## What will break first, and how I would find out

The most likely external failure is Shopify changing its review page structure, rate-limiting automation, or serving a challenge page. A missing or rotated Supabase secret is another possible operational failure.

Zero new reviews is normal and does not create an alert. A healthy scan can find no new reviews while still confirming all existing reviews.

The workflow alerts when extraction itself fails: for example, when all review pages return zero cards, the browser fails, or the database write fails. It deliberately throws `EMPTY_COLLECTION` when zero review cards are extracted. It also verifies every company separately against Shopify's displayed total. If Shopify shows 398 GoKwik reviews but the scraper extracts only 10, the run fails before incomplete data is published. A failed run creates a GitHub Issue labelled `tracker-alert` with a direct Actions-run link.

The workflow also supports an optional webhook. When an `ALERT_WEBHOOK_URL` GitHub secret is configured, the same failure can be sent to Slack, email automation, or an internal incident tool. Healthy runs stay silent.

For partial failures, the scraper retries a short page up to three times. If it is still incomplete, it saves that page’s HTML as a seven-day GitHub Actions artifact before failing the run. I would compare Shopify’s displayed review total with the extracted total, compare each company’s count against its previous scan, then inspect the GitHub Actions logs and the saved HTML evidence.

## Moving from GitHub Actions to AWS EC2

I would keep the scraper and Supabase database logic unchanged. The main change would be replacing GitHub’s temporary runner with a small server I manage.

1. Create a small Ubuntu EC2 instance and use AWS Systems Manager or SSH keys for access; disable password login and run the application under a restricted Linux user.
2. Install Node.js, Playwright, Chromium dependencies, Git, and the project dependencies.
3. Pull the repository using a deploy key, GitHub App token, or controlled Git pull.
4. Move the Supabase credentials to AWS Secrets Manager or Parameter Store. Give the EC2 instance a least-privilege IAM role that can read only the required secret.
5. Create a `systemd` service that runs `npm run scrape` and `npm run build`.
6. Create a daily `systemd` timer to invoke that service.
7. Publish the generated static dashboard to approved internal hosting, such as S3 and CloudFront, and send logs and alerts to CloudWatch and SNS.

In this setup, EC2 is only the scheduled computer that runs the scraper. Supabase remains the managed database and authentication/backend layer.

## What I would build with two more days

First, I would strengthen the tracker itself:

- selectable date ranges and deeper week-over-week analysis;
- per-company anomaly alerts when review volume drops unexpectedly;
- stored page screenshots and HTML snapshots for failed scans;
- a clearer tagging-quality view with the audit sample, agreement scores, and mistakes;
- Google Workspace login for an internal version.

Second, I would turn validated competitor signals into a GTM research workflow. Where a public merchant domain is available, I would enrich the company at an account level using an approved enrichment source, score accounts for ICP fit, create reviewed outreach drafts, and route the best opportunities to an SDR or outbound queue. I would use category-level patterns, not message an individual saying that I saw their review.

The resulting loop would be:

`competitor review signals → account research → ICP scoring → relevant messaging → SDR or outbound action → campaign learning`

## Free tools used

- GitHub Actions for scheduling
- Playwright for browser automation
- Supabase free tier for the database
- GitHub Pages for hosting
- A transparent in-code rule tagger, with AI assistance used during development and implementation
