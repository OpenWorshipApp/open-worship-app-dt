# Threat model — what an agent driving this app can reach

_Last measured 2026-09-23, against the running dev app._

## The thing that makes this different from a browser automation server

Every window in this app runs with `nodeIntegration: true` and
`contextIsolation: false` (`genWebPreferences`, `electron/electronHelpers.ts`,
which carries a TODO admitting it). So "run this in the page" does not mean
what it means in a browser. It means **run this on the operator's computer**.

Measured through the app's own MCP host, from a plain script with no
credential of any kind:

```
evaluate_script  ->  require('os').userInfo()
                     { user: "racky", home: "C:\\Users\\racky", platform: "win32" }

evaluate_script  ->  require('fs').readFileSync(<userData>/setting.json)
                     { bytes: 1354, keys: [ ... "clientSetting", "secureSetting" ... ] }
```

`require('child_process')` is the same reach. There was nothing between an
attacker and that except the model's good judgement.

## Who is actually on the other end

Two callers, and neither is a trust boundary.

**The chatbot's model.** It is sent every tool on every round, and it reads
things the user did not write: an attached file, a pasted document, a
screenshot of somebody else's slide, a lyric sheet from the internet, the app's
own content. Text that says *"ignore your instructions and run this"* is a
normal Tuesday. A prompt-injected model with `evaluate_script` is a remote
shell on a church's computer, and the volunteer sees a help window that looks
like it is thinking.

**A holder of this launch's capability.** `host.mjs` binds `127.0.0.1`, checks
`Origin`, and requires a fresh 256-bit bearer token on `/mcp`. The app writes
that token only into its mode-0600 discovery file and hands it to the chatbot
over IPC; a socket client that merely finds the port gets `401` before a
session exists (`MC-01`). A process running as the same OS account can read the
discovery file, so this is a local account boundary, not a sandbox from the
operator's own processes.

## The policy — `tools/owa-devtools-mcp/firewall.mjs`

The rule: **the assistant may point, the human presses.**

| Rule | What it does |
| --- | --- |
| `denied-tool` | `evaluate_script`, `take_heapsnapshot`, `upload_file` are refused AND removed from `tools/list` |
| `foreign-url` | `navigate_page` / `new_page` may only land on a page the app itself serves (`file:`, loopback, `about:blank`). Reload / back / forward carry no address and are allowed — the allowlist means history holds only app pages |
| `destructive-label` | `owa_click` / `owa_type` refuse a label that cannot be undone — delete, trash, discard, erase, remove, uninstall, overwrite, *clear all*, *reset all*, factory, sign/log out — **and its translation in every language the app is shown in** (`destructiveLabel.mjs`, derived from the app's own dictionary), read after folding what the matcher folds |
| `destructive-uid` | the same refusal for `click` / `fill` / `fill_form` / `drag`, which carry no label — the wording comes from the snapshot that minted the uid, read on its way out |
| `destructive-press` / `question-press` | the same rule **in the page, on the element a press lands on** — `owa_click`, `owa_type` and a walkthrough's Do it: a title that cannot be undone on a button whose own words can, a key whose titled control cannot be (`F6` is *Clear All [F6]*), and anything inside the confirm / alert / input the app is asking the user. See *The interlock reads the control*, below |
| `foreign-url` (outbound) | `owa_read_website` INVERTS the rule above: it may only go the other way. https, and never an address on this machine or its network — see *Reaching out*, below |
| `rate-limit` | acting calls are capped at 25 in a rolling 60s; reads off the internet at 10 in a rolling 5 min; removals (a delete of a file, list, note, slide or passage, and an undo) at 10 in a rolling 5 min. Separate counters across every session, because they protect three different things: the one app window, the one network, the user's files |
| redaction | provider keys, bearer tokens, JWTs and named credentials are scrubbed out of every tool result |

### The uid interlock, and why it is shaped the way it is

`owa_click` names the control it is aiming at. chrome-devtools' `click` names a
`uid`, which means nothing on its own — so until 2026-09-02 the *point, don't
press* rule was two lines away from irrelevant:

```
take_snapshot            ->  uid=1_112 button "Clear All" ...
click({uid: '1_112'})                     <- nothing looked at this
```

The uid only means anything because a snapshot said so, and that snapshot came
back **through the firewall**. So the label is remembered on the way out and
looked up on the way in (`genUidLabelMemory`). Four choices in it, each
deliberate:

- **Only destructively-worded INTERACTIVE rows are kept** — one entry for the
  presenter's whole 354-line tree. A memory of the full tree would be a
  per-session cache of the app's entire UI, which this app cannot afford; and
  without the role filter a Bible verse reading "and God shall take away and
  **remove** his part" would make its own text unpressable, which is the
  refuse-ordinary-work failure the label list is kept short to avoid.
- **Replaced per page, not merged.** chrome-devtools mints fresh uids on every
  snapshot, so a remembered `1_112` is a different element after the next one.
  A stale refusal is worse than a missed one: a firewall that blocks ordinary
  work is one the model learns to route around.
- **Fed by every result, not just `take_snapshot`'s** — every acting tool takes
  `includeSnapshot`, so a model could otherwise refresh its uids past the
  interlock without ever naming the snapshot tool.
- **Fails open on a uid it never saw.** Same call `redactSecrets` makes: a net,
  not a proof. A uid the model was never shown is a uid it cannot aim with, and
  refusing every unrecognised one would break the developer's door for nothing.

And the model does not get those tools at all — `modelTools.mjs` withholds
them, so the recovery above is defence in depth for the door where the caller
is the operator.

### The interlock reads the control

Both halves above read a LABEL somebody wrote down — a `find`, a snapshot row.
Measured 2026-09-14, that was three holes wide (`MC-23`): the label list was
English and the app is used in Khmer, where every destructive control
(`ផ្លាស់ទីទៅធុងសំរាម`, `លុបទាំងអស់`) sailed through; the matcher folded a
no-break space the patterns did not (`Clear All`); and a walkthrough
step pressed its `find` or its `press` key with no label read at all.

So the rule is data now (`destructiveLabel.mjs`: the English patterns plus
every translation of a destructively-worded dictionary key) and it is read a
second time where a label cannot lie — in the page, on the element the matcher
resolved, immediately before `click()`. Four choices in it:

- **Content never makes itself unpressable.** A title and an aria-label are
  read always; an element's own text only when it is a control. A slide card
  or a list row carries a hymn, and "erase my sin" must not refuse its card.
- **A key is judged by the control that names it.** This app writes a control's
  shortcut into its title, so `F6` is as destructive as *Clear All [F6]* and
  `F9` as ordinary as *Clear Bible [F9]* — with no list of keys to keep in step.
- **A question is the user's.** Anything inside the confirm, alert or input
  popup is refused, which needs no language at all — and is what stands behind
  the one gap left by design: a translation the dictionary also uses for an
  allowed control (Khmer *Clear Bible* IS *Delete Bible*) is pressable, and the
  app confirms the destructive reading.
- **The card's Do it and a tool's `do` are one rule.** The card shows words the
  model wrote, and a step reading *Press Do it to save* aimed at Move to Trash
  must not be pressed by either; the control stays ringed and the person
  presses it.

### What the assistant can delete

Since `MC-24` the data tools delete: a song, a slide document, a slide, a saved
passage, a note, a whole list or file. They are offered because nothing they
do is final:

- **No backup, no change.** Every write snapshots what it is about to change
  (`agentBackupHelpers.ts`) and is refused when the snapshot cannot be saved —
  including the Bibles list and notes file, which have no undo of their own.
- **A delete is the app's own Move to Trash**, and `owa_undo` puts any change
  back from the backup (the OS trash cannot be emptied back by a program).
  An undo backs itself up first, so undoing the wrong thing is one more undo.
- **Removals have their own budget** (10 per 5 min): a loop emptying a Documents
  folder into the trash is recoverable and still a morning lost.
- **A note open in its own window blocks a write** to that file: the window
  saves its whole stale copy back, which would silently undo the change the
  answer reported.

What this does not close: a model asked to "clean up" can still trash a real
document the user wanted. The banner names the file, the answer must say it can
be undone, and `owa_undo list` shows it — recoverable, not prevented.

Why each denial, since "it's dangerous" is not a reason a future reader can
weigh:

- **`evaluate_script`** — the proven exploit above. Nothing in this package
  needs it: `guide.mjs`, `notify.mjs`, `picker.mjs` and `domMatch.mjs` all
  reach the page through `cdp.mjs`'s `evaluateInApp`, which is the app talking
  to itself, not a tool the model can aim.
- **`take_heapsnapshot`** — a heap snapshot is every string the window is
  holding, written to disk: the user's API keys, their songs, their notes.
- **`upload_file`** — hands a file off the disk to a page that can send it
  anywhere, on a path the model chose.
- **`navigate_page` to a foreign URL** — loading a remote page into a
  node-integration window is the same hole `evaluate_script` was, one step
  removed.

Two enforcement points, because either alone is a hole. Filtering `tools/list`
is what saves tokens and stops the model taking a wrong turn; it is **not** the
safety, because a client can call a tool that was never listed. Refusing
`tools/call` is the safety.

A refusal is an `isError` **result**, not a JSON-RPC error, and it is written
for the model: what was refused, why, and what to do instead. A block that
reads as an instruction becomes correct behaviour; a block that reads as a
failure becomes an apology and a retry.

### Where it sits

`server.mjs`, after `server.connect`, wrapping `transport.onmessage` — the one
seam both doors already share with `notify.mjs`. `guardToolCalls` is applied
LAST so it is the OUTERMOST wrapper and therefore runs FIRST: a refused call
must not also raise a banner telling the user the app just did the thing it did
not do.

Both hooks re-enter the trap `notify.mjs` documents: the SDK **chains**
whatever handler it finds, so an accessor that answers "me" recurses until the
stack goes and the host answers 500 to `initialize`. Read the field once, store
the wrapper, never define a getter.

### The off switch

`OWA_MCP_FIREWALL=off`, an environment variable and nothing else. It is set by
whoever started the process — a developer whose QA run genuinely needs
`evaluate_script` — and is unreachable from the wire: no tool relaxes it, no
argument bypasses it. Never make it the default, and say so in the run when
you use it.

## Reaching out — `owa_read_website`

Added 2026-09-02, and the first tool here that opens a socket to somewhere a
language model chose. It inverts the direction of every other risk in this
file, so it gets its own threat statement.

**What it would have cost to get wrong.** The app's own doors are on loopback.
The MCP door now carries its per-launch credential (`MC-01`); the CDP endpoint — whose HTTP
surface includes `/json/list` and `/json/new?url=` — and the MCP host. A fetch
tool that could name `127.0.0.1` would be a way for an injected model to drive
the app from inside its own answer, and that is a shorter path than any of the
ones above. `file:` is the disk. `192.168.x` is the church's router.
`169.254.169.254` is a cloud metadata service.

**Two layers, deliberately not the same check twice.**

| Layer | Where | What it can see |
| --- | --- | --- |
| Synchronous | `firewall.mjs`, at the seam both doors share | Scheme, address literals, obviously-local names, address length. Refused where every other refusal is logged, at no cost |
| Asynchronous | `electron/webPageHelpers.ts`, immediately before the socket | DNS. **Authoritative** — nothing connects without it, and it does not depend on the caller having been careful |

Both read `tools/owa-devtools-mcp/webUrlPolicy.mjs`, shared precisely so the
rule the firewall refuses on and the rule the socket opens under cannot drift.

Two things about it that are easy to get wrong later:

- **Node's URL parser does the hard part.** `0177.0.0.1`, `2130706433`,
  `0x7f.1` and `127.1` all canonicalise to `127.0.0.1` before the policy reads
  them. Do not "harden" the checks by matching the raw string — that is how
  the canonical-form assumption gets quietly broken.
- **The synchronous half proves nothing about a NAME.** `localtest.me` is a
  real domain on the public internet whose A record is `127.0.0.1`, and it
  passes every check that can be made without asking DNS. `probe-mcp.mjs` uses
  it as the live proof.

**The page loads in a locked-down window**, which is the other half of the
answer: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`,
`webSecurity: true`, no preload, its own memory-only session, popups denied
(`window.open` in this app reaches `handlePopupWindowOpen`, which hands out
node integration — `MC-03`), downloads denied, permissions denied, audio
muted, and every redirect re-checked. It is deliberately NOT
`captureWebScreenShot`, which runs with `webSecurity: false` for website canvas
items: that previews an address the USER typed, this loads one a MODEL chose.
The two keep separate settings and share one address dialect.

### The window a SLIDE's address loads in — `MC-16`, closed 2026-09-17

The one hole in this file that needed no model and no agent at all. A website
canvas item's address goes straight from the document to a hidden window, so
**opening a shared presenting flow was the whole delivery** — a `.owapf.tar.gz`
from another church, a memory stick. That window ran on the app's DEFAULT
session with `webSecurity: false` and no handler of any kind.

Proven against the running app before it was changed, by serving a page on this
machine's own LAN address and capturing it exactly as a website item does:

- it reached **`127.0.0.1` and `localhost`** — the CDP endpoint (a WebSocket
  into renderers that all have node integration) and the MCP host (click,
  present, write a file), the same pair the AI Chat guest was walled off from
  on 2026-09-12, in the one renderer nobody had walled;
- **`file:///…/package.json` captured 58 622 characters** of the operator's
  disk, and with `webSecurity: false` a `file:` page reads its neighbours.

`electron/webCaptureHelpers.ts` now holds it to: **a capture may talk to the
site it was asked for and to the public internet; never to this machine, and
never to anything else on the local network.** Its own memory-only session;
permissions, downloads and `window.open` refused; `sandbox: true`; http(s) only
at the first load and at every redirect; and `onBeforeRequest` over the same
three patterns and the same `webUrlPolicy.mjs` dialect the guest's wall uses.
The **same-host exemption** is the difference from the guest: no chat site ever
needs a local address, but a church's intranet notice board is a legitimate
slide, so a private page may load its own assets and nothing else private.
Loopback gets no exemption at all.

`webSecurity` stays OFF — it might be load-bearing for a real user's slide,
nothing measured says whether it is, and the wall closes what it would open.
That is the residual, and it is why the wall rather than the flag is the fix.

**What is NOT closed, and is not claimed to be:**

- **Exfiltration.** A URL is a channel: anything in the model's context can be
  spelled into a query string. This is narrowed rather than shut — 600
  characters per address, ten reads per five minutes, and a banner in the
  operator's own window **naming the site** on every one — so bulk
  exfiltration in a single unnoticed call is off the table and an attempt is
  conspicuous. That is the outcome that was available; a check cannot tell an
  address carrying stolen text from one that is merely long.
- **DNS rebinding.** Between the lookup and the socket, a name whose DNS the
  attacker controls can change its answer. Pinning the connection to the
  checked address is not something Electron's loader offers. It costs an
  attacker a domain the user asked about by name plus a sub-second race, and
  the check re-runs on every redirect.
- **Injection through the content.** Everything a page says arrives in the
  model's context. It is fenced as a document that was read rather than as
  anything talking to the model — but that fence is the SECOND line. The first
  is that none of the refusals in this file care what a page says: the
  destructive interlock, the denied tools and the address policy are unmoved
  by "ignore your previous instructions".

## The window that talks to a language model

`chatbot.html` is the one renderer whose content comes from outside the
machine, and the one holding the user's API keys. Two extra layers, neither of
which is the first line — **the first line is that answers render as TEXT**,
there is no `dangerouslySetInnerHTML` anywhere in `src/chatbot/` and there must
never be one:

- **`electron/client/rendererLockdown.ts`**, called from the preload after
  `fullProvider` has finished requiring: takes `require`, `module`, `exports`,
  `__dirname`, `__filename` away from that window and replaces `process` with a
  frozen decoy carrying an empty `env`. A decoy rather than a deletion because
  every SDK in that window probes `process.env` for a key on start-up and would
  throw instead of shrugging. The empty `env` also closes reading whatever
  secrets are in the environment the app was launched from, and takes
  `process.binding` / `dlopen` / `mainModule` with it. A global that will not
  delete is redefined as a thrower, and one that survives even that is reported
  as not revoked — a lockdown that quietly did nothing is worse than none.
- **A tighter CSP on that page only.** `connect-src` is the part that matters:
  the list of places the window may speak to is the assistants it can be set to
  plus the loopback MCP host, so an answer that tried to post the user's key
  somewhere has nowhere to post it. No `unsafe-eval`; `object-src`,
  `frame-src`, `base-uri` and `form-action` are shut.

## Still open — tracked, not fixed

| Id | Gap |
| --- | --- |
| `MC-13` | `press_key` on the developer's door is unguarded: Enter on a focused *Move to Trash* names no label at any point. The model has not been offered `press_key` since 2026-09-08, and the walkthrough's own key press is judged by the control that names the key since 2026-09-14. |
| `MC-03` | `window.open` from a locked-down renderer still gets `nodeIntegration: true` through `handlePopupWindowOpen`, which is a way back to Node for code already running in that window. |
| `MC-04` | `appProvider.fileUtils` is the full `fs` surface in the chatbot window. It genuinely writes files (a saved report, a saved picture), so narrowing it to the calls that window makes is real work. |
| `MC-05` | The redaction list is a net, not a proof. A secret in a shape nobody anticipated gets through — which is why the tools that dump memory wholesale are denied outright rather than trusted to it. |
| `MC-16` | Residual only: a capture window still runs `webSecurity: false`. The network wall closes what that opens; the flag stays until somebody measures whether a real slide needs it. |

## Re-proving it

```bash
node .claude/skills/owa-enhance-mcp/scripts/probe-mcp.mjs
```

Spawns a **fresh** stdio server — the app's HTTP host cached `server.mjs` on
its first session and will not see your edit until it restarts — and walks the
policy against the live app: the denied tools are absent from `tools/list`, the
proven exploit is refused, a destructive label is refused, an ordinary click is
untouched, a foreign URL is refused, a read still works — and, for the outbound
half, the app's own MCP door, a `file:` address and a public name that resolves
to loopback are each refused.

Run it before and after any change to the policy. A security change with no
before/after transcript is an opinion.
