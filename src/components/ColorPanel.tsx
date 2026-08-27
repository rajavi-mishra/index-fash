import type { IndexItem } from "../types";
import { ChangeBadge } from "./ChangeBadge";

export function ColorPanel({ items, onSelect }: { items: IndexItem[]; onSelect: (item: IndexItem) => void }) {
  const ranked = [...items].sort((a, b) => b.change30d - a.change30d);

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ranked.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => onSelect(item)}
            className="flex w-full items-center gap-3 border border-zinc-900 px-3 py-2.5 text-left transition-colors hover:bg-zinc-900/60"
          >
            <span
              className="h-4 w-4 shrink-0 rounded-full border border-zinc-700"
              style={{ backgroundColor: item.swatch }}
            />
            <span className="flex-1 text-sm text-zinc-100">{item.name}</span>
            <ChangeBadge direction={item.direction} value={item.change30d} />
          </button>
        </li>
      ))}
    </ul>
  );
}
