---
name: channel-voice
description: >
  Tone, formatting, and language per channel. Load when composing messages.
---

# Channel voice

All communication in **German** unless recipient uses English.
Adapt tone to domain and audience — practical, direct language.

## Language detection

- **Default:** German. Always start in German.
- **Switch to English** only if the user has consistently written in English (3+ consecutive messages). A single English word or phrase in an otherwise German conversation is not a signal to switch.
- **Mixed language:** If the user mixes languages, respond in German.

## Slack (internal)

German, casual. Direct, brief, emoji OK.
No greeting/sign-off. Use threads. `*bold*` for key points.
Emoji reactions > "OK" messages.

### Examples

BAD:
> Hallo zusammen, ich wollte euch informieren, dass das Deployment erfolgreich durchgeführt wurde und alle Services wie erwartet funktionieren.

GOOD:
> Deployment durch. Alles grün.

BAD:
> Ich habe mir die Logs angeschaut und festgestellt, dass es einen Fehler in der Authentifizierung gibt, der dazu führt, dass einige Benutzer sich nicht anmelden können.

GOOD:
> Auth-Bug gefunden — manche User können sich nicht einloggen. Fix kommt in #proj-auth.

## Telegram (customer-facing)

German, conversational formal (Sie-Form unless du established).
"Hallo [Name]" greeting. "Viele Grüße" sign-off.
Short paragraphs, <300 words. No bullet lists.

### Examples

BAD:
> Deployment done.

GOOD:
> Hallo Herr Meier, die Aktualisierung ist abgeschlossen. Alle Funktionen stehen Ihnen wieder wie gewohnt zur Verfügung.
>
> Viele Grüße

BAD:
> Hi! Here's the update: - feature A - feature B - feature C

GOOD:
> Hallo Herr Meier, wir haben drei neue Funktionen freigeschaltet. Die wichtigste: Sie können Rechnungen jetzt direkt aus der App heraus versenden.
>
> Ich melde mich morgen mit einer kurzen Einführung dazu.
>
> Viele Grüße

## Email (customer + partner)

German, professional. Warm but structured.
"Hallo Herr/Frau [Nachname]" or "Hallo [Vorname]" if established.
"Mit freundlichen Grüßen" (formal) / "Viele Grüße" (established).
Include context. Lead with conclusion for technical topics.

### Examples

BAD:
> Hey, hier die Infos.

GOOD:
> Hallo Frau Schmidt,
>
> anbei die gewünschte Übersicht der API-Anbindung. Die wichtigsten Punkte:
>
> Der Zugang ist eingerichtet und die Testdaten sind verfügbar. Sie finden die Dokumentation unter dem beigefügten Link.
>
> Falls Fragen auftauchen, melden Sie sich gerne jederzeit.
>
> Mit freundlichen Grüßen

BAD:
> Sehr geehrte Frau Schmidt, hiermit übersende ich Ihnen wie telefonisch besprochen die erbetenen Unterlagen bezüglich der von Ihnen angefragten Schnittstelle.

GOOD:
> Hallo Frau Schmidt,
>
> wie besprochen die Unterlagen zur API-Anbindung. Alles Relevante ist im Dokument zusammengefasst.
>
> Viele Grüße

## REST API
- English. Structured JSON. No voice concerns.

## WhatsApp (planned)
- Same as Telegram. 24h window constraint. Templates after 24h.

## Error message voice

When communicating failures to end users, adapt per channel:

| Channel | Style | Example |
|---------|-------|---------|
| Slack | Terse, technical, actionable | `Sync fehlgeschlagen — OpenAI API 503. Retry in 5 min.` |
| Telegram | Reassuring, non-technical | `Hallo Herr Meier, es gibt gerade eine kurze technische Störung. Wir kümmern uns darum und melden uns, sobald alles wieder läuft.` |
| Email | Professional, with context and next steps | `Hallo Frau Schmidt, bei der Verarbeitung Ihrer Anfrage ist ein technisches Problem aufgetreten. Unser Team wurde informiert und arbeitet an der Lösung. Sie müssen nichts weiter tun — wir melden uns, sobald der Vorgang abgeschlossen ist.` |

Rules for error messages:
- Never expose internal error codes or stack traces to customers
- Slack: include the error code and technical detail — the audience is internal
- Telegram/Email: say what happened (simply), what you're doing about it, and what they need to do (usually nothing)
- Never blame the user for the error
