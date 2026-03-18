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
