import type { IndexItem } from "../types";
import { ChangeBadge } from "./ChangeBadge";
import { Sparkline } from "./Sparkline";

export function TrendTable({ items, onSelect }: { items: IndexItem[]; onSelect: (item: IndexItem) => void }) {
  const ranked = [...items].sort((a, b) => b.change30d - a.change30d);

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase">
          <th className="pb-2 pr-2 font-normal">#</th>
          <th className="pb-2 pr-2 font-normal">Trend</th>
          <th className="pb-2 pr-2 font-normal text-right">Score</th>
          <th className="pb-2 pr-2 font-normal text-right">30D</th>
          <th className="pb-2 font-normal text-right">Trend</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((item, i) => (
          <tr
            key={item.id}
            onClick={() => onSelect(item)}
            className="cursor-pointer border-t border-zinc-900 transition-colors hover:bg-zinc-900/60"
          >
            <td className="py-2.5 pr-2 font-mono text-sm text-zinc-500 tabular-nums">{i + 1}</td>
            <td className="py-2.5 pr-2 text-sm text-zinc-100">{item.name}</td>
            <td className="py-2.5 pr-2 text-right font-mono text-sm text-zinc-100 tabular-nums">{item.score}</td>
            <td className="py-2.5 pr-2 text-right">
              <ChangeBadge direction={item.direction} value={item.change30d} />
            </td>
            <td className="py-2.5 text-right">
              <div className="flex justify-end">
                <Sparkline data={item.history} direction={item.direction} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
