import { ChannelNotConfigured } from "../../../../lib/errors.ts";

export async function sendWhatsApp(_to: string, _message: string): Promise<never> {
  throw new ChannelNotConfigured("whatsapp (not yet implemented)");
}
