export class MenschError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MenschError";
  }
}

export class ChannelNotConfigured extends MenschError {
  constructor(ch: string) {
    super(`Channel not configured: ${ch}`, "CHANNEL_NOT_CONFIGURED");
  }
}

export class NotFound extends MenschError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND");
  }
}

export class ExternalApiError extends MenschError {
  constructor(svc: string, status: number, detail?: string) {
    super(`${svc} API error (${status}): ${detail ?? "unknown"}`, "EXTERNAL_API_ERROR");
  }
}
