/**
 * GDELT DOC 2.0 API — free, no API key.
 *
 * Indexes worldwide online news in near real time. The `timelinevol` mode
 * returns the share of global coverage matching a query over time, which is a
 * usable stand-in for the "visual / editorial" signal: it captures when a trend
 * is actually appearing in fashion press, runway coverage, and celebrity
 * reporting, as opposed to only being searched for.
 *
 * Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
 */

import type { Point } from "../../../src/lib/scoring";
import { fetchJson } from "../http";

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

interface TimelineResponse {
  timeline?: Array<{
    series?: string;
    data?: Array<{
      /** e.g. 20260801T000000Z */
      date: string;
      value: number;
    }>;
  }>;
}

export interface GdeltOptions {
  /** How far back to look, in GDELT timespan syntax. */
  timespan?: string;
}

/** Daily share-of-coverage for a query. Empty series when GDELT knows nothing. */
export async function fetchNewsVolume(
  query: string,
  options: GdeltOptions = {},
): Promise<Point[]> {
  const { timespan = "6m" } = options;

  const params = new URLSearchParams({
    query,
    mode: "timelinevol",
    format: "json",
    timespan,
  });

  const data = await fetchJson<TimelineResponse>(`${BASE}?${params}`, {
    source: "gdelt",
    // GDELT rejects requests without a browser-like agent.
    headers: { "User-Agent": "FashionIndex/0.1", Accept: "application/json" },
  });

  const points = data?.timeline?.[0]?.data;
  if (!points) return [];

  // GDELT reports sub-daily buckets over long spans; fold them into daily means.
  const byDay = new Map<string, { sum: number; count: number }>();
  for (const point of points) {
    const day = `${point.date.slice(0, 4)}-${point.date.slice(4, 6)}-${point.date.slice(6, 8)}`;
    const bucket = byDay.get(day) ?? { sum: 0, count: 0 };
    bucket.sum += point.value;
    bucket.count += 1;
    byDay.set(day, bucket);
  }

  return [...byDay.entries()]
    .map(([date, { sum, count }]) => ({ date, value: sum / count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
