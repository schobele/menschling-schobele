import type { CommandResult } from "../shared/base.ts";
import { logger } from "../../../lib/logger.ts";

export async function shutdownAction(): Promise<CommandResult<{ committed: boolean; pushed: boolean }>> {
  logger.info("Running graceful shutdown...");

  // Stage all changes
  const add = Bun.spawnSync(["git", "add", "-A"], { cwd: process.cwd() });
  if (add.exitCode !== 0) {
    return { success: false, error: "git add failed", code: "GIT_ERROR" };
  }

  // Check if there's anything to commit
  const diff = Bun.spawnSync(["git", "diff", "--cached", "--quiet"], { cwd: process.cwd() });
  if (diff.exitCode === 0) {
    logger.info("Nothing to commit");
    return { success: true, data: { committed: false, pushed: false } };
  }

  // Commit
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const commit = Bun.spawnSync(
    ["git", "commit", "-m", `auto: shutdown sync ${timestamp}`],
    { cwd: process.cwd() },
  );
  if (commit.exitCode !== 0) {
    return { success: false, error: "git commit failed", code: "GIT_ERROR" };
  }

  // Push
  const push = Bun.spawnSync(["git", "push", "origin", "main"], { cwd: process.cwd() });
  if (push.exitCode !== 0) {
    const stderr = push.stderr.toString();
    return { success: false, error: `git push failed: ${stderr}`, code: "GIT_ERROR" };
  }

  logger.info("Shutdown sync complete");
  return { success: true, data: { committed: true, pushed: true } };
}
