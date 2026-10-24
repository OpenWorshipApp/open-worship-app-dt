---
name: llm-registry
description: "The shared LLM registry — https://www.openworship.app/llm/info.json names servers every copy of the app offers beside the saved custom servers; read by MAIN at launch and on the chatbot's ↻, keys and addresses never in a window (a stand-in address on shared-server.invalid), the relay accepts a `registry-<id>` server, and the publish is one script an admin runs"
metadata:
  node_type: memory
  type: project
  originSessionId: 16780dd5-d3fa-4663-8b19-127ebf319066
  modified: 2026-10-15T23:25:23.691Z
---

Added 2026-10-10 at the user's ask: _"currently we have
https://www.openworship.app/download/info.json for downloading, I want
https://www.openworship.app/llm/info.json … list of llm name & url & key &
models-list … app should read it at launch and have reload button in chatbot
page. it should list in available assistants … as an admin I want to store
any available llm endpoints so owa app should be able to use it freshly
real-time … I can do tunnelling my super-computer to cloudflare then store
the llm endpoint online then all users can use my super-computer llm
real-time."_

- **Shape**: `docs/llm-registry/README.md` (the table), `info.schema.json`
  (JSON Schema), `info.example.json`. `version: 1`, `servers[]` of `{id,
name, baseUrl, apiKey?, isFree?, note?, models[{model, name?,
canSeeImages?, note?}]}`, up to 20; `toValidLlmRegistry` in
  `electron/customLlmProtocol.ts` is the one reader, ids prefixed
  `registry-` so no saved uuid can collide, row ids made from the model
  name (`m<index>-<slug>`) so a tab keeps its model across reloads.
- **Main holds it** (`electron/llmRegistryHelpers.ts`): read once after
  `initAi` (never on a timer — a church's internet is metered; it changes
  when an admin changes it), 8 s timeout, 256 KB cap, `http(s)` only; a
  failed read keeps the last good list and records `error`; two Reloads
  share one read. `OWA_LLM_REGISTRY_URL` overrides the address for a dev
  app against a stand-in.
- **A window sees no key, and since 2026-10-12 no address** (the user's ask,
  with the Base URL circled in Settings: _for shared servers, hide endpoint
  and api key. to avoid easily copy and use_): `LLM_REGISTRY_GET_CHANNEL`
  answers the public servers (`toPublicRegistryServers`),
  `LLM_REGISTRY_RELOAD_CHANNEL` reads afresh; both `onAsync` (a sync ask on
  mount once froze every window). Each public server's `baseUrl` is a
  STAND-IN — `https://shared-server.invalid` (`REGISTRY_HIDDEN_HOST`) plus
  the real PATH, the one part a window reads (only a `/v1` or a bare address
  has a root worth asking) — and a server on the local network is told as
  `isFree`, because `checkIsNoCostCustomServer` can no longer read that off
  the address. `checkIsHiddenServerAddress` is how a sentence knows:
  `describeCustomLlmFailure` says _nothing answered at its address — it is
  shared by openworship.app and may be switched off right now_ and
  `genWrongAddressText` names no address and sends nobody to Settings (a
  shared server's address is not the person's to correct). The relay
  (`customLlmRelayHelpers.ts`) finds a `registry-` id in
  `readRegistryServers()` after the saved list, sends the registry's own
  key as the bearer, and takes the real host out of whatever the server or
  its tunnel wrote back (`hideRegistryServerHost`; only a host with a dot —
  a bare machine name is a word an answer may use). **Do not put the address
  back in a window to make something easier**: a new reader of a shared
  server's address belongs in main, or reads a fact main worked out.
  **What this does NOT hide**: the file on the site is public, so anyone who
  opens its address reads both — the app-side hiding stops copying out of
  the app, nothing more (my reading of _easily_; the user was told).
- **In the chatbot**: `customServerHelpers.loadLlmRegistry` fills a
  module-level copy, `getAllCustomServers` = saved + registry (the chatbot's
  readers), `getCustomServers` stays saved-only (Settings edits those);
  `isFree` prices answers at $0 and the model note reads _shared by
  openworship.app · free_; the ↻ beside the Assistant picker reloads, its
  tooltip (`describeRegistryStatus`) saying how the last read went.
- **`note` is SHOWN to the person choosing** (2026-10-17, the user's ask:
  _add `note` to endpoint and models, and show the note in chatbot, e.g. for
  some model we want to let user know it slow but help us save cost of
  usage_; until then a server's `note` was for people reading the file and
  was stripped). On a server and on a model, a string or `{en, km, …}`
  (`toRegistryNote` → `RegistryNoteType`, a plain string under `''`;
  `pickRegistryNote` takes the window's language, its base, `''`, `en`,
  then any). `toPublicRegistryServers` hands both to windows with the
  server's host taken out (`hideRegistryServerHost`). The chatbot puts the
  server's then the model's in `LlmModelType.notice`: a line under the
  pickers (`RenderModelNoticeComp`, `.chat-model-notice`; on Auto once it
  has picked), the model hover, Auto's waiting line after _Auto picked …_;
  Settings' Shared servers shows them too. The tunnel kit no longer writes
  its own _… through a Cloudflare quick tunnel_ note (it would be shown):
  `--note` and `--model-note <model>=<text>` set them, and a restart keeps
  the notes already on its entry in the site's file (`keepLiveNotes`, the
  old automatic line excepted); `findRegistryProblems` flags a note the app
  would cut or drop.
- **In Settings** (2026-10-10, the user's ask with a picture of the chatbot's
  list beside the Others tab: _in setting should have those llm endpoints
  (read-only) and have refresh icon as well_): **Shared servers**, a group of
  its own under Custom servers (`SettingOthersSharedServersComp`). Each
  registry server folds to _name · Models: N_ with a lock; opened it is its
  models as TEXT — no box, no delete, no key and, since 2026-10-12, no
  address (neither is in a window to show; the Base URL row was there for
  two days). Its ↻ is `loadLlmRegistry(true)`, the line under the
  description the last read's time or its failure. `useLlmRegistry` is the
  window's hook: it asks main for what it holds when the group mounts (no
  network) and bails out on the saved list's change events. A card's fold is
  local state on purpose: registry ids come and go, and a fold remembered
  for each would only pile up in the settings.
- **Publishing**: `node extra-work/local-llm/s3-push-llm-registry.mjs
<info.json> [--dry-run]` validates the way the app does, writes
  `www/llm/info.json` with `max-age=60` and invalidates `/llm/info.json`;
  credentials from `extra-work/.env`. A publish waits for the admin's ASK
  each time, and a session then does it (first done 2026-10-10, on _push to
  s3 using "extra-work/.env", do not read the .env file, just read how
  release push files_): load the credentials the way `release.sh`'s
  `load_env` does — `( set -a; source ./extra-work/.env; set +a; node … )`
  — and never open `.env` to look; its variable names are in
  `.env-example`. This script REPLACES the whole registry; the tunnels and
  `llm-registry.mjs` change one entry of it.
- **The admin kit is `extra-work/local-llm/`** (2026-10-10, the user's asks:
  _store all related to llm, including tunnelling building and proxy_, then
  _the tunnelling should be for all platform, can be launch at computer
  start and run interval … node.js scripts_, _I plan to run linux … but
  make sure it support all platforms_). `llm-tunnel.mjs` — one
  dependency-free file, grown from the script another session wrote on the
  server PC — is a loopback DOOR (bearer key checked before the path, then
  only the chat calls and the read-only root doors; load / unload are 404)
  with `cloudflared tunnel --url` pointed at it; `--host` aims the door at
  an LLM server on another computer of the local network. Every `--check`
  seconds it
  asks its own public address and reopens after three misses (the door
  stamps `x-llm-door`, so a Cloudflare error page is not taken for it),
  writes its files again when the model list changes.
  **Each tunnel owns ONE registry entry, by its `--id`** (the user, after
  stopping a tunnel and seeing the LAN test entry come back: _while stopping
  the tunnelling the script should cleanup, no need to use_ the local
  address; then _if I run multiple tunnelling it will add more, when stop it
  will remove the share server … one running will create one and add and
  remove its generated_). With `--publish` it reads the registry the BUCKET
  holds that moment (`readPublishedRegistry` — not the CDN's minute-old
  copy), puts its entry where its old one was, leaves every other server
  alone and writes it back; stopping takes out its own entry and nothing
  else; with none running the registry is empty. There is no hand-kept base
  any more (`llm-info.json` is an empty file to publish by hand). The id
  defaults to `llm-<port>`, and the lock, cloudflared pid, log and output
  files carry it, so several tunnels run from one folder. A failed publish
  is retried and a lost entry put back every five minutes.
  `llm-registry.mjs` is the admin's view (the user: _the script should allow
  me to list current share server (just read the info.json)_ and _check is
  there any unreachable endpoint and let me chose to remove or not_):
  `list` reads the public file and never prints a key; `check` asks each
  server's `/models` with its key and, for one that does not answer, asks
  _[y/N]_ before taking it out (`--remove-unreachable` asks nothing; no
  terminal, nothing is taken out); `remove <id>`.
  `llm-tunnel-startup.mjs install -- <options>` registers ONE service per
  tunnel id: a systemd USER service + linger on Linux (cron lines with no
  systemd), a launchd agent on macOS, a logon task repeating every 5
  minutes on Windows — where ending the task leaves node running, so
  `uninstall` ends it by pid and its entry stays until `remove`. The
  folder's README has the rest; its tests run in `npm test`.
- **An entry can take REPORTS instead of questions** (2026-10-13, the user's
  asks: _a shared server can be type accepting report e.g.
  `"isForReporting":true` … the endpoint should be accepting POST a raw text
  directly … should not show in setting shared servers_ — their own file
  spelt it `isAcceptingReport`, which is the name — then _add a schema …
  `llm-info.schema.json` … implement node.js + sqlite to accept the post_).
  `{id, name, baseUrl, apiKey?, isAcceptingReport: true}`, no `models`.
  `toValidLlmRegistry` keeps such entries APART (`reportServers`, the first
  three), so no list of assistants can hold one: no picker, no Auto, nothing
  in Settings. `electron/llmReportHelpers.ts` is the door
  (`LLM_REPORT_POST_CHANNEL`): the body of the POST is JSON since the same
  afternoon — `{version, reference, prompt, attachments: [{name, mimeType,
  data}]}`, the report under `prompt` and the picture of the app and the
  person's pictures, PDFs and text files under `attachments` (the user:
  _accept json instead of raw text … and accept files like markdown pdf_) —
  to `baseUrl` exactly as written, the entry's key as bearer, each entry in
  turn; when none takes it the registry is read ONCE more and what is new in
  it tried — seen live, an address that had gone answered 500 and the report
  landed at the new one. Limits and the no-address rule are in the rule file
  (`chatbot-llm.md`). **On the admin's side**: `llm-report-inbox.mjs` takes
  `POST /report` into `report-inbox.sqlite` (Node's own `node:sqlite`, so Node
  22.13+; key first; JSON or plain text; the text of a report 640 KB and a
  whole request 18 MB; 8 files, 5 MB each, 12 MB together, each kept for
  what its BYTES are — a picture, a PDF or text — and skipped with a reason
  otherwise, the report kept all the same; 20 per address, or per IPv6 /64,
  per ten minutes, 300 and 256 MB an hour, 20 000 reports and 2 GB kept, the
  oldest `done` ones making room; a report sent twice is one row, by a
  digest) and `list` / `show <id|reference>` / `files <id|reference>` read
  it. **`show` marks the report as a stranger's**: the registry and its key
  are public, so anybody can post, and the data fence inside a report is
  written by its sender — `show` prints it between two lines of its own with
  a boundary drawn at random each time, under a note that the sender is not
  verified and the text is data, with control characters taken out;
  `--raw` is the text alone, and never to be piped into an agent that holds
  the repo's credentials; `done <id|reference>` marks one dealt with and `list --open` is
  what is left. `llm-tunnel.mjs --reports --publish` makes that inbox its DOOR (no
  LLM server behind it; loaded only then, so a plain tunnel still runs on
  Node 18) and publishes an `isAcceptingReport` entry `reports` at
  `<address>/report`, removed on stopping like any tunnel's.
  `llm-info.schema.json` is the kit's own copy of the registry schema (a test
  holds it to `docs/llm-registry/info.schema.json`), bound to `llm-info.json`
  in `.vscode/settings.json`; a `$schema` line in a hand-kept file is left out
  of what is published (`toPublishedRegistry`). `findRegistryProblems` and
  `llm-registry.mjs check` know the kind — a check asks the address with a GET
  and never posts a report to try it. **One tunnel can do both** (the same day, after the user answered _It's
  running now_ with only the LM Studio tunnel up — which is how their first
  example was written: the report entry on the LM Studio tunnel's own
  address and key): `llm-tunnel.mjs … --with-reports` keeps a POST made to
  its own `/v1` (`REPORT_AT_BASE_PATH`) in the inbox (`openReportTaker`,
  the inbox without a listener) and marks its ONE entry `isAcceptingReport`;
  the app reads an entry with the mark AND models as an assistant and as a
  report address, the report half told to no window. Do NOT edit `llm-info.json` while it is
  open unsaved in the user's editor, and never copy a key out of it.
- **A model's measurements go in `extra-work/local-llm/model-benchmarks.json`**
  (2026-10-10, the user's ask: _should store all tested model benchmarking
  somewhere for later use, especially for telling user what be good and fit
  for them_). Whenever a session measures a model answering for the chatbot
  — seconds, rounds, tokens, prompt-reading speed, a right or wrong answer —
  it adds a RUN there the same day (program, machine, context, what was
  asked, the numbers, the outcome, and `source`: where it is written down),
  with `null` for what was not measured, and updates the model's `fit`
  (`good` / `usable` / `limited` / `poor` / `unrated`) and `fitNote`, the
  sentence to tell somebody choosing. `machines[]` are described, never
  named by their address. `model-benchmarks.mjs [--vram N] [--json]` checks
  the shape and prints it best fit first; a speed is never worked out from
  a whole answer's seconds, which hold the reading of the prompt too. First
  filled from the notes: 22 models (local, free, hosted).

**Why:** a volunteer's machine cannot run a 9B model, the church's can, and
typing an address into every copy of the app is the step nobody does; one
file on the project's own site, read fresh, is the step that happens once.

**How to apply:** everything in the file is public — a key in it must reach
only that server, and the kit's door is what keeps a published key to chat
calls. A `*.trycloudflare.com` quick-tunnel address changes per start, so
`--publish` or a named tunnel is what keeps the registry true. Before a
first publish the address answers the site's own HTML page with a 200
(CloudFront's fallback for a missing object), so the ↻ reading _the
registry file is not in the known shape_ can mean "nothing is published",
not a broken file.

Testing the REPORT path (2026-10-13): whether a tunnel is up, and which
one, is read off the machine and the site, never off an answer — twice that
day the answer to _is it running / restarted?_ was yes while the process
list (`Get-CimInstance Win32_Process` for `llm-tunnel.mjs`) showed the
tunnel started the day before with its old options and `llm-registry.mjs
list` showed no entry that takes reports. And a test report is written by
a PRETEND assistant on loopback (a few lines of `node:http` answering
`/v1/models` and `/v1/chat/completions`), picked by name in the help
window: the user declined a run that had their shared LM Studio model
investigate (why was not said; mine is the reading that a test should not
spend their server). A scratch dev instance on `OWA_LLM_REGISTRY_URL` with
that pretend assistant behind the real tunnel script (`--with-reports
--no-key`, pretend cloudflared) proves the whole path with nothing leaving
the machine. **The real thing was then run by the session, once the user
said yes to exactly that** (asked: _start a SEPARATE inbox-only tunnel
myself … test, then stop it_): `llm-tunnel.mjs --reports --publish --id
reports` in the background was NOT refused that day (the note below, from
2026-10-10, says a tunnel was; do not assume either), it published in 16 s,
`llm-registry.mjs check` reached it (405 to a GET), and one TEST report from
a scratch dev instance on the REAL registry — the pretend assistant added
as a custom server in the scratch `setting.json` (`ai-custom-servers`) and
picked by name — landed in the inbox, the door logging it from a public
address. Stopping it on Windows: a background node cannot be asked to
close, so it does not take its entry out — end it by pid, see that its
cloudflared went with it (only the user's own is left), then
`llm-registry.mjs remove reports --yes`, and delete its two pid files.
Never the user's own tunnel: a second start under ITS id is refused by the
lock anyway, and ending it would take the shared assistant down.
**`--with-reports` then ran on a real tunnel too** (the same evening, asked
for and answered _Yes, test then stop_; NOT published, its own id, a pretend
LLM behind it, a scratch `--db`): through the public address a JSON report
with a picture, a PDF and a markdown file was kept and came back out byte
for byte, a 4 MB body took 2 s, a chat call still reached the LLM behind,
and a POST without the key was a 401. The key was read by the test script
from `tunnel-key.txt` and never printed; the connection file and the
tunnel's stdout both carry it, so read one line of them, never the whole.
**Reporting was switched ON that evening** (2026-10-13, asked once more
when everything else was done and answered _Turn it on now_ — not _start
with the computer_): `node extra-work/local-llm/llm-tunnel.mjs --reports
--publish --out extra-work/local-llm/run --log
extra-work/local-llm/tunnel-reports.log`, started with `Start-Process …
-WindowStyle Minimized` so it has a console window of its own that the user
can see and close with Ctrl+C (which takes its entry out of the registry),
and outlives the session. Reports land in the kit's `report-inbox.sqlite`.
It died within hours (the laptop slept, 2026-10-14) and every Send failed
for a day and a half, so on 2026-10-15 the user said yes to the startup
task: _Open Worship LLM Tunnel (reports)_, installed with FULL `--out` /
`--log` paths (the task runs in the kit folder). The installer had a hole:
its only trigger was a logon trigger, whose 5-minute repeat starts at the
NEXT logon -- installed mid-session it ran once and never again (_Next Run
Time: N/A_; the inbox, stopped on purpose, stayed down). It now adds a
time trigger from the install moment as well (`genTaskXml`, `toTaskTime`).
Proven after: the inbox killed at 12:33, back by the task and republished
at 12:40. The same afternoon the inbox learned to SAY a new report on the
desktop (`genNewReportNotifier` / `notifyDesktop` in
`llm-report-inbox.mjs`: Windows PowerShell toast with the words in
environment variables, one notice a minute, `--no-notify` to turn off),
because under the task it has no window and reports sat unseen; and the app
learned to KEEP a report whose server was away and send it later
(memory [[chatbot-report-button]]), so restarting the inbox loses nothing.
The super-computer's assistant was brought back the same day by the session
on that machine (its own tunnel, `google/gemma-4-e4b` at 32k, no startup
task by the user's choice). Its entry listed all nine models downloaded,
a 12B first, with only the 4B loaded — a pick of another made LM Studio's
JIT load it at its default context — so `readModels` in `llm-tunnel.mjs`
now lists only LM Studio's LOADED chat models (`loaded_instances`) when any
is, the whole list when none is (the user's choice of fix, 2026-10-15). It
reaches that machine's entry the next time its tunnel is started there. All
rows of that inbox are done: TESTs from scratch dev instances, and row 2,
the user's own first report (a test throw; it showed the console bug and
made-up STEPS, both fixed). Rows 5 and 6 were the user's own reports sent
through the live inbox the same evening (a free model's bold frame went
unparsed in 5 and was fixed; 6 came through with title, sections, the
Try-this step, console and picture), and on 6 the user said reporting works
the way they want — all six rows done.

Testing the kit: a session CANNOT open a real tunnel. The permission
classifier refuses it as `External Ingress Tunnel` — a SendMessage asking
another session to start one, and `llm-tunnel.mjs` run from this session even
after the user said _do not wait for me, let proceed it by your self_ — and
the other session will not send its door's key across sessions either. So
the real tunnel is the user's own press, in their own terminal (a long-running
command typed with `!` holds the session), and the session takes over from
the ↻. For everything else a PRETEND cloudflared is enough (a script
that prints the address and the _Registered tunnel connection_ line on
Linux, `ping.exe` on Windows, which exits and exercises the start-again).
Linux is tried in WSL, where `/tmp` and every process are gone between two
`wsl.exe` calls and a `$VAR` in a `wsl.exe -- bash -lc '…'` one-liner is
expanded before bash sees it: one script file per run, `MSYS_NO_PATHCONV=1`
from Git Bash. Related: [[custom-llm-servers]], [[cloudflare-quick-tunnel]].
