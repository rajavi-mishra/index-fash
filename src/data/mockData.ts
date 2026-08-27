/**
 * Illustrative sample data, used only as a fallback when no live snapshot has
 * been generated yet (`npm run ingest` writes the real one to
 * public/index-data.json). Everything here is flagged `sample: true` so the UI
 * can say plainly that these are not measured numbers.
 */

import type { FashionIndexData, IndexItem, SignalDetail, SignalKey } from "../types";

function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 30-point walk that lands near `endScore`, trending in `direction`. */
function generateHistory(seed: string, endScore: number, direction: "up" | "down"): number[] {
  const rand = mulberry32(hashSeed(seed));
  const points = 30;
  const totalDrift = direction === "up" ? -(8 + rand() * 10) : 8 + rand() * 10;
  const start = Math.max(5, Math.min(95, endScore + totalDrift));
  const history: number[] = [start];
  for (let i = 1; i < points; i++) {
    const progress = i / (points - 1);
    const target = start + (endScore - start) * progress;
    const noise = (rand() - 0.5) * 6;
    const prev = history[i - 1];
    history.push(Math.max(2, Math.min(98, prev + (target - prev) * 0.4 + noise)));
  }
  history[points - 1] = endScore;
  return history;
}

const SAMPLE_SOURCE = "sample data";

function signals(values: Partial<Record<SignalKey, number>>): Partial<Record<SignalKey, SignalDetail>> {
  const out: Partial<Record<SignalKey, SignalDetail>> = {};
  for (const [key, momentum] of Object.entries(values) as [SignalKey, number][]) {
    out[key] = { score: 50 + momentum, momentum, source: SAMPLE_SOURCE };
  }
  return out;
}

function item(params: {
  id: string;
  name: string;
  category: IndexItem["category"];
  score: number;
  change30d: number;
  signals: Partial<Record<SignalKey, number>>;
  drivers: Array<[string, "up" | "down"]>;
  prediction: string;
  swatch?: string;
}): IndexItem {
  const direction = params.change30d >= 0 ? "up" : "down";
  const detail = signals(params.signals);
  return {
    id: params.id,
    name: params.name,
    category: params.category,
    score: params.score,
    change30d: params.change30d,
    direction,
    signals: detail,
    coverage: Object.keys(detail).length / 4,
    drivers: params.drivers.map(([name, d]) => ({ name, direction: d })),
    history: generateHistory(params.id, params.score, direction),
    prediction: params.prediction,
    swatch: params.swatch,
  };
}

const trends: IndexItem[] = [
  item({
    id: "boho",
    name: "Boho",
    category: "trend",
    score: 82,
    change30d: 24,
    signals: { search: 31, social: 42, visual: 19, commerce: 12 },
    drivers: [
      ["Lace skirts", "up"],
      ["Suede bags", "up"],
      ["Fringe", "up"],
      ["Peasant blouses", "up"],
      ["Crochet", "down"],
    ],
    prediction:
      "Sample figures. Once you run the ingest, this line is generated from the measured 30-day moves in each source.",
  }),
  item({
    id: "cherry",
    name: "Cherry / Oxblood",
    category: "trend",
    score: 79,
    change30d: 19,
    signals: { search: 18, social: 32, visual: 34, commerce: 15 },
    drivers: [
      ["Leather jackets", "up"],
      ["Mary Janes", "up"],
      ["Nail lacquer", "up"],
      ["Berets", "down"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "suede",
    name: "Suede",
    category: "trend",
    score: 76,
    change30d: 17,
    signals: { search: 22, social: 26, visual: 28, commerce: 18 },
    drivers: [
      ["Ankle boots", "up"],
      ["Trench coats", "up"],
      ["Crossbody bags", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "minimalism",
    name: "Minimalism",
    category: "trend",
    score: 71,
    change30d: 11,
    signals: { search: 14, social: 9, visual: 15, commerce: 8 },
    drivers: [
      ["Tailored trousers", "up"],
      ["Monochrome sets", "up"],
      ["Logo-free bags", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "office-siren",
    name: "Office Siren",
    category: "trend",
    score: 54,
    change30d: -6,
    signals: { search: -9, social: -4, visual: 2, commerce: -11 },
    drivers: [
      ["Pencil skirts", "down"],
      ["Cat-eye glasses", "down"],
      ["Slicked buns", "down"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "balletcore",
    name: "Balletcore",
    category: "trend",
    score: 48,
    change30d: -12,
    signals: { search: -15, social: -18, visual: -7, commerce: -6 },
    drivers: [
      ["Ballet flats", "down"],
      ["Leg warmers", "down"],
      ["Wrap tops", "down"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
];

const brands: IndexItem[] = [
  item({
    id: "miu-miu",
    name: "Miu Miu",
    category: "brand",
    score: 88,
    change30d: 21,
    signals: { search: 24, social: 29, visual: 18, commerce: 14 },
    drivers: [
      ["Runway coverage", "up"],
      ["Celebrity styling", "up"],
      ["Resale demand", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "coach",
    name: "Coach",
    category: "brand",
    score: 74,
    change30d: 15,
    signals: { search: 19, social: 22, visual: 11, commerce: 9 },
    drivers: [
      ["Tabby bag", "up"],
      ["Gen Z campaign reach", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "bottega-veneta",
    name: "Bottega Veneta",
    category: "brand",
    score: 70,
    change30d: 9,
    signals: { search: 11, social: 8, visual: 13, commerce: 6 },
    drivers: [
      ["Intrecciato leather goods", "up"],
      ["Editorial placements", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "gucci",
    name: "Gucci",
    category: "brand",
    score: 61,
    change30d: -8,
    signals: { search: -6, social: -12, visual: -4, commerce: -9 },
    drivers: [
      ["Logo monogram pieces", "down"],
      ["New creative direction reception", "down"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
];

const colors: IndexItem[] = [
  item({
    id: "espresso",
    name: "Espresso",
    category: "color",
    score: 77,
    change30d: 18,
    swatch: "#3b2418",
    signals: { search: 20, social: 21, visual: 16, commerce: 13 },
    drivers: [
      ["Outerwear", "up"],
      ["Handbags", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "olive",
    name: "Olive",
    category: "color",
    score: 68,
    change30d: 14,
    swatch: "#5c5f36",
    signals: { search: 16, social: 15, visual: 12, commerce: 10 },
    drivers: [
      ["Utility jackets", "up"],
      ["Cargo pants", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "cherry-color",
    name: "Cherry",
    category: "color",
    score: 81,
    change30d: 27,
    swatch: "#8c1c2b",
    signals: { search: 18, social: 35, visual: 30, commerce: 20 },
    drivers: [
      ["Leather jackets", "up"],
      ["Lip color", "up"],
      ["Nails", "up"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
  item({
    id: "powder-pink",
    name: "Powder Pink",
    category: "color",
    score: 41,
    change30d: -8,
    swatch: "#e7c6cf",
    signals: { search: -10, social: -9, visual: -3, commerce: -6 },
    drivers: [
      ["Loungewear", "down"],
      ["Accessories", "down"],
    ],
    prediction: "Sample figures pending a live ingest run.",
  }),
];

export const fashionIndexData: FashionIndexData = {
  sentiment: {
    score: 74,
    change30d: 8.2,
    direction: "up",
    asOf: new Date().toISOString(),
  },
  trends,
  brands,
  colors,
  meta: {
    generatedAt: new Date().toISOString(),
    sources: [SAMPLE_SOURCE],
    sample: true,
  },
};
