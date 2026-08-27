import { describe, expect, it } from "vitest";
import {
  batchTerms,
  rebaseToAnchor,
  TARGETS_PER_BATCH,
} from "./anchoring";
import {
  extractTimeseriesWidget,
  parseGuardedJson,
  parseMultiline,
} from "./googleTrendsScrape";
import { momentumPct, type Point } from "../../../src/lib/scoring";

describe("parseGuardedJson", () => {
  it("strips Google's anti-hijacking prefix", () => {
    expect(parseGuardedJson<{ a: number }>(")]}'\n{\"a\":1}")).toEqual({ a: 1 });
  });

  it("handles the variant with a trailing comma and whitespace", () => {
    expect(parseGuardedJson<{ a: number }>(")]}',\n\n  {\"a\":2}")).toEqual({ a: 2 });
  });

  it("parses a plain body with no prefix", () => {
    expect(parseGuardedJson<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("throws a source error rather than a raw SyntaxError on an HTML error page", () => {
    expect(() => parseGuardedJson("<html>429</html>")).toThrow(/no JSON body/);
  });
});

describe("extractTimeseriesWidget", () => {
  it("finds the TIMESERIES widget among several", () => {
    const widget = extractTimeseriesWidget({
      widgets: [
        { id: "RELATED_QUERIES", token: "t1", request: { a: 1 } },
        { id: "TIMESERIES", token: "t2", request: { b: 2 } },
      ],
    });
    expect(widget.token).toBe("t2");
    expect(widget.request).toEqual({ b: 2 });
  });

  it("throws when Trends returns no timeseries widget", () => {
    expect(() => extractTimeseriesWidget({ widgets: [] })).toThrow(/no TIMESERIES widget/);
    expect(() => extractTimeseriesWidget({})).toThrow(/no TIMESERIES widget/);
  });
});

describe("parseMultiline", () => {
  const payload = {
    default: {
      timelineData: [
        { time: "1754006400", value: [10, 40] },
        { time: "1754092800", value: [20, 50] },
        // Trailing partial bucket — must be dropped, or it reads as a crash.
        { time: "1754179200", value: [3, 7], isPartial: true },
      ],
    },
  };

  it("splits one payload into a series per requested term", () => {
    const [a, b] = parseMultiline(payload, 2);
    expect(a.map((p) => p.value)).toEqual([10, 20]);
    expect(b.map((p) => p.value)).toEqual([40, 50]);
  });

  it("drops the partial trailing bucket", () => {
    const [a] = parseMultiline(payload, 2);
    expect(a).toHaveLength(2);
    expect(a.some((p) => p.value === 3)).toBe(false);
  });

  it("converts unix seconds to ISO dates", () => {
    const [a] = parseMultiline(payload, 2);
    expect(a[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns empty series when there is no timeline data", () => {
    expect(parseMultiline({}, 2)).toEqual([[], []]);
  });
});

describe("rebaseToAnchor", () => {
  const dates = ["2026-08-01", "2026-08-02", "2026-08-03"];
  const mk = (values: number[]): Point[] => values.map((value, i) => ({ date: dates[i], value }));

  it("expresses the target in anchor units", () => {
    // Anchor averages 50; a target at 25 is half the anchor -> 50.
    const out = rebaseToAnchor(mk([25, 25, 25]), mk([50, 50, 50]))!;
    expect(out.map((p) => p.value)).toEqual([50, 50, 50]);
  });

  it("returns null when the anchor is unusable, rather than dividing by zero", () => {
    expect(rebaseToAnchor(mk([1, 2, 3]), mk([0, 0, 0]))).toBeNull();
    expect(rebaseToAnchor(mk([1, 2, 3]), [])).toBeNull();
  });

  it("preserves dates", () => {
    const out = rebaseToAnchor(mk([10, 20, 30]), mk([10, 10, 10]))!;
    expect(out.map((p) => p.date)).toEqual(dates);
  });

  /**
   * The property that makes anchoring worth the extra request: two runs whose
   * raw values are on different scales (because Trends renormalised to a
   * different peak) become comparable after rebasing.
   */
  it("makes separately-normalised runs comparable", () => {
    // Same underlying reality, but run B was normalised against a higher peak,
    // so every raw value is 40% of run A's.
    const runA = { target: mk([50, 60, 70]), anchor: mk([100, 100, 100]) };
    const runB = { target: mk([20, 24, 28]), anchor: mk([40, 40, 40]) };

    const a = rebaseToAnchor(runA.target, runA.anchor)!;
    const b = rebaseToAnchor(runB.target, runB.anchor)!;

    expect(a.map((p) => p.value)).toEqual(b.map((p) => p.value));
  });

  /**
   * And the failure it prevents: stitching un-rebased runs together invents
   * momentum that never happened.
   */
  it("prevents phantom momentum from renormalisation", () => {
    const flat = (n: number, value: number, startDay: number): Point[] =>
      Array.from({ length: n }, (_, i) => {
        const d = new Date(Date.UTC(2026, 0, startDay + i));
        return { date: d.toISOString().slice(0, 10), value };
      });

    // Reality is flat. Run A reported it as 50, run B renormalised it to 20.
    const rawStitched = [...flat(30, 50, 1), ...flat(30, 20, 31)];
    expect(momentumPct(rawStitched, 30)).toBeCloseTo(-60, 6); // phantom crash

    const rebasedStitched = [
      ...rebaseToAnchor(flat(30, 50, 1), flat(30, 100, 1))!,
      ...rebaseToAnchor(flat(30, 20, 31), flat(30, 40, 31))!,
    ];
    expect(momentumPct(rebasedStitched, 30)).toBeCloseTo(0, 6); // correctly flat
  });
});

describe("batchTerms", () => {
  it("leaves room for the anchor in every batch", () => {
    const batches = batchTerms(["a", "b", "c", "d", "e", "f"]);
    expect(batches).toEqual([["a", "b", "c", "d"], ["e", "f"]]);
    for (const batch of batches) {
      expect(batch.length + 1).toBeLessThanOrEqual(5);
    }
  });

  it("handles empty and exact-fit inputs", () => {
    expect(batchTerms([])).toEqual([]);
    expect(batchTerms(["a", "b", "c", "d"])).toEqual([["a", "b", "c", "d"]]);
    expect(TARGETS_PER_BATCH).toBe(4);
  });
});
