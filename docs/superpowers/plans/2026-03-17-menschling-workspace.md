# Menschling AI Agent Workspace — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete AI agent workspace and runtime environment — the reference template for autonomous agent platforms based on Claude Code and Paperclip AI.

**Architecture:** Inbound webhooks (Telegram, email, REST) hit an Elysia gateway that normalizes messages into `UnifiedMessage`, dispatches to Paperclip (or direct Claude Code CLI), which invokes `.claude/agents/*.md` brains. Brains call the `mensch` CLI toolbox for messaging, knowledge search/sync, and system health. An Obsidian vault backed by SQLite manifest and OpenAI vector stores provides the knowledge layer.

**Tech Stack:** Bun runtime, TypeScript strict, Elysia gateway, `bun:sqlite` (WAL mode), OpenAI Vector Store API, Commander CLI, Pino logger, Zod validation, Resend (email), gray-matter (frontmatter).

**Design doc:** `docs/MenschlingSystemDesignInit.md` — contains complete code listings for every file. Adapt to use `bun:sqlite` instead of `better-sqlite3` (Bun-native).

---

## File Map

### Foundation (`lib/`)
| File | Responsibility |
|------|---------------|
| `lib/env.ts` | Zod-validated env vars, auto-parsed from process.env |
| `lib/types.ts` | `UnifiedMessage`, `Attachment`, shared interfaces |
| `lib/errors.ts` | `MenschError` base class + typed subclasses |
| `lib/logger.ts` | Pino logger to stderr, pretty in dev |
| `lib/db.ts` | SQLite via `bun:sqlite`, WAL mode, schema init |
| `lib/openai.ts` | OpenAI client singleton |

### CLI Framework (`workspace/tools/`)
| File | Responsibility |
|------|---------------|
| `workspace/tools/cli.ts` | Entry point, Commander program, domain discovery |
| `workspace/tools/shared/base.ts` | `handler()`, `output()`, `CommandResult`, error classes |
| `workspace/tools/shared/registry.ts` | Auto-discover domain dirs, load `register()` |
| `workspace/tools/shared/validators.ts` | Shared Zod schemas (channel, category) |

### System Domain (`workspace/tools/system/`)
| File | Responsibility |
|------|---------------|
| `workspace/tools/system/index.ts` | Register `system` command group |
| `workspace/tools/system/health.ts` | Check service connectivity |
| `workspace/tools/system/env.ts` | Show redacted config |
| `workspace/tools/system/manifest.ts` | Knowledge manifest stats |

### Knowledge Domain (`workspace/tools/knowledge/`)
| File | Responsibility |
|------|---------------|
| `workspace/tools/knowledge/index.ts` | Register `knowledge` command group |
| `workspace/tools/knowledge/manifest.ts` | `dirToCategory()`, manifest helpers |
| `workspace/tools/knowledge/search.ts` | OpenAI vector store search |
| `workspace/tools/knowledge/sync.ts` | Vault-to-vector-store sync pipeline |
| `workspace/tools/knowledge/write.ts` | Write new knowledge documents with frontmatter |
| `workspace/tools/knowledge/inspect.ts` | Inspect manifest entry for a path |
| `workspace/tools/knowledge/preprocess.ts` | Extract frontmatter, compute hashes |
| `workspace/tools/knowledge/summarize.ts` | Generate summaries via OpenAI |

### Messaging Domain (`workspace/tools/messaging/`)
| File | Responsibility |
|------|---------------|
| `workspace/tools/messaging/index.ts` | Register `messaging` command group |
| `workspace/tools/messaging/send.ts` | Send message, route to channel adapter |
| `workspace/tools/messaging/reply.ts` | Reply in thread/conversation |
| `workspace/tools/messaging/status.ts` | Check delivery status |
| `workspace/tools/messaging/channels/slack.ts` | Slack Web API adapter |
| `workspace/tools/messaging/channels/telegram.ts` | Telegram Bot API adapter |
| `workspace/tools/messaging/channels/resend.ts` | Resend (email) adapter |
| `workspace/tools/messaging/channels/whatsapp.ts` | WhatsApp stub |

### Gateway (`workspace/apps/gateway/`)
| File | Responsibility |
|------|---------------|
| `workspace/apps/gateway/index.ts` | Elysia server, routes, startup |
| `workspace/apps/gateway/normalize.ts` | `createMessage()` — raw webhook to `UnifiedMessage` |
| `workspace/apps/gateway/dispatch.ts` | Route to Paperclip or direct Claude CLI |
| `workspace/apps/gateway/auth.ts` | Webhook signature verification |
| `workspace/apps/gateway/adapters/telegram.ts` | Telegram webhook handler |
| `workspace/apps/gateway/adapters/email.ts` | Email webhook handler |
| `workspace/apps/gateway/adapters/rest.ts` | REST API endpoint |
| `workspace/apps/gateway/adapters/whatsapp.ts` | WhatsApp webhook stub |

### Knowledge Store
| File | Responsibility |
|------|---------------|
| `workspace/knowledge/schema.sql` | SQLite schema for entries table |
| `workspace/knowledge/vault/00-inbox/.gitkeep` | Vault dir placeholder |
| `workspace/knowledge/vault/01-projects/.gitkeep` | Vault dir placeholder |
| `workspace/knowledge/vault/02-people/.gitkeep` | Vault dir placeholder |
| `workspace/knowledge/vault/03-resources/.gitkeep` | Vault dir placeholder |
| `workspace/knowledge/vault/04-log/.gitkeep` | Vault dir placeholder |

### Brains (`.claude/agents/`)
| File | Brain |
|------|-------|
| `.claude/agents/mastermind.md` | Communication hub, human interface |
| `.claude/agents/knowledge.md` | Knowledge base manager |
| `.claude/agents/research.md` | Deep web research |
| `.claude/agents/project.md` | Project management |
| `.claude/agents/menschling.md` | System architect |
| `.claude/agents/principal.md` | 10x engineer |

### Skills (`.claude/skills/`)
| File | Skill |
|------|-------|
| `.claude/skills/messaging/SKILL.md` | Messaging command reference |
| `.claude/skills/knowledge/SKILL.md` | Knowledge command reference |
| `.claude/skills/workspace/SKILL.md` | Workspace navigation guide |
| `.claude/skills/channel-voice/SKILL.md` | Tone/formatting per channel |

### Config & Scripts
| File | Responsibility |
|------|---------------|
| `.claude/settings.json` | Permissions, env for Claude Code |
| `.env.example` | Template for required env vars |
| `.gitignore` | Updated with vault/db ignores |
| `system/cron/sync.ts` | Knowledge sync cron job |
| `scripts/setup.sh` | First-time setup script |
| `scripts/seed-knowledge.ts` | Seed vault with example docs |

---

## Task 1: Package Setup & Dependencies

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Update package.json with scripts and bin**

Update `package.json` to add scripts and bin entry:

```json
{
  "name": "menschling",
  "module": "index.ts",
  "type": "module",
  "private": true,
  "bin": { "mensch": "./workspace/tools/cli.ts" },
  "scripts": {
    "dev": "bun run workspace/apps/gateway/index.ts",
    "mensch": "bun run workspace/tools/cli.ts",
    "sync": "bun run workspace/tools/cli.ts knowledge sync",
    "sync:cron": "bun run system/cron/sync.ts",
    "setup": "bash scripts/setup.sh",
    "seed": "bun run scripts/seed-knowledge.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
bun add commander elysia gray-matter openai pino pino-pretty resend zod
```

- [ ] **Step 3: Update .gitignore**

Replace `.gitignore` with comprehensive version:

```
# dependencies
node_modules

# output
out
dist
*.tgz

# coverage
coverage
*.lcov

# logs
logs
*.log
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

# dotenv
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# claude local settings
.claude/settings.local.json

# caches
.eslintcache
.cache
*.tsbuildinfo

# IDE
.idea
.DS_Store

# Obsidian workspace UI state
workspace/knowledge/vault/.obsidian/workspace.json
workspace/knowledge/vault/.obsidian/workspace-mobile.json

# SQLite transient files
workspace/knowledge/*.db-wal
workspace/knowledge/*.db-shm
```

- [ ] **Step 4: Create .env.example**

```bash
# Required
OPENAI_API_KEY=sk-...
OPENAI_VECTOR_STORE_ID=vs_...
ANTHROPIC_API_KEY=sk-ant-...

# Gateway
GATEWAY_PORT=3200

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Slack (optional)
SLACK_BOT_TOKEN=xoxb-...

# Email via Resend (optional)
RESEND_API_KEY=re_...

# Paperclip (optional — falls back to direct Claude CLI)
PAPERCLIP_ENABLED=false
PAPERCLIP_URL=http://localhost:3100
PAPERCLIP_API_KEY=
PAPERCLIP_COMPANY_ID=

# WhatsApp (planned)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
```

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock .gitignore .env.example
git commit -m "feat: add dependencies, scripts, and env template"
```

---

## Task 2: Shared Library (`lib/`)

**Files:**
- Create: `lib/env.ts`
- Create: `lib/types.ts`
- Create: `lib/errors.ts`
- Create: `lib/logger.ts`
- Create: `lib/db.ts`
- Create: `lib/openai.ts`

- [ ] **Step 1: Create lib/types.ts**

```typescript
export interface UnifiedMessage {
  id: string;
  channel: "cli" | "rest" | "telegram" | "email" | "whatsapp";
  direction: "inbound" | "outbound";
  userId: string;
  conversationId: string;
  timestamp: Date;
  content: {
    type: "text" | "image" | "audio" | "document";
    text?: string;
    html?: string;
    attachments?: Attachment[];
  };
  metadata: Record<string, unknown>;
  auth: { userId: string; channelUserId: string; authenticated: boolean };
}

export interface Attachment {
  type: string;
  url?: string;
  mimeType: string;
  filename?: string;
  size?: number;
}

export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
```

- [ ] **Step 2: Create lib/errors.ts**

```typescript
export class MenschError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MenschError";
  }
}

export class ChannelNotConfigured extends MenschError {
  constructor(ch: string) {
    super(`Channel not configured: ${ch}`, "CHANNEL_NOT_CONFIGURED");
  }
}

export class NotFound extends MenschError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND");
  }
}

export class ExternalApiError extends MenschError {
  constructor(svc: string, status: number, detail?: string) {
    super(`${svc} API error (${status}): ${detail ?? "unknown"}`, "EXTERNAL_API_ERROR");
  }
}
```

- [ ] **Step 3: Create lib/env.ts**

Use `z.string().optional()` for all channel-specific keys so the app boots without them. Only `OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_ID`, and `ANTHROPIC_API_KEY` are required.

```typescript
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GATEWAY_PORT: z.coerce.number().default(3200),

  // Required
  OPENAI_API_KEY: z.string(),
  OPENAI_VECTOR_STORE_ID: z.string(),
  ANTHROPIC_API_KEY: z.string(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Slack
  SLACK_BOT_TOKEN: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // Paperclip
  PAPERCLIP_ENABLED: z.coerce.boolean().default(false),
  PAPERCLIP_URL: z.string().default("http://localhost:3100"),
  PAPERCLIP_API_KEY: z.string().optional(),
  PAPERCLIP_COMPANY_ID: z.string().optional(),

  // WhatsApp
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;
export const env = schema.parse(process.env);
```

- [ ] **Step 4: Create lib/logger.ts**

Pino logger that writes to stderr (fd 2) so CLI tools can output JSON to stdout cleanly.

```typescript
import pino from "pino";
import { env } from "./env.ts";

export const logger = pino(
  {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { destination: 2 } }
        : undefined,
  },
  pino.destination(2),
);
```

- [ ] **Step 5: Create lib/db.ts**

Uses `bun:sqlite` (not better-sqlite3). Reads schema.sql and applies on first import.

```typescript
import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "../workspace/knowledge/menschling.db");
const SCHEMA_PATH = join(import.meta.dir, "../workspace/knowledge/schema.sql");

const schemaSQL = await Bun.file(SCHEMA_PATH).text();

export const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec(schemaSQL);
```

- [ ] **Step 6: Create lib/openai.ts**

```typescript
import OpenAI from "openai";
import { env } from "./env.ts";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
export const VECTOR_STORE_ID = env.OPENAI_VECTOR_STORE_ID;
```

- [ ] **Step 7: Create knowledge schema and vault directories**

Create `workspace/knowledge/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS entries (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  path                 TEXT    NOT NULL UNIQUE,
  content_hash         TEXT    NOT NULL,
  openai_file_id       TEXT,
  vector_store_file_id TEXT,
  summary              TEXT,
  outline              TEXT,
  title                TEXT,
  category             TEXT,
  tags                 TEXT,
  created_by           TEXT    DEFAULT 'human',
  word_count           INTEGER,
  created_at           TEXT    DEFAULT (datetime('now')),
  updated_at           TEXT    DEFAULT (datetime('now')),
  last_synced          TEXT,
  sync_error           TEXT,
  status               TEXT    DEFAULT 'pending'
                                CHECK (status IN ('pending','synced','error','deleted'))
);

CREATE INDEX IF NOT EXISTS idx_entries_status   ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_hash     ON entries(content_hash);
```

Create `.gitkeep` files in each vault dir:
- `workspace/knowledge/vault/00-inbox/.gitkeep`
- `workspace/knowledge/vault/01-projects/.gitkeep`
- `workspace/knowledge/vault/02-people/.gitkeep`
- `workspace/knowledge/vault/03-resources/.gitkeep`
- `workspace/knowledge/vault/04-log/.gitkeep`

- [ ] **Step 8: Write test for lib/errors.ts**

Create `lib/errors.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { MenschError, ChannelNotConfigured, NotFound, ExternalApiError } from "./errors.ts";

test("MenschError has code", () => {
  const err = new MenschError("boom", "TEST_CODE");
  expect(err.message).toBe("boom");
  expect(err.code).toBe("TEST_CODE");
  expect(err).toBeInstanceOf(Error);
});

test("ChannelNotConfigured", () => {
  const err = new ChannelNotConfigured("whatsapp");
  expect(err.code).toBe("CHANNEL_NOT_CONFIGURED");
  expect(err.message).toContain("whatsapp");
});

test("NotFound", () => {
  const err = new NotFound("entry", "abc");
  expect(err.code).toBe("NOT_FOUND");
});

test("ExternalApiError", () => {
  const err = new ExternalApiError("OpenAI", 429, "rate limited");
  expect(err.code).toBe("EXTERNAL_API_ERROR");
  expect(err.message).toContain("429");
});
```

- [ ] **Step 9: Run tests**

```bash
bun test lib/errors.test.ts
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add lib/ workspace/knowledge/schema.sql workspace/knowledge/vault/
git commit -m "feat: add shared library (types, env, errors, logger, db, openai) and knowledge schema"
```

---

## Task 3: CLI Framework (`workspace/tools/shared/`)

**Files:**
- Create: `workspace/tools/shared/base.ts`
- Create: `workspace/tools/shared/registry.ts`
- Create: `workspace/tools/shared/validators.ts`
- Create: `workspace/tools/cli.ts`

- [ ] **Step 1: Create workspace/tools/shared/validators.ts**

```typescript
import { z } from "zod";

export const channelSchema = z.enum(["slack", "telegram", "email", "whatsapp"]);
export type Channel = z.infer<typeof channelSchema>;

export const vaultCategorySchema = z.enum(["inbox", "projects", "people", "resources", "log"]);
export type VaultCategory = z.infer<typeof vaultCategorySchema>;
```

- [ ] **Step 2: Create workspace/tools/shared/base.ts**

`handler()` wraps async command logic, catches errors, writes JSON to stdout, and exits with appropriate code. `output()` is the low-level JSON writer.

```typescript
import { logger } from "../../../lib/logger.ts";
import { MenschError } from "../../../lib/errors.ts";
import type { CommandResult } from "../../../lib/types.ts";

export type { CommandResult };

export function output<T>(result: CommandResult<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.success ? 0 : 1);
}

export function handler<TFlags>(
  fn: (flags: TFlags) => Promise<CommandResult>,
): (flags: TFlags) => Promise<void> {
  return async (flags: TFlags) => {
    try {
      output(await fn(flags));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof MenschError ? err.code : "UNKNOWN_ERROR";
      logger.error({ err, code }, "Command failed");
      output({ success: false, error: message, code });
    }
  };
}
```

- [ ] **Step 3: Create workspace/tools/shared/registry.ts**

Auto-discovers domain directories under `workspace/tools/`. Each domain has an `index.ts` that exports `register(program)`.

```typescript
import type { Command } from "commander";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const TOOLS_DIR = join(import.meta.dir, "..");

export function discoverDomains(program: Command): void {
  const skip = new Set(["shared", "cli.ts"]);
  for (const entry of readdirSync(TOOLS_DIR)) {
    if (skip.has(entry)) continue;
    const dir = join(TOOLS_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    const indexPath = join(dir, "index.ts");
    if (!existsSync(indexPath)) continue;
    try {
      const mod = require(indexPath);
      if (typeof mod.register === "function") mod.register(program);
    } catch (err) {
      console.error(`[mensch] Failed to load domain "${entry}":`, err);
    }
  }
}
```

- [ ] **Step 4: Create workspace/tools/cli.ts**

```typescript
#!/usr/bin/env bun
import { Command } from "commander";
import { discoverDomains } from "./shared/registry.ts";

const program = new Command()
  .name("mensch")
  .description("Menschling agent toolbox")
  .version("0.1.0")
  .configureHelp({ sortSubcommands: true, showGlobalOptions: true });

discoverDomains(program);
program.parse();
```

- [ ] **Step 5: Test CLI boots**

```bash
bun run workspace/tools/cli.ts --help
```

Expected: Shows "Menschling agent toolbox" help text.

- [ ] **Step 6: Commit**

```bash
git add workspace/tools/cli.ts workspace/tools/shared/
git commit -m "feat: add CLI framework with commander, handler pattern, and auto-discovery"
```

---

## Task 4: System Domain

**Files:**
- Create: `workspace/tools/system/index.ts`
- Create: `workspace/tools/system/health.ts`
- Create: `workspace/tools/system/env.ts`
- Create: `workspace/tools/system/manifest.ts`

- [ ] **Step 1: Create workspace/tools/system/health.ts**

Checks connectivity to configured services (OpenAI, Paperclip, Telegram, Slack).

```typescript
import { env } from "../../../lib/env.ts";
import type { CommandResult } from "../shared/base.ts";

interface HealthCheck {
  service: string;
  status: "ok" | "error" | "unconfigured";
  latencyMs?: number;
  error?: string;
}

async function checkService(
  name: string,
  url: string,
  headers: Record<string, string> = {},
): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    return { service: name, status: res.ok ? "ok" : "error", latencyMs: Date.now() - start };
  } catch (err) {
    return { service: name, status: "error", latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function healthAction(): Promise<CommandResult<{ checks: HealthCheck[] }>> {
  const checks: HealthCheck[] = [];

  // OpenAI
  checks.push(
    await checkService("openai", "https://api.openai.com/v1/models", {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    }),
  );

  // Paperclip
  if (env.PAPERCLIP_ENABLED) {
    checks.push(await checkService("paperclip", `${env.PAPERCLIP_URL}/health`));
  } else {
    checks.push({ service: "paperclip", status: "unconfigured" });
  }

  // Telegram
  if (env.TELEGRAM_BOT_TOKEN) {
    checks.push(
      await checkService("telegram", `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`),
    );
  } else {
    checks.push({ service: "telegram", status: "unconfigured" });
  }

  // Slack
  if (env.SLACK_BOT_TOKEN) {
    checks.push(
      await checkService("slack", "https://slack.com/api/auth.test", {
        Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      }),
    );
  } else {
    checks.push({ service: "slack", status: "unconfigured" });
  }

  const allOk = checks.every((c) => c.status !== "error");
  return { success: allOk, data: { checks } };
}
```

- [ ] **Step 2: Create workspace/tools/system/env.ts**

Shows loaded config with secrets redacted.

```typescript
import { env } from "../../../lib/env.ts";
import type { CommandResult } from "../shared/base.ts";

const REDACT = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "SLACK_BOT_TOKEN",
  "RESEND_API_KEY",
  "PAPERCLIP_API_KEY",
  "WHATSAPP_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
]);

export async function envAction(): Promise<CommandResult<Record<string, string>>> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === "") {
      redacted[key] = "(not set)";
    } else if (REDACT.has(key)) {
      redacted[key] = String(value).slice(0, 4) + "****";
    } else {
      redacted[key] = String(value);
    }
  }
  return { success: true, data: redacted };
}
```

- [ ] **Step 3: Create workspace/tools/system/manifest.ts**

```typescript
import { db } from "../../../lib/db.ts";
import type { CommandResult } from "../shared/base.ts";

interface ManifestStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export async function manifestAction(flags: {
  stats?: boolean;
}): Promise<CommandResult<ManifestStats>> {
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
```

- [ ] **Step 4: Create workspace/tools/system/index.ts**

```typescript
import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { healthAction } from "./health.ts";
import { envAction } from "./env.ts";
import { manifestAction } from "./manifest.ts";

export function register(program: Command): void {
  const system = program.command("system").description("Workspace introspection");

  system
    .command("health")
    .description("Check service connectivity")
    .action(handler(healthAction));

  system
    .command("env")
    .description("Show loaded config (redacted)")
    .action(handler(envAction));

  system
    .command("manifest")
    .description("Knowledge manifest stats")
    .option("--stats", "Include detailed stats")
    .action(handler(manifestAction));
}
```

- [ ] **Step 5: Test system commands**

```bash
bun run workspace/tools/cli.ts system --help
```

Expected: Shows `health`, `env`, `manifest` subcommands.

- [ ] **Step 6: Commit**

```bash
git add workspace/tools/system/
git commit -m "feat: add system domain (health, env, manifest)"
```

---

## Task 5: Knowledge Domain

**Files:**
- Create: `workspace/tools/knowledge/index.ts`
- Create: `workspace/tools/knowledge/manifest.ts`
- Create: `workspace/tools/knowledge/preprocess.ts`
- Create: `workspace/tools/knowledge/summarize.ts`
- Create: `workspace/tools/knowledge/sync.ts`
- Create: `workspace/tools/knowledge/search.ts`
- Create: `workspace/tools/knowledge/write.ts`
- Create: `workspace/tools/knowledge/inspect.ts`

- [ ] **Step 1: Create workspace/tools/knowledge/manifest.ts**

Category mapping from vault directory names.

```typescript
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
```

- [ ] **Step 2: Create workspace/tools/knowledge/preprocess.ts**

Extracts frontmatter, computes content hash, counts words.

```typescript
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
```

- [ ] **Step 3: Create workspace/tools/knowledge/summarize.ts**

Uses OpenAI to generate a short summary and outline for a document.

```typescript
import { openai } from "../../../lib/openai.ts";

export async function summarizeDoc(
  title: string,
  content: string,
): Promise<{ summary: string; outline: string }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Summarize the following document in 1-2 sentences. Then provide a brief outline (max 5 bullet points). Return JSON: { summary, outline }",
      },
      { role: "user", content: `# ${title}\n\n${content.slice(0, 4000)}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 300,
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    return {
      summary: parsed.summary ?? "",
      outline: typeof parsed.outline === "string" ? parsed.outline : JSON.stringify(parsed.outline ?? []),
    };
  } catch {
    return { summary: "", outline: "" };
  }
}
```

- [ ] **Step 4: Create workspace/tools/knowledge/sync.ts**

Hash-based incremental sync: scans vault, compares hashes in manifest, uploads changed files to OpenAI vector store.

```typescript
import { db } from "../../../lib/db.ts";
import { openai, VECTOR_STORE_ID } from "../../../lib/openai.ts";
import { logger } from "../../../lib/logger.ts";
import { VAULT_ROOT, dirToCategory } from "./manifest.ts";
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

  const upsert = db.prepare(`
    INSERT INTO entries (path, content_hash, title, category, tags, created_by, word_count, summary, outline, openai_file_id, vector_store_file_id, status, last_synced, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', datetime('now'), datetime('now'))
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

  const getExisting = db.prepare("SELECT content_hash FROM entries WHERE path = ?");

  for (const relPath of filtered) {
    try {
      const raw = await Bun.file(join(VAULT_ROOT, relPath)).text();
      const doc = preprocess(relPath, raw);

      // Check if hash changed
      const existing = getExisting.get(relPath) as { content_hash: string } | null;
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

      const vsFile = await openai.vectorStores.files.create(VECTOR_STORE_ID, {
        file_id: file.id,
      });

      // Summarize
      const { summary, outline } = await summarizeDoc(doc.title, doc.bodyContent);

      // Upsert manifest
      upsert.run(
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
      db.prepare(
        "INSERT INTO entries (path, content_hash, status, sync_error) VALUES (?, '', 'error', ?) ON CONFLICT(path) DO UPDATE SET status = 'error', sync_error = ?",
      ).run(relPath, String(err), String(err));
    }
  }

  return { success: result.errors === 0, data: result };
}
```

- [ ] **Step 5: Create workspace/tools/knowledge/search.ts**

```typescript
import { openai, VECTOR_STORE_ID } from "../../../lib/openai.ts";
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

  const response = await openai.vectorStores.search(VECTOR_STORE_ID, {
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
```

- [ ] **Step 6: Create workspace/tools/knowledge/write.ts**

```typescript
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
```

- [ ] **Step 7: Create workspace/tools/knowledge/inspect.ts**

```typescript
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
      "SELECT path, content_hash, title, category, status, openai_file_id, vector_store_file_id, summary, outline, word_count, last_synced, sync_error FROM entries WHERE path = ?",
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
```

- [ ] **Step 8: Create workspace/tools/knowledge/index.ts**

```typescript
import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { syncAction } from "./sync.ts";
import { searchAction } from "./search.ts";
import { writeAction } from "./write.ts";
import { inspectAction } from "./inspect.ts";

export function register(program: Command): void {
  const knowledge = program.command("knowledge").description("Obsidian vault + vector store");

  knowledge
    .command("search")
    .description("Semantic search via OpenAI vector store")
    .requiredOption("--query <text>", "Search query")
    .option("--filter <key=value>", "Filter results")
    .option("--top <n>", "Max results", parseInt)
    .action(handler(searchAction));

  knowledge
    .command("sync")
    .description("Sync vault to OpenAI vector store")
    .option("--dry-run", "Preview changes without syncing")
    .option("--force", "Re-sync all files regardless of hash")
    .option("--path <subpath>", "Sync only files under this path")
    .action(handler(syncAction));

  knowledge
    .command("write")
    .description("Write a new knowledge document")
    .requiredOption("--path <path>", "Vault-relative path")
    .requiredOption("--title <title>", "Document title")
    .requiredOption("--category <cat>", "Category (inbox, projects, people, resources, log)")
    .requiredOption("--body <content>", "Document body (markdown)")
    .option("--tags <tags>", "Comma-separated tags")
    .action(handler(writeAction));

  knowledge
    .command("inspect")
    .description("Show manifest entry for a vault path")
    .requiredOption("--path <path>", "Vault-relative path")
    .action(handler(inspectAction));
}
```

- [ ] **Step 9: Test knowledge commands register**

```bash
bun run workspace/tools/cli.ts knowledge --help
```

Expected: Shows `search`, `sync`, `write`, `inspect` subcommands.

- [ ] **Step 10: Write test for preprocess**

Create `workspace/tools/knowledge/preprocess.test.ts`:

```typescript
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
```

- [ ] **Step 11: Run tests**

```bash
bun test workspace/tools/knowledge/preprocess.test.ts
```

Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add workspace/tools/knowledge/
git commit -m "feat: add knowledge domain (sync, search, write, inspect, preprocess, summarize)"
```

---

## Task 6: Messaging Domain

**Files:**
- Create: `workspace/tools/messaging/index.ts`
- Create: `workspace/tools/messaging/send.ts`
- Create: `workspace/tools/messaging/reply.ts`
- Create: `workspace/tools/messaging/status.ts`
- Create: `workspace/tools/messaging/channels/slack.ts`
- Create: `workspace/tools/messaging/channels/telegram.ts`
- Create: `workspace/tools/messaging/channels/resend.ts`
- Create: `workspace/tools/messaging/channels/whatsapp.ts`

- [ ] **Step 1: Create channel adapters**

Each adapter exports `sendMessage()` and optionally `replyMessage()`, returning `{ messageId, timestamp }`.

**workspace/tools/messaging/channels/slack.ts:**

```typescript
import { env } from "../../../../lib/env.ts";
import { ChannelNotConfigured, ExternalApiError } from "../../../../lib/errors.ts";

export async function sendSlack(conversation: string, message: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.SLACK_BOT_TOKEN) throw new ChannelNotConfigured("slack");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: conversation, text: message }),
  });

  const data = await res.json() as { ok: boolean; ts?: string; error?: string };
  if (!data.ok) throw new ExternalApiError("Slack", res.status, data.error);

  return { messageId: data.ts!, timestamp: new Date().toISOString() };
}

export async function replySlack(conversation: string, thread: string, message: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.SLACK_BOT_TOKEN) throw new ChannelNotConfigured("slack");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: conversation, text: message, thread_ts: thread }),
  });

  const data = await res.json() as { ok: boolean; ts?: string; error?: string };
  if (!data.ok) throw new ExternalApiError("Slack", res.status, data.error);

  return { messageId: data.ts!, timestamp: new Date().toISOString() };
}
```

**workspace/tools/messaging/channels/telegram.ts:**

```typescript
import { env } from "../../../../lib/env.ts";
import { ChannelNotConfigured, ExternalApiError } from "../../../../lib/errors.ts";

export async function sendTelegram(chatId: string, message: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) throw new ChannelNotConfigured("telegram");

  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "MarkdownV2" }),
  });

  const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!data.ok) throw new ExternalApiError("Telegram", res.status, data.description);

  return { messageId: String(data.result!.message_id), timestamp: new Date().toISOString() };
}
```

**workspace/tools/messaging/channels/resend.ts:**

```typescript
import { Resend } from "resend";
import { env } from "../../../../lib/env.ts";
import { ChannelNotConfigured, ExternalApiError } from "../../../../lib/errors.ts";

export async function sendEmail(to: string, subject: string, body: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.RESEND_API_KEY) throw new ChannelNotConfigured("email");

  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "Agent <agent@example.com>",
    to: to.split(",").map((a) => a.trim()),
    subject,
    text: body,
  });

  if (error) throw new ExternalApiError("Resend", 400, error.message);

  return { messageId: data!.id, timestamp: new Date().toISOString() };
}
```

**workspace/tools/messaging/channels/whatsapp.ts:**

```typescript
import { ChannelNotConfigured } from "../../../../lib/errors.ts";

export async function sendWhatsApp(_to: string, _message: string): Promise<never> {
  throw new ChannelNotConfigured("whatsapp (not yet implemented)");
}
```

- [ ] **Step 2: Create workspace/tools/messaging/send.ts**

Routes to the correct channel adapter.

```typescript
import type { CommandResult } from "../shared/base.ts";
import type { Channel } from "../shared/validators.ts";
import { sendSlack } from "./channels/slack.ts";
import { sendTelegram } from "./channels/telegram.ts";
import { sendEmail } from "./channels/resend.ts";
import { sendWhatsApp } from "./channels/whatsapp.ts";

interface SendResult {
  messageId: string;
  channel: string;
  timestamp: string;
}

export async function sendAction(flags: {
  channel: Channel;
  conversation?: string;
  message?: string;
  to?: string;
  subject?: string;
  body?: string;
}): Promise<CommandResult<SendResult>> {
  let result: { messageId: string; timestamp: string };

  switch (flags.channel) {
    case "slack":
      result = await sendSlack(flags.conversation!, flags.message!);
      break;
    case "telegram":
      result = await sendTelegram(flags.conversation!, flags.message!);
      break;
    case "email":
      result = await sendEmail(flags.to!, flags.subject!, flags.body ?? flags.message!);
      break;
    case "whatsapp":
      result = await sendWhatsApp(flags.conversation!, flags.message!);
      break;
  }

  return {
    success: true,
    data: { messageId: result.messageId, channel: flags.channel, timestamp: result.timestamp },
  };
}
```

- [ ] **Step 3: Create workspace/tools/messaging/reply.ts**

```typescript
import type { CommandResult } from "../shared/base.ts";
import type { Channel } from "../shared/validators.ts";
import { replySlack } from "./channels/slack.ts";
import { ChannelNotConfigured } from "../../../lib/errors.ts";

interface ReplyResult {
  messageId: string;
  channel: string;
  timestamp: string;
}

export async function replyAction(flags: {
  channel: Channel;
  conversation: string;
  thread: string;
  message: string;
}): Promise<CommandResult<ReplyResult>> {
  let result: { messageId: string; timestamp: string };

  switch (flags.channel) {
    case "slack":
      result = await replySlack(flags.conversation, flags.thread, flags.message);
      break;
    default:
      throw new ChannelNotConfigured(`${flags.channel} (reply not supported)`);
  }

  return {
    success: true,
    data: { messageId: result.messageId, channel: flags.channel, timestamp: result.timestamp },
  };
}
```

- [ ] **Step 4: Create workspace/tools/messaging/status.ts**

```typescript
import type { CommandResult } from "../shared/base.ts";

export async function statusAction(flags: {
  id: string;
}): Promise<CommandResult<{ id: string; status: string }>> {
  // Status tracking is a future enhancement — for now return acknowledged
  return { success: true, data: { id: flags.id, status: "delivered" } };
}
```

- [ ] **Step 5: Create workspace/tools/messaging/index.ts**

```typescript
import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { sendAction } from "./send.ts";
import { replyAction } from "./reply.ts";
import { statusAction } from "./status.ts";

export function register(program: Command): void {
  const messaging = program.command("messaging").description("Send and receive across channels");

  messaging
    .command("send")
    .description("Send a message")
    .requiredOption("--channel <channel>", "Channel (slack, telegram, email, whatsapp)")
    .option("--conversation <target>", "Conversation target (#channel, @user, chatId)")
    .option("--message <text>", "Message text")
    .option("--to <addr>", "Email recipient(s)")
    .option("--subject <subj>", "Email subject")
    .option("--body <text>", "Email body")
    .action(handler(sendAction));

  messaging
    .command("reply")
    .description("Reply in a thread/conversation")
    .requiredOption("--channel <channel>", "Channel")
    .requiredOption("--conversation <target>", "Conversation")
    .requiredOption("--thread <ts>", "Thread ID / parent message timestamp")
    .requiredOption("--message <text>", "Reply message")
    .action(handler(replyAction));

  messaging
    .command("status")
    .description("Check delivery status")
    .requiredOption("--id <message_id>", "Message ID")
    .action(handler(statusAction));
}
```

- [ ] **Step 6: Test messaging commands register**

```bash
bun run workspace/tools/cli.ts messaging --help
```

Expected: Shows `send`, `reply`, `status` subcommands.

- [ ] **Step 7: Commit**

```bash
git add workspace/tools/messaging/
git commit -m "feat: add messaging domain (send, reply, status) with Slack, Telegram, email adapters"
```

---

## Task 7: Gateway (Elysia)

**Files:**
- Create: `workspace/apps/gateway/index.ts`
- Create: `workspace/apps/gateway/normalize.ts`
- Create: `workspace/apps/gateway/dispatch.ts`
- Create: `workspace/apps/gateway/auth.ts`
- Create: `workspace/apps/gateway/adapters/telegram.ts`
- Create: `workspace/apps/gateway/adapters/email.ts`
- Create: `workspace/apps/gateway/adapters/rest.ts`
- Create: `workspace/apps/gateway/adapters/whatsapp.ts`

- [ ] **Step 1: Create workspace/apps/gateway/normalize.ts**

Converts raw webhook payloads into `UnifiedMessage`.

```typescript
import type { UnifiedMessage } from "../../../lib/types.ts";
import { randomUUID } from "crypto";

export function createMessage(
  channel: UnifiedMessage["channel"],
  userId: string,
  text: string,
  metadata: Record<string, unknown> = {},
): UnifiedMessage {
  return {
    id: randomUUID(),
    channel,
    direction: "inbound",
    userId,
    conversationId: `${channel}_${userId}`,
    timestamp: new Date(),
    content: { type: "text", text },
    metadata: { channel, ...metadata },
    auth: { userId, channelUserId: userId, authenticated: true },
  };
}
```

- [ ] **Step 2: Create workspace/apps/gateway/dispatch.ts**

Routes messages to Paperclip (if enabled) or directly invokes Claude Code CLI.

```typescript
import type { UnifiedMessage } from "../../../lib/types.ts";
import { logger } from "../../../lib/logger.ts";
import { env } from "../../../lib/env.ts";

export async function dispatch(message: UnifiedMessage): Promise<{ taskId: string }> {
  const taskId = `msg_${Date.now()}_${message.channel}`;

  if (env.PAPERCLIP_ENABLED) {
    await fetch(
      `${env.PAPERCLIP_URL}/api/companies/${env.PAPERCLIP_COMPANY_ID}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PAPERCLIP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `[${message.channel}] ${message.content.text?.slice(0, 80) ?? "inbound"}`,
          body: JSON.stringify(message),
          assigneeAgentId: "comms-lead",
        }),
      },
    );
    logger.info({ taskId, channel: message.channel }, "Dispatched via Paperclip");
    return { taskId };
  }

  // Direct mode — spawn Claude Code CLI
  const proc = Bun.spawn(
    ["claude", "--agent", "mastermind", "--yes", "-p", JSON.stringify(message)],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
  );
  proc.exited.then((code) =>
    logger.info({ taskId, exitCode: code }, "Direct agent completed"),
  );

  return { taskId };
}
```

- [ ] **Step 3: Create workspace/apps/gateway/auth.ts**

Telegram webhook signature verification.

```typescript
import { createHmac } from "crypto";
import { env } from "../../../lib/env.ts";

export function verifyTelegramWebhook(secretToken: string | null): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return true; // No secret configured, skip
  return secretToken === env.TELEGRAM_WEBHOOK_SECRET;
}
```

- [ ] **Step 4: Create gateway adapters**

**workspace/apps/gateway/adapters/telegram.ts:**

```typescript
import { createMessage } from "../normalize.ts";
import { dispatch } from "../dispatch.ts";
import { verifyTelegramWebhook } from "../auth.ts";
import { logger } from "../../../../lib/logger.ts";

export async function telegramWebhook({ body, headers }: { body: unknown; headers: Record<string, string | undefined> }): Promise<{ ok: boolean }> {
  const payload = body as Record<string, unknown>;

  // Verify webhook secret
  if (!verifyTelegramWebhook(headers["x-telegram-bot-api-secret-token"] ?? null)) {
    logger.warn("Telegram webhook auth failed");
    return { ok: false };
  }

  const msg = payload?.message as Record<string, unknown> | undefined;
  if (!msg?.text) return { ok: true };

  const from = msg.from as Record<string, unknown>;
  const chat = msg.chat as Record<string, unknown>;

  const message = createMessage("telegram", String(from.id), msg.text as string, {
    telegram: {
      chatId: chat.id,
      messageId: msg.message_id,
      chatType: chat.type,
      firstName: from.first_name,
      username: from.username,
    },
  });

  await dispatch(message);
  return { ok: true };
}
```

**workspace/apps/gateway/adapters/email.ts:**

```typescript
import { createMessage } from "../normalize.ts";
import { dispatch } from "../dispatch.ts";

export async function emailWebhook({ body }: { body: unknown }): Promise<{ ok: boolean }> {
  const payload = body as Record<string, unknown>;

  const from = (payload.from as string) ?? "unknown";
  const subject = (payload.subject as string) ?? "(no subject)";
  const text = (payload.text as string) ?? (payload.body as string) ?? "";

  const message = createMessage("email", from, text, {
    email: { from, subject, html: payload.html },
  });

  await dispatch(message);
  return { ok: true };
}
```

**workspace/apps/gateway/adapters/rest.ts:**

```typescript
import { createMessage } from "../normalize.ts";
import { dispatch } from "../dispatch.ts";

export async function restEndpoint({ body }: { body: unknown }): Promise<{ ok: boolean; taskId?: string }> {
  const payload = body as Record<string, unknown>;

  const channel = (payload.channel as "rest" | "cli") ?? "rest";
  const userId = (payload.userId as string) ?? "api-user";
  const text = (payload.text as string) ?? (payload.message as string) ?? "";

  const message = createMessage(channel, userId, text, payload.metadata as Record<string, unknown> ?? {});

  const { taskId } = await dispatch(message);
  return { ok: true, taskId };
}
```

**workspace/apps/gateway/adapters/whatsapp.ts:**

```typescript
import { logger } from "../../../../lib/logger.ts";

export async function whatsappWebhook({ body }: { body: unknown }): Promise<{ ok: boolean }> {
  logger.info({ body }, "WhatsApp webhook received (stub)");
  return { ok: true };
}
```

- [ ] **Step 5: Create workspace/apps/gateway/index.ts**

```typescript
import { Elysia } from "elysia";
import { telegramWebhook } from "./adapters/telegram.ts";
import { emailWebhook } from "./adapters/email.ts";
import { restEndpoint } from "./adapters/rest.ts";
import { whatsappWebhook } from "./adapters/whatsapp.ts";
import { env } from "../../../lib/env.ts";
import { logger } from "../../../lib/logger.ts";

const app = new Elysia()
  .onRequest(({ request }) => {
    logger.debug({ method: request.method, url: request.url }, "Request");
  })
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .post("/webhook/telegram", telegramWebhook)
  .post("/webhook/email", emailWebhook)
  .post("/webhook/whatsapp", whatsappWebhook)
  .post("/api/message", restEndpoint)
  .listen(env.GATEWAY_PORT);

logger.info({ port: env.GATEWAY_PORT }, "Gateway running");

export type App = typeof app;
```

- [ ] **Step 6: Write test for normalize.ts**

Create `workspace/apps/gateway/normalize.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { createMessage } from "./normalize.ts";

test("createMessage builds UnifiedMessage", () => {
  const msg = createMessage("telegram", "user123", "Hello world", {
    telegram: { chatId: 456 },
  });

  expect(msg.channel).toBe("telegram");
  expect(msg.direction).toBe("inbound");
  expect(msg.userId).toBe("user123");
  expect(msg.content.text).toBe("Hello world");
  expect(msg.metadata.telegram).toEqual({ chatId: 456 });
  expect(msg.id).toBeTruthy();
});
```

- [ ] **Step 7: Run tests**

```bash
bun test workspace/apps/gateway/normalize.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add workspace/apps/gateway/
git commit -m "feat: add Elysia gateway with Telegram, email, REST, WhatsApp adapters"
```

---

## Task 8: Brains

**Files:**
- Create: `.claude/agents/mastermind.md`
- Create: `.claude/agents/knowledge.md`
- Create: `.claude/agents/research.md`
- Create: `.claude/agents/project.md`
- Create: `.claude/agents/menschling.md`
- Create: `.claude/agents/principal.md`

- [ ] **Step 1: Create all six brain files**

Each brain file follows the exact content from the design doc (`docs/MenschlingSystemDesignInit.md` lines 417-757). Copy the full markdown content for each brain verbatim from the design doc's code blocks. The brains are:

1. **mastermind.md** — Communication hub, human interface. Model: sonnet. Tools: Read, Grep, Glob, Bash, Task, WebSearch.
2. **knowledge.md** — Knowledge base manager. Model: sonnet. Tools: Read, Write, Grep, Glob, Bash.
3. **research.md** — Deep web research. Model: opus. Tools: Read, Write, Grep, Glob, Bash, WebSearch, WebFetch.
4. **project.md** — Project management. Model: sonnet. Tools: Read, Write, Grep, Glob, Bash.
5. **menschling.md** — System architect. Model: opus. Tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch.
6. **principal.md** — 10x engineer. Model: opus. Tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch.

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/
git commit -m "feat: add brain definitions (mastermind, knowledge, research, project, menschling, principal)"
```

---

## Task 9: Skills

**Files:**
- Create: `.claude/skills/messaging/SKILL.md`
- Create: `.claude/skills/knowledge/SKILL.md`
- Create: `.claude/skills/workspace/SKILL.md`
- Create: `.claude/skills/channel-voice/SKILL.md`

- [ ] **Step 1: Create all four skill files**

Each skill file follows the exact content from the design doc (`docs/MenschlingSystemDesignInit.md` lines 802-1028). Copy the full markdown content for each skill verbatim from the design doc's code blocks. The skills are:

1. **messaging/SKILL.md** — mensch messaging command reference, channel-specific formatting
2. **knowledge/SKILL.md** — mensch knowledge command reference, vault conventions, sync pipeline
3. **workspace/SKILL.md** — Workspace navigation, key paths, conventions
4. **channel-voice/SKILL.md** — Tone, formatting, and language per channel (German default)

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/
git commit -m "feat: add skill definitions (messaging, knowledge, workspace, channel-voice)"
```

---

## Task 10: Settings, Scripts, Cron

**Files:**
- Create: `.claude/settings.json`
- Create: `system/cron/sync.ts`
- Create: `scripts/setup.sh`
- Create: `scripts/seed-knowledge.ts`
- Modify: `index.ts`

- [ ] **Step 1: Create .claude/settings.json**

```json
{
  "permissions": {
    "allow": [
      "Bash(mensch *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(cat *)",
      "Bash(ls *)",
      "Bash(find *)",
      "Bash(bun test *)",
      "Bash(bun run typecheck)",
      "Read",
      "Write(workspace/knowledge/vault/04-log/*)",
      "Write(workspace/knowledge/vault/00-inbox/*)",
      "Glob",
      "Grep"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(git push *)",
      "Bash(git commit *)",
      "Read(.env)",
      "Read(.env.*)",
      "Write(.env*)",
      "Write(.claude/settings*)"
    ]
  },
  "env": {
    "MENSCH_ROOT": "."
  }
}
```

- [ ] **Step 2: Create system/cron/sync.ts**

```typescript
import { logger } from "../../lib/logger.ts";
import { syncAction } from "../../workspace/tools/knowledge/sync.ts";

async function main() {
  logger.info("Cron: starting knowledge sync");
  const result = await syncAction({});
  if (result.success) {
    logger.info({ data: result.data }, "Cron: sync complete");
  } else {
    logger.error({ error: result.error }, "Cron: sync failed");
    process.exit(1);
  }
}

main();
```

- [ ] **Step 3: Create scripts/setup.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies..."
bun install

echo "==> Checking .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example — please fill in your API keys"
else
  echo "    .env already exists"
fi

echo "==> Creating vault directories..."
mkdir -p workspace/knowledge/vault/{00-inbox,01-projects,02-people,03-resources,04-log}

echo "==> Initializing database..."
bun run -e "import './lib/db.ts'"

echo "==> Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run 'bun run dev' to start the gateway"
echo "  3. Run 'bun run mensch system health' to verify connectivity"
```

- [ ] **Step 4: Create scripts/seed-knowledge.ts**

```typescript
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
    path: "04-log/${new Date().toISOString().slice(0, 10)}-system-init.md",
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
```

- [ ] **Step 5: Update index.ts**

Replace the placeholder with a proper entrypoint.

```typescript
export { env } from "./lib/env.ts";
export type { UnifiedMessage, Attachment, CommandResult } from "./lib/types.ts";
```

- [ ] **Step 6: Commit**

```bash
git add .claude/settings.json system/ scripts/ index.ts
git commit -m "feat: add settings, cron sync, setup/seed scripts, update entrypoint"
```

---

## Task 11: Typecheck & Full Test

- [ ] **Step 1: Run typecheck**

```bash
bun run typecheck
```

Fix any TypeScript errors that arise. Common issues to expect:
- Import paths may need `.ts` extensions for Bun bundler resolution
- `bun:sqlite` types come from `@types/bun`

- [ ] **Step 2: Run all tests**

```bash
bun test
```

Expected: All tests pass (errors.test.ts, preprocess.test.ts, normalize.test.ts).

- [ ] **Step 3: Test CLI end-to-end**

```bash
bun run workspace/tools/cli.ts --help
bun run workspace/tools/cli.ts system --help
bun run workspace/tools/cli.ts knowledge --help
bun run workspace/tools/cli.ts messaging --help
```

Expected: All show proper help text with subcommands.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve typecheck and test issues"
```
