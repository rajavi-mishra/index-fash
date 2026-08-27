import type { FashionIndexData, IndexItem, SourceBreakdown } from "../types";

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

/** 30-point walk that lands near `endScore`, trending in `direction` for the sparkline. */
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
    const next = Math.max(2, Math.min(98, prev + (target - prev) * 0.4 + noise));
    history.push(next);
  }
  history[points - 1] = endScore;
  return history;
}

function item(params: {
  id: string;
  name: string;
  category: IndexItem["category"];
  score: number;
  change30d: number;
  breakdown: SourceBreakdown;
  drivers: IndexItem["drivers"];
  prediction: string;
  swatch?: string;
}): IndexItem {
  const direction = params.change30d >= 0 ? "up" : "down";
  return {
    id: params.id,
    name: params.name,
    category: params.category,
    score: params.score,
    change30d: params.change30d,
    direction,
    breakdown: params.breakdown,
    drivers: params.drivers,
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
    breakdown: { search: 31, social: 42, visual: 19, commerce: 12 },
    drivers: [
      { name: "Lace skirts", direction: "up" },
      { name: "Suede bags", direction: "up" },
      { name: "Fringe", direction: "up" },
      { name: "Peasant blouses", direction: "up" },
      { name: "Crochet", direction: "down" },
    ],
    prediction: "Search interest accelerated 31% over 30 days, with lace skirts and suede bags leading new visual appearances. Likely to keep rising for 6–10 weeks.",
  }),
  item({
    id: "cherry",
    name: "Cherry / Oxblood",
    category: "trend",
    score: 79,
    change30d: 19,
    breakdown: { search: 18, social: 32, visual: 34, commerce: 15 },
    drivers: [
      { name: "Leather jackets", direction: "up" },
      { name: "Mary Janes", direction: "up" },
      { name: "Nail lacquer", direction: "up" },
      { name: "Berets", direction: "down" },
    ],
    prediction: "Leather jackets account for 34% of new visual appearances; celebrity adoption up 41%. Momentum likely holds through early autumn.",
  }),
  item({
    id: "suede",
    name: "Suede",
    category: "trend",
    score: 76,
    change30d: 17,
    breakdown: { search: 22, social: 26, visual: 28, commerce: 18 },
    drivers: [
      { name: "Ankle boots", direction: "up" },
      { name: "Trench coats", direction: "up" },
      { name: "Crossbody bags", direction: "up" },
    ],
    prediction: "Commerce signal (sold-out ankle boots, resale premiums) is the fastest-growing input — typically a leading indicator for continued acceleration.",
  }),
  item({
    id: "minimalism",
    name: "Minimalism",
    category: "trend",
    score: 71,
    change30d: 11,
    breakdown: { search: 14, social: 9, visual: 15, commerce: 8 },
    drivers: [
      { name: "Tailored trousers", direction: "up" },
      { name: "Monochrome sets", direction: "up" },
      { name: "Logo-free bags", direction: "up" },
    ],
    prediction: "Steady, broad-based growth across all four signals. A slow-burn trend rather than a spike — expect gradual continued rise.",
  }),
  item({
    id: "office-siren",
    name: "Office Siren",
    category: "trend",
    score: 54,
    change30d: -6,
    breakdown: { search: -9, social: -4, visual: 2, commerce: -11 },
    drivers: [
      { name: "Pencil skirts", direction: "down" },
      { name: "Cat-eye glasses", direction: "down" },
      { name: "Slicked buns", direction: "down" },
    ],
    prediction: "Search and commerce are both cooling while visual appearances hold flat — a sign the aesthetic is plateauing before a likely decline.",
  }),
  item({
    id: "balletcore",
    name: "Balletcore",
    category: "trend",
    score: 48,
    change30d: -12,
    breakdown: { search: -15, social: -18, visual: -7, commerce: -6 },
    drivers: [
      { name: "Ballet flats", direction: "down" },
      { name: "Leg warmers", direction: "down" },
      { name: "Wrap tops", direction: "down" },
    ],
    prediction: "Decline is broad-based and accelerating on social. Likely to keep fading over the next 4–6 weeks.",
  }),
];

const brands: IndexItem[] = [
  item({
    id: "miu-miu",
    name: "Miu Miu",
    category: "brand",
    score: 88,
    change30d: 21,
    breakdown: { search: 24, social: 29, visual: 18, commerce: 14 },
    drivers: [
      { name: "Runway coverage", direction: "up" },
      { name: "Celebrity styling", direction: "up" },
      { name: "Resale demand", direction: "up" },
    ],
    prediction: "Sustained runway-to-street pipeline. Attention growth has held for three consecutive months.",
  }),
  item({
    id: "coach",
    name: "Coach",
    category: "brand",
    score: 74,
    change30d: 15,
    breakdown: { search: 19, social: 22, visual: 11, commerce: 9 },
    drivers: [
      { name: "Tabby bag", direction: "up" },
      { name: "Gen Z campaign reach", direction: "up" },
    ],
    prediction: "Social-led growth concentrated in one hero product. Watch for diversification to sustain past this cycle.",
  }),
  item({
    id: "bottega-veneta",
    name: "Bottega Veneta",
    category: "brand",
    score: 70,
    change30d: 9,
    breakdown: { search: 11, social: 8, visual: 13, commerce: 6 },
    drivers: [
      { name: "Intrecciato leather goods", direction: "up" },
      { name: "Editorial placements", direction: "up" },
    ],
    prediction: "Consistent, editorial-driven growth rather than viral spikes — typically more durable.",
  }),
  item({
    id: "gucci",
    name: "Gucci",
    category: "brand",
    score: 61,
    change30d: -8,
    breakdown: { search: -6, social: -12, visual: -4, commerce: -9 },
    drivers: [
      { name: "Logo monogram pieces", direction: "down" },
      { name: "New creative direction reception", direction: "down" },
    ],
    prediction: "Attention softening across all signals following the creative-direction transition. Typical adjustment period is 2–3 quarters.",
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
    breakdown: { search: 20, social: 21, visual: 16, commerce: 13 },
    drivers: [
      { name: "Outerwear", direction: "up" },
      { name: "Handbags", direction: "up" },
    ],
    prediction: "Neutral-driven rise typical of a transitional-season color. Expect continued strength into winter.",
  }),
  item({
    id: "olive",
    name: "Olive",
    category: "color",
    score: 68,
    change30d: 14,
    swatch: "#5c5f36",
    breakdown: { search: 16, social: 15, visual: 12, commerce: 10 },
    drivers: [
      { name: "Utility jackets", direction: "up" },
      { name: "Cargo pants", direction: "up" },
    ],
    prediction: "Broad, steady adoption across categories — low volatility, durable trend.",
  }),
  item({
    id: "cherry-color",
    name: "Cherry",
    category: "color",
    score: 81,
    change30d: 27,
    swatch: "#8c1c2b",
    breakdown: { search: 18, social: 35, visual: 30, commerce: 20 },
    drivers: [
      { name: "Leather jackets", direction: "up" },
      { name: "Lip color", direction: "up" },
      { name: "Nails", direction: "up" },
    ],
    prediction: "Fastest-accelerating color signal this cycle, mirrors the Cherry/Oxblood trend index. Likely to continue rising for 6–10 weeks.",
  }),
  item({
    id: "powder-pink",
    name: "Powder Pink",
    category: "color",
    score: 41,
    change30d: -8,
    swatch: "#e7c6cf",
    breakdown: { search: -10, social: -9, visual: -3, commerce: -6 },
    drivers: [
      { name: "Loungewear", direction: "down" },
      { name: "Accessories", direction: "down" },
    ],
    prediction: "Cooling steadily since spring peak. Typical seasonal fade — watch for a rebound next spring.",
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
};
