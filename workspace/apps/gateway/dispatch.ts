import type { UnifiedMessage } from "../../../lib/types.ts";
import { logger } from "../../../lib/logger.ts";
import { env } from "../../../lib/env.ts";

export async function dispatch(message: UnifiedMessage): Promise<{ taskId: string }> {
  const taskId = `msg_${Date.now()}_${message.channel}`;

  if (env.PAPERCLIP_ENABLED) {
    await fetch(`${env.PAPERCLIP_URL}/api/companies/${env.PAPERCLIP_COMPANY_ID}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PAPERCLIP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: `[${message.channel}] ${message.content.text?.slice(0, 80) ?? "inbound"}`,
        body: JSON.stringify(message),
        assigneeAgentId: "mastermind",
      }),
    });
    logger.info({ taskId, channel: message.channel }, "Dispatched via Paperclip");
    return { taskId };
  }

  // Direct mode — spawn Claude agent
  const proc = Bun.spawn(
    ["claude", "--agent", "mastermind", "--yes", "-p", JSON.stringify(message)],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
  );
  proc.exited.then((code) => logger.info({ taskId, exitCode: code }, "Direct agent completed"));
  return { taskId };
}
