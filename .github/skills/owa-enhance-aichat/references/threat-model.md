# Threat model — a stranger's website inside the app

_Last measured 2026-09-14, against the running dev app, from inside the guest.
43 checks with one site open, all held._

## Why this window is different from every other window

Every other renderer in this app runs with `nodeIntegration: true` and
`contextIsolation: false` (`genWebPreferences`, `electron/electronHelpers.ts`).
Their content is ours. The chatbot window renders text a model wrote, which
is why it is locked down separately. The AI Chat window goes one step further
than either: **it runs a page nobody here wrote at all** — ChatGPT's, Claude's,
Gemini's, DeepSeek's — a remotely updated web application under somebody
else's control, carrying third-party scripts, rendering whatever the user
pastes into it, and holding the user's signed-in session with that company.

If that page ran where the other pages run, `require('child_process')` from
a chat site's script would be a shell on a church's computer. So the site
runs in a `<webview>` guest, and the guest has five walls. Each is a
measurable property, and `scripts/probe-aichat.mjs` measures them from
INSIDE the guest, because a wall that is assumed is a wall that is not there.

The fifth was missing until 2026-09-12, and it is the one the first four
cannot see: they all keep the site out of the APP, and none of them touches
the fact that the site is running on a MACHINE whose loopback carries this
app's own two doors.

## Who is on the other end

- **The site.** It is not malicious, and it does not have to be: a supply
  chain of ad scripts, analytics and A/B frameworks changes under it weekly,
  and every one of those runs in the guest with the site's authority.
- **What the user pastes into it.** A notice, a sermon draft, a song from a
  chord site — the same untrusted text the chatbot's threat model worries
  about, now rendered by a page that renders untrusted text for a living.
- **A link inside it.** A citation, a "learn more", a share sheet: anything
  that can open a window is a way to ask the app for a new renderer.
- **The machine's other users.** The partition is persistent on disk; a
  sign-in cookie is a credential.

## The five walls

### 1. The guest's own preferences are FORCED, not trusted

`electron/aiChatGuestHelpers.ts` `initAiChatGuestGuard` listens for
`will-attach-webview` on every WebContents and, for the guest about to
attach:

| Forced | Why |
| --- | --- |
| `preload` / `preloadURL` deleted | a preload runs with node before the page does; "just for this site" is how the boundary goes |
| `nodeIntegration: false`, `nodeIntegrationInSubFrames: false` | the page must not see `require` |
| `contextIsolation: true` | the page's JS world is not the browser's |
| `sandbox: true` | the renderer process is OS-sandboxed |
| `webSecurity: true` | same-origin rules stay on (unlike `captureWebScreenShot`, a different trust level) |
| refused unless `src` is https AND `partition === 'persist:aichat'` | a guest on a session nobody locked down, or on `file:`, never attaches |

`webviewTag: true` itself is handed out by `genPopupWebPreferences` to ONE
page — the AI Chat window, by its bounds key — never by a feature an opener
could request in `window.open`'s features string.

Measured: `typeof require`, `typeof process`, `typeof module` are all
`'undefined'` in the guest.

### 2. One session, locked down once

`session.fromPartition('persist:aichat')`:

| Rule | What it does |
| --- | --- |
| `setPermissionRequestHandler` → `clipboard-sanitized-write`, and the microphone ASKED | camera, geolocation, notifications, clipboard-read, display capture, MIDI, USB, the lot: refused without a prompt — a permission dialog over a live service, raised by a page in a side window, is the surprise this app is built to avoid |
| the microphone (since 2026-09-14, `AC-13`) | an audio-only `media` request from the site's own https top page (`toMicrophoneOrigin`) goes to the AI Chat window (`askAiChatMicrophone`) instead of being answered here. The window refuses it silently unless the guest is the tab in FRONT and the page is on that tab's own site (`decideMicrophoneAsk`), and otherwise asks on its own amber line with **Don't allow** focused. A yes is per origin, in memory only, until the app closes or **Sign out of every site**; even a site already allowed is routed through the window, so a tab behind cannot open it. Only the window that was asked may answer (`event.sender` is checked); an ask unanswered for two minutes, or whose guest goes away, is a no. A request that also wants the camera, or comes from a frame inside the page, is refused whole. Measured 2026-09-14 on claude.ai in the dev window: the site's own **Dictate** button raised the line (it had shown *Microphone access is blocked* before); **Don't allow**, Escape and a tab switch each handed the page `NotAllowedError` and cleared the line, and the next ask asked again; **Allow** handed it a live audio track, a second ask got one with no line, and the same page behind another tab was refused on that same yes |
| `setPermissionCheckHandler` → the same set, plus the microphone on a site's own https top page | a page that only QUERIES gets the same answer as one that asks — with one difference forced by Electron: a check has no "ask me" answer (true reads as granted, false as denied), and a site that reads denied shows its own "blocked" notice without ever asking. So the microphone checks as available on a site's own page and the STREAM is what the person is asked about. The cost, measured: `permissions.query` says granted before anyone said so, and `enumerateDevices` names the machine's microphones and speakers to the page (the camera stays unnamed) |
| persistent | a sign-in survives a restart — the reason the window exists |
| user agent: Electron's own | see *What a bot check sees* |
| downloads: Electron's default Save dialog | a PERSON is driving, and a chat site legitimately hands over files the user asked for; `owa_read_website`'s session refuses them because a MODEL chose that page |

The app-wide `webRequest` rewrites in `electron/fsServe.ts` (Referer, CORS
headers) are on `defaultSession` only; they never touch this partition.

### 3. Navigation: the web and nothing else

On every WebContents of type `webview`:

| Rule | What it does |
| --- | --- |
| `will-navigate` / `will-redirect` → `checkIsGuestUrlAllowed` | `http:` and `https:` only. `file:`, `owa://local/…` (the app's own pages), `javascript:`, `about:` are cancelled |
| `setWindowOpenHandler` → `shell.openExternal` then `{ action: 'deny' }` | a link out of the site opens in the browser the user already has, NEVER a window of this app: `handlePopupWindowOpen` hands out `nodeIntegration: true` to anything it lets through |
| … and only for a press (`decideGuestWindowOpen`, since 2026-09-14) | the browser is handed a page only within five seconds of a press the person made in that guest, one page per press. The press is the guest's `input-event` (mouse down or up, key down, tap), read in the MAIN process, where a page's script cannot make one. An address the guest itself is refused is never handed over, and nothing is while the address policy has not loaded |
| `allowpopups` on the element | present on purpose, so `window.open` REACHES the handler above instead of dying in silence and taking sign-in popups with it. It reaches the element as the string `""` — React drops a boolean on an attribute it does not know |

Measured: `window.open('file:///C:/')` returns `null` in the guest; a
`location.href = 'file:///…'` leaves the guest where it was.

**Why a press — measured 2026-09-14.** `allowpopups` does more than let a
pressed link through: Electron applies no popup blocker at all to a guest that
carries it. In a standalone harness on this app's Electron (43.3.0), a page's
`window.open` from a timer, with nothing pressed, reached
`setWindowOpenHandler` from the guest with `allowpopups` and not from the one
without — and in the app that handler called `shell.openExternal`. So any
script on a chat site could have opened the operator's browser again and
again, over whatever was on the projector. The same harness proved the gate's
plumbing: a press delivered to the guest fires its `input-event` BEFORE the
page's click handler reaches the window-open handler, and a second
`window.open` after that press was spent is refused. A refused page is said
on the window's own `role="status"` line — the tab in front only, at most once
per 5 s per guest, gone after 12 s: *This site tried to open example.com in
your browser without a press, so it was not opened. Press the link again if
you meant it.* Nothing on the line opens the page; the address is the site's
word. Measured in the app after: the probe's no-press `window.open` of
example.com was handed nothing and the line named example.com — and the line
is only ever sent on the branch that does not open the browser.

### 4. The host page has nothing worth reaching

`html/aichat.html` is on `LOCKED_DOWN_PATH_NAMES` beside the chatbot
(`electron/client/rendererLockdown.ts`): the preload takes `require`,
`module`, `exports`, `__dirname`, `__filename` away and replaces `process`
with a frozen decoy holding an empty `env`. The page draws a tab strip, a
chooser and a head row; it opens links with a plain `window.open`, which
the popup handler sends to the system browser. Its production CSP
(`html/aichat.html`, prod-only markers) allows `frame-src https:` so the
guest element can exist and `connect-src 'self'` only — the host talks to
nobody; the guest does its own talking on its own session.

Measured on the host: `typeof require === 'undefined'`; at most three
`<webview>` elements in the document, each `partition="persist:aichat"`.

### 5. The machine it is standing on

`electron/aiChatGuestHelpers.ts` `guardGuestSessionRequests` cancels every
request from the guest session whose host is not on the public internet, by
`checkIsLocalHostname` in `tools/owa-devtools-mcp/webUrlPolicy.mjs` — the
same module, and the same dialect, the MCP firewall and `owa_read_website`
use.

Why it is needed, measured 2026-09-12 from inside a live guest on claude.ai,
BEFORE the wall existed:

| From the guest | Before | Meaning |
| --- | --- | --- |
| `fetch` the CDP door, cors mode | `TypeError` | CORS refused the READ |
| a CDP WebSocket (`ws://…/devtools/…`) | closed 1006 | Chromium's `--remote-allow-origins` rule refused the socket |
| POST the MCP door, cors mode | `TypeError` | `host.mjs` `checkIsAllowedOrigin` answers 403 to a foreign Origin |
| **`fetch` the CDP door, `no-cors`** | **opaque, served** | **the request WENT OUT** |
| **POST the MCP door, `no-cors`** | **opaque, served** | **the request WENT OUT** |

So nothing could be read and no socket could be opened — every one of those
refusals is somebody else's code, and two of them are Chromium's — but a
blind request went out. A blind request needs no permission and reads no
answer, which is all a state-changing call needs, and it is the whole of the
classic attack on a service listening on loopback. Beyond this app the same
request reaches the church's router, its NAS, its printers and anything else
on that network.

The wall makes it ours and makes it complete. Measured after:

| From the guest | After |
| --- | --- |
| the CDP door, the MCP door | refused |
| `127.1`, `2130706433`, `0x7f.1` (the same address, written to defeat a naive check) | refused |
| `127.0.0.2` (loopback that is not `127.0.0.1`) | refused |
| `[::1]`, `192.168.1.1`, `169.254.169.254`, `printer` | refused |
| **the site's own origin** | **still reachable, status 200** |

That last row is the point of the section: a wall that also blocks the site
is a brick. The probe carries it as a check.

Two things about the shape, both deliberate:

- **The filter is `*://*/*`, not a list of loopback patterns.** Chromium's
  match patterns take a `*` host or a `*.suffix` one and no address range, so
  `127.0.0.2` would walk straight through a pattern list. The listener is
  what judges, and routing a chat site's requests through the main process is
  the cost that correctness is bought with. Electron keeps ONE
  `onBeforeRequest` listener per session: anything else registered on this
  partition later would silently REPLACE this wall rather than sit beside it.
- **A name is judged on its shape, not on where it resolves.** A public name
  whose DNS answers `127.0.0.1` (`localtest.me` is a real one) is not caught
  here; catching it needs a DNS lookup per request, which is a TOCTOU race
  anyway. It does not reach this app's own doors, because both refuse a
  foreign `Origin` — which is exactly what the "before" table measured. The
  residue is a local service that has no origin check of its own.

### WebSockets — the same wall, which they walked around until 2026-09-14

`*://` in a request filter means http and https and nothing else. So the wall
above judged every `fetch`, image and script, and never saw a WebSocket
handshake at all. Measured from inside a live claude.ai guest, with a
throwaway server on each loopback address reading what ARRIVED:

| From the guest | Before (`*://*/*`) | After (`GUEST_REQUEST_URL_PATTERNS`) |
| --- | --- | --- |
| `ws://127.0.0.1` | **opened; the server received it, `Origin: https://claude.ai`** | closed 1006, nothing received |
| `ws://localhost` | **opened, received** | closed 1006, nothing received |
| `ws://127.1` | **opened, received** | closed 1006, nothing received |
| `ws://[::1]` | **opened, received** | closed 1006, nothing received |
| `ws://127.0.0.2` | **opened, received** | closed 1006, nothing received |
| `http://127.0.0.1` (the control) | refused | refused |
| two public `wss://` echoes | opened | **still opened** |

The CDP endpoint refusing a foreign origin was never the protection it looked
like: it is one server. A church machine's loopback is where OBS, Companion
and presentation remotes listen, and many of them take a WebSocket from
anyone. The filter is now `*://*/*`, `ws://*/*` and `wss://*/*`, proven first
in a standalone Electron 43 harness: the listener sees the handshake as
`webSocket`, a cancel closes it, and `about:blank`, `data:` and a real https
page still load. Not `<all_urls>`, which catches WebSockets too and also hands
the listener every `data:` and `blob:` load — whose empty host
`checkIsLocalHostname` calls local, so every site would break.

What still does not pass through `onBeforeRequest` at all: WebRTC's UDP and
WebTransport. Neither has been measured from the guest (`AC-16`).

## Signing out, and the profile on disk

`persist:aichat` is a credential store: it holds the user's signed-in session
with every site they have opened, under `<userData>/Partitions/aichat/`, with
the OS user's file protection and nothing more. That is the same protection
every browser profile on the machine has — and a church back room is a shared
computer, where the volunteer who opened ChatGPT before the service is still
signed in for whoever sits down after it.

Closing every tab does not touch it: the tabs are a setting file, the sign-in
is a Chromium profile beside it. So the window has **Sign out of every site**
(`clearAiChatGuestData`) — `clearStorageData` + `clearCache` +
`clearAuthCache` on the partition — in two places, because neither alone is
enough: a line in words on the chooser card, which is where there is room to
explain it, and the ↤ in the head row, which is always there (a window with
all eight tabs on a site cannot open the card at all). It asks before it
acts, the safe answer has the focus, and what it takes is what came FROM the
sites — their pages and **the names they gave them, which are the previous
person's conversation titles sitting in a settings file** — while the name
the user typed on a tab stays theirs. Every guest is remounted afterwards, or
a page already loaded goes on showing a conversation whose cookie has just
been thrown away.

## What comes back from the site, and what is done with it

The page's title becomes the tab's name; the page's address is remembered so
the tab reopens on the same conversation. Both are the site's words:

- `toPageTitle` collapses whitespace and cuts at 60 characters; the strip
  shows 26.
- `toKeptUrl` keeps an address only when it is https AND on one of the
  site's own `hosts` (a subdomain counts, a lookalike does not — `claude.ai`
  yes, `claude.ai.evil.com` no) AND under 2 000 characters. A sign-in host
  is never remembered, so a tab cannot reopen onto an expired redirect.
- `toValidSession` LISTS the fields it reads off `aichat-sessions`, never
  spreads, so a hand-edited file cannot put an arbitrary address into a
  guest; an unknown site drops its address AND its page title.
- Nothing from the guest is ever rendered as HTML in the host: the title is
  text in a button.

## What a bot check sees — measured 2026-09-11

Reported with a picture: claude.ai's Cloudflare *Verify you are human* box,
never passing. Measured on `browserscan.net`'s bot-detection page, loaded in a
guest (a temporary row in the site list, removed after):

| Guest as | Verdict | Red squares |
| --- | --- | --- |
| first cut: user agent rewritten to plain Chrome, app as launched | **Robot** | Webdriver |
| + `--disable-blink-features=AutomationControlled` | **Normal** | none — and claude.ai's box STILL looped (tick → *Verifying…* → fresh Ray ID → the box) |
| + Electron's own user agent | **Normal** | none — claude.ai opened straight to its sign-in page, `accounts.google.com` to its ordinary email prompt |

Two lessons that hold beyond Cloudflare. `navigator.webdriver` was `true`
in every renderer of the app as launched — nothing here reads it, the
remote-debugging door is unchanged, it is simply no longer announced. And a
browser that lies about itself is caught: a user agent claiming Google Chrome
from a fingerprint that says Chromium is exactly the inconsistency a bot
check scores on, so the guest tells the truth. The original reason for the
rewrite — Google refusing sign-in from a browser that names Electron — was
not observed at Google's sign-in page; if it is ever observed further into a
flow, the fix is the `User-Agent` HEADER on Google's sign-in hosts
(`webRequest.onBeforeSendHeaders`), not the page-visible string.

## What the guest is allowed, on purpose

A person is driving, and a wall that stops the person is not security:

- cookies, storage and a sign-in on its own persistent session;
- a download the user asked for, through Electron's own Save dialog;
- a link in the user's own browser;
- writing the clipboard when the user presses the site's Copy;
- the ↗ **Open in your browser** button for anything the box cannot do —
  a sign-in that insists on a popup, a site that wants a device.

## Still open — tracked, not fixed

See [backlog.md](./backlog.md). The ones worth knowing about:

- `AC-02` — a download lands wherever Electron's dialog puts it; no
  `will-download` policy of its own.
- `AC-10` — a public NAME that resolves to a local address is not caught by
  the fifth wall, only by the origin checks on this app's own two doors.
- `AC-03` — Google sign-in inside the guest is unmeasured past its first
  page.
- `AC-04` — the production CSP of the host page is proven only by reading
  it; the prod markers are stripped in dev.
- `AC-16` — WebRTC and WebTransport do not pass the request wall, and are
  unmeasured from the guest.

## Re-proving it

```bash
node .claude/skills/owa-enhance-aichat/scripts/probe-aichat.mjs
```

With the dev app running and the AI Chat window open on at least one site.
It reaches each guest over raw CDP (`/json/list` lists `webview` targets;
`evaluateInTarget` from `tools/owa-devtools-mcp/cdp.mjs` speaks to one),
reads the properties above, tries the refusals it expects to be refused
(`file:` navigation, `window.open` of a `file:` address, ten addresses on
this machine and its network including both of the app's own doors,
WebSockets to loopback servers it starts itself — judged by what ARRIVED,
because a page's `closed 1006` cannot tell a refusal from nothing listening —
and a `window.open` of example.com with nothing pressed, which must be handed
nothing and said on the window's line) and reports. The attempts are the
point of the run: one that succeeds is the failure this script exists to
catch, and a browser window opening on example.com is the press gate failing.
Two checks are the opposite — the site's own origin must STILL be reachable,
and a public `wss://` echo must STILL open — because a wall that blocks the
site is a brick and would otherwise pass every other check in the file.
Note that a CDP `Runtime.enable` on a guest is itself something a bot check
can detect for the life of that session — run the probe, then reload the
tab before judging a site's box.
