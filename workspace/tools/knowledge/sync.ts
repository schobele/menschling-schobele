import { db } from "../../../lib/db.ts";
import { openai, vectorStoreId } from "../../../lib/openai.ts";
import { logger } from "../../../lib/logger.ts";
import { VAULT_ROOT } from "./manifest.ts";
import { preprocess } from "./preprocess.ts";
import { summarizeDoc } from "./summarize.ts";
import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import type { CommandResult } from "../shared/base.ts";

function walkVault(dir: string, base: string = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walkVault(full, base));
    } else if (entry.endsWith(".md")) {
      files.push(relative(base, full));
    }
  }
  return files;
}

interface SyncResult {
  scanned: number;
  synced: number;
  skipped: number;
  errors: number;
  details: { path: string; action: string }[];
}

export async function syncAction(flags: {
  dryRun?: boolean;
  force?: boolean;
  path?: string;
}): Promise<CommandResult<SyncResult>> {
  const allFiles = walkVault(VAULT_ROOT);
  const filtered = flags.path
    ? allFiles.filter((f) => f.startsWith(flags.path!))
    : allFiles;

  const result: SyncResult = { scanned: filtered.length, synced: 0, skipped: 0, errors: 0, details: [] };

  const upsertQuery = db.query(`
    INSERT INTO entries (path, content_hash, title, category, tags, created_by, word_count, summary, outline, openai_file_id, vector_store_file_id, status, last_synced, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'synced', datetime('now'), datetime('now'))
    ON CONFLICT(path) DO UPDATE SET
      content_hash = excluded.content_hash,
      title = excluded.title,
      category = excluded.category,
      tags = excluded.tags,
      word_count = excluded.word_count,
      summary = excluded.summary,
      outline = excluded.outline,
      openai_file_id = excluded.openai_file_id,
      vector_store_file_id = excluded.vector_store_file_id,
      status = 'synced',
      last_synced = datetime('now'),
      updated_at = datetime('now'),
      sync_error = NULL
  `);

  const getExistingQuery = db.query("SELECT content_hash FROM entries WHERE path = ?1");

  for (const relPath of filtered) {
    try {
      const raw = await Bun.file(join(VAULT_ROOT, relPath)).text();
      const doc = preprocess(relPath, raw);

      // Check if hash changed
      const existing = getExistingQuery.get(relPath) as { content_hash: string } | null;
      if (!flags.force && existing?.content_hash === doc.contentHash) {
        result.skipped++;
        continue;
      }

      if (flags.dryRun) {
        result.details.push({ path: relPath, action: existing ? "update" : "create" });
        result.synced++;
        continue;
      }

      // Upload to OpenAI
      const file = await openai.files.create({
        file: new File([raw], relPath.split("/").pop() ?? "doc.md", { type: "text/markdown" }),
        purpose: "assistants",
      });

      const vsFile = await openai.vectorStores.files.create(vectorStoreId(), {
        file_id: file.id,
      });

      // Summarize
      const { summary, outline } = await summarizeDoc(doc.title, doc.bodyContent);

      // Upsert manifest
      upsertQuery.run(
        doc.path,
        doc.contentHash,
        doc.title,
        doc.category,
        doc.tags,
        doc.createdBy,
        doc.wordCount,
        summary,
        outline,
        file.id,
        vsFile.id,
      );

      result.synced++;
      result.details.push({ path: relPath, action: existing ? "update" : "create" });
      logger.info({ path: relPath, fileId: file.id }, "Synced");
    } catch (err) {
      result.errors++;
      logger.error({ path: relPath, err }, "Sync failed");

      // Record error in manifest
      db.query(
        "INSERT INTO entries (path, content_hash, status, sync_error) VALUES (?1, '', 'error', ?2) ON CONFLICT(path) DO UPDATE SET status = 'error', sync_error = ?2",
      ).run(relPath, String(err));
    }
  }

  return { success: result.errors === 0, data: result };
}
