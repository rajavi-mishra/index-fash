/**
 * Pure scoring math for The Fashion Index.
 *
 * Shared by the ingestion pipeline (Node) and the frontend (browser), so the
 * numbers on screen are produced by exactly the code that is unit-tested here.
 *
 * Every raw source (Wikipedia pageviews, GDELT news volume, Google Trends,
 * eBay listing counts) arrives on a different scale. The job of this module is
 * to turn each into a comparable 0-100 score plus a 30-day momentum figure.
 */

export interface Point {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  value: number;
}

export type SignalKey = "search" | "social" | "visual" | "commerce";

/** Relative weight of each raw signal in the composite Fashion Trend Score. */
export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  search: 0.3,
  social: 0.3,
  visual: 0.3,
  commerce: 0.1,
};

export const DEFAULT_WINDOW = 30;

/** Blend of level (where it stands) vs momentum (where it's going) in a signal score. */
const LEVEL_WEIGHT = 0.6;
const MOMENTUM_WEIGHT = 0.4;

/**
 * Momentum of this many percent maps to ~73 on the 0-100 momentum scale.
 * Fashion signals are noisy; this keeps ordinary week-to-week wobble in the
 * middle of the range and reserves the extremes for genuine breakouts.
 */
const MOMENTUM_SCALE = 15;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let total = 0;
  for (const v of values) total += v;
  return total / values.length;
}

export function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mu = mean(values);
  let sum = 0;
  for (const v of values) sum += (v - mu) ** 2;
  return Math.sqrt(sum / (values.length - 1));
}

/** Maps any real number to (0, 1). */
export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function sortedValues(series: Point[]): number[] {
  return [...series]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => p.value);
}

/**
 * Percent change between the mean of the trailing `window` days and the mean of
 * the `window` days before that. Returns null when there isn't enough history
 * for both windows, so callers can distinguish "flat" from "unknown".
 */
export function momentumPct(series: Point[], window = DEFAULT_WINDOW): number | null {
  const values = sortedValues(series);
  if (values.length < window * 2) return null;

  const recent = mean(values.slice(-window));
  const prior = mean(values.slice(-window * 2, -window));

  // A prior window of zero has no meaningful percentage change.
  if (prior === 0) return recent === 0 ? 0 : null;

  return ((recent - prior) / prior) * 100;
}

/**
 * Where the trailing window sits relative to the entity's own history,
 * expressed 0-100. Uses a z-score so a brand with huge absolute traffic isn't
 * automatically scored above a small one — this measures "unusually high *for
 * itself*", which is what makes indices comparable across entities.
 */
export function levelScore(series: Point[], window = DEFAULT_WINDOW): number | null {
  const values = sortedValues(series);
  if (values.length < window) return null;

  const recent = mean(values.slice(-window));
  const sd = stdev(values);

  // A perfectly flat series carries no information about standing.
  if (sd === 0) return 50;

  const z = (recent - mean(values)) / sd;
  return logistic(z) * 100;
}

export interface SignalResult {
  /** 0-100 blend of level and momentum. */
  score: number;
  /** Percent change vs the previous window, or null if history is too short. */
  momentum: number | null;
}

/**
 * Turns one source's raw series into a 0-100 score plus momentum.
 * Returns null when the series is too short to say anything honest.
 */
export function scoreSeries(series: Point[], window = DEFAULT_WINDOW): SignalResult | null {
  const level = levelScore(series, window);
  if (level === null) return null;

  const momentum = momentumPct(series, window);

  // Without a prior window we can only speak to level.
  if (momentum === null) {
    return { score: clamp(level), momentum: null };
  }

  const momentumScore = logistic(momentum / MOMENTUM_SCALE) * 100;
  const score = LEVEL_WEIGHT * level + MOMENTUM_WEIGHT * momentumScore;

  return { score: clamp(score), momentum };
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export interface CompositeResult {
  score: number;
  /** Weighted share of the model actually backed by data, 0-1. */
  coverage: number;
  /** Signals that contributed. */
  contributing: SignalKey[];
}

/**
 * Weighted composite across signals.
 *
 * Only some signals are available for a given entity (visual imagery and
 * commerce feeds in particular need paid or self-hosted pipelines). Rather than
 * silently treating a missing signal as zero — which would drag every score
 * toward the floor and make the index meaningless — weights are renormalised
 * over the signals actually present, and `coverage` reports how much of the
 * intended model that represents so the UI can disclose it.
 */
export function composite(
  signals: Partial<Record<SignalKey, number>>,
  weights: Record<SignalKey, number> = SIGNAL_WEIGHTS,
): CompositeResult | null {
  const contributing = (Object.keys(weights) as SignalKey[]).filter(
    (key) => typeof signals[key] === "number" && Number.isFinite(signals[key]),
  );

  if (contributing.length === 0) return null;

  let weightSum = 0;
  let weighted = 0;
  for (const key of contributing) {
    weightSum += weights[key];
    weighted += weights[key] * (signals[key] as number);
  }

  if (weightSum === 0) return null;

  const totalWeight = (Object.keys(weights) as SignalKey[]).reduce((sum, k) => sum + weights[k], 0);

  return {
    score: clamp(weighted / weightSum),
    coverage: weightSum / totalWeight,
    contributing,
  };
}

/**
 * Downsamples a series to at most `points` values for sparkline rendering,
 * always keeping the most recent value so the chart ends where the score does.
 */
export function toSparkline(series: Point[], points = 30): number[] {
  const values = sortedValues(series);
  if (values.length <= points) return values;

  const step = (values.length - 1) / (points - 1);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    out.push(values[Math.round(i * step)]);
  }
  return out;
}
