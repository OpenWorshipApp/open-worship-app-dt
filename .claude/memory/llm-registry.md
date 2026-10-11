---
name: llm-registry
description: "The shared LLM registry — https://www.openworship.app/llm/info.json names servers every copy of the app offers beside the saved custom servers; read by MAIN at launch and on the chatbot's ↻, keys never in a window, the relay accepts a `registry-<id>` server, and the publish is one script an admin runs"
metadata:
  node_type: memory
  type: project
  originSessionId: 16780dd5-d3fa-4663-8b19-127ebf319066
  modified: 2026-10-11T03:19:44.963Z
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
canSeeImages?}]}`, up to 20; `toValidLlmRegistry` in
  `electron/customLlmProtocol.ts` is the one reader, ids prefixed
  `registry-` so no saved uuid can collide, row ids made from the model
  name (`m<index>-<slug>`) so a tab keeps its model across reloads.
- **Main holds it** (`electron/llmRegistryHelpers.ts`): read once after
  `initAi` (never on a timer — a church's internet is metered; it changes
  when an admin changes it), 8 s timeout, 256 KB cap, `http(s)` only; a
  failed read keeps the last good list and records `error`; two Reloads
  share one read. `OWA_LLM_REGISTRY_URL` overrides the address for a dev
  app against a stand-in.
- **A window sees no key**: `LLM_REGISTRY_GET_CHANNEL` answers the public
  servers (`toPublicRegistryServers`), `LLM_REGISTRY_RELOAD_CHANNEL` reads
  afresh; both `onAsync` (a sync ask on mount once froze every window). The
  relay (`customLlmRelayHelpers.ts`) finds a `registry-` id in
  `readRegistryServers()` after the saved list and sends the registry's own
  key as the bearer.
- **In the chatbot**: `customServerHelpers.loadLlmRegistry` fills a
  module-level copy, `getAllCustomServers` = saved + registry (the chatbot's
  readers), `getCustomServers` stays saved-only (Settings edits those);
  `isFree` prices answers at $0 and the model note reads _shared by
  openworship.app · free_; the ↻ beside the Assistant picker reloads, its
  tooltip (`describeRegistryStatus`) saying how the last read went.
- **In Settings** (2026-10-10, the user's ask with a picture of the chatbot's
  list beside the Others tab: _in setting should have those llm endpoints
  (read-only) and have refresh icon as well_): **Shared servers**, a group of
  its own under Custom servers (`SettingOthersSharedServersComp`). Each
  registry server folds to _name · Models: N_ with a lock; opened it is its
  address and its models as TEXT — no box, no delete, no key (none is in a
  window to show). Its ↻ is `loadLlmRegistry(true)`, the line under the
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
