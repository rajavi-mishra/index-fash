import { describe, expect, it } from "vitest";
import {
  composite,
  levelScore,
  logistic,
  mean,
  momentumPct,
  scoreSeries,
  stdev,
  toSparkline,
  type Point,
} from "./scoring";

/** Builds a series of `n` daily points ending today, from a value function. */
function series(n: number, valueAt: (i: number) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 0, 1));
    d.setUTCDate(d.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), value: valueAt(i) });
  }
  return out;
}

describe("basic statistics", () => {
  it("computes mean and sample standard deviation", () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdev([5])).toBe(0);
  });

  it("maps logistic to (0,1) around 0.5", () => {
    expect(logistic(0)).toBe(0.5);
    expect(logistic(100)).toBeGreaterThan(0.99);
    expect(logistic(-100)).toBeLessThan(0.01);
  });
});

describe("momentumPct", () => {
  it("returns null without two full windows of history", () => {
    expect(momentumPct(series(59, () => 10), 30)).toBeNull();
    expect(momentumPct(series(60, () => 10), 30)).not.toBeNull();
  });

  it("reports zero change for a flat series", () => {
    expect(momentumPct(series(60, () => 10), 30)).toBeCloseTo(0, 6);
  });

  it("reports a clean doubling as +100%", () => {
    // First 30 days at 10, next 30 at 20.
    const s = series(60, (i) => (i < 30 ? 10 : 20));
    expect(momentumPct(s, 30)).toBeCloseTo(100, 6);
  });

  it("reports a halving as -50%", () => {
    const s = series(60, (i) => (i < 30 ? 20 : 10));
    expect(momentumPct(s, 30)).toBeCloseTo(-50, 6);
  });

  it("is order-independent (sorts by date)", () => {
    const s = series(60, (i) => (i < 30 ? 10 : 20));
    const shuffled = [...s].reverse();
    expect(momentumPct(shuffled, 30)).toBeCloseTo(100, 6);
  });

  it("returns null when the prior window is zero but the recent one is not", () => {
    const s = series(60, (i) => (i < 30 ? 0 : 5));
    expect(momentumPct(s, 30)).toBeNull();
  });

  it("returns 0 when both windows are zero", () => {
    expect(momentumPct(series(60, () => 0), 30)).toBe(0);
  });
});

describe("levelScore", () => {
  it("returns null without a full window", () => {
    expect(levelScore(series(29, () => 10), 30)).toBeNull();
  });

  it("returns the neutral midpoint for a flat series", () => {
    expect(levelScore(series(60, () => 10), 30)).toBe(50);
  });

  it("scores a rising series above the midpoint and a falling one below", () => {
    const rising = levelScore(series(90, (i) => i), 30)!;
    const falling = levelScore(series(90, (i) => 90 - i), 30)!;
    expect(rising).toBeGreaterThan(50);
    expect(falling).toBeLessThan(50);
  });

  it("is scale-invariant, so a big brand does not outrank a small one on volume alone", () => {
    const small = levelScore(series(90, (i) => i), 30)!;
    const large = levelScore(
      series(90, (i) => i * 1000),
      30,
    )!;
    expect(large).toBeCloseTo(small, 9);
  });
});

describe("scoreSeries", () => {
  it("returns null when there is not even one window", () => {
    expect(scoreSeries(series(10, () => 5), 30)).toBeNull();
  });

  it("reports level only when momentum is unavailable", () => {
    const result = scoreSeries(series(30, () => 10), 30)!;
    expect(result.momentum).toBeNull();
    expect(result.score).toBe(50);
  });

  it("scores an accelerating series higher than a decaying one", () => {
    const up = scoreSeries(series(90, (i) => i), 30)!;
    const down = scoreSeries(series(90, (i) => 90 - i), 30)!;
    expect(up.score).toBeGreaterThan(down.score);
    expect(up.momentum!).toBeGreaterThan(0);
    expect(down.momentum!).toBeLessThan(0);
  });

  it("keeps scores inside 0-100 for extreme inputs", () => {
    const explosive = scoreSeries(
      series(90, (i) => (i < 60 ? 1 : 1_000_000)),
      30,
    )!;
    expect(explosive.score).toBeGreaterThanOrEqual(0);
    expect(explosive.score).toBeLessThanOrEqual(100);
  });
});

describe("composite", () => {
  it("returns null when no signal has data", () => {
    expect(composite({})).toBeNull();
    expect(composite({ search: Number.NaN })).toBeNull();
  });

  it("weights signals per the 30/30/30/10 model at full coverage", () => {
    const result = composite({ search: 100, social: 0, visual: 0, commerce: 0 })!;
    expect(result.coverage).toBeCloseTo(1, 9);
    expect(result.score).toBeCloseTo(30, 9);
  });

  it("renormalises weights over available signals rather than treating gaps as zero", () => {
    // Only search present. Naively weighting would give 0.3*80 = 24; the
    // renormalised answer is the signal itself.
    const result = composite({ search: 80 })!;
    expect(result.score).toBeCloseTo(80, 9);
    expect(result.coverage).toBeCloseTo(0.3, 9);
    expect(result.contributing).toEqual(["search"]);
  });

  it("reports partial coverage across two signals", () => {
    const result = composite({ search: 60, social: 80 })!;
    // Equal 0.3 weights -> simple average.
    expect(result.score).toBeCloseTo(70, 9);
    expect(result.coverage).toBeCloseTo(0.6, 9);
    expect(result.contributing).toEqual(["search", "social"]);
  });

  it("gives commerce its smaller share of the blend", () => {
    const result = composite({ search: 0, commerce: 100 })!;
    // weights 0.3 and 0.1 -> 100 * 0.1/0.4 = 25
    expect(result.score).toBeCloseTo(25, 9);
    expect(result.coverage).toBeCloseTo(0.4, 9);
  });
});

describe("toSparkline", () => {
  it("passes short series through unchanged", () => {
    expect(toSparkline(series(5, (i) => i), 30)).toEqual([0, 1, 2, 3, 4]);
  });

  it("downsamples to the requested length keeping first and last values", () => {
    const out = toSparkline(series(365, (i) => i), 30);
    expect(out).toHaveLength(30);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(364);
  });
});
