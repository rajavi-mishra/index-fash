/**
 * Builds the "why it's moving" line from the actual signal moves.
 *
 * Deliberately descriptive rather than predictive: it reports what the measured
 * series did and which source moved most. Nothing here forecasts, because
 * nothing in the current model is a forecast — inventing a confident prediction
 * from two months of pageview data would be dressing up noise.
 */

import type { SignalKey } from "../../src/lib/scoring";
import type { SignalDetail } from "../../src/types";

const SIGNAL_PHRASE: Record<SignalKey, string> = {
  search: "search interest",
  social: "social mentions",
  visual: "editorial and news coverage",
  commerce: "marketplace listings",
};

export function buildExplanation(
  name: string,
  signals: Partial<Record<SignalKey, SignalDetail>>,
  coverage: number,
): string {
  const measured = (Object.entries(signals) as [SignalKey, SignalDetail][]).filter(
    ([, detail]) => typeof detail.momentum === "number",
  );

  if (measured.length === 0) {
    return `Not enough history yet to describe how ${name} is moving. Scores reflect current standing only; momentum appears once the pipeline has two full 30-day windows.`;
  }

  const ranked = [...measured].sort(
    (a, b) => Math.abs(b[1].momentum as number) - Math.abs(a[1].momentum as number),
  );

  const [topKey, topDetail] = ranked[0];
  const topMomentum = topDetail.momentum as number;
  const verb = topMomentum >= 0 ? "rose" : "fell";

  const parts: string[] = [
    `${capitalize(SIGNAL_PHRASE[topKey])} ${verb} ${Math.abs(topMomentum).toFixed(0)}% over 30 days (${topDetail.source}), the largest move behind this score.`,
  ];

  const others = ranked.slice(1, 3).map(([key, detail]) => {
    const m = detail.momentum as number;
    return `${SIGNAL_PHRASE[key]} ${m >= 0 ? "+" : ""}${m.toFixed(0)}%`;
  });

  if (others.length > 0) {
    parts.push(`Alongside it: ${others.join(", ")}.`);
  }

  if (coverage < 0.999) {
    parts.push(
      `Backed by ${Math.round(coverage * 100)}% of the four-signal model — the rest is unmeasured, not zero.`,
    );
  }

  return parts.join(" ");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
