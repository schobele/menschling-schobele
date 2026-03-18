import { env } from "../../../lib/env.ts";

export function verifyTelegramWebhook(secretToken: string | null): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return true;
  return secretToken === env.TELEGRAM_WEBHOOK_SECRET;
}
