/**
 * The entities the index tracks, and how each data source should ask about them.
 *
 * This is the one place to add a trend, brand, or color. The ingestion pipeline
 * fans out over this list; any source config that is absent is simply skipped
 * for that entity (and lowers its reported coverage rather than its score).
 */

export type IndexCategory = "trend" | "brand" | "color";

export interface DriverDef {
  name: string;
  /** GDELT / Trends query for this sub-term. */
  query: string;
  /** Optional Wikipedia article backing this driver. */
  wikipedia?: string;
}

export interface EntityDef {
  id: string;
  name: string;
  category: IndexCategory;
  /** Hex swatch, colors only. */
  swatch?: string;

  /** English Wikipedia article title, underscored. Backs the search signal. */
  wikipedia?: string;
  /** GDELT DOC 2.0 query. Backs the visual/editorial signal. */
  gdeltQuery?: string;
  /** Google Trends term (via SerpAPI). Backs the search signal when available. */
  trendsTerm?: string;
  /** eBay Browse keyword. Backs the commerce signal. */
  ebayQuery?: string;
  /** Subreddit-agnostic Reddit query. Backs the social signal. */
  redditQuery?: string;

  /** Sub-terms broken out in the "what's driving this" panel. */
  drivers?: DriverDef[];
}

/**
 * GDELT queries are quoted phrases ANDed with a fashion context term, which
 * keeps ambiguous words ("cherry", "boho", "coach") from matching food, travel,
 * and sports coverage.
 */
const FASHION_CONTEXT = "(fashion OR style OR runway OR wardrobe)";

export function gdeltQuery(phrase: string): string {
  return `"${phrase}" ${FASHION_CONTEXT}`;
}

export const TRENDS: EntityDef[] = [
  {
    id: "boho",
    name: "Boho",
    category: "trend",
    wikipedia: "Boho-chic",
    gdeltQuery: gdeltQuery("boho"),
    trendsTerm: "boho",
    ebayQuery: "boho",
    redditQuery: "boho",
    drivers: [
      { name: "Lace skirts", query: gdeltQuery("lace skirt") },
      { name: "Suede bags", query: gdeltQuery("suede bag") },
      { name: "Fringe", query: gdeltQuery("fringe") },
      { name: "Peasant blouses", query: gdeltQuery("peasant blouse") },
      { name: "Crochet", query: gdeltQuery("crochet"), wikipedia: "Crochet" },
    ],
  },
  {
    id: "cherry",
    name: "Cherry / Oxblood",
    category: "trend",
    wikipedia: "Oxblood_(color)",
    gdeltQuery: gdeltQuery("oxblood"),
    trendsTerm: "oxblood",
    ebayQuery: "oxblood",
    redditQuery: "oxblood",
    drivers: [
      { name: "Leather jackets", query: gdeltQuery("leather jacket"), wikipedia: "Leather_jacket" },
      { name: "Mary Janes", query: gdeltQuery("mary jane shoes"), wikipedia: "Mary_Jane_(shoe)" },
      { name: "Nail lacquer", query: gdeltQuery("nail polish") },
      { name: "Berets", query: gdeltQuery("beret"), wikipedia: "Beret" },
    ],
  },
  {
    id: "suede",
    name: "Suede",
    category: "trend",
    wikipedia: "Suede",
    gdeltQuery: gdeltQuery("suede"),
    trendsTerm: "suede",
    ebayQuery: "suede",
    redditQuery: "suede",
    drivers: [
      { name: "Ankle boots", query: gdeltQuery("ankle boots") },
      { name: "Trench coats", query: gdeltQuery("trench coat"), wikipedia: "Trench_coat" },
      { name: "Crossbody bags", query: gdeltQuery("crossbody bag") },
    ],
  },
  {
    id: "minimalism",
    name: "Minimalism",
    category: "trend",
    wikipedia: "Minimalist_fashion",
    gdeltQuery: gdeltQuery("minimalist"),
    trendsTerm: "minimalist fashion",
    ebayQuery: "minimalist",
    redditQuery: "minimalist fashion",
    drivers: [
      { name: "Tailored trousers", query: gdeltQuery("tailored trousers") },
      { name: "Monochrome sets", query: gdeltQuery("monochrome outfit") },
      { name: "Logo-free bags", query: gdeltQuery("quiet luxury bag") },
    ],
  },
  {
    id: "office-siren",
    name: "Office Siren",
    category: "trend",
    gdeltQuery: gdeltQuery("office siren"),
    trendsTerm: "office siren",
    ebayQuery: "office siren",
    redditQuery: "office siren",
    drivers: [
      { name: "Pencil skirts", query: gdeltQuery("pencil skirt"), wikipedia: "Pencil_skirt" },
      { name: "Cat-eye glasses", query: gdeltQuery("cat eye glasses") },
      { name: "Slicked buns", query: gdeltQuery("slicked back bun") },
    ],
  },
  {
    id: "balletcore",
    name: "Balletcore",
    category: "trend",
    gdeltQuery: gdeltQuery("balletcore"),
    trendsTerm: "balletcore",
    ebayQuery: "balletcore",
    redditQuery: "balletcore",
    drivers: [
      { name: "Ballet flats", query: gdeltQuery("ballet flats"), wikipedia: "Ballet_flat" },
      { name: "Leg warmers", query: gdeltQuery("leg warmers"), wikipedia: "Leg_warmer" },
      { name: "Wrap tops", query: gdeltQuery("wrap top") },
    ],
  },
];

export const BRANDS: EntityDef[] = [
  {
    id: "miu-miu",
    name: "Miu Miu",
    category: "brand",
    wikipedia: "Miu_Miu",
    gdeltQuery: '"Miu Miu"',
    trendsTerm: "Miu Miu",
    ebayQuery: "Miu Miu",
    redditQuery: "Miu Miu",
  },
  {
    id: "coach",
    name: "Coach",
    category: "brand",
    wikipedia: "Coach_New_York",
    gdeltQuery: `"Coach" ${FASHION_CONTEXT}`,
    trendsTerm: "Coach bag",
    ebayQuery: "Coach handbag",
    redditQuery: "Coach bag",
  },
  {
    id: "bottega-veneta",
    name: "Bottega Veneta",
    category: "brand",
    wikipedia: "Bottega_Veneta",
    gdeltQuery: '"Bottega Veneta"',
    trendsTerm: "Bottega Veneta",
    ebayQuery: "Bottega Veneta",
    redditQuery: "Bottega Veneta",
  },
  {
    id: "gucci",
    name: "Gucci",
    category: "brand",
    wikipedia: "Gucci",
    gdeltQuery: '"Gucci"',
    trendsTerm: "Gucci",
    ebayQuery: "Gucci",
    redditQuery: "Gucci",
  },
  {
    id: "the-row",
    name: "The Row",
    category: "brand",
    wikipedia: "The_Row_(fashion_label)",
    gdeltQuery: '"The Row" (fashion OR runway)',
    trendsTerm: "The Row",
    ebayQuery: "The Row",
    redditQuery: "The Row",
  },
  {
    id: "loewe",
    name: "Loewe",
    category: "brand",
    wikipedia: "Loewe_(fashion_brand)",
    gdeltQuery: '"Loewe"',
    trendsTerm: "Loewe",
    ebayQuery: "Loewe",
    redditQuery: "Loewe",
  },
];

export const COLORS: EntityDef[] = [
  {
    id: "espresso",
    name: "Espresso",
    category: "color",
    swatch: "#3b2418",
    gdeltQuery: gdeltQuery("espresso brown"),
    trendsTerm: "espresso brown",
    ebayQuery: "espresso brown",
    drivers: [
      { name: "Outerwear", query: gdeltQuery("brown coat") },
      { name: "Handbags", query: gdeltQuery("brown handbag") },
    ],
  },
  {
    id: "olive",
    name: "Olive",
    category: "color",
    swatch: "#5c5f36",
    wikipedia: "Olive_(color)",
    gdeltQuery: gdeltQuery("olive green"),
    trendsTerm: "olive green",
    ebayQuery: "olive green",
    drivers: [
      { name: "Utility jackets", query: gdeltQuery("utility jacket") },
      { name: "Cargo pants", query: gdeltQuery("cargo pants"), wikipedia: "Cargo_pants" },
    ],
  },
  {
    id: "cherry-color",
    name: "Cherry",
    category: "color",
    swatch: "#8c1c2b",
    gdeltQuery: gdeltQuery("cherry red"),
    trendsTerm: "cherry red",
    ebayQuery: "cherry red",
    drivers: [
      { name: "Leather jackets", query: gdeltQuery("red leather jacket") },
      { name: "Lip color", query: gdeltQuery("red lipstick"), wikipedia: "Lipstick" },
      { name: "Nails", query: gdeltQuery("red nails") },
    ],
  },
  {
    id: "powder-pink",
    name: "Powder Pink",
    category: "color",
    swatch: "#e7c6cf",
    wikipedia: "Pink",
    gdeltQuery: gdeltQuery("powder pink"),
    trendsTerm: "powder pink",
    ebayQuery: "powder pink",
    drivers: [
      { name: "Loungewear", query: gdeltQuery("pink loungewear") },
      { name: "Accessories", query: gdeltQuery("pink accessories") },
    ],
  },
  {
    id: "butter-yellow",
    name: "Butter Yellow",
    category: "color",
    swatch: "#f0dd9c",
    gdeltQuery: gdeltQuery("butter yellow"),
    trendsTerm: "butter yellow",
    ebayQuery: "butter yellow",
    drivers: [
      { name: "Knitwear", query: gdeltQuery("yellow knit") },
      { name: "Tailoring", query: gdeltQuery("yellow blazer") },
    ],
  },
];

export const ALL_ENTITIES: EntityDef[] = [...TRENDS, ...BRANDS, ...COLORS];
