/**
 * Candidate image discovery via SerpAPI's Google Images engine.
 *
 * Reuses the SERPAPI_KEY already documented in .env.example — the same paid
 * key the main pipeline uses to upgrade the search signal from Wikipedia
 * pageviews to real Google Trends data. SerpAPI is a legitimate, ToS-compliant
 * commercial API built exactly for this (as opposed to scraping Google Images'
 * HTML directly, which this deliberately avoids).
 *
 * Docs: https://serpapi.com/images-results
 */

import { createHash } from "node:crypto";
import type { BagCandidateImage } from "../types";

const SEARCH_URL = "https://serpapi.com/search.json";

interface SerpApiImageResult {
  original?: string;
  link?: string;
  title?: string;
  source?: string;
  /** Not reliably present; SerpAPI's image results rarely carry a publish date. */
  date?: string;
}

interface SerpApiImagesResponse {
  images_results?: SerpApiImageResult[];
  error?: string;
}

function idFor(imageUrl: string): string {
  return createHash("sha1").update(imageUrl).digest("hex").slice(0, 16);
}

export interface SerpApiImageOptions {
  apiKey: string;
  /** Defaults to a query aimed at candid/paparazzi/street-style bag shots. */
  query?: string;
  /** Max results to request (SerpAPI pages internally; keep this modest). */
  count?: number;
}

export async function fetchBagCandidates(
  subject: string,
  options: SerpApiImageOptions,
): Promise<BagCandidateImage[]> {
  const { apiKey, query = `"${subject}" carrying bag purse street style`, count = 30 } = options;

  const params = new URLSearchParams({
    engine: "google_images",
    q: query,
    api_key: apiKey,
    ijn: "0",
  });

  const response = await fetch(`${SEARCH_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`[serpapi-images] HTTP ${response.status}`);
  }

  const data = (await response.json()) as SerpApiImagesResponse;
  if (data.error) {
    throw new Error(`[serpapi-images] ${data.error}`);
  }

  const results = (data.images_results ?? []).slice(0, count);

  return results
    .filter((r): r is SerpApiImageResult & { original: string; link: string } =>
      Boolean(r.original && r.link),
    )
    .map((r) => ({
      id: idFor(r.original),
      sourceUrl: r.link,
      imageUrl: r.original,
      title: r.title,
      date: r.date,
      provider: "serpapi-google-images",
    }));
}
