---
name: aichat-window
description: "The AI Chat window (aichat.html, ✨ right of the 🤖) is a company's own chat site in a sandboxed <webview> guest beside the app — not the assistant, not gated on the AI switch, 3 live guests at most, and the guest is no CDP page target"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8d1ebea-4367-48e5-bef9-e0dd99a3f259
  modified: 2026-09-14T17:32:50.917Z
---

Added 2026-09-11 at the user's ask (*like firefox, I want an ai chat panel …
just open webpage from ai company directly … tabs for each session like the
chatbot*). `html/aichat.html` → `src/aichat/*` holds ChatGPT, Claude, Gemini,
DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen or Copilot in a `<webview>`
guest on the persistent `persist:aichat` session; `electron/aiChatGuestHelpers.ts`
is the box (forced sandbox preferences in `will-attach-webview`, http(s)-only
navigation, `window.open` → system browser for a press only, no permissions but clipboard
write; the user agent is left as Electron's OWN, and `navigator.webdriver`
is switched off app-wide). Opened like the chatbot (same popup features) by
the ✨ button, Help → AI Chat, Tools → AI Chat.

**Cloudflare (2026-09-11):** claude.ai's *Verify you are human* box looped
for good. Measured on browserscan.net from inside the guest: the first cut's
plain-Chrome user agent read as *Robot* with `navigator.webdriver` true;
`--disable-blink-features=AutomationControlled` cleared the flag and the box
still looped; the honest Electron user agent passed with no box at all, and
accounts.google.com showed its ordinary email prompt. A user agent claiming
Chrome from a Chromium/Electron fingerprint is what a bot check scores on.
If Google ever refuses a sign-in, rewrite the `User-Agent` HEADER for its
sign-in hosts only, never what the page's script reads.

**Signing out (2026-09-12):** the partition is a credential store on disk and
closing every tab never touched it — the tabs are a setting file, the sign-in
a Chromium profile beside it — which on a shared church computer leaves the
last volunteer signed in for the next. **Sign out of every site**
(`clearAiChatGuestData` behind `main:app:clear-ai-chat-data`) is the **↤** in
the head row AND a line on the chooser card, because neither alone reaches it:
a window with all eight tabs on a site cannot open the card. It asks first,
and a yes clears each tab's `lastUrl` and its site-given `pageTitle` (the
previous person's conversation titles) while keeping a name the user typed,
then remounts every guest through a window-local epoch in the React key.
The box's fifth wall is [[aichat-guest-cannot-reach-loopback]].

**Microphone (2026-09-14):** reported with a picture of claude.ai's dictation
button under *Microphone access is blocked* — the site's own way out points
at a browser address bar the guest does not have. The user chose to ASK per
site rather than keep refusing or always allow. The main process routes an
audio-only request from a site's own https top page to the window
(`askAiChatMicrophone`), which refuses silently unless it is the tab in front
on its own site, else asks on its amber line with *Don't allow* focused. A yes
lives in memory until the app closes or Sign out. The permission CHECK must
answer yes for that page: Electron's check is boolean, and a site that reads
denied shows "blocked" without ever asking. The camera stays refused, even
beside the microphone; nothing yet shows that a microphone is live (`AC-14`).

**Popups and WebSockets (2026-09-14):** found by measuring, not reported.
`allowpopups` switches Electron's popup blocking off, so a page's timer could
open the system browser unasked; the handler now hands the browser a page only
within 5 s of a press in that guest (its `input-event`, read in the main
process), one per press, and a refused one is said on the window's
`role="status"` line for the tab in front. And `*://` is http(s) only, so a
`ws://` handshake to any loopback service walked around the fifth wall until
the filter named `ws://` and `wss://` — see
[[aichat-guest-cannot-reach-loopback]].

**Why:** the user wanted the sites themselves, with their own accounts, not
the app's assistant — and the app runs on low-spec machines, so every open
site (one renderer process each) had to be capped: three live guests, the
rest unload and reload their last page on return.

**How to apply:** it is NOT the chatbot — no key, no MCP, no knowledge, and
the *Enable AI features* switch does not touch it (decided with the user).
The guest is not a `list_pages` target, and the host page is a locked-down
window the `owa_*` tools refuse like the chatbot's: chrome-devtools'
`take_snapshot` / `click` / `take_screenshot` by page id drive the host
(tabs, chooser, head row), nothing drives the site inside, and sign-in checks
(and claude.ai's Cloudflare box on a first visit) are by hand.
`webviewTag: true` is handed to that ONE page by its bounds key in
`genPopupWebPreferences`; React's types already declare `webview`, and
`allowpopups` must reach the element as the string `""`. The tab strip is
shared with the chatbot (`RenderSessionTabsComp`, `chatWindowShared.scss`).
Related: [[aichat-guest-cannot-reach-loopback]],
[[agent-access-mcp-chatbot]], [[glassy-popup-windows]],
[[app-window-tools-everywhere]].
