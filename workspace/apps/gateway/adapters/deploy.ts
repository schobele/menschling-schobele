import { logger } from "../../../../lib/logger.ts";
import { env } from "../../../../lib/env.ts";

export async function deployWebhook({
  body,
  headers,
}: {
  body: unknown;
  headers: Record<string, string | undefined>;
}): Promise<{ ok: boolean; action?: string; error?: string }> {
  // Authenticate
  const secret = headers["x-deploy-secret"];
  if (!env.DEPLOY_SECRET) {
    return { ok: false, error: "DEPLOY_SECRET not configured" };
  }
  if (secret !== env.DEPLOY_SECRET) {
    logger.warn("Deploy webhook: invalid secret");
    return { ok: false, error: "unauthorized" };
  }

  // Check if this is an auto-commit (skip to prevent loops)
  const payload = body as Record<string, unknown>;
  const headCommit = payload?.head_commit as Record<string, unknown> | undefined;
  const commitMessage = (headCommit?.message as string) ?? "";
  if (commitMessage.startsWith("auto:")) {
    logger.info("Deploy webhook: skipping auto-commit");
    return { ok: true, action: "skipped (auto-commit)" };
  }

  logger.info("Deploy webhook: pulling changes...");

  try {
    // Pull latest changes
    const pull = Bun.spawnSync(["git", "pull", "--rebase", "origin", "main"], {
      cwd: "/app",
    });
    if (pull.exitCode !== 0) {
      const stderr = pull.stderr.toString();
      logger.error({ stderr }, "Deploy webhook: git pull failed");
      return { ok: false, error: `git pull failed: ${stderr}` };
    }

    // Install deps in case package.json changed
    const install = Bun.spawnSync(["bun", "install"], { cwd: "/app" });
    if (install.exitCode !== 0) {
      logger.warn("Deploy webhook: bun install had issues");
    }

    // Check if gateway code changed — if so, signal restart
    const diffOutput = pull.stdout.toString();
    const gatewayChanged = diffOutput.includes("workspace/apps/gateway/");

    if (gatewayChanged) {
      logger.info("Deploy webhook: gateway code changed, signaling restart");
      // Touch restart flag and kill the gateway process so the entrypoint loop restarts it
      Bun.spawnSync(["touch", "/tmp/.gateway-restart"]);
      Bun.spawnSync(["pkill", "-SIGUSR1", "-f", "entrypoint.sh"]);
      return { ok: true, action: "pulled + gateway restart" };
    }

    return { ok: true, action: "pulled" };
  } catch (err) {
    logger.error({ err }, "Deploy webhook: error");
    return { ok: false, error: String(err) };
  }
}
