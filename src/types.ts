import type { SignalKey } from "./lib/scoring";
import type { IndexCategory } from "./lib/taxonomy";

export type { SignalKey, IndexCategory };
export { SIGNAL_WEIGHTS } from "./lib/scoring";

export type Direction = "up" | "down";

/** One signal's contribution to an entity's score, with provenance. */
export interface SignalDetail {
  /** 0-100 score derived from this source alone. */
  score: number;
  /** 30-day percent change, or null when history is too short. */
  momentum: number | null;
  /** Human-readable data source, shown in the UI so numbers are auditable. */
  source: string;
}

export interface Driver {
  name: string;
  direction: Direction;
  /** 30-day percent change behind the arrow, when measured. */
  momentum?: number | null;
}

export interface IndexItem {
  id: string;
  name: string;
  category: IndexCategory;
  score: number;
  change30d: number;
  direction: Direction;
  /** Only the signals that actually had data. */
  signals: Partial<Record<SignalKey, SignalDetail>>;
  /** Weighted share of the 30/30/30/10 model backed by real data, 0-1. */
  coverage: number;
  drivers: Driver[];
  history: number[];
  /** Factual summary generated from the signal moves above. */
  prediction: string;
  swatch?: string;
}

export interface SentimentSnapshot {
  score: number;
  change30d: number;
  direction: Direction;
  asOf: string;
}

export interface FashionIndexData {
  sentiment: SentimentSnapshot;
  trends: IndexItem[];
  brands: IndexItem[];
  colors: IndexItem[];
  /** Provenance for the whole snapshot. */
  meta: {
    generatedAt: string;
    /** Sources that contributed to this run. */
    sources: string[];
    /** True when this is illustrative sample data rather than a live pull. */
    sample: boolean;
  };
}
