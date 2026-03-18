import { test, expect } from "bun:test";
import { preprocess } from "./preprocess.ts";

test("preprocess extracts frontmatter", () => {
  const raw = `---
title: "Test Doc"
category: projects
tags: [foo, bar]
---

Hello world, this is a test document.`;

  const doc = preprocess("01-projects/test.md", raw);
  expect(doc.title).toBe("Test Doc");
  expect(doc.category).toBe("projects");
  expect(doc.tags).toBe("foo,bar");
  expect(doc.wordCount).toBeGreaterThan(0);
  expect(doc.contentHash).toHaveLength(64);
});

test("preprocess infers category from path", () => {
  const doc = preprocess("04-log/note.md", "# Note\n\nSome content.");
  expect(doc.category).toBe("log");
  expect(doc.title).toBe("note");
});
