import type { CommandResult } from "../shared/base.ts";
import type { Channel } from "../shared/validators.ts";
import { sendSlack } from "./channels/slack.ts";
import { sendTelegram } from "./channels/telegram.ts";
import { sendEmail } from "./channels/resend.ts";
import { sendWhatsApp } from "./channels/whatsapp.ts";

interface SendResult {
  messageId: string;
  channel: string;
  timestamp: string;
}

export async function sendAction(flags: {
  channel: Channel;
  conversation?: string;
  message?: string;
  to?: string;
  subject?: string;
  body?: string;
}): Promise<CommandResult<SendResult>> {
  let result: { messageId: string; timestamp: string };

  switch (flags.channel) {
    case "slack":
      result = await sendSlack(flags.conversation!, flags.message!);
      break;
    case "telegram":
      result = await sendTelegram(flags.conversation!, flags.message!);
      break;
    case "email":
      result = await sendEmail(flags.to!, flags.subject!, flags.body ?? flags.message!);
      break;
    case "whatsapp":
      result = await sendWhatsApp(flags.conversation!, flags.message!);
      break;
  }

  return {
    success: true,
    data: { messageId: result.messageId, channel: flags.channel, timestamp: result.timestamp },
  };
}
