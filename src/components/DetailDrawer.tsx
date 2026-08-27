import type { IndexItem } from "../types";
import { SIGNAL_WEIGHTS } from "../types";
import { ChangeBadge } from "./ChangeBadge";
import { Sparkline } from "./Sparkline";

const SIGNAL_LABELS: Record<keyof IndexItem["breakdown"], string> = {
  search: "Search interest",
  social: "Social mentions",
  visual: "Visual appearances",
  commerce: "Commerce signal",
};

export function DetailDrawer({ item, onClose }: { item: IndexItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.25em] text-amber-400/90 uppercase">
              {item.category} index
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-zinc-50">{item.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-zinc-800 px-2 py-1 font-mono text-xs text-zinc-400 hover:bg-zinc-900"
          >
            ESC
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <span className="font-mono text-5xl font-semibold text-zinc-50 tabular-nums">{item.score}</span>
          <ChangeBadge direction={item.direction} value={item.change30d} />
          <div className="ml-auto">
            <Sparkline data={item.history} direction={item.direction} width={120} height={36} />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase">Why it's moving</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.prediction}</p>
        </div>

        <div className="mt-6 space-y-3">
          {(Object.keys(item.breakdown) as (keyof typeof item.breakdown)[]).map((key) => {
            const value = item.breakdown[key];
            const up = value >= 0;
            const magnitude = Math.min(100, Math.abs(value) * 2.2);
            return (
              <div key={key}>
                <div className="flex items-center justify-between font-mono text-xs text-zinc-400">
                  <span className="flex items-center gap-2">
                    {SIGNAL_LABELS[key]}
                    <span className="text-zinc-600">· {Math.round(SIGNAL_WEIGHTS[key] * 100)}% weight</span>
                  </span>
                  <span className={up ? "text-emerald-400" : "text-red-400"}>
                    {up ? "+" : ""}
                    {value}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-zinc-900">
                  <div
                    className={`h-full ${up ? "bg-emerald-500" : "bg-red-500"}`}
                    style={{ width: `${magnitude}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8">
          <h3 className="font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase">
            What's driving {item.name}
          </h3>
          <ul className="mt-2 space-y-1.5">
            {item.drivers.map((driver) => (
              <li key={driver.name} className="flex items-center justify-between text-sm text-zinc-300">
                <span>{driver.name}</span>
                <span className={driver.direction === "up" ? "text-emerald-400" : "text-red-400"}>
                  {driver.direction === "up" ? "▲" : "▼"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
