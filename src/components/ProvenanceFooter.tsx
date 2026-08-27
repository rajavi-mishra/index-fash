import type { FashionIndexData } from "../types";

export function ProvenanceFooter({ meta }: { meta: FashionIndexData["meta"] }) {
  const generated = new Date(meta.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <footer className="mt-8 space-y-2 border-t border-zinc-900 pt-4 font-mono text-[10px] leading-relaxed text-zinc-600">
      <p>
        Fashion Trend Score = 30% search + 30% social + 30% visual + 10% commerce, renormalised over
        the signals actually measured. Click any row for the full breakdown.
      </p>
      <p>
        {meta.sample ? (
          <span className="text-amber-500/80">
            Showing illustrative sample data — run <code>npm run ingest</code> to replace it with a
            live pull.
          </span>
        ) : (
          <>
            Sources: {meta.sources.join(" · ")} — generated {generated}.
          </>
        )}
      </p>
    </footer>
  );
}
