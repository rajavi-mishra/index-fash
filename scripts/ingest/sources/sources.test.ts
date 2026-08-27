/**
 * Adapter tests against recorded response shapes.
 *
 * The sandbox these were written in has no network egress, so rather than hit
 * the live APIs these assert against the documented payload shapes. They cover
 * the parts most likely to break silently: URL construction, timestamp
 * conversion, daily folding, and empty/missing-data handling.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNewsVolume } from "./gdelt";
import { fetchSearchInterest } from "./googleTrends";
import { fetchPageviews } from "./wikipedia";

function mockFetch(payload: unknown, status = 200) {
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wikipedia pageviews adapter", () => {
  const payload = {
    items: [
      { project: "en.wikipedia", article: "Miu_Miu", timestamp: "2026080100", views: 1200 },
      { project: "en.wikipedia", article: "Miu_Miu", timestamp: "2026080200", views: 1350 },
    ],
  };

  it("builds the documented endpoint path", async () => {
    const spy = mockFetch(payload);
    await fetchPageviews("Miu_Miu", new Date(Date.UTC(2026, 7, 1)), new Date(Date.UTC(2026, 7, 2)), {
      userAgent: "FashionIndex/0.1 (test@example.com)",
    });

    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain("/metrics/pageviews/per-article/en.wikipedia/all-access/user/Miu_Miu/daily/");
    expect(url).toMatch(/\/20260801\/20260802$/);
  });

  it("sends the User-Agent Wikimedia's policy requires", async () => {
    const spy = mockFetch(payload);
    await fetchPageviews("Miu_Miu", new Date(), new Date(), { userAgent: "FashionIndex/0.1 (a@b.c)" });

    const init = spy.mock.calls[0][1]!;
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("FashionIndex/0.1 (a@b.c)");
  });

  it("converts YYYYMMDDHH timestamps to ISO dates", async () => {
    mockFetch(payload);
    const series = await fetchPageviews("Miu_Miu", new Date(), new Date(), { userAgent: "t" });

    expect(series).toEqual([
      { date: "2026-08-01", value: 1200 },
      { date: "2026-08-02", value: 1350 },
    ]);
  });

  it("treats an unknown article (404) as no data rather than an error", async () => {
    mockFetch({ type: "not_found" }, 404);
    await expect(
      fetchPageviews("Nonexistent_Article", new Date(), new Date(), { userAgent: "t" }),
    ).resolves.toEqual([]);
  });

  it("returns an empty series when the payload has no items", async () => {
    mockFetch({});
    await expect(fetchPageviews("X", new Date(), new Date(), { userAgent: "t" })).resolves.toEqual([]);
  });
});

describe("gdelt adapter", () => {
  it("requests timelinevol JSON with the given query", async () => {
    const spy = mockFetch({ timeline: [{ data: [] }] });
    await fetchNewsVolume('"boho" (fashion OR style)');

    const url = new URL(String(spy.mock.calls[0][0]));
    expect(url.searchParams.get("mode")).toBe("timelinevol");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("query")).toBe('"boho" (fashion OR style)');
  });

  it("folds sub-daily buckets into daily means", async () => {
    mockFetch({
      timeline: [
        {
          series: "Volume Intensity",
          data: [
            { date: "20260801T000000Z", value: 0.1 },
            { date: "20260801T120000Z", value: 0.3 },
            { date: "20260802T000000Z", value: 0.5 },
          ],
        },
      ],
    });

    const series = await fetchNewsVolume("boho");
    expect(series).toEqual([
      { date: "2026-08-01", value: 0.2 },
      { date: "2026-08-02", value: 0.5 },
    ]);
  });

  it("returns an empty series when GDELT knows nothing about the query", async () => {
    mockFetch({});
    await expect(fetchNewsVolume("zzzz")).resolves.toEqual([]);
  });
});

describe("google trends adapter", () => {
  it("converts unix timestamps and extracts values", async () => {
    mockFetch({
      interest_over_time: {
        timeline_data: [
          { timestamp: "1754006400", values: [{ extracted_value: 62 }] },
          { timestamp: "1754092800", values: [{ extracted_value: 71 }] },
        ],
      },
    });

    const series = await fetchSearchInterest("boho", { apiKey: "k" });
    expect(series).toHaveLength(2);
    expect(series[0].value).toBe(62);
    expect(series[1].value).toBe(71);
    expect(series[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("skips malformed entries instead of emitting NaN dates", async () => {
    mockFetch({
      interest_over_time: {
        timeline_data: [
          { timestamp: "not-a-number", values: [{ extracted_value: 5 }] },
          { timestamp: "1754006400", values: [{}] },
          { timestamp: "1754092800", values: [{ extracted_value: 71 }] },
        ],
      },
    });

    const series = await fetchSearchInterest("boho", { apiKey: "k" });
    expect(series).toHaveLength(1);
    expect(series[0].value).toBe(71);
  });
});
