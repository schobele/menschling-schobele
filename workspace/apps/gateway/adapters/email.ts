import { createMessage } from "../normalize.ts";
import { dispatch } from "../dispatch.ts";

export async function emailWebhook({ body }: { body: any }) {
  const from = body?.from ?? body?.sender ?? "unknown";
  const subject = body?.subject ?? "";
  const text = body?.text ?? body?.body ?? "";

  const message = createMessage("email", from, text, {
    email: { from, subject },
  });

  await dispatch(message);
  return { ok: true };
}
