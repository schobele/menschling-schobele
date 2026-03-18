import { db } from "../../../lib/db.ts";
import { NotFound } from "../../../lib/errors.ts";
import type { CommandResult } from "../shared/base.ts";

interface EntryInfo {
  path: string;
  contentHash: string;
  title: string | null;
  category: string | null;
  status: string;
  openaiFileId: string | null;
  vectorStoreFileId: string | null;
  summary: string | null;
  outline: string | null;
  wordCount: number | null;
  lastSynced: string | null;
  syncError: string | null;
}

export async function inspectAction(flags: {
  path: string;
}): Promise<CommandResult<EntryInfo>> {
  const row = db
    .query(
      "SELECT path, content_hash, title, category, status, openai_file_id, vector_store_file_id, summary, outline, word_count, last_synced, sync_error FROM entries WHERE path = ?1",
    )
    .get(flags.path) as Record<string, unknown> | null;

  if (!row) throw new NotFound("entry", flags.path);

  return {
    success: true,
    data: {
      path: row.path as string,
      contentHash: row.content_hash as string,
      title: row.title as string | null,
      category: row.category as string | null,
      status: row.status as string,
      openaiFileId: row.openai_file_id as string | null,
      vectorStoreFileId: row.vector_store_file_id as string | null,
      summary: row.summary as string | null,
      outline: row.outline as string | null,
      wordCount: row.word_count as number | null,
      lastSynced: row.last_synced as string | null,
      syncError: row.sync_error as string | null,
    },
  };
}
