import type { UnifiedMessage } from "../../../lib/types.ts";
import { randomUUID } from "crypto";

export function createMessage(
  channel: UnifiedMessage["channel"],
  userId: string,
  text: string,
  metadata: Record<string, unknown> = {},
): UnifiedMessage {
  return {
    id: randomUUID(),
    channel,
    direction: "inbound",
    userId,
    conversationId: `${channel}_${userId}`,
    timestamp: new Date(),
    content: { type: "text", text },
    metadata: { channel, ...metadata },
    auth: { userId, channelUserId: userId, authenticated: true },
  };
}
