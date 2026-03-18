import { env } from "../../../../lib/env.ts";
import { ChannelNotConfigured, ExternalApiError } from "../../../../lib/errors.ts";

export async function sendSlack(conversation: string, message: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.SLACK_BOT_TOKEN) throw new ChannelNotConfigured("slack");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: conversation, text: message }),
  });

  const data = await res.json() as { ok: boolean; ts?: string; error?: string };
  if (!data.ok) throw new ExternalApiError("Slack", res.status, data.error);

  return { messageId: data.ts!, timestamp: new Date().toISOString() };
}

export async function replySlack(conversation: string, thread: string, message: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.SLACK_BOT_TOKEN) throw new ChannelNotConfigured("slack");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ channel: conversation, text: message, thread_ts: thread }),
  });

  const data = await res.json() as { ok: boolean; ts?: string; error?: string };
  if (!data.ok) throw new ExternalApiError("Slack", res.status, data.error);

  return { messageId: data.ts!, timestamp: new Date().toISOString() };
}
