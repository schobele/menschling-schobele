export interface UnifiedMessage {
  id: string;
  channel: "cli" | "rest" | "telegram" | "email" | "whatsapp";
  direction: "inbound" | "outbound";
  userId: string;
  conversationId: string;
  timestamp: Date;
  content: {
    type: "text" | "image" | "audio" | "document";
    text?: string;
    html?: string;
    attachments?: Attachment[];
  };
  metadata: Record<string, unknown>;
  auth: { userId: string; channelUserId: string; authenticated: boolean };
}

export interface Attachment {
  type: string;
  url?: string;
  mimeType: string;
  filename?: string;
  size?: number;
}

export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
