/**
 * Per-image analysis via Claude's vision API — the "own the visual signal"
 * idea from the root README's roadmap, spiked here with an LLM classifier
 * instead of a trained CLIP-style model (no ML infra in this repo yet, and
 * a vision-language model is a reasonable stand-in for a one-off prototype).
 *
 * Brand and material calls are best-effort visual guesses, not verified fact —
 * treat the output as descriptive commentary, not a claim about what the
 * subject actually wore.
 */

import { mediaTypeFor, readImageBase64 } from "./download";
import type { BagAnalysis, BrandConfidence, SentimentLabel } from "./types";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a fashion-accessory analyst. You are shown one photograph that may
contain a handbag, clutch, or similar bag. Reply with ONLY a JSON object (no prose, no markdown
fences) matching exactly this shape:

{
  "bagDetected": boolean,
  "brand": string,            // best-guess brand from visible logo/hardware/silhouette, or "unknown"
  "brandConfidence": "high" | "medium" | "low" | "unknown",
  "shape": string,            // e.g. "structured top-handle", "slouchy hobo", "sculptural asymmetric"
  "material": string,         // e.g. "smooth leather", "quilted satin", "raffia", "PVC"
  "pattern": string,          // e.g. "solid", "logo monogram", "animal print", "graphic print"
  "colorway": string,
  "weirdness": {
    "score": number,          // 0-100: 0 = a plain classic bag, 100 = maximally unconventional/avant-garde
    "traits": string[],       // pick from/near: "unconventional shape", "loud print", "unexpected fabric",
                               // "exaggerated scale", "novelty form", "clashing pattern", "unusual hardware"
    "reasoning": string        // one or two sentences on what specifically makes it ordinary or strange
  },
  "sentiment": {
    "score": number,          // 0-100: how positively the bag choice reads aesthetically (100 = glowing)
    "label": "positive" | "neutral" | "negative",
    "reasoning": string
  },
  "caption": string           // one-line plain description of the bag
}

If no bag is visible, set bagDetected to false and use "unknown"/"n/a" placeholders for the rest,
weirdness.score 0, sentiment.score 50, sentiment.label "neutral".`;

interface AnthropicContentBlock {
  type: "text";
  text: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON object found in model response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function coerceAnalysis(imageId: string, parsed: unknown): BagAnalysis {
  const p = parsed as Record<string, unknown>;
  const weirdness = (p.weirdness ?? {}) as Record<string, unknown>;
  const sentiment = (p.sentiment ?? {}) as Record<string, unknown>;

  const clamp = (n: unknown): number => Math.max(0, Math.min(100, Number(n) || 0));

  return {
    imageId,
    bagDetected: Boolean(p.bagDetected),
    brand: typeof p.brand === "string" && p.brand ? p.brand : "unknown",
    brandConfidence: (["high", "medium", "low", "unknown"] as BrandConfidence[]).includes(
      p.brandConfidence as BrandConfidence,
    )
      ? (p.brandConfidence as BrandConfidence)
      : "unknown",
    shape: typeof p.shape === "string" ? p.shape : "unknown",
    material: typeof p.material === "string" ? p.material : "unknown",
    pattern: typeof p.pattern === "string" ? p.pattern : "unknown",
    colorway: typeof p.colorway === "string" ? p.colorway : "unknown",
    weirdness: {
      score: clamp(weirdness.score),
      traits: Array.isArray(weirdness.traits) ? weirdness.traits.map(String) : [],
      reasoning: typeof weirdness.reasoning === "string" ? weirdness.reasoning : "",
    },
    sentiment: {
      score: clamp(sentiment.score),
      label: (["positive", "neutral", "negative"] as SentimentLabel[]).includes(
        sentiment.label as SentimentLabel,
      )
        ? (sentiment.label as SentimentLabel)
        : "neutral",
      reasoning: typeof sentiment.reasoning === "string" ? sentiment.reasoning : "",
    },
    caption: typeof p.caption === "string" ? p.caption : "",
  };
}

export async function analyzeBagImage(
  imageId: string,
  localPath: string,
  apiKey: string,
): Promise<BagAnalysis> {
  const base64 = await readImageBase64(localPath);
  const mediaType = mediaTypeFor(localPath);

  const response = await fetch(MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Analyze the bag in this photo per the schema in your instructions." },
          ],
        },
      ],
    }),
  });

  const data = (await response.json()) as AnthropicResponse;
  if (!response.ok) {
    throw new Error(`[anthropic] ${data.error?.message ?? `HTTP ${response.status}`}`);
  }

  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  return coerceAnalysis(imageId, extractJson(text));
}
