/**
 * Accumulating history for point-in-time sources.
 *
 * Timeseries sources (Wikipedia, GDELT, Google Trends) hand back months of
 * history on every call. Marketplace APIs do not — they answer "what is listed
 * right now". To get a trend line out of them we append one reading per run to
 * a JSON file kept in the repo, so history builds up as the pipeline runs on a
 * schedule.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Point } from "../../src/lib/scoring";

export type SnapshotStore = Record<string, Point[]>;

export async function loadSnapshots(path: string): Promise<SnapshotStore> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SnapshotStore;
    }
    return {};
  } catch (error) {
    // A missing file is the normal first-run case.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

/**
 * Records today's reading for `key`, replacing any existing entry for the same
 * day so re-running the pipeline is idempotent.
 */
export function appendReading(
  store: SnapshotStore,
  key: string,
  value: number,
  date = new Date().toISOString().slice(0, 10),
): void {
  const existing = store[key] ?? [];
  const withoutToday = existing.filter((point) => point.date !== date);
  withoutToday.push({ date, value });
  withoutToday.sort((a, b) => a.date.localeCompare(b.date));
  store[key] = withoutToday;
}

export async function saveSnapshots(path: string, store: SnapshotStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
