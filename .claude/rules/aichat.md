---
paths:
  - "src/aichat/**"
  - "electron/aiChat*.ts"
  - "html/aichat.html"
---

# AI Chat window

The ✨ window — a company's chat site in a sandboxed `<webview>`, owned by the
`owa-enhance-aichat` skill. The caution asked before it opens is in
`chatbot-window.md`.

- **The AI Chat window is a company's site in a box, not the assistant**
  (2026-09-11, `html/aichat.html` → `src/aichat/*`,
  `electron/aiChatGuestHelpers.ts`; the user's ask, modelled on Firefox's AI
  sidebar). Sites are `AI_CHAT_PROVIDER_LIST` rows (ChatGPT, Claude, Gemini,
  DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen, Copilot — adding a site is
  adding a row), opened by the ✨ RIGHT of the 🤖 on the three headers, Help →
  AI Chat and Tools → AI Chat, with the chatbot's popup features (460×640,
  glassy, bounds under `aichat.html`). **Not gated on the AI switch** (decided
  with the user): there is no key, MCP or CDP door to turn off. W-44, CB-68.
  - **The guest stays a stranger.** A `<webview>` (`webviewTag: true` from
    `genPopupWebPreferences` for that ONE page by its bounds key, never by an
    opener's feature) on the persistent `persist:aichat` session.
    `initAiChatGuestGuard`: `will-attach-webview` forces no preload / no node /
    context isolation / sandbox and REFUSES another partition or a non-https
    `src`; navigation is http(s) only; `window.open` is denied and sent to
    `shell.openExternal` (`handlePopupWindowOpen` hands out
    `nodeIntegration: true`) ONLY within 5 s of a real press in that page, one
    page per press (`AC-15`, `decideGuestWindowOpen`; the press is the guest's
    `input-event`, read in main). `allowpopups` disables Electron's blocker, and
    a page timer once opened the system browser unprompted. A refusal is said
    on the window's `role="status"` line (`RenderAiChatPopupNoticeComp`, front
    tab only, ≤1 per 5 s), which opens nothing. Downloads keep Electron's Save
    dialog because a person is driving.
  - **Permissions**: only `clipboard-sanitized-write`; the microphone is ASKED
    (`AC-13`). An audio-only request from a site's own https top page goes to
    the window (`askAiChatMicrophone` → `app:ai-chat:microphone-ask`), refused
    silently unless it came from the FRONT tab on its own site, else asked on
    the amber line with _Don't allow_ focused. A yes is per origin, in memory,
    until quit or Sign out, and only the window asked may answer. The CHECK
    handler says yes for that page (Electron has no "ask" state, and a site
    reading denied never asks); the cost is that `enumerateDevices` names the
    microphones. The camera stays refused.
  - **The fifth wall is the machine itself** (2026-09-12). Before it, a
    `no-cors` fetch from a claude.ai guest was served by BOTH loopback doors —
    CORS, `checkIsAllowedOrigin` and `--remote-allow-origins` stop reads, POSTs
    and WebSockets, not that — and the same request reaches the church's
    router, NAS and printers. `guardGuestSessionRequests` puts
    `onBeforeRequest` on the guest session and cancels any host that
    `checkIsLocalHostname` (in `webUrlPolicy.mjs`, the one implementation
    `checkWebUrl` also uses) calls local or private. The filter
    `GUEST_REQUEST_URL_PATTERNS` is `*://*/*`, `ws://*/*`, `wss://*/*` — never
    address patterns (they carry no range; `127.0.0.2` walks through), and
    `*://` is http(s) only, so ws/wss need their own (`AC-11`); never
    `<all_urls>` (`data:`/`blob:` have an empty host that counts as local).
    Electron keeps ONE `onBeforeRequest` per session, so registering another
    on this partition REPLACES the wall. The probe also checks the site's own
    origin still answers 200. A public name resolving to a local address
    (`localtest.me`) is not caught, deliberately: a DNS pass per request is a
    TOCTOU race anyway, and both doors refuse a foreign Origin (`AC-10`).
  - **Sign out of every site**: the partition is an on-disk credential store
    that closing tabs never touches. `clearAiChatGuestData`
    (`clearStorageData` + `clearCache` + `clearAuthCache`, via
    `main:app:clear-ai-chat-data`) is the **↤** in the head row AND a line on
    the chooser card (a window with every tab on a site cannot open the card).
    It asks on the strip's amber `role="alertdialog"` line with _Keep me signed
    in_ focused; a yes clears each tab's `lastUrl` and site-given `pageTitle`,
    keeps a name the user typed, and remounts every guest through a
    window-local epoch in the React key.
  - **The browser tells the truth**: Electron's own user agent, and
    `--disable-blink-features=AutomationControlled` (`electron/index.ts`)
    switches `navigator.webdriver` off. A plain-Chrome user agent plus
    `webdriver: true` read as _Robot_ and looped Cloudflare on claude.ai; a
    Chrome user agent on a browser with Chromium traits is the mismatch a bot
    check scores. If Google ever refuses a sign-in, rewrite the `User-Agent`
    HEADER for its sign-in hosts in `onBeforeSendHeaders`, never what page
    script reads. A first claude.ai visit shows _Verify you are human_, which
    the person ticks.
  - **Tabs**: the chatbot's strip EXTRACTED to `RenderSessionTabsComp`
    (generic over `{id, isLocked}` plus `genTitle` / `canAdd` /
    `canClearAll`), shared rules in `chatWindowShared.scss`.
    `aichat-sessions` keeps 8 tabs of `{providerKey, title, pageTitle, lastUrl,
isLocked, lastUsedAt}`; `lastUrl` is only an https page on the site's own
    hosts (`toKeptUrl`), never a sign-in page. **Three live guests at most**
    (`toLiveSessionIds`: active + 2 most recent; the rest unmount and reload
    later — each site is a renderer process). **Up to three WINDOWS**
    (2026-09-30, `electron/aiChatWindowHelpers.ts`): every ✨ press opens
    another (a fresh `uuid`; a fourth press raises the open ones), and each
    keeps its own tabs under a SLOT the main process hands out — slot 0 is
    the old `aichat-sessions` key, slot n `aichat-sessions-<n+1>` — because
    two windows on one key save over each other. A tab dragged along the
    strip reorders; dragged out of the window, or sent by **Open in new
    window**, it is handed to the main process by a sync IPC keyed by the
    new window's uuid and taken ONCE at module scope (a `useState`
    initialiser runs twice under StrictMode). The new window's parent is the
    opener's parent, and `webviewTag` is `false` on every other page, so
    nothing an AI Chat window opens inherits the tag. A closed tab goes to
    **Recently closed** (`aichat-closed-tabs`, 20, shared, read with
    `getSettingForce`), reopened from the card, the 🕘 or Ctrl+Shift+T; Sign
    out empties it and tells the other windows. Hide with `visibility: hidden`,
    never `display: none` (it re-attaches). `src` is fixed per mount; a site
    change is a new React key. `allowpopups` must be the STRING `""`
    (`GUEST_POPUP_ATTRIBUTES`; React drops a boolean on an unknown attribute),
    and React already types `webview`. The host page is on
    `LOCKED_DOWN_PATH_NAMES`; the guest is not a `list_pages` target and the
    `owa_*` tools refuse the host, so chrome-devtools tools by page id drive
    only the host chrome and sign-in checks are by hand.
