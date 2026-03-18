import { Elysia } from "elysia";
import { telegramWebhook } from "./adapters/telegram.ts";
import { emailWebhook } from "./adapters/email.ts";
import { restEndpoint } from "./adapters/rest.ts";
import { whatsappWebhook } from "./adapters/whatsapp.ts";
import { deployWebhook } from "./adapters/deploy.ts";
import { env } from "../../../lib/env.ts";
import { logger } from "../../../lib/logger.ts";

const app = new Elysia()
  .onRequest(({ request }) => {
    logger.debug({ method: request.method, url: request.url }, "Request");
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .post("/webhook/telegram", telegramWebhook)
  .post("/webhook/email", emailWebhook)
  .post("/webhook/whatsapp", whatsappWebhook)
  .post("/api/message", restEndpoint)
  .post("/webhook/deploy", deployWebhook)
  .listen(env.GATEWAY_PORT);

logger.info({ port: env.GATEWAY_PORT }, "Gateway running");

export type App = typeof app;
