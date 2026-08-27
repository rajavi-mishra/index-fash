export type Direction = "up" | "down";

/** Weighted contribution of each raw signal to a composite score, in percentage-point change. */
export interface SourceBreakdown {
  search: number;
  social: number;
  visual: number;
  commerce: number;
}

export interface Driver {
  name: string;
  direction: Direction;
}

export type IndexCategory = "trend" | "brand" | "color";

export interface IndexItem {
  id: string;
  name: string;
  category: IndexCategory;
  score: number;
  change30d: number;
  direction: Direction;
  breakdown: SourceBreakdown;
  drivers: Driver[];
  history: number[];
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
}

/** Relative weight of each raw signal in the composite Fashion Trend Score. */
export const SIGNAL_WEIGHTS: Record<keyof SourceBreakdown, number> = {
  search: 0.3,
  social: 0.3,
  visual: 0.3,
  commerce: 0.1,
};
