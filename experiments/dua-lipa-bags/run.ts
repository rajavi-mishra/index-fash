/**
 * Orchestrator: discover candidate bag photos -> download -> analyze with
 * Claude vision -> aggregate -> write report.json.
 *
 *   npm run experiment:dua-lipa-bags
 *
 * With no keys at all, prints the bundled sample report (see data/sample-report.json)
 * so the output shape is visible without any setup — same "sample data when
 * nothing is configured" philosophy as `npm run ingest`.
 *
 * With SERPAPI_KEY set, discovers candidates via Google Images search. Without
 * it, falls back to the curated data/seed-urls.json. Either way, ANTHROPIC_API_KEY
 * is required to actually analyze the images — without it the run stops after
 * listing what it found, since there's nothing useful to aggregate yet.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "../../scripts/ingest/env";
import { mapWithConcurrency } from "../../scripts/ingest/http";
import { analyzeBagImage } from "./analyze";
import { buildReport } from "./aggregate";
import { downloadCandidate } from "./download";
import { fetchBagCandidates } from "./sources/serpApiImages";
import { loadSeedCandidates } from "./sources/seedList";
import type { BagReportEntry } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(HERE, "data");
const IMAGE_CACHE = resolve(DATA_DIR, "images");
const SEED_FILE = resolve(DATA_DIR, "seed-urls.json");
const SAMPLE_FILE = resolve(DATA_DIR, "sample-report.json");
const OUTPUT_FILE = resolve(DATA_DIR, "report.json");

const SUBJECT = process.env.EXPERIMENT_SUBJECT || "Dua Lipa";
const CONCURRENCY = 3;

async function printSample(): Promise<void> {
  console.log(
    "No ANTHROPIC_API_KEY set — printing the bundled sample report instead of running live.\n" +
      "Set ANTHROPIC_API_KEY (and optionally SERPAPI_KEY) in .env to run for real.\n",
  );
  const raw = await readFile(SAMPLE_FILE, "utf8");
  console.log(raw);
}

async function main(): Promise<void> {
  loadEnv();

  const serpApiKey = process.env.SERPAPI_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    await printSample();
    return;
  }

  console.log(`Dua Lipa bag experiment: subject="${SUBJECT}"`);
  console.log(
    `· candidates: ${serpApiKey ? "SerpAPI Google Images" : "seed list (data/seed-urls.json)"}`,
  );

  const candidates = serpApiKey
    ? await fetchBagCandidates(SUBJECT, { apiKey: serpApiKey })
    : await loadSeedCandidates(SEED_FILE);

  if (candidates.length === 0) {
    console.warn(
      "  ~ no candidates found. Without SERPAPI_KEY, add entries to data/seed-urls.json first.",
    );
    return;
  }

  console.log(`  ${candidates.length} candidate photo(s)`);
  await mkdir(IMAGE_CACHE, { recursive: true });

  const entries: BagReportEntry[] = await mapWithConcurrency(candidates, CONCURRENCY, async (candidate) => {
    const downloaded = await downloadCandidate(candidate, IMAGE_CACHE);
    if (!downloaded.localPath) {
      return { ...candidate, analysis: null, error: downloaded.error ?? "download failed" };
    }

    try {
      const analysis = await analyzeBagImage(candidate.id, downloaded.localPath, anthropicKey);
      return { ...candidate, analysis };
    } catch (error) {
      return { ...candidate, analysis: null, error: error instanceof Error ? error.message : String(error) };
    }
  });

  const report = buildReport(SUBJECT, entries);

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`\n✓ wrote ${OUTPUT_FILE}`);
  console.log(
    `  ${report.analyzedCount}/${report.totalCandidates} analyzed · ` +
      `avg weirdness ${report.averageWeirdness} · ` +
      `overall sentiment ${report.overallSentiment.score} (${report.overallSentiment.label})`,
  );
  if (report.brandFrequency.length) {
    console.log("  brands seen:", report.brandFrequency.map((b) => `${b.brand} x${b.count}`).join(", "));
  }
}

main().catch((error) => {
  console.error(`\n✗ experiment failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
