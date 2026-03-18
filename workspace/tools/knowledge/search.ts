import { openai, vectorStoreId } from "../../../lib/openai.ts";
import type { CommandResult } from "../shared/base.ts";

interface SearchHit {
  score: number;
  filename: string;
  content: string;
}

export async function searchAction(flags: {
  query: string;
  filter?: string;
  top?: number;
}): Promise<CommandResult<{ hits: SearchHit[] }>> {
  const maxResults = flags.top ?? 5;

  // Build filter object from key=value string
  const filterObj: Record<string, string> = {};
  if (flags.filter) {
    const [key, value] = flags.filter.split("=");
    if (key && value) filterObj[key] = value;
  }

  const response = await openai.vectorStores.search(vectorStoreId(), {
    query: flags.query,
    max_num_results: maxResults,
  });

  const hits: SearchHit[] = response.data.map((result) => ({
    score: result.score,
    filename: result.filename ?? "unknown",
    content: result.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n")
      .slice(0, 500),
  }));

  // Client-side category filter if provided
  const filtered = filterObj.category
    ? hits.filter((h) => h.filename.toLowerCase().includes(filterObj.category!))
    : hits;

  return { success: true, data: { hits: filtered } };
}
