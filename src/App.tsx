import { useEffect, useState } from "react";
import { loadIndexData } from "./data/loadData";
import type { FashionIndexData, IndexItem } from "./types";
import { SentimentBanner } from "./components/SentimentBanner";
import { Panel } from "./components/Panel";
import { TrendTable } from "./components/TrendTable";
import { BrandPanel } from "./components/BrandPanel";
import { ColorPanel } from "./components/ColorPanel";
import { DetailDrawer } from "./components/DetailDrawer";
import { ProvenanceFooter } from "./components/ProvenanceFooter";

function App() {
  const [data, setData] = useState<FashionIndexData | null>(null);
  const [selected, setSelected] = useState<IndexItem | null>(null);

  useEffect(() => {
    loadIndexData().then(setData);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <p className="font-mono text-xs tracking-[0.25em] text-zinc-600 uppercase">Loading index…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-16 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <SentimentBanner sentiment={data.sentiment} meta={data.meta} />

        <div className="mt-4">
          <Panel title="Fastest Rising">
            <TrendTable items={data.trends} onSelect={setSelected} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel title="Brands Gaining Attention">
            <BrandPanel items={data.brands} onSelect={setSelected} />
          </Panel>
          <Panel title="Colors">
            <ColorPanel items={data.colors} onSelect={setSelected} />
          </Panel>
        </div>

        <ProvenanceFooter meta={data.meta} />
      </div>

      {selected && <DetailDrawer item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
