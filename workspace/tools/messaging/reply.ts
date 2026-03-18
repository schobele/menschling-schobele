import type { CommandResult } from "../shared/base.ts";
import type { Channel } from "../shared/validators.ts";
import { replySlack } from "./channels/slack.ts";
import { ChannelNotConfigured } from "../../../lib/errors.ts";

interface ReplyResult {
  messageId: string;
  channel: string;
  timestamp: string;
}

export async function replyAction(flags: {
  channel: Channel;
  conversation: string;
  thread: string;
  message: string;
}): Promise<CommandResult<ReplyResult>> {
  let result: { messageId: string; timestamp: string };

  switch (flags.channel) {
    case "slack":
      result = await replySlack(flags.conversation, flags.thread, flags.message);
      break;
    default:
      throw new ChannelNotConfigured(`${flags.channel} (reply not supported)`);
  }

  return {
    success: true,
    data: { messageId: result.messageId, channel: flags.channel, timestamp: result.timestamp },
  };
}
