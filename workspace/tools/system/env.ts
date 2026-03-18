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
  const { env } = await import("../../../lib/env.ts");
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
