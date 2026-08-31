/**
 * Keyless fallback: a curated list of image URLs the user maintains by hand in
 * data/seed-urls.json. This is the "always works" tier — same role Wikipedia
 * pageviews plays for the main ingest pipeline when no paid key is present.
 *
 * Curating the list yourself (rather than scraping it) sidesteps two problems
 * at once: it avoids bulk-scraping a live site's HTML (fragile, and against
 * most fashion/paparazzi sites' ToS), and it means every image in the run is
 * one you've actually looked at and have a defensible reason to analyze.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { BagCandidateImage } from "../types";

interface SeedEntry {
  imageUrl: string;
  sourceUrl: string;
  title?: string;
  date?: string;
}

function idFor(imageUrl: string): string {
  return createHash("sha1").update(imageUrl).digest("hex").slice(0, 16);
}

export async function loadSeedCandidates(path: string): Promise<BagCandidateImage[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }

  const entries = JSON.parse(raw) as SeedEntry[];

  return entries
    .filter((e) => e.imageUrl && e.sourceUrl)
    .map((e) => ({
      id: idFor(e.imageUrl),
      sourceUrl: e.sourceUrl,
      imageUrl: e.imageUrl,
      title: e.title,
      date: e.date,
      provider: "seed-list",
    }));
}
