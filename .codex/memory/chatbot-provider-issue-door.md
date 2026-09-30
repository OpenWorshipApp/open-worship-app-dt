---
name: chatbot-provider-issue-door
description: "A provider's failure is read off the BODY, not the status (an empty Anthropic account is a 402 or a \"credit balance\" 400 the stand-in used to miss; an OpenAI 429 is usually an empty account), and the note carries a button to the provider's own billing/keys/limits/status page by NAME, never by address"
metadata: 
  node_type: memory
  type: project
  originSessionId: feda027c-34ab-43a9-a19a-a7537b6f604b
  modified: 2026-09-10T21:49:03.262Z
---

A "could not answer" note in the chatbot window carries the door to what
went wrong (2026-09-10, `src/chatbot/providerIssueHelpers.ts`, `EC-158`):
`readLlmIssue` classifies the SDK error into a kind (`noCredit`, `badKey`,
`rateLimited`, `quotaOrRate`, `overloaded`, `serverTrouble`, `modelMissing`,
`workspace`, `unreachable`, `other`) and `genProviderIssueActions` turns the
kind into buttons — *Open ChatGPT billing*, *Open AI settings* + *Open Claude
API keys*, the limits page, the status page, the settings panel for the
keyless provider.

**Why:** the status alone was wrong two ways. An OpenAI 429 body says
`insufficient_quota` (now also `credit_balance_exhausted`) for an empty
account and `rate_limit_exceeded` for a rate limit, and the window hedged
"out of credit or being rate-limited" for both; and an empty Anthropic
account answers with a **402 `billing_error`** or a **400
`invalid_request_error` saying "credit balance is too low"** (also an
organisation's own spend limit), which `checkIsProviderFault` — 401/403/429/
5xx, never a 400 — had never once handed to the stand-in key. Every code in
the classifier was read off the providers' own error pages that day; a
remembered name is how `insufficient_quota` stays the only one checked
after a rename.

**How to apply:** a button carries `{provider, page}` NAMES and
`getLlmProviderPageUrl` resolves the address at the press out of
`PAID_PROVIDER_PAGE_MAP` (the one table; Settings' *Get key* buttons read
it too) — never put a URL in an action's args, a saved session file is
hand-editable. When a new failure shape turns up, add its documented code
to the right set in `providerIssueHelpers.ts` and a test with the
provider's real body; do not widen `NO_CREDIT_WORDS_PATTERN` to a 5xx or a
401 (a 401 is the key whatever it says). The Anthropic console is
`platform.claude.com` now (`console.anthropic.com` redirects); Kimi
documents no billing page, so its money doors are the console home
(`EC-159`). Related: [[chatbot-grade-on-the-window-default]],
[[chatbot-spend-guard]].
