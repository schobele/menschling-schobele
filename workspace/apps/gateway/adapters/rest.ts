import { createMessage } from "../normalize.ts";
import { dispatch } from "../dispatch.ts";

export async function restEndpoint({ body }: { body: any }) {
  const channel = body?.channel ?? "rest";
  const userId = body?.userId ?? "anonymous";
  const text = body?.text ?? "";

  if (!text) {
    return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = createMessage(channel, userId, text, body?.metadata ?? {});
  const result = await dispatch(message);
  return { ok: true, messageId: message.id, taskId: result.taskId };
}
