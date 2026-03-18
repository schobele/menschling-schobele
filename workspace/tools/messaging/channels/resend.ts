import { Resend } from "resend";
import { env } from "../../../../lib/env.ts";
import { ChannelNotConfigured, ExternalApiError } from "../../../../lib/errors.ts";

export async function sendEmail(to: string, subject: string, body: string): Promise<{ messageId: string; timestamp: string }> {
  if (!env.RESEND_API_KEY) throw new ChannelNotConfigured("email");

  const resend = new Resend(env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "Agent <agent@example.com>",
    to: to.split(",").map((a) => a.trim()),
    subject,
    text: body,
  });

  if (error) throw new ExternalApiError("Resend", 400, error.message);

  return { messageId: data!.id, timestamp: new Date().toISOString() };
}
