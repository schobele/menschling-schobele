import OpenAI from "openai";
import { env } from "./env.ts";

let _openai: OpenAI | undefined;

function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _openai;
}

/** Lazy-initialized OpenAI client. Does not trigger env validation until first use. */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
}) as OpenAI;

export function vectorStoreId(): string {
  return env.OPENAI_VECTOR_STORE_ID;
}
