import { logger } from "../../../../lib/logger.ts";

export async function whatsappWebhook({ body }: { body: any }) {
  logger.info({ body }, "WhatsApp webhook received (stub)");
  return { ok: true };
}
