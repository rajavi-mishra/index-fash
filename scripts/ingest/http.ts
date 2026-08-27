/**
 * Shared HTTP helpers for source adapters: polite throttling, bounded retries
 * with exponential backoff, and clear errors when a public API changes shape.
 */

export class SourceError extends Error {
  readonly source: string;
  readonly reason: unknown;

  constructor(source: string, message: string, reason?: unknown) {
    super(`[${source}] ${message}`);
    this.name = "SourceError";
    this.source = source;
    this.reason = reason;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retryable status codes: rate limits and transient upstream failures. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export interface FetchOptions {
  source: string;
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
  /** Treat a 404 as "no data for this entity" rather than an error. */
  allow404?: boolean;
}

export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T | null> {
  const { source, headers = {}, retries = 3, timeoutMs = 20_000, allow404 = false } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(2 ** attempt * 500);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });

      if (response.status === 404 && allow404) return null;

      if (!response.ok) {
        if (RETRYABLE.has(response.status) && attempt < retries) {
          lastError = new SourceError(source, `HTTP ${response.status}`);
          continue;
        }
        throw new SourceError(source, `HTTP ${response.status} for ${url}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      // An abort or network error is worth another attempt; a SourceError from
      // a non-retryable status is not.
      if (error instanceof SourceError && !(error.message.includes("429"))) throw error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SourceError(source, `request failed after ${retries + 1} attempts: ${url}`, lastError);
}

/** Runs tasks with bounded concurrency so we stay polite to free public APIs. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export function formatDate(date: Date, separator = ""): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return [y, m, d].join(separator);
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
