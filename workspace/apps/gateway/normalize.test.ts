import { describe, expect, it } from "bun:test";
import { createMessage } from "./normalize.ts";

describe("createMessage", () => {
  it("builds a correct UnifiedMessage from channel, userId, text", () => {
    const msg = createMessage("telegram", "user123", "Hello world");

    expect(msg.id).toBeDefined();
    expect(typeof msg.id).toBe("string");
    expect(msg.channel).toBe("telegram");
    expect(msg.direction).toBe("inbound");
    expect(msg.userId).toBe("user123");
    expect(msg.conversationId).toBe("telegram_user123");
    expect(msg.timestamp).toBeInstanceOf(Date);
    expect(msg.content.type).toBe("text");
    expect(msg.content.text).toBe("Hello world");
    expect(msg.auth.userId).toBe("user123");
    expect(msg.auth.channelUserId).toBe("user123");
    expect(msg.auth.authenticated).toBe(true);
  });

  it("includes channel in metadata", () => {
    const msg = createMessage("email", "foo@bar.com", "Hi");

    expect(msg.metadata.channel).toBe("email");
  });

  it("merges custom metadata", () => {
    const msg = createMessage("rest", "u1", "test", { custom: "value" });

    expect(msg.metadata.custom).toBe("value");
    expect(msg.metadata.channel).toBe("rest");
  });

  it("generates unique ids for each message", () => {
    const msg1 = createMessage("cli", "u1", "a");
    const msg2 = createMessage("cli", "u1", "b");

    expect(msg1.id).not.toBe(msg2.id);
  });

  it("defaults metadata to empty when not provided", () => {
    const msg = createMessage("whatsapp", "u1", "hey");

    expect(msg.metadata).toEqual({ channel: "whatsapp" });
  });
});
