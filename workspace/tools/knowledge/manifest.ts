const DIR_TO_CATEGORY: Record<string, string> = {
  "00-inbox": "inbox",
  "01-projects": "projects",
  "02-people": "people",
  "03-resources": "resources",
  "04-log": "log",
};

export function dirToCategory(relPath: string): string {
  return DIR_TO_CATEGORY[relPath.split("/")[0] ?? ""] ?? "inbox";
}

export const VAULT_ROOT = new URL(
  "../../../workspace/knowledge/vault",
  import.meta.url,
).pathname;
