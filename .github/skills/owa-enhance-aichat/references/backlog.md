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

### `AC-11` — `ws:`/`wss:` from the guest is Chromium's business, not ours · open

`onBeforeRequest` is registered on `*://*/*`, which is http and https;
Chromium's match patterns put WebSocket schemes outside it. The only
WebSocket server on this loopback is the CDP endpoint, which refuses a
foreign origin (measured). Widening the filter is a one-line change and was
NOT made because an invalid pattern in the array would take the whole wall
down with it and Electron allows one listener per session — so it needs
proving on this Electron version first, against a real `ws://` request.

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
