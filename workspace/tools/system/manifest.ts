import type { CommandResult } from "../shared/base.ts";

interface ManifestStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export async function manifestAction(flags: {
  stats?: boolean;
}): Promise<CommandResult<ManifestStats>> {
  const { db } = await import("../../../lib/db.ts");

  const total = db.query("SELECT COUNT(*) as count FROM entries").get() as { count: number };

  const statusRows = db
    .query("SELECT status, COUNT(*) as count FROM entries GROUP BY status")
    .all() as { status: string; count: number }[];
  const byStatus: Record<string, number> = {};
  for (const row of statusRows) byStatus[row.status] = row.count;

  const catRows = db
    .query("SELECT category, COUNT(*) as count FROM entries GROUP BY category")
    .all() as { category: string; count: number }[];
  const byCategory: Record<string, number> = {};
  for (const row of catRows) byCategory[row.category] = row.count;

  return { success: true, data: { total: total.count, byStatus, byCategory } };
}
