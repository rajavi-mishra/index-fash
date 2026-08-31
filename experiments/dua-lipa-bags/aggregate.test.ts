import { describe, expect, it } from "vitest";
import { buildReport } from "./aggregate";
import type { BagAnalysis, BagReportEntry } from "./types";

function analysis(overrides: Partial<BagAnalysis> = {}): BagAnalysis {
  return {
    imageId: "x",
    bagDetected: true,
    brand: "Coach",
    brandConfidence: "medium",
    shape: "top-handle",
    material: "leather",
    pattern: "solid",
    colorway: "black",
    weirdness: { score: 20, traits: [], reasoning: "" },
    sentiment: { score: 70, label: "positive", reasoning: "" },
    caption: "a black leather bag",
    ...overrides,
  };
}

function entry(id: string, overrides: Partial<BagReportEntry> = {}): BagReportEntry {
  return {
    id,
    sourceUrl: `https://example.com/${id}`,
    imageUrl: `https://example.com/${id}.jpg`,
    provider: "seed-list",
    analysis: analysis({ imageId: id }),
    ...overrides,
  };
}

describe("buildReport", () => {
  it("counts only entries where a bag was actually detected", () => {
    const entries = [
      entry("a"),
      entry("b", { analysis: analysis({ imageId: "b", bagDetected: false }) }),
      entry("c", { analysis: null, error: "download failed" }),
    ];

    const report = buildReport("Test Subject", entries);
    expect(report.totalCandidates).toBe(3);
    expect(report.analyzedCount).toBe(1);
  });

  it("tallies brand frequency and per-brand average weirdness", () => {
    const entries = [
      entry("a", { analysis: analysis({ imageId: "a", brand: "Coach", weirdness: { score: 10, traits: [], reasoning: "" } }) }),
      entry("b", { analysis: analysis({ imageId: "b", brand: "Coach", weirdness: { score: 30, traits: [], reasoning: "" } }) }),
      entry("c", { analysis: analysis({ imageId: "c", brand: "Jacquemus", weirdness: { score: 90, traits: [], reasoning: "" } }) }),
    ];

    const report = buildReport("Test Subject", entries);
    expect(report.brandFrequency).toEqual([
      { brand: "Coach", count: 2, averageWeirdness: 20 },
      { brand: "Jacquemus", count: 1, averageWeirdness: 90 },
    ]);
  });

  it("ranks the weirdest bags highest score first, capped at 5", () => {
    const entries = Array.from({ length: 7 }, (_, i) =>
      entry(`img${i}`, {
        analysis: analysis({ imageId: `img${i}`, weirdness: { score: i * 10, traits: [], reasoning: "" } }),
      }),
    );

    const report = buildReport("Test Subject", entries);
    expect(report.weirdestBags).toHaveLength(5);
    expect(report.weirdestBags[0].score).toBe(60);
    expect(report.weirdestBags.map((b) => b.score)).toEqual([60, 50, 40, 30, 20]);
  });

  it("builds a sentiment trend only from dated entries, sorted ascending", () => {
    const entries = [
      entry("a", { date: "2026-03-01", analysis: analysis({ imageId: "a", sentiment: { score: 40, label: "negative", reasoning: "" } }) }),
      entry("b", { analysis: analysis({ imageId: "b" }) }), // no date, excluded
      entry("c", { date: "2026-01-15", analysis: analysis({ imageId: "c", sentiment: { score: 80, label: "positive", reasoning: "" } }) }),
    ];

    const report = buildReport("Test Subject", entries);
    expect(report.sentimentTrend).toEqual([
      { date: "2026-01-15", score: 80 },
      { date: "2026-03-01", score: 40 },
    ]);
  });

  it("falls back to a neutral 50 overall sentiment when nothing was analyzed", () => {
    const report = buildReport("Test Subject", [entry("a", { analysis: null, error: "failed" })]);
    expect(report.overallSentiment).toEqual({ score: 50, label: "neutral" });
  });

  it("labels overall sentiment positive, neutral, or negative from the averaged score", () => {
    const positive = buildReport("s", [entry("a", { analysis: analysis({ imageId: "a", sentiment: { score: 85, label: "positive", reasoning: "" } }) })]);
    const negative = buildReport("s", [entry("a", { analysis: analysis({ imageId: "a", sentiment: { score: 15, label: "negative", reasoning: "" } }) })]);
    const neutral = buildReport("s", [entry("a", { analysis: analysis({ imageId: "a", sentiment: { score: 50, label: "neutral", reasoning: "" } }) })]);

    expect(positive.overallSentiment.label).toBe("positive");
    expect(negative.overallSentiment.label).toBe("negative");
    expect(neutral.overallSentiment.label).toBe("neutral");
  });
});
