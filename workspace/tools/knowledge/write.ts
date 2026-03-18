import { join } from "path";
import { VAULT_ROOT } from "./manifest.ts";
import type { CommandResult } from "../shared/base.ts";

export async function writeAction(flags: {
  path: string;
  title: string;
  category: string;
  body: string;
  tags?: string;
}): Promise<CommandResult<{ path: string }>> {
  const fullPath = join(VAULT_ROOT, flags.path);

  const frontmatter = [
    "---",
    `title: "${flags.title}"`,
    `category: ${flags.category}`,
    flags.tags ? `tags: [${flags.tags.split(",").map((t) => t.trim()).join(", ")}]` : null,
    `created_at: ${new Date().toISOString()}`,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const content = frontmatter + flags.body + "\n";
  await Bun.write(fullPath, content);

  return { success: true, data: { path: flags.path } };
}
