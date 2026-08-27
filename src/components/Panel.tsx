import type { ReactNode } from "react";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-zinc-800 bg-zinc-950/60">
      <header className="border-b border-zinc-800 px-4 py-2.5">
        <h2 className="font-mono text-[11px] tracking-[0.25em] text-amber-400/90 uppercase">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
