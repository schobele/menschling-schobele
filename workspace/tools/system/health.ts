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
  const { env } = await import("../../../lib/env.ts");
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
