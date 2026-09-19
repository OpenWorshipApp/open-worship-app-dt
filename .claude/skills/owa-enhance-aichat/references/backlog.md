# AI Chat backlog — tracked `AC-xx` items

Stable ids so a later run starts ahead of this one. **File what you find even
when you do not do it.** Every item carries its evidence.

Status: `open` · `doing` · `done` · `wontfix` (with a reason).

---

## Security

### `AC-00` — the guest could send blind requests to this machine · done (2026-09-12)

The wall the other four never covered. Measured from inside a live guest
BEFORE it existed: a cross-origin READ of the app's CDP and MCP doors was
refused by CORS, and a CDP WebSocket by Chromium's own origin rule — but a
`no-cors` `fetch` at BOTH doors went out and was served. A blind request
needs no permission and reads no answer, which is all a state-changing call
needs, and the same request reaches the church's router, NAS and printers.

Fixed by `guardGuestSessionRequests` in `electron/aiChatGuestHelpers.ts`:
`onBeforeRequest` on the guest session cancels any host that is not on the
public internet, judged by `checkIsLocalHostname` — added to
`tools/owa-devtools-mcp/webUrlPolicy.mjs` and now the one implementation
`checkWebUrl` uses too, so there is no second dialect. Measured after: both
doors, `127.1`, `2130706433`, `0x7f.1`, `127.0.0.2`, `[::1]`, `192.168.1.1`,
`169.254.169.254` and `printer` all refused, and the site's own origin still
200. Probe checks 22 → 33. Full account in threat-model.md §5.

### `AC-01` — the partition is a credential store on disk · done (2026-09-12)

`persist:aichat` holds the user's signed-in sessions with every site they
have opened, under `<userData>/Partitions/aichat/`, with the OS user's file
protection and nothing more — the same protection every browser profile on
the machine has, and less than the chatbot's API keys get (`safeStorage`).
Encrypting a Chromium partition is not a thing the app can do from outside
it, so what was available was the visible half, and it is done:
**Sign out of every site** (`clearAiChatGuestData`) in two places — a line in
words on the chooser card, and the ↤ in the head row, because a window with
all eight tabs on a site cannot open the card. It asks first, the safe answer
has the focus, and it clears the tabs' remembered pages AND the site-given
titles (the previous person's conversation names, in a settings file) while
leaving a name the user typed. W-44 step 7 says to use it on a shared
machine. What is still true: the profile on disk is unencrypted while a
sign-in is live, and nothing here changes that.

### `AC-02` — downloads have no policy of their own · open

A chat site can hand over a file the user asked for, and one the user did
not. Today the guest session uses Electron's default: a Save dialog, wherever
the user points it. A `will-download` handler could confine downloads to the
Downloads folder, refuse executables by extension, or ask first with the
site named. Measure how often a site downloads unasked before building it —
none of the ten was seen to.

### `AC-03` — Google sign-in inside the guest is unmeasured past its first page · open

With Electron's own user agent `accounts.google.com` shows its ordinary email
prompt (measured 2026-09-11); whether the flow completes, or Google's *This
browser or app may not be secure* appears after the password, needs a real
account and is by hand. If it refuses: rewrite the `User-Agent` HEADER for
`accounts.google.com` only in `webRequest.onBeforeSendHeaders`, leave
`navigator.userAgent` alone (the page-visible lie is what looped Cloudflare —
threat-model.md, *What a bot check sees*).

### `AC-04` — the host page's production CSP is proven by reading only · open

`html/aichat.html` carries `frame-src https:; child-src https:;
connect-src 'self' data: blob:` inside the prod-only markers `vite.config.ts`
strips in dev, so no dev run has ever had it active. `npm run pack:win` and
the packaged app (`/owa-robot-test prod`, with `ai-enabled` irrelevant here —
the window is not gated) is the only way to see the guest element created
under it.

### `AC-05` — `Open in your browser` is unpressed by any run · open

It is a `window.open(url)` from the locked-down host, which
`handlePopupWindowOpen` sends to `shell.openExternal` for http(s) — the same
path the chatbot's links use. Pressing it opens the operator's browser, so
no automated run has; a person pressing it once closes this.

### `AC-06` — a bot check can see the probe · wontfix

`probe-aichat.mjs` runs `Runtime.enable` on a guest, which Cloudflare's
CDP detection can notice for the life of that renderer. Not fixable and not
wanted: the probe is a developer tool, and the note in threat-model.md says
to reload the tab before judging a site's box.

### `AC-10` — a public NAME that resolves to a local address is not caught · open

The fifth wall judges a hostname on its SHAPE, because it has only the URL:
`localtest.me` is a real public domain whose A record is `127.0.0.1`, and it
would pass. Catching it needs a DNS lookup per request — expensive, and a
TOCTOU race against rebinding anyway, which is why `webUrlPolicy.mjs`'s own
two-layer version says the same about itself. It does not reach THIS app's
doors: both refuse a foreign `Origin`, measured in threat-model.md §5. The
residue is a local service with no origin check of its own. Weigh a DNS pass
only if one is ever found; the honest note is the fix for now.

### `AC-11` — a WebSocket from the guest walked around the wall · done (2026-09-14)

`onBeforeRequest` was registered on `*://*/*`, and `*://` is http and https
ONLY — so the fifth wall never saw a WebSocket handshake. Measured from inside
a live claude.ai guest, with throwaway servers bound on loopback: `ws://` to
127.0.0.1, localhost, 127.1, `[::1]` and 127.0.0.2 all OPENED, and every
server received the handshake with `Origin: https://claude.ai`, while plain
http to the same server was refused. "The only WebSocket server on this
loopback is the CDP endpoint" was never true of a church machine: OBS,
Companion and presentation remotes listen there, many with no origin check.

Proven on this Electron (43.3.0) before touching the app, in a standalone
harness, one process per variant: `*://*/*` saw the xhr and not the
WebSocket, which opened; `['*://*/*', 'ws://*/*', 'wss://*/*']` and an
explicit http/https/ws/wss list both registered without error, saw
`webSocket ws://…`, closed it 1006 on a cancel with nothing reaching the
server, and still loaded `about:blank`, `data:` and https://example.com;
`<all_urls>` caught the WebSocket too, but also handed the listener the
`data:` page load, whose empty host `checkIsLocalHostname` calls local — it
would have cancelled every `data:` and `blob:` load a site makes.

Fixed with `GUEST_REQUEST_URL_PATTERNS` in `electron/aiChatGuestHelpers.ts`.
After, from the same guest: all five closed 1006 with nothing received, the
http control still refused, and two public `wss://` echoes still opened
(335 ms and 445 ms). The probe now starts its own loopback servers and reads
what ARRIVED — a page's `closed 1006` cannot tell a refusal from nothing
listening — and carries a public echo as the positive control. Probe 35 → 43
checks with one site.

### `AC-13` — a site's microphone was refused with no way to ask · done (2026-09-14)

Reported with a picture: claude.ai's dictation button under *Microphone
access is blocked — select the site settings icon in your browser's address
bar and allow the microphone*. The box refused every `media` request without
a prompt, and the site's own way out points at an address bar a guest does
not have, so the person had nothing to press. Decided with the user: ASK,
per site, never grant.

`toMicrophoneOrigin` lets through only an audio-only request from the site's
own https top page; `askAiChatMicrophone` hands it to the AI Chat window,
where `decideMicrophoneAsk` refuses it silently unless the guest is the tab
in front on its own site, and otherwise the window's amber line asks with
**Don't allow** focused. A yes is per origin, in memory, until the app closes
or Sign out (`forgetAiChatMicrophoneGrants`); only the window asked may
answer; two minutes unanswered, a tab switch or the guest going away is a no.
The check handler answers yes for that page, because Electron's check has no
"ask me" state and a site that reads denied never asks. The camera, alone or
beside the microphone, stays refused — the probe carries both as checks.

Verified live 2026-09-14 on claude.ai in the dev window, over raw CDP into
the guest: Claude's own **Dictate** button raised the line; **Don't allow**,
Escape and a tab switch each gave the page `NotAllowedError` and cleared the
line, and the next ask asked again; **Allow** gave a live audio track, a
second ask got one with no line, and the same page behind another tab was
refused on that same yes. Probe 91/91 over three sites. Measured cost of
the check answering yes: the page's `enumerateDevices` now names the
microphones and speakers (the camera stays unnamed). Not run live: **Sign
out of every site** taking the yes back, which would have signed the dev
window out of three sites; the unit tests cover
`forgetAiChatMicrophoneGrants`.

### `AC-14` — nothing in the window says a microphone is LIVE · open

A browser draws a recording dot on the tab; a guest has no browser tab, and
Electron exposes no capture event (`media-started-playing` is playback).
Once a site is allowed, the only signs a microphone is open are the site's
own button and Windows' tray icon. A head-row indicator would need the host
to learn about capture from the main process — worth doing if a person asks,
and BEFORE any change that lets a yes outlive the app.

### `AC-15` — a page could open the person's browser with nothing pressed · done (2026-09-14)

Found by measuring, not reported. `allowpopups` is on the guest so a pressed
link reaches `setWindowOpenHandler` instead of dying in silence — and it
switches Electron's popup blocking off entirely. In a standalone harness on
this app's Electron (43.3.0), a `window.open` from a timer reached the handler
from a guest with `allowpopups` (and not from one without); in the app that
handler called `shell.openExternal` for any http(s) address. So a chat site's
script could open the operator's browser whenever it liked, over whatever was
on the projector, with nobody having asked.

Fixed with a press gate (`decideGuestWindowOpen`, `checkIsGuestPressFresh`):
the browser is handed a page only within five seconds of a press the person
made in that guest (Chromium's own activation lifetime), one page per press.
The press is the guest's `input-event` — mouse down or up, key down, tap —
read in the main process, where a page cannot fake one; the harness proved it
arrives before the click's `window.open` reaches the handler, and that a
second no-press open after the press was spent is refused. An address the
guest is refused is never handed over, and nothing is before the address
policy has loaded. A refused page is said on the window's `role="status"`
line (`RenderAiChatPopupNoticeComp`, `app:ai-chat:popup-refused`), for the
tab in front only, at most once per 5 s per guest, gone after 12 s; nothing on
the line opens the page, because the address is the site's word. Verified
live: the probe's no-press `window.open` of example.com was handed nothing and
the line named example.com. Not driven live: a REAL pressed link still opening
the browser, which would open the operator's own browser (the reason given in
`AC-05`) — proven in the harness with a press delivered to the guest.

Left as it is: a key press counts, so a page could spend a keystroke typed
into its own box on one window — the same allowance Chromium gives a page.

### `AC-16` — WebRTC and WebTransport do not pass the request wall · open

`onBeforeRequest` sees http(s) and, since `AC-11`, WebSocket handshakes. A
page's `RTCPeerConnection` can still send STUN over UDP to a candidate address
it names, a local one included, and WebTransport is not among the request
types Electron's filter documents. Neither can speak HTTP or a WebSocket to a
local service, which is what the wall exists for, and chat sites' voice modes
use WebRTC, so `setWebRTCIPHandlingPolicy` would cost a feature. Unmeasured
from the guest: measure what a manual ICE candidate at 127.0.0.1 actually
sends before deciding anything.

## Sites

### `AC-07` — a cold session gets a human check on claude.ai and DeepSeek · open

Seen 2026-09-11 on first visits: Cloudflare's box on claude.ai, AWS's *Let's
confirm you are human* on DeepSeek. Both are the site's own first-visit
checks, ticked once by the person, and the clearance then lives on the
persistent partition. Nothing to fix unless one LOOPS (threat-model.md says
how the loop looks); this item is here so the next run does not mistake a
first visit for a regression.

### `AC-08` — a tab is named after a challenge page · open

While a site is on its bot check the page title is *Just a moment…* or
*Human Verification*, and the tab says so until the real page loads. A page
title matching those could be held back until the site's own title arrives.
Cosmetic; only worth it if a person mentions it.

## Window

### `AC-12` — after a sign-out the tab remembers the logout URL · open

Observed 2026-09-12 while verifying `AC-01`: the sign-out clears `lastUrl`,
the guest remounts on `claude.ai/new`, and the site itself redirects to
`https://claude.ai/login?from=logout&reauth=1&returnTo=%2Fnew%3F` — which is
on its own hosts, so `toKeptUrl` records it and the tab reopens there. Not a
bug: it is a plain login page with a `returnTo`, so signing in lands on a new
chat, and the alternative is special-casing addresses, which is exactly the
fragile thing `toKeptUrl` avoids. Filed so the next run does not read it as
one.


### `AC-09` — the head row's `<select>` cannot be driven by `fill` · open

chrome-devtools' `fill` on the CHAT WITH combobox timed out twice
(2026-09-11) where `click` on the same element opened its native list;
`press_key` of a letter then Enter chose the site. Unknown whether the
element or the tool; a QA run should use the keyboard route until it is.
