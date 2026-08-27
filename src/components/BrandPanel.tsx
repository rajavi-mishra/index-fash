import type { IndexItem } from "../types";
import { ChangeBadge } from "./ChangeBadge";

export function BrandPanel({ items, onSelect }: { items: IndexItem[]; onSelect: (item: IndexItem) => void }) {
  const ranked = [...items].sort((a, b) => b.change30d - a.change30d);

  return (
    <ul className="divide-y divide-zinc-900">
      {ranked.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => onSelect(item)}
            className="flex w-full items-center justify-between py-2.5 text-left transition-colors hover:bg-zinc-900/60"
          >
            <span className="text-sm text-zinc-100">{item.name}</span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-sm text-zinc-400 tabular-nums">{item.score}</span>
              <ChangeBadge direction={item.direction} value={item.change30d} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
