---
paths:
  - "tools/owa-devtools-mcp/**"
  - "electron/aiHelpers.ts"
  - "electron/webCaptureHelpers.ts"
  - "electron/webPageHelpers.ts"
  - "electron/client/rendererLockdown.ts"
  - "electron/index.ts"
  - "html/chatbot.html"
  - "html/markdownPreview.html"
  - "src/helper/ai/aiEnableHelpers.ts"
  - "src/helper/ai/aiHelpers.ts"
  - ".mcp.json"
---

# Agent access: doors, firewall, discovery

The doors an agent comes in by, the policy at the door, and the windows that
load pages nobody here wrote. The summary and the index of every rule file is
`.claude/CLAUDE.md` §Agent access.

Everything that makes the app drivable by an agent — the in-app self-help
chatbot first, an outside client second — lives in `electron/aiHelpers.ts` and
the `tools/owa-devtools-mcp` package. Two doors, one discovery file:

- **CDP**: `enableRemoteDebugging()` appends `--remote-debugging-port=0` (any
  free port) BEFORE `ready` and after the single-instance lock. It must stay
  synchronous — Chromium reads the switch when it starts the DevTools handler,
  so an `await`ed free-port lookup loses that race and the app silently gets no
  endpoint. Packaged builds open it too (the chatbot needs it), bound to
  `127.0.0.1`.
- **MCP**: `startMcpHost()` serves `owa-devtools-mcp` over streamable HTTP on
  `OWA_MCP_PORT` (default 39223, next free port if taken). Only `node:http`
  loads at startup; chrome-devtools-mcp and puppeteer are imported on the first
  MCP session. The SAME server is what `./.mcp.json` spawns over stdio for an
  outside agent (as `owa-devtools`), so the chatbot and the agent share one tool
  set — chrome-devtools' plus the `owa_*` ones. **The HTTP door requires a
  per-launch bearer capability** (2026-09-23, `MC-01`): 256 random bits from
  `startOwaMcpHost`, published beside `mcpUrl` in the mode-0600 instance file,
  passed to the chatbot over IPC, and checked before an MCP session is opened.
  It never enters the URL, logs, results or model context; a missing or wrong
  token gets 401. The stdio door is unchanged. **The in-app host is PINNED to
  its own instance** (2026-09-09, `pinCdpPort` in `discovery.mjs`, fed by
  `getCdpPort: () => remoteDebuggingPort` from `startMcpHost`): discovery is
  newest-first, which is right for the stdio bin and wrong for a server living
  inside one app — with the packaged app up and `npm run dev` started after
  it, the packaged app's own chatbot reported (and would have clicked in) the
  dev window. Both resolution paths read the pin — chrome-devtools'
  `browserUrl` getter AND `cdp.mjs`'s `requireLivePort`, which every `owa_*`
  tool uses; fixing only the first left the `owa_*` tools on the dev window.
- **Firewall**: `tools/owa-devtools-mcp/firewall.mjs` sits on the one seam both
  doors share (`transport.onmessage`, wrapped AFTER `watchToolCalls` so it is
  outermost and runs FIRST — a refused call must not also raise a banner saying
  the app did it). Every renderer has `nodeIntegration: true`, so
  `evaluate_script` reached `require('os').userInfo()` and
  `require('fs').readFileSync(setting.json)` from a script with NO credential,
  and that tool was in the list sent to the chatbot's model on every round —
  one sentence of injected text in an attachment was a shell on a church's
  computer. The rule is now **the assistant may point, the human presses**:
  `evaluate_script`/`take_heapsnapshot`/`upload_file` are refused AND dropped
  from `tools/list` (both, because a client can call a tool never listed — the
  filter saves ~668 tokens/round, the refusal is the safety); `navigate_page`
  /`new_page` are allowlisted to pages the app serves (reload/back/forward
  carry no address at all and were refused for it — an agent could not reload
  the window in front of it); `owa_click`/`owa_type`
  refuse a label that cannot be undone (delete, trash, discard, erase, remove,
  uninstall, overwrite, _clear all_, _reset all_, factory, sign/log out — NOT
  bare `reset` or `clear`, which are `Reset Widgets Size` and `Clear Bible`)
  **in every language the app is shown in, read on the CONTROL as well as on
  the words** (2026-09-14, `MC-23`, `destructiveLabel.mjs`): the list was
  English regexes on a call's `find`, and every Khmer destructive label, a
  `Clear All` typed with a no-break space, and a walkthrough step's `do` —
  which reads no words at all, and `press: "F6"` is Clear All — got through.
  The rule is now those patterns plus every translation of a
  destructively-worded `tran()` key, read by the firewall on the words and
  again IN THE PAGE on the element about to be pressed (`PRESS_GUARD_SOURCE`,
  the module's own functions as source text): a title or aria-label that
  cannot be undone, a key whose titled control cannot be (`F6` is _Clear All
  [F6]_), a picker's chosen option, and anything inside the app's confirm /
  alert / input popups, which are the user's to answer. An element's own TEXT
  is read only on a control, so a slide card saying "erase my sin" stays
  pressable, and so does a translation the dictionary shares with an allowed
  control (Khmer _Clear Bible_ is _Delete Bible_), the app's confirm behind it;
  **and so do `click`/`fill`/`fill_form`/`drag`, which carry no label at all**
  — they aim by a uid out of a snapshot, so the interlock was two
  `take_snapshot` lines away from being irrelevant, and the label is now
  recovered from the snapshot that minted the uid on its way back out
  (`genUidLabelMemory`, per session, holding ONLY the destructively-worded
  interactive rows — one entry for the presenter's whole tree — replaced
  per page because chrome-devtools mints fresh uids each snapshot, and fed by
  EVERY result because every acting tool takes `includeSnapshot`). It fails
  open on a uid it never saw, deliberately: a uid the model was not shown is
  one it cannot aim with. Only ACTIONABLE roles count, or a verse reading
  "remove" would make its own text unpressable;
  acting calls are capped at 25 per rolling minute ACROSS sessions because the
  thing protected is one window; **`owa_read_website` inverts the URL rule and
  gets a budget of its own** (10 per 5 minutes — a separate counter, because
  the thing protected there is the one network rather than the one window);
  and provider keys, bearer tokens and JWTs are
  scrubbed out of every result — the chatbot calls its provider FROM THE
  RENDERER with the key in a header, so a network log or a snapshot of Settings
  hands it to the model otherwise. A refusal is an `isError` RESULT written FOR
  the model (what, why, what to do instead), never a JSON-RPC error: a block
  that reads as an instruction becomes correct behaviour, one that reads as a
  failure becomes an apology. Off switch is `OWA_MCP_FIREWALL=off`, an env var
  only — nothing on the wire can reach it. `probe-mcp.mjs` walks the policy
  against the live app; it spawns a FRESH server because the running host
  cached `server.mjs` on its first session.
- **Discovery**: `publishAiEndpoints()` writes
  `<temp>/open-worship-app-cdp/<pid>.json` with `{port, url, mcpUrl, mcpToken, isDev,
userDataPath, startedAt}` — one file per live instance, swept when a pid is
  gone, removed on `will-quit`. Chromium reports its chosen port through
  `<userData>/DevToolsActivePort`, which is polled after `ready`.
  **A port named on purpose is a PIN, not a preference** (2026-09-17,
  `MC-30`): `listCandidatePorts` used to put `pinCdpPort`'s port and
  `OWA_CDP_PORT` at the head of a list that went on to every published
  instance and then the legacy fallbacks, and `resolveCdpPort` takes the first
  that ANSWERS — so a pin that had died fell through in silence, while
  chrome-devtools' own tools (`resolveAppBrowserUrl`, always exclusive) kept
  failing on it. Two halves of one server driving two different apps, and a
  dev app that nodemon had restarted onto a new port left a "pinned" script
  driving whatever was published last — the PACKAGED app, with the user's real
  data, if one is up. A named port is now that port or nothing, and
  `describeDeadPin` writes the refusal: _"Port 9999 was named by OWA_CDP_PORT
  and is not answering. The app published 62807 (dev)."_ The old message said
  "start the app" with the app right there, which is what made it hard to see.
  **Pinning by KIND** (`MC-31`, 2026-10-07): `OWA_CDP_TARGET=dev|prod`
  filters published instances by the exact boolean `isDev`, so a developer's
  server follows restarts without reaching the other kind. Both tool groups
  and the bridge honor it; unknown kinds and legacy fallback ports are never
  candidates. Invalid nonempty values fail explicitly. The host's own port
  and `OWA_CDP_PORT` take priority. This selects a kind, not a data profile;
  several matches still follow newest-first discovery, read afresh each time.
- **Master switch**: Settings → Others → _Enable AI features_ writes
  `ai-enabled` into `clientSetting` in `<userData>/setting.json`.
  `checkIsAiEnabled()` reads that file directly (before `ready`, before the
  setting manager exists); off means neither door opens, the Help menu drops
  the chatbot item, and the renderer's AI providers refuse to hand out a
  client. It only takes effect on the next launch — that is the point.
  The panel SAYS so and hands over the restart: _Restart the app to apply_
  sits under the switch whether or not it was just touched, with a
  **Restart Now** button beside it (amber once it was), and View →
  **Relaunch** is the same thing one row under Reload. Both confirm first —
  every window in the app closes, including one on a projector — and both
  end in `relaunchApp()` (`electron/taskbarHelpers.ts`): `app.relaunch` with
  the data dir named on the argv the way a jump list task names it, minus
  that task’s window reset, then `app.quit()` so `will-quit` still runs.
  A reload cannot do this job (`forceReloadAppWindows` re-reads renderers,
  and this setting was read before a renderer existed), which is why the
  Apply Settings button is not the answer here.
  **Unset means OFF in a packaged build and ON in dev**, and the renderer's
  `getIsAIEnabled()` (`src/helper/ai/aiHelpers.ts`) MUST agree with the
  main-process twin or the Settings toggle, the 🤖 button and the provider
  clients contradict a process that opened no door. Nobody gets a CDP endpoint
  by upgrading: anything reaching it drives a renderer with node integration.
- **The chatbot window is locked down separately.** It is the one renderer
  whose content comes from outside the machine and the one holding the API
  keys. `electron/client/rendererLockdown.ts`, called from the preload AFTER
  `fullProvider` has finished requiring, takes `require`/`module`/`exports`/
  `__dirname`/`__filename` off `chatbot.html` and replaces `process` with a
  frozen decoy holding an empty `env` — a decoy, not a deletion, because every
  SDK in that window probes `process.env` on start-up and would throw instead
  of shrugging, and the empty `env` also closes reading the launch
  environment's secrets plus `binding`/`dlopen`/`mainModule`. A global that
  will not delete is redefined as a thrower; one that survives that is reported
  as NOT revoked, because a lockdown that quietly did nothing is worse than
  none. `html/chatbot.html` also carries its own CSP, tighter than the app-wide
  one: `connect-src` names the assistants it may speak to plus the loopback MCP
  host and nothing else, so an answer that tried to post the user's key
  somewhere has nowhere to send it. None of that is the FIRST line — the first
  line is that answers render as TEXT, there is no `dangerouslySetInnerHTML`
  anywhere in `src/chatbot/` and there must never be one. The same list holds
  `aichat.html` and `markdownPreview.html` (2026-09-17, a markdown file from
  any folder, its HTML parsed and then DOMPurify-sanitized — memory
  `markdown-preview-window`). **Nothing a preload reaches may evaluate a
  string at load** (2026-09-18, `MC-32`): every preload requires
  `electronHelpers`, which reaches `aiHelpers` through `webCaptureHelpers`,
  and that tighter CSP has no 'unsafe-eval' — nor does EVERY page's in a
  packaged build. `importEsm` built its `Function` at load, the preload threw,
  and the chatbot opened on _Standing by_ with no provider; it is built on the
  first call now, which only the main process makes (memory
  `preload-must-not-eval-at-load`).
- **Reaching OUT is `owa_read_website`** (2026-09-02), the only tool here that
  opens a socket to somewhere a MODEL chose rather than driving a window the
  operator is already looking at. It answers with a page's text, optionally its
  links and a picture of it, for questions about the world outside the app — a
  link the user pasted, what a Bible translation is. It is NOT a second source
  for how the app works; the system prompt says so, because a page about some
  other worship program handed over as though it were this one is worse than
  "I don't know". The address policy is `tools/owa-devtools-mcp/webUrlPolicy.mjs`,
  enforced at TWO layers that are not the same check twice: the firewall
  refuses synchronously what it can see (scheme, address literals, local names,
  a 600-character cap), and `electron/webPageHelpers.ts` re-checks WITH DNS
  immediately before it connects, which is the authoritative one. Both are
  needed — `localtest.me` is a real public domain whose A record is
  `127.0.0.1`, and loopback is where this app serves its own CDP and MCP doors
  (the MCP door is authenticated, but a model must not reach either). Node's
  `new URL()` canonicalises `0177.0.0.1`,
  `2130706433`, `0x7f.1` and `127.1` to `127.0.0.1` before the policy reads
  them, so the checks read the canonical hostname and must never be "improved"
  to match the raw string. The page loads in a window locked down separately
  from every other renderer in this app — no Node, no preload, sandboxed, its
  own memory-only session, popups denied (`window.open` here would reach
  `handlePopupWindowOpen` and its `nodeIntegration: true`), downloads denied,
  permissions denied, audio muted, every redirect re-checked — deliberately NOT
  `captureWebScreenShot`, which keeps `webSecurity: false` for website canvas
  items and is a different trust level: that address was typed by the USER.
  The two keep separate settings and share one address dialect.
- **A SLIDE's website is loaded in a box too** (2026-09-17, `MC-16`,
  `electron/webCaptureHelpers.ts`). `captureWebScreenShot` — the hidden window
  behind a website canvas item and a web background — opened on the app's
  DEFAULT session with `webSecurity: false` and NO handler of any kind, and
  loaded whatever address the document carried, so **opening a shared
  presenting flow was the whole delivery**: no model, no agent. Measured
  against the running app first, by capturing a page served on this machine's
  own LAN address: it reached `127.0.0.1` AND `localhost` — the CDP and MCP
  doors, the same pair the AI Chat guest was walled off from, in the one
  renderer nobody had walled — and `file:///…/package.json` captured 58 622
  characters of the operator's disk. The rule now is **a capture may talk to
  the site it was asked for and to the public internet; never to this machine,
  and never to anything else on the local network**: its own memory-only
  session, permissions / downloads / `window.open` refused, `sandbox: true`,
  a judged first load and every redirect, and `onBeforeRequest`
  over four patterns (`*://*/*`, `ws://*/*`, `wss://*/*`, `file:///*`) and the
  same `webUrlPolicy.mjs` dialect the guest's wall uses. The **same-host
  exemption** is the difference from that guest, and it is what keeps a
  church's own intranet notice board working — a private page may load its own
  assets and nothing else private; loopback gets no exemption at all.
  `webSecurity` stays OFF: it may be load-bearing for a real user's slide,
  nothing measured says whether it is, and the wall closes what it would open.
  Re-measured after: the notice board captures byte for byte the same 7 106
  characters, reaches this machine not at all, `file://` is refused in a
  sentence, and `example.com` / Wikipedia are untouched.
  **The app's OWN pages are `file:` URLs, and that first cut took them down
  with the rest** (2026-09-24). The Webs panel's **New File** writes an
  `.html` into `<data folder>/webs`, its own editor edits it, and the
  Background **Webs** tab, every Foreground **Web Show** widget and a slide's
  website item put that page up as `file:///…/webs/x.html` — so "http(s) only"
  left every one of those tiles on the globe-and-url placeholder with one
  `Only a web address can be captured` per file in the console, while the
  remote URL item beside them kept its picture. What separates them from
  `file:///C:/Users/.../setting.json` is the FOLDER, not the scheme, so the
  rule has a second half: **a local page may be captured only out of a folder
  this app's Webs panel was pointed at, and it may read that folder and
  nothing else of this machine.** The folders are the `select-dir-web-bg*`
  directory settings — one file per key under the data folder, `$DATA_DIR_PATH`
  and either OS family's separator expanded — plus the default
  `<data folder>/webs`; `listWebCaptureDirPaths` in `electronHelpers.ts` reads
  them (5 s cache, only ever for a URL that is not http(s)), and the rule
  itself is `resolveCaptureTarget` in `webCaptureHelpers.ts`: extension
  checked as well as folder (`setting.json` must not become a page by being
  moved), `..` resolved away first, case folded on Windows and macOS and NOT
  on Linux. `file:///*` had to JOIN the wall's patterns or no `file:` request
  was ever judged at all — a SITE now reads no file, and a local page reads
  only its own folder. A shared document fails the same test by naming the
  other church's folders; where the two really are the same item,
  `$DATA_DIR_PATH` has already rewritten it into this user's own webs folder.
  Proven live with a page in that folder fetching both ways: it read its own
  sibling and was blocked one folder up.
  What comes back is FENCED as a document that was read rather than as anything
  talking to the model, which is the second line; the first is that no refusal
  in the firewall cares what a page says. Exfiltration is narrowed, not closed:
  a URL is a channel out, so the address is capped, the reads are rationed, and
  every one raises a banner in the operator's window **naming the site**. Two
  things the page script must keep: `\s` needs DOUBLE backslashes in the
  TypeScript template literal or it reaches the page as `s` (which silently
  turned `replace(/\s+/g, ' ')` into "replace runs of the letter s"), and the
  text is cut IN the page so ~80 KB of a long article never crosses the IPC.

`chrome-devtools-mcp`'s `usageStatistics` is forced off in `server.mjs`: its
telemetry is a process-wide singleton that throws on the second
`createMcpServer` (one per MCP session), and it would phone home from the
operator's machine.
