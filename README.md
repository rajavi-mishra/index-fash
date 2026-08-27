# The Fashion Index

A single-screen "Bloomberg terminal for fashion" — one dashboard that turns
scattered signals about what's trending into a handful of legible numbers.

Three indexes (**Trend**, **Brand**, **Color**), each scored 0–100, each with a
drill-down that shows *why* it's moving and which data actually backs it.

```bash
npm install
cp .env.example .env    # optional; works with no keys
npm run ingest          # pull live data -> public/index-data.json
npm run dev
```

Without an ingest run the dashboard shows clearly-labelled sample data.

---

## Data sources

The score is a weighted blend of four signals. What's actually obtainable
differs a lot per signal, so the pipeline is built to run on whatever you have
and to **say so on screen** rather than quietly pretending to full coverage.

| Signal | Weight | Source used | Cost | Status |
|---|--:|---|---|---|
| Search | 30% | Wikipedia pageviews | free, no key | **works now** |
| Search | 30% | Google Trends (SerpAPI) | ~$75/mo | optional upgrade |
| Visual | 30% | GDELT news/editorial volume | free, no key | **works now** |
| Commerce | 10% | eBay Browse API | free account | optional, accrues |
| Social | 30% | — | — | not wired (see below) |

### Tier 1 — free, no API key, working today

**[Wikimedia Pageviews API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/)**
Daily pageviews per article, no account or key, history going back years.
A well-established proxy for public attention — [research has used it to
predict market moves](https://trendspider.com/blog/wikipedia-page-views-indicator/).
Strong on brands and designers (stable articles); weak on micro-trends, which
often have no article. Their policy asks for a contact address in the
User-Agent, hence `CONTACT_EMAIL`.

**[GDELT DOC 2.0 API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)**
Indexes worldwide online news in near real time; `timelinevol` returns a query's
share of global coverage over time. This is the closest free stand-in for the
"visual/editorial" signal: it captures when a trend is actually *appearing* in
fashion press, runway coverage, and celebrity reporting, not just being searched
for. Free, no key. Ambiguous terms need disambiguating — see `FASHION_CONTEXT`
in `src/lib/taxonomy.ts`, which ANDs queries with a fashion context so "cherry"
doesn't match fruit and "Coach" doesn't match sports.

### Tier 2 — free account, worth adding

**[eBay Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html)**
Joining the Developers Program is free. Gives active listing counts and price
distribution per keyword — a real commerce signal.

One caveat worth understanding: it answers *"what is listed right now"*, not
*"what was listed last March"*. There is no historical endpoint. So the pipeline
appends one reading per run to `data/commerce-history.json`, and the commerce
signal switches on once ~30 days of history has accumulated. Run the ingest on a
schedule and it fills itself in.

### Tier 3 — paid or gated

**Google Trends.** The [official Trends API](https://developers.google.com/search/blog/2025/07/trends-api)
was announced in July 2025 and is *still* an application-gated alpha — worth
applying for, but not something to plan around. Meanwhile `pytrends` and the
other scrapers have largely stopped working. The practical route today is
[SerpAPI's Google Trends endpoint](https://serpapi.com/google-trends-api)
(~$75/mo). The adapter in `scripts/ingest/sources/googleTrends.ts` targets
SerpAPI; if you get into the official alpha, swap the URL and response mapping
there and nothing else in the pipeline changes.

**Social (the missing 30%).** This is the hardest signal and deliberately not
faked. Reddit's API is free for non-commercial use at 100 QPM, but
[self-service registration closed in late 2025](https://www.socialcrawl.dev/blog/reddit-data-api-2026) —
every new OAuth client now goes through manual approval, and commercial use
starts around $0.24/1k calls. TikTok and Instagram have no usable public
mention-volume API; realistically that means a paid social-listening vendor
(Brandwatch, Sprout, Apify actors). Until one is wired in, the dashboard reports
social as "not measured" rather than as zero.

**Visual, properly done.** GDELT is a proxy for editorial coverage, not actual
garment detection. The real version of this signal is your own vision pipeline:
CLIP-style embeddings plus a garment/color/silhouette classifier run over
street-style, runway, and celebrity imagery, counting appearances per entity.
That's the most defensible moat here and the most work.

---

## How the score is built

```
Fashion Trend Score = 30%·Search + 30%·Social + 30%·Visual + 10%·Commerce
```

Turning four incompatible raw series into one comparable number takes three
steps, all in `src/lib/scoring.ts` (pure functions, unit-tested, imported by
both the pipeline and the frontend so the screen and the tests agree):

**1. Level — where it stands.** Each series is reduced to a z-score of its
trailing 30-day mean against its own history, squashed through a logistic to
0–100. Using the entity's *own* history is what makes a small label comparable
to Gucci: this measures "unusually high for itself", not raw volume. (Tested:
scaling a series by 1000× leaves its level score unchanged.)

**2. Momentum — where it's going.** Mean of the trailing 30 days vs. the 30
before that, as a percent. Returns `null` — not `0` — when there isn't enough
history, so "flat" and "unknown" never get confused.

**3. Blend.** `0.6·level + 0.4·momentum`, then a weighted composite across
signals.

**The part that matters most:** missing signals are *renormalised over*, not
treated as zero. If only search and visual reported, the composite is the
weighted mean of those two and `coverage` is reported as 60%. Scoring a missing
signal as zero would drag every number toward the floor and make the whole index
meaningless. The UI shows the coverage figure and greys out unmeasured signals,
so any number on screen can be traced to what actually backs it.

The "why it's moving" line is generated from the measured moves
(`scripts/ingest/explain.ts`) and is deliberately *descriptive, not predictive* —
it reports which source moved most and by how much. Two months of pageview data
does not support a confident six-week forecast, so it doesn't make one.

## Layout

```
src/lib/scoring.ts        pure scoring math (shared, unit-tested)
src/lib/taxonomy.ts       entities + per-source queries — add trends here
scripts/ingest/
  run.ts                  orchestrator -> public/index-data.json
  sources/                wikipedia · gdelt · googleTrends · ebay
  snapshots.ts            accrues point-in-time readings into a series
  explain.ts              generates the "why it's moving" line
src/components/           dashboard UI
```

Adding a trend, brand, or color is one entry in `src/lib/taxonomy.ts`; any
source config you omit is skipped for that entity and lowers its reported
coverage rather than its score.

## Scripts

```bash
npm run dev       # dev server
npm run ingest    # pull live data -> public/index-data.json
npm run test      # 34 unit tests (scoring math + adapter parsing)
npm run build     # typecheck + production build
npm run lint      # oxlint
```

To keep the index current, run `npm run ingest` on a schedule (cron, a GitHub
Action, whatever) and redeploy. The commerce signal in particular needs this to
accumulate history.

## Roadmap

- Wire a social source once Reddit approval or a vendor key is in hand.
- Own the visual signal: a classifier over runway/street-style imagery.
- Geographic breakdown — Google Trends exposes ~210 US DMAs.
- Historical browsing: keep every snapshot, not just the latest.
- A Cultural Index (celebrities, TV, music) and a Silhouette Index.
- Alerting: "tell me when X crosses 70."
