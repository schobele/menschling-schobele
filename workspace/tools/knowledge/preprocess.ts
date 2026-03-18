import matter from "gray-matter";
import { createHash } from "crypto";
import { dirToCategory } from "./manifest.ts";

export interface PreprocessedDoc {
  path: string;
  contentHash: string;
  title: string;
  category: string;
  tags: string;
  createdBy: string;
  wordCount: number;
  rawContent: string;
  bodyContent: string;
}

export function preprocess(relPath: string, raw: string): PreprocessedDoc {
  const { data, content } = matter(raw);
  const contentHash = createHash("sha256").update(raw).digest("hex");
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  return {
    path: relPath,
    contentHash,
    title: (data.title as string) ?? relPath.split("/").pop()?.replace(/\.md$/, "") ?? relPath,
    category: (data.category as string) ?? dirToCategory(relPath),
    tags: Array.isArray(data.tags) ? data.tags.join(",") : ((data.tags as string) ?? ""),
    createdBy: (data.created_by as string) ?? "human",
    wordCount,
    rawContent: raw,
    bodyContent: content,
  };
}
