/**
 * Downloads candidate images into a local, gitignored cache so the vision
 * step can read bytes without re-fetching. Never redistributes images: only
 * derived metadata (brand/weirdness/sentiment) is meant to leave this folder.
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import type { BagCandidateImage } from "./types";

export interface DownloadResult {
  candidate: BagCandidateImage;
  localPath: string | null;
  error?: string;
}

function extensionFor(imageUrl: string): string {
  const ext = extname(new URL(imageUrl).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function downloadCandidate(
  candidate: BagCandidateImage,
  cacheDir: string,
): Promise<DownloadResult> {
  const localPath = `${cacheDir}/${candidate.id}${extensionFor(candidate.imageUrl)}`;

  if (await exists(localPath)) {
    return { candidate, localPath };
  }

  try {
    const response = await fetch(candidate.imageUrl);
    if (!response.ok) {
      return { candidate, localPath: null, error: `HTTP ${response.status}` };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(cacheDir, { recursive: true });
    await writeFile(localPath, bytes);
    return { candidate, localPath };
  } catch (error) {
    return { candidate, localPath: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function readImageBase64(localPath: string): Promise<string> {
  const bytes = await readFile(localPath);
  return bytes.toString("base64");
}

export function mediaTypeFor(localPath: string): string {
  const ext = extname(localPath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}
