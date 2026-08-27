import { useEffect, useState } from "react";
import { fashionIndexData } from "./data/mockData";
import type { IndexItem } from "./types";
import { SentimentBanner } from "./components/SentimentBanner";
import { Panel } from "./components/Panel";
import { TrendTable } from "./components/TrendTable";
import { BrandPanel } from "./components/BrandPanel";
import { ColorPanel } from "./components/ColorPanel";
import { DetailDrawer } from "./components/DetailDrawer";

function App() {
  const [selected, setSelected] = useState<IndexItem | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <div className="min-h-screen bg-[#050505] pb-16 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <SentimentBanner sentiment={fashionIndexData.sentiment} />

        <div className="mt-4">
          <Panel title="Fastest Rising">
            <TrendTable items={fashionIndexData.trends} onSelect={setSelected} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel title="Brands Gaining Attention">
            <BrandPanel items={fashionIndexData.brands} onSelect={setSelected} />
          </Panel>
          <Panel title="Colors">
            <ColorPanel items={fashionIndexData.colors} onSelect={setSelected} />
          </Panel>
        </div>

        <footer className="mt-8 border-t border-zinc-900 pt-4">
          <p className="font-mono text-[10px] leading-relaxed text-zinc-600">
            Fashion Trend Score = 30% search + 30% social + 30% visual + 10% commerce. Click any row for the
            full breakdown and "why it's moving." Data shown is illustrative sample data — see README for how
            to wire in live sources.
          </p>
        </footer>
      </div>

      {selected && <DetailDrawer item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
