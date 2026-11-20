# Checkout review radar

A zero-cost, public review tracker for Kwik COD & Checkout, Razorpay COD & Magic Checkout, and Simpl: 1-Click Checkout. It is built for the GoKwik AI GTM technical assignment.

## What runs, and when

GitHub Actions runs `.github/workflows/daily-tracker.yml` daily at 02:17 UTC (07:47 IST) and can be run manually. It installs Chromium, visits the three public Shopify App Store review pages with Playwright, extracts visible review cards, deduplicates them with a stable SHA-256 key, classifies sentiment/theme, rebuilds `public/index.html`, and commits only changed data. GitHub Pages serves that committed static dashboard.

An empty extraction deliberately throws `EMPTY_COLLECTION`; any failed run (including empty results) opens a public GitHub Issue labelled `tracker-alert`. Healthy runs do not send anything.

## Run locally

```bash
npm ci
npx playwright install chromium
npm run scrape
npm run build
open public/index.html
```

`npm run scrape` needs only public web access. No credentials, paid APIs, subscriptions, or keys are used. The public repository contains all data; this is intentional because the source reviews are public. Do not add merchant contact details or private tokens.

## Tagging and evaluation

`scripts/scrape.mjs` uses a transparent, deterministic rule tagger: star rating plus keyword signals determine `positive`, `neutral`, or `negative`, and a priority keyword map determines one theme. This is deliberately easy to inspect and change, and costs nothing. `data/validation.json` holds a hand-labelled sample of 30 fetched reviews, its agreement fields, and two error cases; the dashboard calculates exact sentiment-and-theme agreement from it. The tagger is a baseline, not a claim of human-level understanding.

## Operational handover

**Data and access.** Reviews live in `data/reviews.json`; run history in `data/run-history.json`; validation in `data/validation.json`. The workflow has repository-scoped `contents: write` and `issues: write` only. There are no keys. Public repo viewers can see the public-source review text and alert issue.

**What breaks first.** Shopify can change its markup, rate-limit browser automation, or show a challenge page. The `collected === 0` guard catches complete breakage and opens an issue with the Actions run link. Partial extraction is the main remaining risk; I would add per-app historic-volume thresholds and DOM screenshots as the next monitoring improvement.

**Move to EC2.** (1) Create a small Ubuntu instance and a least-privilege deploy key. (2) Install Node 22, Chromium dependencies, and clone the repo. (3) Put `npm ci && npm run scrape && npm run build` in a systemd service. (4) trigger it with a systemd timer at the same daily time. (5) replace the GitHub push with an atomic write to S3/CloudFront or a deploy to the static host. (6) send non-zero service exits and zero-result checks to CloudWatch/SNS. (7) monitor disk, browser process count, job duration, and data volumes; add backups for `data/`.

**Two more days.** Add pagination and page snapshots; improve the tagger with a small human-reviewed labelled set and per-label precision/recall; show review drill-down/filtering; add per-app volume anomaly detection; and make alert deduplication close/reopen a single incident instead of creating one Issue per failed schedule.

## Submission links

- Repository: add after creating the public GitHub repository.
- Live page: enable GitHub Pages from the `main` branch / `public` folder and add the URL here.
- Alert proof: trigger a deliberately failing workflow once, link its Issue here, then restore the normal workflow.
