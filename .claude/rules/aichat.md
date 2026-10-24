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
    opener's feature) on the persistent `persist:aichat` session. **The one
    other `<webview>` host is main's own** (2026-10-07): a virtual display's
    hidden compositor window (`electron/virtualDisplayService.ts`) holds the
    app's OWN screen pages, one `<webview>` per screen. It is created by
    main, never opened by a page, and registered BY WEBCONTENTS in
    `electron/virtualDisplayHostRegistry.ts` before it loads anything;
    `initAiChatGuestGuard` steps aside for that registered host and its
    guests only (`checkIsVirtualDisplayHost` / `checkIsVirtualDisplayGuest`),
    and the compositor's own `will-attach-webview` refuses any `src` but an
    attached screen's `screenMirrorRuntime.screenUrl(id)`. An unregistered
    host is refused exactly as before; a URL is never what exempts one.
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
  - **Its words and lettering are the app's language** (2026-10-17, the
    user's picture of the window in English beside a Khmer app: _both
    chatbot and ai chat must have translation and have font-family apply_):
    `src/aichat.tsx` draws from `init`'s callback and plugs in the
    chatbot's translator (`plugChatWindowLanguage`), so every label here is
    a chatbot `tran` key with Khmer and French, and the language's face
    rides `--chat-lang-font` in the shared font stacks. **Inside the site
    too** (the same day, the user's picture of Claude's Khmer in the OS's
    serif fallback: _make font-family effect page body as well_;
    `aiChatGuestFontHelpers.ts`): on each guest's `dom-ready` and
    `did-stop-loading` the window reads the pack's regular and bold files
    and hands their BYTES to the page as `FontFace` objects -- nothing is
    fetched, so neither the guest's wall nor the site's own CSP has a
    request to allow, and nothing of the app is reachable from the page --
    each limited to the language's letters (`unicode-range` from its
    `scriptPattern`) and added under the web-font names the site's text is
    drawn in, plus one `insertCSS` body rule putting the face in front of
    the site's own list for a site on system fonts (the list read back is
    cut to names and commas, between names, before it is written).
    **Same weight, style and stretch as the site's face** (the same day:
    _ai chat font-family not effect the website_): Chromium picks ONE group
    of faces per name by those three, and only inside a group does
    `unicode-range` share the letters out -- a Khmer face at `400` beside
    claude.ai's `anthropic-sans` at `300 800` took regular text and sent
    its Latin to Segoe UI. So each site face that is LOADED (the browser
    loads a web font only for text drawn in it), or loads later
    (`loadingdone`, so an answer's face nothing used at load still gets
    it), gets one Khmer face with its own descriptors, ≤12 a page; a site
    face whose own range cannot hold the letters is passed over. Cost:
    in a site face covering every weight, bold Khmer is the regular file.
    Once per document (`window.__owaLanguageFont`, checked before any byte
    is sent). Seen live on claude.ai: Latin in Anthropic Sans/Serif, Khmer
    in Battambang, read with `CSS.getPlatformFontsForNode` over the
    guest's own `/json/list` `webview` target. That report was ALSO a dev
    server serving a stale `AiChatAppComp.tsx` (a long-running Vite missed
    the change; fetching the module showed no font code) -- check what is
    served before debugging the code. **A face picked in Settings →
    General → Font Family reaches the guest too, by NAME only**
    (2026-10-20: _not effect ai chat as well_, then _like font-family from
    lang data, it should effect inside the page as well_, then _still not
    effect_; it is an installed face, nothing of it is fetched or handed
    over): `aichat.tsx` reads it once (`readChatWindowAppFontFamily`) into
    `setAppFontFamily`, and `applyGuestLanguageFont` runs
    `genGuestAppFontScript` -- a `local(...)` FontFace under every loaded
    site face's name with that face's own weight, style and stretch (the
    same move the language face makes with bytes), limited to text letters
    (`U+0-2FFF`, so PUA icon fonts and the emoji planes stay the site's) --
    plus the body rule with the name in front of everything. Both come
    AFTER the language face's, so where the ranges overlap the picked face
    wins; the rule lands too when the app language has no face of its own,
    which is how a Khmer answer on an English app takes Battambang inside
    claude.ai. **The first cut named the FAMILY (`local("Battambang")`) and
    every borrowed face ended in `error`**: `local()` wants the face's
    FULL name or PostScript name, not the family, and its failure is "A
    network error occurred" (in the host page as much as in a guest; plain
    CSS resolves family names fine, which is why the chrome worked while
    the page did not). Each borrow now tries `local("F Regular")`,
    `local("F-Regular")` and `local("F")` (plus the Bold pair for a heavy
    site face), and a face none of them load for is skipped by the letter
    matcher, leaving the site's own face alone. Verified at the glyph
    level: `CSS.getPlatformFontsForNode` on the guest's Khmer answer node
    read `Battambang — glyphs: 23`.
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
    opener's parent, and `webviewTag` is `false` on every other page a
    renderer can open, so nothing an AI Chat window opens inherits the tag. A closed tab goes to
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
