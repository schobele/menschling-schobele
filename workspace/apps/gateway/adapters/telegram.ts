import { createMessage } from "../normalize.ts";
import { dispatch } from "../dispatch.ts";
import { verifyTelegramWebhook } from "../auth.ts";
import { logger } from "../../../../lib/logger.ts";

export async function telegramWebhook({ body, request }: { body: any; request: Request }) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyTelegramWebhook(secret)) {
    logger.warn("Telegram webhook auth failed");
    return new Response("Unauthorized", { status: 401 });
  }

  const msg = body?.message;
  if (!msg?.text) return { ok: true };

  const message = createMessage("telegram", String(msg.from.id), msg.text, {
    telegram: {
      chatId: msg.chat.id,
      messageId: msg.message_id,
      chatType: msg.chat.type,
      firstName: msg.from.first_name,
      username: msg.from.username,
    },
  });

  await dispatch(message);
  return { ok: true };
}
