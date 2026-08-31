/** Pure aggregation from per-image entries to the report summary. No I/O. */

import type { BagReportEntry, BagReportSummary, BrandTally, SentimentLabel } from "./types";

function labelFor(score: number): SentimentLabel {
  if (score >= 60) return "positive";
  if (score <= 40) return "negative";
  return "neutral";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildReport(
  subject: string,
  entries: BagReportEntry[],
  options: { sample?: boolean; generatedAt?: string } = {},
): BagReportSummary {
  const analyzed = entries.filter(
    (e): e is BagReportEntry & { analysis: NonNullable<BagReportEntry["analysis"]> } =>
      e.analysis !== null && e.analysis.bagDetected,
  );

  const brandTotals = new Map<string, { count: number; weirdnessSum: number }>();
  for (const e of analyzed) {
    const brand = e.analysis.brand || "unknown";
    const bucket = brandTotals.get(brand) ?? { count: 0, weirdnessSum: 0 };
    bucket.count += 1;
    bucket.weirdnessSum += e.analysis.weirdness.score;
    brandTotals.set(brand, bucket);
  }

  const brandFrequency: BrandTally[] = [...brandTotals.entries()]
    .map(([brand, { count, weirdnessSum }]) => ({
      brand,
      count,
      averageWeirdness: round1(weirdnessSum / count),
    }))
    .sort((a, b) => b.count - a.count);

  const averageWeirdness = analyzed.length
    ? round1(analyzed.reduce((sum, e) => sum + e.analysis.weirdness.score, 0) / analyzed.length)
    : 0;

  const weirdestBags = [...analyzed]
    .sort((a, b) => b.analysis.weirdness.score - a.analysis.weirdness.score)
    .slice(0, 5)
    .map((e) => ({
      imageId: e.id,
      brand: e.analysis.brand,
      score: e.analysis.weirdness.score,
      traits: e.analysis.weirdness.traits,
      caption: e.analysis.caption,
      sourceUrl: e.sourceUrl,
    }));

  const sentimentTrend = analyzed
    .filter((e) => e.date)
    .map((e) => ({ date: e.date as string, score: e.analysis.sentiment.score }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const overallSentimentScore = analyzed.length
    ? round1(analyzed.reduce((sum, e) => sum + e.analysis.sentiment.score, 0) / analyzed.length)
    : 50;

  return {
    subject,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sample: options.sample ?? false,
    totalCandidates: entries.length,
    analyzedCount: analyzed.length,
    brandFrequency,
    averageWeirdness,
    weirdestBags,
    sentimentTrend,
    overallSentiment: { score: overallSentimentScore, label: labelFor(overallSentimentScore) },
    entries,
  };
}
