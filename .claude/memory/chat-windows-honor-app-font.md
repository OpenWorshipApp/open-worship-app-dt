---
name: chat-windows-honor-app-font
description: "The 🤖/✨ windows take Settings→General Font Family as --chat-app-font heading their font stacks, and the ✨ guest gets it as local() aliases under site face names limited to text letters"
metadata:
  node_type: memory
  type: project
  originSessionId: 0b239c62-1c22-418c-b8b5-3fd2b7e56ea8
  modified: 2026-10-20T23:57:45.380Z
---

In the chatbot and AI Chat windows, boot.ts's `initFontFamily()` writes the
Settings → General → Font Family pick as `* { font-family: ... }` — and a
universal rule loses to EVERY `font-family: var(--chat-font-*)` class stack in
`chatWindowShared.scss` (2026-10-20, the user's report: custom font had no
effect on either page, tab titles included).

So `plugChatWindowAppFont` (`src/chatbot/chatWindowLanguage.ts`, called by
both entries, `src/chatbot.tsx` and `src/aichat.tsx`) sets the face on
`<html>` as `--chat-app-font`, which heads every `--chat-font-*` stack, ahead
of `--chat-lang-font` (the pack face). See [[own-font-list-with-weights]].

Inside an AI Chat GUEST (`genGuestAppFontScript` in
`aiChatGuestFontHelpers.ts`): the picked face is an installed local font, so
it goes in as `local(...)` FontFaces under each loaded site face's name
(same weight/style/stretch — the lang-data face does the same with bytes),
running AFTER the language face's script so the explicit pick wins overlap.
The borrowed faces cover only `GUEST_TEXT_UNICODE_RANGE` (U+0-2FFF) so PUA
icon fonts and emoji planes stay the site's own, plus one body rule with the
name in front.

**The trap**: `local("<family>")` — the BARE family name — fails with "A
network error occurred" and the face ends in `error` status (host page and
guest alike; plain CSS `font-family` family names resolve fine). `local()`
wants the face's FULL name (`Battambang Regular`) or PostScript name
(`Battambang-Regular`), so each borrow tries all three spellings (and the
Bold pair for heavy site faces). Verify the guest effect at the glyph level
with `CSS.getPlatformFontsForNode` over the webview target's own
`/json/list` entry — `evaluate_script` on the host can't read a guest.
