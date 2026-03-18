import { join } from "path";

const VAULT_ROOT = join(import.meta.dir, "../workspace/knowledge/vault");

const seeds = [
  {
    path: "00-inbox/welcome.md",
    content: `---
title: "Welcome to Menschling"
category: inbox
created_at: ${new Date().toISOString()}
---

# Welcome

This is the Menschling knowledge vault. Documents placed here will be synced
to the OpenAI vector store and made searchable by agent brains.

## Getting started

1. Add documents to the appropriate vault directory
2. Run \`mensch knowledge sync\` to upload to the vector store
3. Use \`mensch knowledge search --query "..."\` to search
`,
  },
  {
    path: `04-log/${new Date().toISOString().slice(0, 10)}-system-init.md`,
    content: `---
title: "System Initialized"
category: log
tags: [system, init]
created_by: setup-script
created_at: ${new Date().toISOString()}
---

# System Initialized

Menschling workspace initialized with seed knowledge documents.
`,
  },
];

for (const seed of seeds) {
  const fullPath = join(VAULT_ROOT, seed.path);
  await Bun.write(fullPath, seed.content);
  console.log(`Seeded: ${seed.path}`);
}

console.log("Done.");
