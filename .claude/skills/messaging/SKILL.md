---
name: messaging
description: >
  Reference for mensch messaging commands. Load when composing or sending
  messages to Slack, Telegram, email, or WhatsApp. Channel-specific
  formatting, thread handling, delivery patterns.
---

# Messaging domain

## mensch messaging send

```bash
mensch messaging send --channel slack --conversation "#general" --message "Hello"
mensch messaging send --channel slack --conversation "@leo" --message "FYI"
mensch messaging send --channel slack --conversation "C04ABCDEF" --message "By ID"
mensch messaging send --channel telegram --conversation "12345" --message "Update"
mensch messaging send --channel email --to "user@example.com" --subject "Sync" --body "Hi Leo, ..."
```

### Success output

```json
{
  "success": true,
  "data": {
    "messageId": "msg_abc123",
    "channel": "slack",
    "timestamp": "2026-03-17T14:30:00Z"
  }
}
```

### Failure output

```json
{
  "success": false,
  "error": "Channel not configured: whatsapp",
  "code": "CHANNEL_NOT_CONFIGURED"
}
```

```json
{
  "success": false,
  "error": "slack API error (429): rate limited, retry after 30s",
  "code": "EXTERNAL_API_ERROR"
}
```

## mensch messaging reply

```bash
mensch messaging reply --channel slack --conversation "#support" --thread "1710234567.123456" --message "On it"
```

### Success output

```json
{
  "success": true,
  "data": {
    "messageId": "msg_reply456",
    "channel": "slack",
    "thread": "1710234567.123456",
    "timestamp": "2026-03-17T14:31:00Z"
  }
}
```

### Failure output

```json
{
  "success": false,
  "error": "slack API error (404): thread_not_found",
  "code": "EXTERNAL_API_ERROR"
}
```

## mensch messaging status

```bash
mensch messaging status --id "msg_abc123"
```

### Success output

```json
{
  "success": true,
  "data": {
    "messageId": "msg_abc123",
    "channel": "email",
    "status": "delivered",
    "deliveredAt": "2026-03-17T14:30:05Z"
  }
}
```

## Error codes

| Code | Trigger | Recovery |
|------|---------|----------|
| `CHANNEL_NOT_CONFIGURED` | Channel env vars missing or channel string unknown | Check `.env` for required keys (see table below). WhatsApp throws this explicitly — it does not silently fail. |
| `EXTERNAL_API_ERROR` | Upstream API returned non-2xx | Slack: check bot scopes (`chat:write`, `channels:read`). Telegram: verify bot token and chat ID. Resend: verify API key and sender domain. |
| `RATE_LIMITED` | Too many requests to upstream API | Slack: 1 msg/sec per channel. Telegram: 30 msg/sec global, 1 msg/sec per chat. Resend: 10 req/sec. Back off and retry. |
| `NOT_FOUND` | Thread ID or conversation target does not exist | Verify the thread timestamp (Slack) or chat ID (Telegram) from inbound metadata. |

## Channel specifics

### Slack
- **Conversation target resolution:** `#channel` name, `@user` mention, or raw channel ID (`C04ABCDEF`) — all three formats accepted
- Slack mrkdwn: `*bold*`, `_italic_`, `<url|text>`
- Thread via parent message `ts` as `--thread`
- **Message size limit:** >4000 chars auto-splits into sequential messages

### Telegram
- `--conversation`: numeric chat ID from inbound metadata
- Markdown V2: `*bold*`, `_italic_`, `` `code` ``
- **Message size limit:** >4096 chars auto-splits into sequential messages

### Email (Resend)
- `--to`: single or comma-separated addresses
- `--body`: markdown, auto-converted to HTML
- `--subject`: required
- Reply threading automatic for inbound conversations (uses `In-Reply-To` header)

### WhatsApp (planned)
- 24-hour conversation window
- Template messages after 24h
- Throws `ChannelNotConfigured` until fully wired — does not silently degrade
