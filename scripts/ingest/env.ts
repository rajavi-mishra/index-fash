/**
 * Minimal .env loader.
 *
 * Avoids a dependency and avoids depending on Node's --env-file flag, which
 * varies by version. Existing environment variables always win, so CI secrets
 * override anything in a local file.
 */

import { readFileSync } from "node:fs";

export function loadEnv(path = ".env"): void {
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    // No .env is fine — the keyless sources still run.
    return;
  }

  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
