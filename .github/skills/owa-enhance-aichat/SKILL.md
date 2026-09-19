---
name: owa-enhance-aichat
description: 'Enhance and, above all, HARDEN the Open Worship App AI Chat window — `html/aichat.html` → `src/aichat/*` and `electron/aiChatGuestHelpers.ts` — the ✨ button right of the 🤖 that holds a company''s own chat site (ChatGPT, Claude, Gemini, DeepSeek, Kimi, Grok, Mistral, Perplexity, Qwen, Copilot) in a sandboxed `<webview>` guest beside the app, the way a browser''s AI sidebar does. NOT the assistant: that is `owa-enhance-chatbot` (the 🤖, the MCP tools, the manual). Use when asked to enhance / improve / harden / secure / audit / fix / speed up the AI Chat window, the ai chat panel, the ✨ window, `aichat.html`, the AI chat sites list, the AI chat tabs, a site that will not load or sign in inside it (a Cloudflare "Verify you are human" loop, a Google "browser may not be secure" page), the guest, the webview, or to answer "is it safe to hold a stranger''s website inside this app". THE RULE THAT BINDS EVERY CHANGE: the guest is the ONE place in this app where a page nobody here wrote runs, and every other renderer has `nodeIntegration: true` — so the guest must stay a stranger (forced sandbox preferences, one locked-down persistent session, http(s) only, popups to the system browser, no permissions, no preload, no node), the host page must stay locked down, and nothing a site can do may reach the app, the operator''s files or the projector. Every run MEASURES FIRST (scripts/probe-aichat.mjs — the guest''s box re-proven from inside it, plus what a bot check sees), verifies LIVE in the running window (a site that loads, a sign-in that works, three guests and not four), runs the gate LAST, and leaves the paper trail: W-44, CB-68, CLAUDE.md, references/backlog.md AC-xx ids, the `.github/` mirror.'
argument-hint: '[security | sites | tabs | perf | audit | full — or a plain description of the change]'
---

# OWA Enhance AI Chat — a stranger's website in a box

The AI Chat window (`html/aichat.html`) is the app's Firefox-style AI
sidebar: a ✨ button right of the 🤖 opens a narrow window beside the app, a
card lists ten AI chat sites, and a press loads the company's own website in
a `<webview>` guest — the user's own account, the site's own sign-in, kept
across restarts. It was asked for on 2026-09-11 (*like firefox, I want an ai
chat panel … just open webpage from ai company directly*, *tabs for each
session like the chatbot*) and it is NOT the assistant:

| | 🤖 App Assistant (`owa-enhance-chatbot`) | ✨ AI Chat (this skill) |
| --- | --- | --- |
| What it is | the app's own help: manual + MCP tools + a model | somebody else's website |
| Who talks to whom | the window calls a provider with the user's key | the site talks to itself |
| Gated on *Enable AI features* | yes | **no** — no key, no door |
| What runs in the window | our React code | **a stranger's page**, in a guest |

That last row is the whole subject. Every other renderer in this app runs
with `nodeIntegration: true` and `contextIsolation: false`; the guest is the
one renderer where a page nobody here wrote executes, minutes before a
service, on a machine that also holds the projector. So this skill's first
property is not negotiable and comes before every feature:

1. **The guest stays a stranger** — §A and
   [references/threat-model.md](./references/threat-model.md).
2. **The window stays cheap** — every loaded site is a renderer process, and
   the target machines cannot hold eight; §B.
3. **The sites actually work** — a site that will not sign in, or a bot check
   that never passes, is a window nobody uses; §C.
4. **It stays the chatbot's twin** — same popup, same tab strip, same tokens,
   so the two windows read as one family; §D.

## Non-negotiables

Breaking one of these is a regression even when the feature works.

1. **No node in the guest, ever.** `will-attach-webview` in
   `electron/aiChatGuestHelpers.ts` FORCES the guest's preferences — no
   preload, `nodeIntegration: false`, `contextIsolation: true`,
   `sandbox: true`, `webSecurity: true` — and refuses any guest that is not
   an https site on `persist:aichat`. A change that needs a preload in the
   guest "just for this" is the change that loses the boundary.
2. **One partition, locked down once.** The guest lives on `persist:aichat`
   (persistent, so a sign-in survives a restart — that is the point). The
   session grants only `clipboard-sanitized-write` on its own; camera,
   location, notifications, screen capture, clipboard-read are refused
   without a prompt. **The microphone is ASKED, never granted by the box**
   (2026-09-14, the user's call): an audio-only request from a site's own
   https top page goes to the window, which refuses it silently unless the
   guest is the tab in FRONT and the page is that tab's own site, and
   otherwise asks on its own line with **Don't allow** focused. A yes is per
   site, in memory, until the app closes or **Sign out of every site**; a
   request that also wants the camera is refused whole.
3. **http(s) only, and out means OUT — for a press.** The guest may navigate
   to http(s) and nothing else (`will-navigate` / `will-redirect`); a window
   it opens goes to the system browser through `shell.openExternal` and is
   denied — never to an app window, because `handlePopupWindowOpen` hands out
   `nodeIntegration: true` — and ONLY within five seconds of a press the
   person made in that guest, one page per press (`decideGuestWindowOpen`;
   the press is the guest's `input-event`, read in the main process where a
   page cannot fake one). `allowpopups` switches Electron's popup blocking
   off entirely: before 2026-09-14 a page's timer opened the system browser
   with nothing pressed. A refused page is said on the window's own line, for
   the tab in front, and nothing on that line opens it.
4. **The guest talks to the public internet and nothing else — WebSockets
   too.** `guardGuestSessionRequests` cancels every request from the guest
   session to a local or private address (`checkIsLocalHostname`,
   `tools/owa-devtools-mcp/webUrlPolicy.mjs` — one dialect, shared with the
   MCP firewall). This machine's loopback carries the app's own CDP and MCP
   doors; a blind `no-cors` `fetch` at both was served before this existed.
   The filter is `GUEST_REQUEST_URL_PATTERNS` — `*://*/*`, `ws://*/*`,
   `wss://*/*` — because `*://` is http and https only: until 2026-09-14 a
   `ws://` handshake to any loopback service opened from the guest. Never
   `<all_urls>` (it hands the listener `data:`/`blob:` loads, whose empty
   host counts as local), never narrow the filter to an address pattern list
   (`127.0.0.2` walks through one), and never register a second
   `onBeforeRequest` on this partition — Electron keeps one listener and the
   second silently replaces the first.
5. **`webviewTag: true` goes to ONE page by its bounds key**
   (`genPopupWebPreferences`, `electron/electronHelpers.ts`), never by a
   feature an opener could ask for.
6. **The host page is locked down** like the chatbot's
   (`LOCKED_DOWN_PATH_NAMES`, `electron/client/rendererLockdown.ts`): no
   `require`, a decoy `process`. It draws a tab strip and a chooser and
   needs nothing of Node.
7. **The browser tells the truth about itself.** The user agent is Electron's
   own and `navigator.webdriver` is switched off
   (`--disable-blink-features=AutomationControlled`, `electron/index.ts`).
   A plain-Chrome user agent made claude.ai's Cloudflare box loop for good;
   see §C. Do not "fix" a site by lying to it — fix the one HEADER the site
   reads, on that site's hosts, if it ever comes to that.
8. **Three live guests, never `display: none`.** `toLiveSessionIds` keeps the
   active tab plus the two most recently used; a hidden guest is
   `visibility: hidden` (display:none re-attaches and reloads it); `src` is
   fixed per mount and a site change is a new React key.
9. **Nothing a site says is trusted on the way back.** The tab strip shows
   the page's title and remembers an address; `toKeptUrl` keeps only an
   https page on the site's own hosts, `toPageTitle` bounds the title, and
   `toValidSession` LISTS the fields it reads off disk, never spreads.
10. **Performance outranks elegance** (CLAUDE.md): no long-lived cache, no
    guest kept alive "in case", nothing read that is not on screen.
11. **Everything under `.claude/skills/` ships** in the installer, in
    plaintext. No secrets, no account names, no customer sites.
12. **Anything that changes what a congregation sees is offered, never done.**
    So is anything that ends a sign-in: **Sign out of every site** asks
    first, and the safe answer keeps the focus.

## Procedure

### 0. Get a live app, a live window, and a baseline

The dev app must be RUNNING with the AI Chat window open on at least one site.

```bash
# re-proves the guest's box from INSIDE the guest, and reads the host page
node .claude/skills/owa-enhance-aichat/scripts/probe-aichat.mjs
```

It answers, per guest: `require` / `process` unreachable, `navigator.webdriver`
false, the partition, the permissions a page is refused, that a `file:`
navigation is refused, that `window.open` is denied, that ten addresses on
this machine and its network — both of the app's own doors among them — are
unreachable, and that the site's own origin STILL is; that a WebSocket to five
spellings of loopback is refused — judged by what the probe's own loopback
servers RECEIVED, since a page's `closed 1006` cannot tell a refusal from
nothing listening — and that a public `wss://` echo STILL opens; and, on the
host page, that `require` is gone, no more than three guests are mounted, and
a `window.open` of example.com with nothing pressed is handed nothing and said
on the window's line. 43 checks with one site open, all held as of 2026-09-14
— the eight added that afternoon are the WebSockets, their positive control
and the no-press window. Write it down before changing anything. A run where
one of those "held" checks fails is the failure this skill exists to catch —
including the two that fail when a wall has become a brick. A browser window
opening on example.com during a run is the press gate failing.

> **The guest is not a `list_pages` target.** chrome-devtools-mcp lists pages;
> a `<webview>` is a `webview` target, and the `owa_*` tools refuse the host
> page as they refuse the chatbot's (it is locked down). So: chrome-devtools'
> `take_snapshot` / `click` / `take_screenshot` by page id drive the HOST (tabs,
> chooser, head row) and a `take_screenshot` of the host does include the
> guest's pixels; the probe script reaches the guest over raw CDP
> (`/json/list` lists it, `evaluateInTarget` speaks to it); keyboard events
> sent to the host reach the guest once it has focus (click its `Iframe`
> node in a verbose snapshot, then `press_key`). Nothing else drives the
> site inside — sign-in checks are by hand.

> **Two watchers restart the dev app.** `electron/*.ts` is recompiled by
> `tsc -w` and nodemon restarts Electron on `electron-build/` AND on
> `tools/owa-devtools-mcp/**` — so editing the guard, the corpus, or
> rebuilding the knowledge closes the AI Chat window mid-check. Tabs come
> back from `aichat-sessions` on the next open. `npm run build` deletes
> `electron-build/` and does the same (memory: `build-kills-running-dev-app`):
> **verify live FIRST, run the gate LAST.**

### 1. Decide what kind of change this is

- **Security** (§A): something a site could reach that it must not; a
  property in the threat model that is measured rather than assumed.
- **Sites** (§C): a site that will not load, will not sign in, loops on a bot
  check; a site to add (a row in `AI_CHAT_PROVIDER_LIST`, its `hosts` right).
- **Tabs / window** (§D): the strip, the chooser, the head row — shared with
  the chatbot, so a change here is a change there.
- **Performance** (§B): what a guest costs, how many are alive, what is
  written to `aichat-sessions` and how often.

### 2. Do the work — §A–D below

### 3. Verify LIVE — mandatory

| Change | Proof |
| --- | --- |
| The guest's box | `probe-aichat.mjs` shows the property held from inside the guest, AND the thing tried for real fails to happen |
| The request wall | the address is refused from inside the guest AND the site's own origin still answers — a wall that blocks the site is a brick, so both halves or it does not count |
| Sign out of every site | the confirm asks, the safe answer has the focus, and after a yes the guests come back on their sign-in pages with the tabs' remembered pages and site-given names gone |
| A site added or fixed | it loads in a tab; the tab takes the page's title; a reload lands on the same page; the address survives closing and reopening the window |
| A bot-check or sign-in fix | the site's own page opens with NO box, on a fresh Ray ID — a box that appears and "passes" once is not a pass (see §C for how the loop looks) |
| The live-guest cap | four tabs on four sites; a verbose `take_snapshot` of the host shows exactly three children in the stage; the fourth reloads when chosen |
| Anything in the strip | the SAME thing in the chatbot window, which shares the component |
| Anything the host page does | `typeof require === 'undefined'` there, still |

### 4. Run the gate, last

```bash
npm run lint
```

`&&`-chained: the first failing stage stops the rest. Read the log body, not
the exit code. Its build check goes to a temp dir (`EN-16`), so the dev app
under nodemon is left alone; a real `npm run build` still restarts it — nudge a
watched file if it does not come back.

### 5. Land the paper trail

In the SAME change, whatever is true of the work:

- `.claude/CLAUDE.md` §*Agent access* → the AI Chat bullet — anything
  structural: a preference, a policy, the session, the cap.
- [references/backlog.md](./references/backlog.md) — `AC-xx` status, plus
  everything found and NOT done.
- `.claude/skills/owa-robot-test/references/user-workflows.md` **W-44** and
  `docs/test-paths/coverage-matrix.md` **CB-68**, then
  `node docs/scripts/build-manual.mjs`; `questions/common.json` for a
  question the assistant should now answer.
- `.claude/memory/aichat-window.md` for anything not derivable from the code.
- **The `.github/` mirror** (`.github/skills/`, `.github/memory/`,
  `.github/copilot-instructions.md`): copy, never reconcile by hand.
- **Any edit under `.claude/` needs `node extra-work/build-knowledge.mjs`.**

## Areas

### A. Security — the one that comes first

Full model, the measurements and what is still open:
**[references/threat-model.md](./references/threat-model.md).** The short form:

- The threat is the SITE. A chat site is a huge, remotely updated, ad- and
  script-carrying web application under somebody else's control, and it
  renders whatever the user pastes into it. Treat every guest as hostile
  and every property as something to re-prove, not assume.
- The box has five walls, each measured by the probe: the guest's
  preferences (forced, not trusted), the session (permissions refused, one
  partition), navigation (http(s) only, popups out), the host page (no
  node, one `webviewTag` grant), and the machine it stands on (no request
  to a local or private address). The fifth was missing until 2026-09-12
  and the first four could not see it: they keep the site out of the APP,
  and the site is running on a machine whose loopback carries the app's own
  CDP and MCP doors.
- What the guest CAN do, and must be allowed to: set cookies and storage on
  its own session (sign-in), download a file the user asked for (Electron's
  own Save dialog — a person is driving), open a link in the system browser,
  write the clipboard when the user presses Copy.
- What it must never do: reach `file:`/`owa:`/the app's pages, open an app
  window, prompt for a device (the microphone is asked by the WINDOW, on its
  own line, never by the page), read the clipboard, run with a preload, or be
  driven by anything but the person in front of it.

When adding to the policy: a refusal a person sees is written for a PERSON
(*"… could not be loaded — Check the internet connection"*, **Try again**),
and a refusal a page meets is silent — a page is not owed an explanation.

**Never widen the box to make a site work.** If a site needs a permission,
the answer is the ↗ **Open in your browser** button, not a grant. The
microphone is the one exception, decided by the user on 2026-09-14 with a
picture of claude.ai's dictation button refused, and it is still not a
grant: it is a question the person answers, per site, for the tab they are
looking at (`AC-13`). A second exception is the user's call, not a run's.

### B. Performance — every guest is a process

- One loaded site is a renderer process of a few hundred megabytes. The cap
  is three (`MAX_LIVE_GUEST_COUNT`); the rest reload their last page on
  return, which costs a second and loses nothing because the conversation
  lives on the site.
- `aichat-sessions` is written on a 400 ms debounce and flushed on unload;
  every field in it is bounded (8 tabs, a 60-character page title, a
  2 000-character address).
- The host page loads bootstrap and its own sheet, no app tokens, no
  webfonts — the chatbot's rules, for the same back-room reasons.

### C. The sites — where the real bugs live

A site is a moving target; what worked in September may show a box in
October. Measured 2026-09-11, from inside the guest, on `browserscan.net`'s
bot-detection page (the probe reads the same signals):

- **`navigator.webdriver` read `true`** with the app as launched — the one
  red square on an otherwise *Normal* browser. Fixed by
  `--disable-blink-features=AutomationControlled` before `ready`; nothing in
  the app reads the flag and the remote-debugging door stays as it was.
- **A plain-Chrome user agent looped claude.ai's Cloudflare box for good** —
  tick, *Verifying…*, a fresh Ray ID, the box again — even with the flag
  cleared. A user agent claiming Google Chrome from a browser whose every
  other trait says Chromium is exactly the mismatch a bot check scores on.
  With Electron's own user agent claude.ai opened straight to its sign-in
  page, and `accounts.google.com` showed its ordinary email prompt. So the
  browser tells the truth (non-negotiable 6). Should Google ever refuse a
  sign-in, rewrite the `User-Agent` **header** for its sign-in hosts in
  `webRequest.onBeforeSendHeaders`, never `navigator.userAgent`.
- A first visit to claude.ai or DeepSeek may still show a human check on a
  cold session; that is the site's, the person ticks it once, and the
  clearance cookie then lives on the persistent partition. A box that comes
  BACK after ticking is the loop above — measure, do not guess.
- Adding a site is adding a row to `AI_CHAT_PROVIDER_LIST`: `homeUrl`, and
  `hosts` — the hosts a tab may REMEMBER a page on (`toKeptUrl`); the
  sign-in hosts (`accounts.google.com`, `auth.openai.com`) are deliberately
  not among them, or a tab reopens onto an expired half of a redirect.

### D. The window — the chatbot's twin

- The tab strip is `src/chatbot/RenderSessionTabsComp.tsx`, shared; the
  tokens, the glass variants and the tab rules are
  `src/chatbot/chatWindowShared.scss`. A change to either is a change to both
  windows — verify in both.
- The popup is opened with the chatbot's features (`openAiChatPage` in
  `src/helper/domHelpers.ts`: 460×640, glassy, right/centre, bounds
  remembered under `aichat.html`). Three ways in: the ✨ button
  (`AiChatButtonComp`, `src/others/commonButtons.tsx`, on the three
  headers), **Help → AI Chat** (`electron/electronMenu.ts`), **Tools → AI
  Chat** (`AppAssistantComp`, every window). None is gated on the AI switch.
- Strings inside the window are English-only, like the chatbot's; the one
  label the app windows draw (`AI Chat`) goes through `tran()` and has its
  Khmer key.

## What counts as an improvement

- A way for a site to reach the app or the machine that is now impossible,
  shown refused by the probe from inside the guest.
- A site that now loads, signs in or passes its own check where it looped —
  proven on a fresh Ray ID, not on a cached clearance.
- Fewer processes or fewer bytes for the same window, measured.
- A failure that used to be a blank stage now says something true.

Not an improvement: a permission granted for convenience, a user agent that
lies, a preload in the guest, a fourth live guest, a site added with a
`hosts` list that lets a sign-in page be remembered.

## Resources

- [references/threat-model.md](./references/threat-model.md) — the box, its
  five walls, the measurements, what is still open. **Read before any
  security change.**
- [references/backlog.md](./references/backlog.md) — tracked `AC-xx` items.
- [scripts/probe-aichat.mjs](./scripts/probe-aichat.mjs) — re-proves the
  box from inside the running guest. Read-only apart from the refusals it
  expects to be refused.
- `../owa-enhance-mcp/references/threat-model.md` — the app-wide picture this
  box sits inside: every other renderer has node integration.
- W-44 in `../owa-robot-test/references/user-workflows.md`, CB-68 in
  `docs/test-paths/coverage-matrix.md` — what the user is promised.
