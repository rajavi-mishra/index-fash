/** Shared shapes for the bag-discovery -> download -> vision-analysis -> aggregate pipeline. */

export interface BagCandidateImage {
  /** Stable id derived from imageUrl (sha1, hex). Used as the cache filename stem. */
  id: string;
  /** The page the image was found embedded on — kept for attribution, never dropped. */
  sourceUrl: string;
  /** Direct URL to the image bytes. */
  imageUrl: string;
  title?: string;
  /** ISO date if the source reported one; undated entries are left out of the trend line. */
  date?: string;
  /** Where this candidate came from, e.g. "serpapi-google-images" or "seed-list". */
  provider: string;
}

export type BrandConfidence = "high" | "medium" | "low" | "unknown";
export type SentimentLabel = "positive" | "neutral" | "negative";

export interface BagAnalysis {
  imageId: string;
  bagDetected: boolean;
  brand: string;
  brandConfidence: BrandConfidence;
  shape: string;
  material: string;
  pattern: string;
  colorway: string;
  weirdness: {
    /** 0 = a plain classic bag, 100 = maximally unconventional. */
    score: number;
    /** Which of shape / pattern / print / fabric / silhouette drove the score. */
    traits: string[];
    reasoning: string;
  };
  sentiment: {
    /** 0-100, same scale as the dashboard's overall Fashion Sentiment score. */
    score: number;
    label: SentimentLabel;
    reasoning: string;
  };
  /** One-line human-readable description of the bag, for display. */
  caption: string;
}

export interface BagReportEntry extends BagCandidateImage {
  analysis: BagAnalysis | null;
  /** Set when download or analysis failed for this candidate; analysis is then null. */
  error?: string;
}

export interface BrandTally {
  brand: string;
  count: number;
  averageWeirdness: number;
}

export interface BagReportSummary {
  subject: string;
  generatedAt: string;
  /** True when this report was built from data/sample-report.json rather than a live run. */
  sample: boolean;
  totalCandidates: number;
  analyzedCount: number;
  brandFrequency: BrandTally[];
  averageWeirdness: number;
  weirdestBags: Array<{
    imageId: string;
    brand: string;
    score: number;
    traits: string[];
    caption: string;
    sourceUrl: string;
  }>;
  /** One point per dated entry, sorted ascending. Undated entries are excluded. */
  sentimentTrend: Array<{ date: string; score: number }>;
  overallSentiment: { score: number; label: SentimentLabel };
  entries: BagReportEntry[];
}
