import { Command } from "commander";
import { handler } from "../shared/base.ts";
import { sendAction } from "./send.ts";
import { replyAction } from "./reply.ts";
import { statusAction } from "./status.ts";

export function register(program: Command): void {
  const messaging = program.command("messaging").description("Send and receive across channels");

  messaging
    .command("send")
    .description("Send a message")
    .requiredOption("--channel <channel>", "Channel (slack, telegram, email, whatsapp)")
    .option("--conversation <target>", "Conversation target (#channel, @user, chatId)")
    .option("--message <text>", "Message text")
    .option("--to <addr>", "Email recipient(s)")
    .option("--subject <subj>", "Email subject")
    .option("--body <text>", "Email body")
    .action(handler(sendAction));

  messaging
    .command("reply")
    .description("Reply in a thread/conversation")
    .requiredOption("--channel <channel>", "Channel")
    .requiredOption("--conversation <target>", "Conversation")
    .requiredOption("--thread <ts>", "Thread ID / parent message timestamp")
    .requiredOption("--message <text>", "Reply message")
    .action(handler(replyAction));

  messaging
    .command("status")
    .description("Check delivery status")
    .requiredOption("--id <message_id>", "Message ID")
    .action(handler(statusAction));
}
