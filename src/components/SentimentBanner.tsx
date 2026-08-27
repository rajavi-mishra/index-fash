import type { FashionIndexData, SentimentSnapshot } from "../types";
import { ChangeBadge } from "./ChangeBadge";

export function SentimentBanner({
  sentiment,
  meta,
}: {
  sentiment: SentimentSnapshot;
  meta: FashionIndexData["meta"];
}) {
  const dateLabel = new Date(sentiment.asOf).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section className="border border-zinc-800 bg-zinc-950/60 px-6 py-5 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-mono text-xs tracking-[0.3em] text-amber-400/90 uppercase">
            The Fashion Index
          </h1>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs text-zinc-500">
            {dateLabel}
            {meta.sample && (
              <span className="border border-amber-500/40 px-1.5 py-0.5 text-[9px] tracking-[0.15em] text-amber-500/90 uppercase">
                Sample
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
            Fashion Sentiment
          </p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold text-zinc-50 tabular-nums sm:text-5xl">
              {sentiment.score}
            </span>
            <ChangeBadge direction={sentiment.direction} value={sentiment.change30d} />
          </div>
        </div>
      </div>
    </section>
  );
}
