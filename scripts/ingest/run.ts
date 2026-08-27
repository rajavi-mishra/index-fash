/**
 * Ingestion pipeline entry point.
 *
 * Fans out over the taxonomy, pulls each configured source, scores everything
 * with the same tested math the frontend imports, and writes a dated snapshot
 * to public/index-data.json.
 *
 *   npm run ingest
 *
 * Works with no API keys at all (Wikipedia + GDELT). Adding keys raises the
 * coverage figure the dashboard reports rather than changing how it works.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  composite,
  scoreSeries,
  toSparkline,
  type Point,
  type SignalKey,
  type SignalResult,
} from "../../src/lib/scoring";
import { BRANDS, COLORS, TRENDS, type EntityDef } from "../../src/lib/taxonomy";
import type { Direction, Driver, FashionIndexData, IndexItem, SignalDetail } from "../../src/types";
import { loadEnv } from "./env";
import { buildExplanation } from "./explain";
import { daysAgo, mapWithConcurrency, SourceError } from "./http";
import { appendReading, loadSnapshots, saveSnapshots, type SnapshotStore } from "./snapshots";
import { DEFAULT_ANCHOR, fetchAnchoredInterest } from "./sources/anchoring";
import { fetchCommerceReading, getAccessToken, type EbayCredentials } from "./sources/ebay";
import { fetchNewsVolume } from "./sources/gdelt";
import { fetchSearchInterest } from "./sources/googleTrends";
import { TrendsSession } from "./sources/googleTrendsScrape";
import { fetchPageviews } from "./sources/wikipedia";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUTPUT = resolve(ROOT, "public/index-data.json");
const SNAPSHOT_FILE = resolve(ROOT, "data/commerce-history.json");

/** How far back to pull. Two 30-day windows plus slack for momentum. */
const HISTORY_DAYS = 180;
const CONCURRENCY = 4;

interface Config {
  userAgent: string;
  serpApiKey?: string;
  /** Opt-in to the keyless Trends scraper. Off by default: it's against ToS. */
  scrapeTrends: boolean;
  trendsAnchor: string;
  ebay?: EbayCredentials;
}

function readConfig(): Config {
  const contact = process.env.CONTACT_EMAIL;
  if (!contact) {
    console.warn(
      "! CONTACT_EMAIL is not set. Wikimedia's policy asks for a contact in the User-Agent;\n" +
        "  set it in .env to stay a good citizen of a free API.",
    );
  }

  const ebayId = process.env.EBAY_CLIENT_ID;
  const ebaySecret = process.env.EBAY_CLIENT_SECRET;

  return {
    userAgent: `FashionIndex/0.1 (${contact ?? "https://github.com/rajavi-mishra/index-fash"})`,
    serpApiKey: process.env.SERPAPI_KEY,
    scrapeTrends: process.env.GOOGLE_TRENDS_SCRAPE === "true",
    trendsAnchor: process.env.GOOGLE_TRENDS_ANCHOR || DEFAULT_ANCHOR,
    ebay: ebayId && ebaySecret ? { clientId: ebayId, clientSecret: ebaySecret } : undefined,
  };
}

/**
 * Anchored Trends series keyed by term, fetched in one batched pass before the
 * per-entity work. Batching is required for correctness, not just speed: terms
 * are only comparable when they share a request with the anchor.
 */
async function prefetchScrapedTrends(config: Config): Promise<Map<string, Point[]>> {
  if (!config.scrapeTrends) return new Map();

  const terms = [...TRENDS, ...BRANDS, ...COLORS]
    .map((entity) => entity.trendsTerm)
    .filter((term): term is string => Boolean(term));

  if (terms.length === 0) return new Map();

  console.log(
    `· Google Trends (scraped): ${terms.length} terms, anchored on "${config.trendsAnchor}"`,
  );

  const session = new TrendsSession();
  const result = await safely("google trends scrape", () =>
    fetchAnchoredInterest(terms, session, { anchor: config.trendsAnchor }),
  );

  if (!result || result.size === 0) {
    console.warn("  ~ no Trends data returned; falling back to Wikipedia pageviews");
    return new Map();
  }

  console.log(`  ${result.size}/${terms.length} terms resolved`);
  return result;
}

/** Records which sources actually returned data, for the snapshot's meta block. */
const usedSources = new Set<string>();

async function safely<T>(label: string, task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    const message = error instanceof SourceError ? error.message : String(error);
    console.warn(`  ~ ${label}: ${message}`);
    return null;
  }
}

interface EntitySignals {
  signals: Partial<Record<SignalKey, SignalDetail>>;
  /** Longest available series, used for the sparkline. */
  sparklineSource: Point[] | null;
}

async function collectSignals(
  entity: EntityDef,
  config: Config,
  commerceHistory: SnapshotStore,
  scrapedTrends: Map<string, Point[]>,
): Promise<EntitySignals> {
  const signals: Partial<Record<SignalKey, SignalDetail>> = {};
  let sparklineSource: Point[] | null = null;

  const record = (key: SignalKey, result: SignalResult | null, source: string, series: Point[]) => {
    if (!result) return;
    signals[key] = { score: result.score, momentum: result.momentum, source };
    usedSources.add(source);
    if (!sparklineSource || series.length > sparklineSource.length) {
      sparklineSource = series;
    }
  };

  // --- Search, best available first: paid Trends, scraped Trends, pageviews.
  if (config.serpApiKey && entity.trendsTerm) {
    const series = await safely(`${entity.name} trends`, () =>
      fetchSearchInterest(entity.trendsTerm!, { apiKey: config.serpApiKey! }),
    );
    if (series?.length) record("search", scoreSeries(series), "Google Trends", series);
  }

  if (!signals.search && entity.trendsTerm) {
    const series = scrapedTrends.get(entity.trendsTerm);
    if (series?.length) {
      record("search", scoreSeries(series), "Google Trends (scraped, anchored)", series);
    }
  }

  if (!signals.search && entity.wikipedia) {
    const series = await safely(`${entity.name} wikipedia`, () =>
      fetchPageviews(entity.wikipedia!, daysAgo(HISTORY_DAYS), new Date(), {
        userAgent: config.userAgent,
      }),
    );
    if (series?.length) record("search", scoreSeries(series), "Wikipedia pageviews", series);
  }

  // --- Visual/editorial: news coverage share.
  if (entity.gdeltQuery) {
    const series = await safely(`${entity.name} gdelt`, () => fetchNewsVolume(entity.gdeltQuery!));
    if (series?.length) record("visual", scoreSeries(series), "GDELT news volume", series);
  }

  // --- Commerce: accumulated marketplace snapshots.
  const history = commerceHistory[entity.id];
  if (history && history.length >= 30) {
    record("commerce", scoreSeries(history), "eBay active listings", history);
  }

  return { signals, sparklineSource };
}

async function measureDrivers(entity: EntityDef): Promise<Driver[]> {
  if (!entity.drivers?.length) return [];

  return mapWithConcurrency(entity.drivers, CONCURRENCY, async (driver) => {
    const series = await safely(`${entity.name} / ${driver.name}`, () =>
      fetchNewsVolume(driver.query, { timespan: "6m" }),
    );

    const result = series?.length ? scoreSeries(series) : null;
    const momentum = result?.momentum ?? null;

    return {
      name: driver.name,
      direction: (momentum ?? 0) >= 0 ? "up" : "down",
      momentum,
    } satisfies Driver;
  });
}

async function buildItem(
  entity: EntityDef,
  config: Config,
  commerceHistory: SnapshotStore,
  scrapedTrends: Map<string, Point[]>,
): Promise<IndexItem | null> {
  const { signals, sparklineSource } = await collectSignals(
    entity,
    config,
    commerceHistory,
    scrapedTrends,
  );

  const scores = Object.fromEntries(
    (Object.entries(signals) as [SignalKey, SignalDetail][]).map(([key, detail]) => [
      key,
      detail.score,
    ]),
  ) as Partial<Record<SignalKey, number>>;

  const blended = composite(scores);
  if (!blended) {
    console.warn(`  ~ ${entity.name}: no signal returned data, skipping`);
    return null;
  }

  // Headline 30-day change is the coverage-weighted mean of the signals that
  // actually reported momentum.
  const momenta = (Object.values(signals) as SignalDetail[])
    .map((d) => d.momentum)
    .filter((m): m is number => typeof m === "number");
  const change30d = momenta.length
    ? momenta.reduce((sum, m) => sum + m, 0) / momenta.length
    : 0;

  const drivers = await measureDrivers(entity);

  return {
    id: entity.id,
    name: entity.name,
    category: entity.category,
    score: Math.round(blended.score),
    change30d: Number(change30d.toFixed(1)),
    direction: (change30d >= 0 ? "up" : "down") as Direction,
    signals,
    coverage: blended.coverage,
    drivers,
    history: sparklineSource ? toSparkline(sparklineSource) : [],
    prediction: buildExplanation(entity.name, signals, blended.coverage),
    swatch: entity.swatch,
  };
}

async function updateCommerceHistory(config: Config, store: SnapshotStore): Promise<void> {
  if (!config.ebay) return;

  console.log("· eBay: refreshing commerce snapshot");
  const token = await safely("ebay token", () => getAccessToken(config.ebay!));
  if (!token) return;

  const entities = [...TRENDS, ...BRANDS, ...COLORS].filter((e) => e.ebayQuery);

  await mapWithConcurrency(entities, 2, async (entity) => {
    const reading = await safely(`${entity.name} ebay`, () =>
      fetchCommerceReading(entity.ebayQuery!, token, config.ebay!),
    );
    if (reading) {
      appendReading(store, entity.id, reading.listingCount);
      usedSources.add("eBay active listings");
    }
  });

  await saveSnapshots(SNAPSHOT_FILE, store);
}

async function main(): Promise<void> {
  loadEnv();
  const config = readConfig();

  console.log("Fashion Index ingest");
  const searchSource = config.serpApiKey
    ? "Google Trends (SerpAPI)"
    : config.scrapeTrends
      ? "Google Trends (scraped) -> Wikipedia pageviews"
      : "Wikipedia pageviews";
  console.log(`· search:   ${searchSource}`);
  console.log("· visual:   GDELT news volume");
  console.log(`· commerce: ${config.ebay ? "eBay Browse" : "disabled (no eBay credentials)"}`);
  console.log("· social:   disabled (needs an approved Reddit or social vendor key)\n");

  const commerceHistory = await loadSnapshots(SNAPSHOT_FILE);
  const scrapedTrends = await prefetchScrapedTrends(config);
  await updateCommerceHistory(config, commerceHistory);

  const groups: Array<[keyof Pick<FashionIndexData, "trends" | "brands" | "colors">, EntityDef[]]> = [
    ["trends", TRENDS],
    ["brands", BRANDS],
    ["colors", COLORS],
  ];

  const result: Partial<FashionIndexData> = {};

  for (const [key, entities] of groups) {
    console.log(`· ${key}: ${entities.length} entities`);
    const items = await mapWithConcurrency(entities, CONCURRENCY, (entity) =>
      buildItem(entity, config, commerceHistory, scrapedTrends),
    );
    result[key] = items.filter((item): item is IndexItem => item !== null);
  }

  const all = [...(result.trends ?? []), ...(result.brands ?? []), ...(result.colors ?? [])];
  if (all.length === 0) {
    throw new Error("no entities produced a score — every source failed, refusing to write a snapshot");
  }

  // Overall sentiment is the mean of everything the index tracks.
  const sentimentScore = all.reduce((sum, item) => sum + item.score, 0) / all.length;
  const sentimentChange = all.reduce((sum, item) => sum + item.change30d, 0) / all.length;

  const data: FashionIndexData = {
    sentiment: {
      score: Math.round(sentimentScore),
      change30d: Number(sentimentChange.toFixed(1)),
      direction: sentimentChange >= 0 ? "up" : "down",
      asOf: new Date().toISOString(),
    },
    trends: result.trends ?? [],
    brands: result.brands ?? [],
    colors: result.colors ?? [],
    meta: {
      generatedAt: new Date().toISOString(),
      sources: [...usedSources].sort(),
      sample: false,
    },
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(`\n✓ wrote ${OUTPUT}`);
  console.log(`  ${all.length} entities · sources: ${data.meta.sources.join(", ") || "none"}`);
}

main().catch((error) => {
  console.error(`\n✗ ingest failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
