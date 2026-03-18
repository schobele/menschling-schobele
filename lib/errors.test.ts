import { test, expect } from "bun:test";
import { MenschError, ChannelNotConfigured, NotFound, ExternalApiError } from "./errors.ts";

test("MenschError has code", () => {
  const err = new MenschError("boom", "TEST_CODE");
  expect(err.message).toBe("boom");
  expect(err.code).toBe("TEST_CODE");
  expect(err).toBeInstanceOf(Error);
});

test("ChannelNotConfigured", () => {
  const err = new ChannelNotConfigured("whatsapp");
  expect(err.code).toBe("CHANNEL_NOT_CONFIGURED");
  expect(err.message).toContain("whatsapp");
});

test("NotFound", () => {
  const err = new NotFound("entry", "abc");
  expect(err.code).toBe("NOT_FOUND");
});

test("ExternalApiError", () => {
  const err = new ExternalApiError("OpenAI", 429, "rate limited");
  expect(err.code).toBe("EXTERNAL_API_ERROR");
  expect(err.message).toContain("429");
});
