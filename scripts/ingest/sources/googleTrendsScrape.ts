/**
 * Google Trends via its own unofficial web endpoints — no API key.
 *
 * This is the same two-hop flow the trends.google.com UI uses:
 *
 *   1. GET /trends/api/explore        -> returns widget descriptors + tokens
 *   2. GET /trends/api/widgetdata/multiline?token=...  -> returns the series
 *
 * Both responses are prefixed with an anti-JSON-hijacking guard, `)]}',\n`,
 * which has to be stripped before parsing.
 *
 * Two things to know before enabling this:
 *
 * - It is against Google's Terms of Service. It is widely done and the data is
 *   public, but it is not a contractual right: expect no SLA, and don't build a
 *   paid product's critical path on it without accepting that risk. SerpAPI
 *   exists precisely to absorb that liability. Off by default; opt in with
 *   GOOGLE_TRENDS_SCRAPE=true.
 *
 * - Trends rate-limits aggressively (HTTP 429) once you go beyond a trickle.
 *   This adapter serialises requests and backs off, but a real workload needs a
 *   proxy pool. The pipeline degrades to Wikipedia pageviews rather than
 *   failing when it gets throttled.
 *
 * The sampling and normalisation caveats — which matter more than the scraping
 * question for building an index — are handled in anchoring.ts.
 */

import type { Point } from "../../../src/lib/scoring";
import { SourceError } from "../http";

const BASE = "https://trends.google.com/trends/api";
const HOME = "https://trends.google.com/trends/explore";

/** Google's anti-hijacking prefix on these endpoints. */
const JSON_PREFIX = ")]}'";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface TrendsScrapeOptions {
  /** Trends date-range syntax, e.g. "today 12-m". */
  dateRange?: string;
  geo?: string;
  /** Milliseconds to wait between requests. Trends throttles fast. */
  throttleMs?: number;
}

/** Strips the `)]}'` guard and parses. */
export function parseGuardedJson<T>(body: string): T {
  const start = body.indexOf(JSON_PREFIX);
  const payload = start === -1 ? body : body.slice(start + JSON_PREFIX.length);
  const brace = payload.search(/[{[]/);
  if (brace === -1) {
    throw new SourceError("google-trends-scrape", "response contained no JSON body");
  }
  return JSON.parse(payload.slice(brace)) as T;
}

interface ExploreResponse {
  widgets?: Array<{
    id?: string;
    token?: string;
    request?: unknown;
  }>;
}

interface MultilineResponse {
  default?: {
    timelineData?: Array<{
      /** Unix seconds as a string. */
      time?: string;
      value?: number[];
      /** Present and false for the trailing partial bucket. */
      hasData?: boolean[];
      isPartial?: boolean;
    }>;
  };
}

/** Holds the consent/NID cookie Trends hands out on first contact. */
export class TrendsSession {
  private cookie = "";
  private lastRequestAt = 0;
  private readonly throttleMs: number;

  constructor(throttleMs = 1500) {
    this.throttleMs = throttleMs;
  }

  private async pace(): Promise<void> {
    const wait = this.throttleMs - (Date.now() - this.lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequestAt = Date.now();
  }

  private headers(): Record<string, string> {
    return {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "application/json, text/plain, */*",
      Referer: HOME,
      ...(this.cookie ? { Cookie: this.cookie } : {}),
    };
  }

  /** Picks up the cookie Trends sets before the first API call. */
  async warmUp(): Promise<void> {
    if (this.cookie) return;
    await this.pace();

    const response = await fetch(HOME, { headers: this.headers(), redirect: "follow" });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    const jar = setCookie
      .map((entry) => entry.split(";")[0])
      .filter((entry) => /^(NID|AEC|SOCS|CONSENT)=/.test(entry));

    if (jar.length > 0) this.cookie = jar.join("; ");
  }

  /** GET with pacing and one retry on 429. */
  async get(url: string, retries = 2): Promise<string> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      await this.pace();
      const response = await fetch(url, { headers: this.headers() });

      if (response.status === 429) {
        if (attempt === retries) {
          throw new SourceError(
            "google-trends-scrape",
            "rate limited (HTTP 429) — Trends is throttling this IP; falling back",
          );
        }
        await new Promise((r) => setTimeout(r, 2 ** (attempt + 2) * 1000));
        continue;
      }

      if (!response.ok) {
        throw new SourceError("google-trends-scrape", `HTTP ${response.status}`);
      }

      return await response.text();
    }

    throw new SourceError("google-trends-scrape", "exhausted retries");
  }
}

/** Extracts the TIMESERIES widget's token and request payload. */
export function extractTimeseriesWidget(explore: ExploreResponse): { token: string; request: unknown } {
  const widget = explore.widgets?.find((w) => w.id === "TIMESERIES");
  if (!widget?.token || widget.request === undefined) {
    throw new SourceError("google-trends-scrape", "no TIMESERIES widget in explore response");
  }
  return { token: widget.token, request: widget.request };
}

/**
 * Converts a multiline payload into one series per requested term.
 * Drops the trailing partial bucket, which Trends marks `isPartial` and which
 * otherwise reads as a sudden collapse in interest.
 */
export function parseMultiline(payload: MultilineResponse, termCount: number): Point[][] {
  const rows = payload.default?.timelineData ?? [];
  const out: Point[][] = Array.from({ length: termCount }, () => []);

  for (const row of rows) {
    if (row.isPartial) continue;
    if (!row.time || !Array.isArray(row.value)) continue;

    const date = new Date(Number(row.time) * 1000);
    if (Number.isNaN(date.getTime())) continue;
    const iso = date.toISOString().slice(0, 10);

    for (let i = 0; i < termCount; i++) {
      const value = row.value[i];
      if (typeof value !== "number") continue;
      out[i].push({ date: iso, value });
    }
  }

  return out;
}

/**
 * Fetches interest-over-time for up to 5 terms in ONE request.
 *
 * Requesting terms together is not just an optimisation — it is what makes
 * their values comparable, because Trends normalises across the whole
 * comparison. See anchoring.ts.
 */
export async function fetchComparison(
  terms: string[],
  session: TrendsSession,
  options: TrendsScrapeOptions = {},
): Promise<Point[][]> {
  if (terms.length === 0) return [];
  if (terms.length > 5) {
    throw new SourceError("google-trends-scrape", "Trends compares at most 5 terms per request");
  }

  const { dateRange = "today 12-m", geo = "US" } = options;

  await session.warmUp();

  const exploreReq = {
    comparisonItem: terms.map((term) => ({ keyword: term, geo, time: dateRange })),
    category: 0,
    property: "",
  };

  const exploreUrl =
    `${BASE}/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(exploreReq))}`;

  const explore = parseGuardedJson<ExploreResponse>(await session.get(exploreUrl));
  const { token, request } = extractTimeseriesWidget(explore);

  const dataUrl =
    `${BASE}/widgetdata/multiline?hl=en-US&tz=0` +
    `&req=${encodeURIComponent(JSON.stringify(request))}` +
    `&token=${encodeURIComponent(token)}`;

  const payload = parseGuardedJson<MultilineResponse>(await session.get(dataUrl));
  return parseMultiline(payload, terms.length);
}
