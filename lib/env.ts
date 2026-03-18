import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GATEWAY_PORT: z.coerce.number().default(3200),

  // Required
  OPENAI_API_KEY: z.string(),
  OPENAI_VECTOR_STORE_ID: z.string(),
  ANTHROPIC_API_KEY: z.string(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Slack
  SLACK_BOT_TOKEN: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // Paperclip
  PAPERCLIP_ENABLED: z.coerce.boolean().default(false),
  PAPERCLIP_URL: z.string().default("http://localhost:3100"),
  PAPERCLIP_API_KEY: z.string().optional(),
  PAPERCLIP_COMPANY_ID: z.string().optional(),

  // WhatsApp
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Deploy
  DEPLOY_SECRET: z.string().optional(),
  GIT_USER_NAME: z.string().default("menschling-agent"),
  GIT_USER_EMAIL: z.string().default("agent@menschling.dev"),
});

export type Env = z.infer<typeof schema>;

let _env: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) _env = schema.parse(process.env);
    return _env[prop as keyof Env];
  },
  ownKeys() {
    if (!_env) _env = schema.parse(process.env);
    return Reflect.ownKeys(_env);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (!_env) _env = schema.parse(process.env);
    return Object.getOwnPropertyDescriptor(_env, prop);
  },
});
