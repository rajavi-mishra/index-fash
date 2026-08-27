/**
 * eBay Browse API — the commerce signal.
 *
 * Joining the eBay Developers Program is free and gives you a client ID and
 * secret. This adapter reports how many active listings match a keyword, and
 * the median asking price among the first page of results.
 *
 * Note this is a *point-in-time* reading, not a historical series: eBay will
 * tell you what is listed right now, not what was listed last March. The
 * pipeline therefore accumulates one reading per run into a local history file
 * (see snapshots.ts), so the commerce signal becomes usable once you have run
 * the ingest for a couple of months. Everything else works from day one.
 *
 * Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
 */

import { fetchJson } from "../http";

const TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SearchResponse {
  total?: number;
  itemSummaries?: Array<{
    price?: { value?: string; currency?: string };
  }>;
}

export interface EbayCredentials {
  clientId: string;
  clientSecret: string;
  /** eBay marketplace, e.g. EBAY_US. */
  marketplaceId?: string;
}

export interface CommerceReading {
  /** Number of active listings matching the keyword. */
  listingCount: number;
  /** Median asking price on the first page, or null when unavailable. */
  medianPrice: number | null;
}

/** Client-credentials token. Cached by the caller for the life of a run. */
export async function getAccessToken(credentials: EbayCredentials): Promise<string> {
  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!response.ok) {
    throw new Error(`[ebay] token request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  if (!data.access_token) throw new Error("[ebay] token response contained no access_token");
  return data.access_token;
}

export async function fetchCommerceReading(
  keyword: string,
  token: string,
  credentials: EbayCredentials,
): Promise<CommerceReading | null> {
  const params = new URLSearchParams({
    q: keyword,
    // Women's clothing, shoes & accessories.
    category_ids: "15724",
    limit: "50",
  });

  const data = await fetchJson<SearchResponse>(`${SEARCH_URL}?${params}`, {
    source: "ebay",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": credentials.marketplaceId ?? "EBAY_US",
      Accept: "application/json",
    },
  });

  if (!data || typeof data.total !== "number") return null;

  const prices = (data.itemSummaries ?? [])
    .map((item) => Number(item.price?.value))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const medianPrice =
    prices.length === 0
      ? null
      : prices.length % 2 === 1
        ? prices[(prices.length - 1) / 2]
        : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;

  return { listingCount: data.total, medianPrice };
}
