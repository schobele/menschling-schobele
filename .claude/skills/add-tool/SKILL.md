---
name: add-tool
description: >
  Scaffold a new CLI domain for the mensch toolbox. Use whenever the user wants
  to add a command, tool, or capability to the mensch CLI — even if they say
  something vague like "I need agents to be able to do X" or "add a command for Y".
  Guides through intent, proposes the domain design, scaffolds files, and wires
  everything up (registration, skill doc, CLAUDE.md).
---

# Add Tool

You are a systems designer helping extend the mensch CLI with a new domain. Your job is to understand what the user needs, shape it into a well-designed domain with the right subcommands, scaffold the code, and wire it into the workspace.

**Your approach:** The user often knows what they want but not how to structure it. You take their rough idea and propose a clean domain design with the right granularity — not too many commands (YAGNI), not too few (each should do one thing well). You know the codebase patterns cold and can scaffold production-ready code.

## Context

The mensch CLI is domain-grouped: `mensch <domain> <action> [--flags]`. Each domain lives at `workspace/tools/<domain>/` and auto-registers via the discovery system in `workspace/tools/shared/registry.ts`. Every domain follows the same pattern:

- `index.ts` exports `register(program)` using Commander
- Each action is a separate file exporting an async function returning `CommandResult`
- Actions use the `handler()` wrapper from `workspace/tools/shared/base.ts`
- All output is JSON to stdout, logging to stderr via Pino
- Named flags only, no positional args
- Zod validation on external input

## Flow

### Phase 1: Understand the Need

Start by reading what the user wants. If they say "add a tool for X," don't immediately scaffold — first understand:

1. **What problem does this solve?** What will agents (or humans) use this for?
2. **What are the operations?** What distinct actions does this domain need?

Often you can infer both from a single sentence. "I need agents to manage calendar events" -> domain: `calendar`, actions: `list`, `create`, `update`, `cancel`. Say what you see and ask if it's right.

Read existing domains to calibrate your design:
- `workspace/tools/system/index.ts` — simple domain with 4 subcommands
- `workspace/tools/knowledge/index.ts` — more complex, with supporting files (manifest, preprocess, summarize)
- `workspace/tools/messaging/index.ts` — domain with channel adapters in a subdirectory

### Phase 2: Propose the Design

Present a concrete proposal:

> "Here's how I'd structure the **[domain]** domain:"
>
> ```
> mensch [domain]
> ├── [action1]    # [what it does]
> ├── [action2]    # [what it does]
> └── [action3]    # [what it does]
> ```
>
> **Files I'll create:**
> - `workspace/tools/[domain]/index.ts` — registers the command group
> - `workspace/tools/[domain]/[action1].ts` — [description]
> - `workspace/tools/[domain]/[action2].ts` — [description]
> - `workspace/tools/[domain]/[action1].test.ts` — basic tests
> - `.claude/skills/[domain]/SKILL.md` — command reference for brains

Include the flag signatures for each command. Be specific about types and whether flags are required or optional.

Ask: "Does this cover what you need, or should I adjust?"

### Phase 3: Scaffold

Once the user confirms, create all files. Follow these patterns exactly:

**index.ts** — registration file:
```typescript
import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { someAction } from "./some-action.ts";

export function register(program: Command): void {
  const domain = program.command("<domain>").description("<description>");

  domain
    .command("<action>")
    .description("<what it does>")
    .requiredOption("--flag <value>", "Description")
    .option("--optional <value>", "Description")
    .action(handler(someAction));
}
```

**Action files** — each action is a standalone async function with both success and failure paths:
```typescript
import type { CommandResult } from "../shared/base.ts";
import { MenschError, ExternalApiError } from "../../lib/errors.ts";

interface SomeResult {
  id: string;
  status: string;
}

export async function someAction(flags: {
  flag: string;
  optional?: string;
}): Promise<CommandResult<SomeResult>> {
  // Lazy import to avoid triggering env validation on --help
  const { env } = await import("../../lib/env.ts");

  try {
    const result = await doWork(flags, env);
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof MenschError) throw err;
    throw new ExternalApiError("ServiceName", 500, String(err));
  }
}
```

**Test files** — colocated `<action>.test.ts`:
```typescript
import { describe, it, expect } from "bun:test";
import { someAction } from "./some-action.ts";

describe("someAction", () => {
  it("returns success with valid input", async () => {
    const result = await someAction({ flag: "test-value" });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it("throws on missing required config", async () => {
    expect(someAction({ flag: "" })).rejects.toThrow();
  });
});
```

Key patterns:
- Import env/db lazily inside the function (not at module top level) to avoid triggering validation on `--help`
- Use typed interfaces for the return data
- Throw `MenschError` subclasses from `lib/errors.ts` for known error conditions
- Use `Bun.spawnSync` or `fetch` for external calls, not child_process

**Skill file** — `.claude/skills/<domain>/SKILL.md`:
```markdown
---
name: <domain>
description: >
  Reference for mensch <domain> commands. [When to load this skill.]
---

# [Domain] domain

## mensch [domain] [action]

\`\`\`bash
mensch [domain] [action] --flag <value> [--optional <value>]
\`\`\`

## Output format

\`\`\`json
{ "success": true, "data": { ... } }
{ "success": false, "error": "...", "code": "..." }
\`\`\`
```

### Phase 4: Wire Up

After creating the files:

1. **Verify auto-discovery** — the registry finds new domains automatically, no manual registration needed. Run:
   ```bash
   bun run workspace/tools/cli.ts <domain> --help
   ```
   This confirms the domain is registered and all flags are wired correctly.

2. **Update CLAUDE.md** — add the new domain's commands to the `## mensch CLI` section. Read CLAUDE.md, find the right insertion point, add the new command reference.

3. **Run tests** — `bun test` to make sure nothing broke. If the new domain has testable logic (pure functions, data transforms), write a colocated test file.

Note: The existing `Bash(mensch *)` wildcard in `.claude/settings.json` already covers all domains. No per-domain permission entry is needed.

### Phase 5: Confirm

> "The **[domain]** domain is live. Here's what was created:"
>
> - [N] files in `workspace/tools/[domain]/`
> - Skill reference at `.claude/skills/[domain]/SKILL.md`
> - CLI reference added to CLAUDE.md
>
> "Try it: `mensch [domain] --help`"

## Anti-patterns

- Don't create domains with only one action — that's a flag on an existing domain, not a new domain.
- Don't scaffold empty stub files "for future use." Only create what's needed now.
- Don't forget the skill file — brains need the command reference to use the tool effectively.
- Don't hardcode API keys or secrets in action files — always read from `env` via lazy import.
- Don't manually add `Bash(mensch <domain> *)` to settings.json — the `Bash(mensch *)` wildcard already covers it.
