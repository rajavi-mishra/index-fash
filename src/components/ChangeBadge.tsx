import type { Direction } from "../types";

export function ChangeBadge({ direction, value }: { direction: Direction; value: number }) {
  const up = direction === "up";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
      <span>{up ? "▲" : "▼"}</span>
      <span>{Math.abs(value).toFixed(0)}%</span>
    </span>
  );
}
