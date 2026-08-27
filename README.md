# The Fashion Index

A single-screen "Bloomberg terminal for fashion" — one dashboard that turns
messy, scattered signals about what's trending in fashion into a handful of
legible numbers.

This is the MVP described in the project brief: a **Trend Index**, a
**Brand Index**, and a **Color Index**, each scored 0–100, with a
drill-down "why is this moving" view for every entry.

## What's here

- **Fashion Sentiment** — one headline number for the overall market.
- **Fastest Rising** — ranked trend table (score, 30-day change, sparkline).
- **Brands Gaining Attention** — which brands are gaining/losing attention.
- **Colors** — which colors are rising/falling.
- **Detail drawer** — click any row to see:
  - the score breakdown across the four underlying signals,
  - what specifically is driving the move (e.g. "lace skirts ↑", "suede bags ↑"),
  - a plain-language explanation and a short-term prediction.

## Scoring model

Every index item is a composite of four raw signals, matching the brief:

| Signal    | Weight | What it captures                                              |
|-----------|-------:|-----------------------------------------------------------------|
| Search    |   30%  | Search interest (e.g. Google Trends)                            |
| Social    |   30%  | Hashtags, mentions, engagement (TikTok / Instagram / Pinterest)  |
| Visual    |   30%  | Appearances in street style, runway, celebrity, editorial imagery|
| Commerce  |   10%  | Product searches, sell-outs, resale price movement               |

```
Fashion Trend Score = 0.3·Search + 0.3·Social + 0.3·Visual + 0.1·Commerce
```

The weights live in `src/types.ts` (`SIGNAL_WEIGHTS`) so they're one place
to tune as real data comes in.

## Data layer — currently mocked, built to be swapped

Right now `src/data/mockData.ts` exports a static `FashionIndexData` object
with hand-authored (but internally consistent) sample numbers, plus a
seeded pseudo-random walk generator for the 30-day sparkline history. It
matches the shape the UI actually needs (`src/types.ts`), so wiring in
live data is a matter of replacing the *source* of a `FashionIndexData`
object, not the UI:

1. **Search** — [Google Trends](https://trends.google.com) (the alpha
   Trends API gives normalized daily interest across ~210 US DMAs).
2. **Social** — TikTok/Instagram/Pinterest hashtag volume and engagement
   APIs, or a scraping/ingestion pipeline that rolls up mentions per term.
3. **Visual** — a vision pipeline (e.g. CLIP-style embeddings + a garment/
   color/silhouette classifier) run over street-style, runway, and
   editorial imagery to count appearances per trend/brand/color.
4. **Commerce** — retailer/resale APIs or scraping for sell-through,
   sold-out rates, and resale price deltas.

The plan: build one ingestion job per signal that writes normalized,
per-entity daily scores into a small database, a nightly job that combines
them into the weighted composite + 30-day history, and swap
`mockData.ts` for a fetch against that database. The component layer
(`TrendTable`, `BrandPanel`, `ColorPanel`, `DetailDrawer`) is already
generic over `IndexItem[]` and needs no changes.

## Tech stack

- [Vite](https://vite.dev) + React + TypeScript
- Tailwind CSS v4 (dark, terminal-style theme)
- No chart library — sparklines are hand-drawn inline SVG to keep the
  bundle tiny.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # type-check + production build
npm run lint       # oxlint
```

## Roadmap ideas

- Geographic breakdown per trend (Google Trends DMA-level data supports this).
- Historical index browsing (pick any past week, not just "now").
- A Cultural Index (celebrities, TV/film, music driving adoption).
- A Silhouette Index (shapes: oversized, cropped, wide-leg, etc.).
- Alerts: "notify me when X trend crosses score 70."
