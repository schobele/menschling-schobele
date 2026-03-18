import type { Command } from "commander";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const TOOLS_DIR = join(import.meta.dir, "..");

export async function discoverDomains(program: Command): Promise<void> {
  const skip = new Set(["shared", "cli.ts"]);
  for (const entry of readdirSync(TOOLS_DIR)) {
    if (skip.has(entry)) continue;
    const dir = join(TOOLS_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    const indexPath = join(dir, "index.ts");
    if (!existsSync(indexPath)) continue;
    try {
      const mod = await import(indexPath);
      if (typeof mod.register === "function") mod.register(program);
    } catch (err) {
      console.error(`[mensch] Failed to load domain "${entry}":`, err);
    }
  }
}
