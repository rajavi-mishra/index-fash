/**
 * Google Trends — the canonical search signal.
 *
 * Google's own Trends API is still an application-gated alpha, so this adapter
 * targets SerpAPI's Google Trends endpoint, which is the most reliable paid
 * route today. If you are admitted to the official alpha, swap the URL and the
 * response mapping here; nothing else in the pipeline needs to change.
 *
 * Set GOOGLE_TRENDS_PROVIDER=serpapi and SERPAPI_KEY to enable.
 * Docs: https://serpapi.com/google-trends-api
 */

import type { Point } from "../../../src/lib/scoring";
import { fetchJson } from "../http";

const BASE = "https://serpapi.com/search.json";

interface SerpApiTrendsResponse {
  interest_over_time?: {
    timeline_data?: Array<{
      /** Unix seconds as a string. */
      timestamp?: string;
      values?: Array<{ extracted_value?: number }>;
    }>;
  };
}

export interface TrendsOptions {
  apiKey: string;
  /** Trends date range syntax, e.g. "today 3-m", "today 12-m". */
  dateRange?: string;
  geo?: string;
}

/** Normalized (0-100) search interest over time for one term. */
export async function fetchSearchInterest(
  term: string,
  options: TrendsOptions,
): Promise<Point[]> {
  const { apiKey, dateRange = "today 12-m", geo = "US" } = options;

  const params = new URLSearchParams({
    engine: "google_trends",
    q: term,
    data_type: "TIMESERIES",
    date: dateRange,
    geo,
    api_key: apiKey,
  });

  const data = await fetchJson<SerpApiTrendsResponse>(`${BASE}?${params}`, {
    source: "google-trends",
    headers: { Accept: "application/json" },
  });

  const timeline = data?.interest_over_time?.timeline_data;
  if (!timeline) return [];

  const points: Point[] = [];
  for (const entry of timeline) {
    const value = entry.values?.[0]?.extracted_value;
    if (typeof value !== "number" || !entry.timestamp) continue;
    const date = new Date(Number(entry.timestamp) * 1000);
    if (Number.isNaN(date.getTime())) continue;
    points.push({ date: date.toISOString().slice(0, 10), value });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}
