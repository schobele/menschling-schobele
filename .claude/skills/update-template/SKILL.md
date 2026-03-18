---
name: update-template
description: >
  Pull updates from the menschling template repo and resolve conflicts.
  Use when the user wants to update their workspace from the upstream template,
  sync template changes, or says "update template", "pull upstream", or
  "get latest template".
---

# Update Template

You are helping the user merge upstream template improvements into their workspace without losing their customizations.

## What gets updated vs what's preserved

**Template-owned (accept upstream changes):**
- Stack docs, commands, architecture diagrams in CLAUDE.md (between `<!-- TEMPLATE -->` markers)
- Default brain improvements (mastermind, knowledge, research, project, menschling, principal)
- Default skill improvements (messaging, knowledge, workspace, channel-voice, add-tool, add-brain, onboarding)
- CLI framework code (`workspace/tools/shared/`)
- Gateway code (`workspace/apps/gateway/`)
- Shared library (`lib/`)
- Docker files, scripts, CI workflows
- gstack vendored copy

**User-owned (preserve during merge):**
- SOUL and PROJECT sections in CLAUDE.md (between `<!-- SOUL -->` and `<!-- PROJECT -->` markers)
- Custom brains added by the user (any `.claude/agents/*.md` not in the default 6)
- Custom skills added by the user
- Custom CLI domains added by the user
- Vault content (`workspace/knowledge/vault/`)
- `.env` (never in git)
- `.claude/settings.local.json`

**Mixed (needs judgment):**
- Default brains the user has customized (keep user changes, note new template additions)
- `package.json` (merge deps — user may have added their own)

## Flow

### Step 1: Run the update script

```bash
./scripts/update-template.sh
```

If the script isn't present (old fork), create the template remote manually:

```bash
git remote add template https://github.com/schobele/menschling.git
git fetch template
git merge template/main --no-edit
```

### Step 2: Handle the result

**If merge was clean:** Done. Run `bun install` in case deps changed, verify with `bun test`.

**If there are conflicts:** This is where you help. Read each conflicted file:

```bash
git diff --name-only --diff-filter=U
```

### Step 3: Resolve conflicts file by file

For each conflicted file, read it and resolve:

**CLAUDE.md conflicts:**
- Content between `<!-- SOUL -->` / `<!-- /SOUL -->` → keep the user's version entirely
- Content between `<!-- PROJECT -->` / `<!-- /PROJECT -->` → keep the user's version entirely
- Content between `<!-- TEMPLATE -->` / `<!-- /TEMPLATE -->` → accept the template's version
- If markers are missing (old fork), identify user sections by content and preserve them

**Brain conflicts (`.claude/agents/*.md`):**
- If it's one of the 6 default brains: show the user both versions side by side. The template may have added new sections (decision trees, stop-and-check gates). Propose merging: keep user's personality/constraints, add template's structural improvements.
- If it's a custom brain: keep the user's version entirely.

**Skill conflicts (`.claude/skills/*/SKILL.md`):**
- Default skills: accept template version (these are reference docs, not customized)
- Custom skills: keep user's version

**Code conflicts (`lib/`, `workspace/`):**
- Generally accept template version — this is framework code
- If user has modified framework files (unusual), flag for manual review

**package.json:**
- Merge both: template's deps + user's added deps. Use `bun install` to regenerate lockfile.

### Step 4: Complete the merge

After resolving all conflicts:

```bash
git add .
git commit
bun install
bun test
```

### Step 5: Verify

```bash
bun run workspace/tools/cli.ts --help    # CLI boots
bun test                                  # Tests pass
mensch system health                      # If .env configured
```

> "Template updated. [N] conflicts resolved. Your SOUL, PROJECT, custom brains, and vault content are preserved."

## Edge cases

- **User deleted a default brain:** Template merge will recreate it. Ask if they want to keep the deletion or accept the brain back.
- **Template renamed a file:** Git may not detect the rename. If a file appears both deleted and created, check if it's a rename and resolve accordingly.
- **User is many versions behind:** Multiple merge conflicts are likely. Resolve one file at a time, starting with CLAUDE.md.
