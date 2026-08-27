/**
 * Wikimedia Pageviews API — free, no API key, no account.
 *
 * Daily pageview counts per article are a well-established proxy for public
 * attention, and for fashion they work best on brands and named designers
 * (which have stable articles) rather than on micro-trends (which often don't).
 *
 * Docs: https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/
 * Policy: requests must carry a descriptive User-Agent identifying the client.
 */

import type { Point } from "../../../src/lib/scoring";
import { fetchJson, formatDate, type FetchOptions } from "../http";

const BASE = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";

interface PageviewsResponse {
  items?: Array<{
    /** YYYYMMDDHH */
    timestamp: string;
    views: number;
  }>;
}

export interface WikipediaOptions {
  project?: string;
  /** Contact string required by Wikimedia's user-agent policy. */
  userAgent: string;
}

/**
 * Daily pageviews for one article between two dates.
 * Returns an empty series when the article has no data (404), so a bad title
 * lowers coverage instead of failing the whole run.
 */
export async function fetchPageviews(
  article: string,
  start: Date,
  end: Date,
  options: WikipediaOptions,
): Promise<Point[]> {
  const { project = "en.wikipedia", userAgent } = options;

  const url = [
    BASE,
    project,
    "all-access",
    // "user" excludes bots and crawlers, which matters for attention data.
    "user",
    encodeURIComponent(article),
    "daily",
    formatDate(start),
    formatDate(end),
  ].join("/");

  const fetchOptions: FetchOptions = {
    source: "wikipedia",
    headers: { "User-Agent": userAgent, Accept: "application/json" },
    allow404: true,
  };

  const data = await fetchJson<PageviewsResponse>(url, fetchOptions);
  if (!data?.items) return [];

  return data.items.map((item) => ({
    date: `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}-${item.timestamp.slice(6, 8)}`,
    value: item.views,
  }));
}
