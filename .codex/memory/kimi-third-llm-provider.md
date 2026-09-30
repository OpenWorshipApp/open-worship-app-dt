---
name: kimi-third-llm-provider
description: Kimi rides the OpenAI loop with its own budget rule; the provider set is declared once, and setAISetting used to delete a key it did not hand-list
metadata:
  type: project
---

Kimi (Moonshot) joined Claude and ChatGPT as a chatbot provider on 2026-09-01
(`src/helper/ai/kimiHelpers.ts` = the OpenAI SDK pointed at
`https://api.moonshot.ai/v1`). Four things here are not derivable from the code.

**Kimi's reasoning rule is the mirror image of OpenAI's, and sharing it breaks
both.** OpenAI: only reasoning models get the big budget AND `reasoning_effort`.
Kimi: *every* model offered thinks before it answers (k3 always, k2.7-code
always, k2.6 by default), so **all** of them need `OPENAI_MAX_TOKENS` — at 2000
the thinking eats the answer, and an empty answer on that path `throw`s, so the
user is dropped to the offline manual having paid for the whole run. But only
`kimi-k3` accepts `reasoning_effort`; the K2 family rejects it and takes a
`thinking` object instead. Hence a separate `KIMI_EFFORT_MODEL_PATTERN`
(`/^kimi-k3/`), and a *pattern* rather than a list because "More models…" puts
the account's whole catalogue in the picker.

**Never reuse `OPENAI_CHAT_MODEL_PATTERN` for Kimi.** `/^(gpt-[0-9]|o[0-9])/`
rejects every `kimi-*` id, so "More models…" would appear to succeed and show
nothing new — no error anywhere. Moonshot lists chat models only, so
`checkIsChatModel` is optional on the descriptor and deliberately unset.

**The provider set is declared ONCE**, in `LLM_PROVIDER_MAP`, with
`Record<LlmProviderType, …>` lookups for ask and list-models and a `keyField`
naming its credential. Three two-way ternaries used to decide those, and each
one sent an unrecognised provider into the **OpenAI** branch in silence.
`chatSessionHelpers.ts` keeps its own `Record<LlmProviderType, true>` instead of
importing the list — a value import would drag both SDKs into a module read at
mount. See [[secure-storage-safestorage]] and [[agent-access-mcp-chatbot]].

**`setAISetting` rebuilt the encrypted blob from hand-listed fields**, so it
dropped any key it did not mention — and for a user with only the new key, the
"nothing to protect" branch fired on the very save that *stored* it, removing
the blob it was about to write. The user typed a good key, tabbed out of the
field, and the provider stayed disabled with nothing said. It builds one object
and asks whether it holds anything now; two regression tests pin it. A fourth
provider must extend `AISecretKeyNameType`, which both the chatbot and the
settings panel take their key names from.
