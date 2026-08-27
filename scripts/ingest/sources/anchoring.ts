/**
 * Making Google Trends numbers mean something across runs.
 *
 * Two properties of Trends break naive longitudinal use, and they bite whether
 * you scrape it or pay SerpAPI — this is a property of the data, not the
 * transport:
 *
 * 1. RELATIVE NORMALISATION. Every response is scaled so the peak of *that
 *    request* equals 100. "Boho = 80" does not mean 80 of anything; it means
 *    80% of boho's own peak within the window you asked for. Change the window
 *    and every number changes. Two entities fetched in separate requests are on
 *    different scales and cannot be compared or ranked against each other.
 *
 * 2. RANDOM SAMPLING. Trends computes from a sample of searches, redrawn per
 *    query. The identical request on two days returns different numbers.
 *    Research on this ("Addressing Google Trends inconsistencies",
 *    Technological Forecasting & Social Change, 2024) finds the noise is
 *    material at daily granularity and shrinks at weekly.
 *
 * The standard fix, from Eichenauer et al., "Obtaining consistent time series
 * from Google Trends" (Economic Inquiry, 2022): put a fixed ANCHOR term in
 * every request. Because normalisation happens across the whole comparison,
 * co-requested terms share one scale. Dividing by the anchor's own level
 * converts each series into anchor units — stable across runs, windows, and
 * batches, because the anchor's real-world search volume is roughly constant.
 *
 * Trends allows 5 terms per request, so each batch carries 1 anchor + 4 targets.
 */

import type { Point } from "../../../src/lib/scoring";
import { mean } from "../../../src/lib/scoring";
import { fetchComparison, type TrendsScrapeOptions, type TrendsSession } from "./googleTrendsScrape";

/**
 * A high, steady-volume term unrelated to any tracked entity, so its own
 * seasonality doesn't leak into the index. Kept deliberately generic.
 */
export const DEFAULT_ANCHOR = "weather";

export const MAX_TERMS_PER_REQUEST = 5;
export const TARGETS_PER_BATCH = MAX_TERMS_PER_REQUEST - 1;

/**
 * Rescales a target series into anchor units: 100 means "as much search
 * interest as the anchor averaged over this window".
 *
 * Returns null when the anchor came back flat at zero, which means the batch
 * carries no usable scale — better to drop it than to emit fabricated numbers.
 */
export function rebaseToAnchor(target: Point[], anchor: Point[]): Point[] | null {
  const anchorLevel = mean(anchor.map((p) => p.value));
  if (!Number.isFinite(anchorLevel) || anchorLevel <= 0) return null;

  return target.map((point) => ({
    date: point.date,
    value: (point.value / anchorLevel) * 100,
  }));
}

/** Splits terms into batches that each leave room for the anchor. */
export function batchTerms<T>(terms: T[], size = TARGETS_PER_BATCH): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < terms.length; i += size) {
    batches.push(terms.slice(i, i + size));
  }
  return batches;
}

export interface AnchoredOptions extends TrendsScrapeOptions {
  anchor?: string;
}

/**
 * Fetches anchored search interest for many terms, batching automatically.
 *
 * The returned map is keyed by term. A term is absent when its batch failed or
 * the anchor was unusable — callers treat that as "not measured", which lowers
 * reported coverage rather than inventing a score.
 */
export async function fetchAnchoredInterest(
  terms: string[],
  session: TrendsSession,
  options: AnchoredOptions = {},
): Promise<Map<string, Point[]>> {
  const { anchor = DEFAULT_ANCHOR, ...scrapeOptions } = options;
  const results = new Map<string, Point[]>();

  for (const batch of batchTerms(terms)) {
    // Anchor first so its index is predictable.
    const series = await fetchComparison([anchor, ...batch], session, scrapeOptions);
    const anchorSeries = series[0];
    if (!anchorSeries?.length) continue;

    batch.forEach((term, i) => {
      const targetSeries = series[i + 1];
      if (!targetSeries?.length) return;

      const rebased = rebaseToAnchor(targetSeries, anchorSeries);
      if (rebased) results.set(term, rebased);
    });
  }

  return results;
}
