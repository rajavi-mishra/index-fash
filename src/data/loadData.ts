import type { FashionIndexData } from "../types";
import { fashionIndexData as sampleData } from "./mockData";

/**
 * Loads the snapshot written by `npm run ingest`, falling back to sample data
 * when the pipeline hasn't been run yet. The returned `meta.sample` flag tells
 * the UI which it got, so the dashboard never presents illustrative numbers as
 * measured ones.
 */
export async function loadIndexData(): Promise<FashionIndexData> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}index-data.json`, {
      cache: "no-cache",
    });
    if (!response.ok) return sampleData;

    const data = (await response.json()) as FashionIndexData;

    // Guard against a partially written or stale-shaped file.
    if (!data?.sentiment || !Array.isArray(data.trends)) return sampleData;

    return data;
  } catch {
    return sampleData;
  }
}
