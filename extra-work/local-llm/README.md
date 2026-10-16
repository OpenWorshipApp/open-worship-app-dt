# Local LLM kit

Everything an admin needs to share one computer's LLM server (LM Studio,
Ollama, llama.cpp, …) with every copy of Open Worship: a key-checking door, a
Cloudflare quick tunnel in front of it, and the shared registry on the site
that the tunnels write themselves into. What the app does with the registry is
in [`docs/llm-registry/README.md`](../../docs/llm-registry/README.md).

All of it is plain Node.js (18 or newer) with no npm packages, for Linux,
macOS and Windows. Only writing the registry needs this repo's `node_modules`
and `extra-work/.env`; the two tunnel scripts can be copied to a machine that
has neither. The report inbox keeps its reports with Node's own SQLite, so
that one script — and a tunnel started with `--reports` — needs Node 22.13 or
newer.

| File | What it is |
| --- | --- |
| `llm-tunnel.mjs` | The door, cloudflared and the look it takes at itself. With `--publish` it adds its own server to the registry and takes it out again when it stops. With `--reports` its door is the report inbox instead of an LLM server. |
| `llm-tunnel-startup.mjs` | Starts a tunnel with the computer and brings it back when it stops. |
| `llm-report-inbox.mjs` | Takes the problem reports the app's help window sends — a `POST` of JSON, the report and its files — keeps them in a SQLite file, and lists them, shows them and writes their files out. |
| `llm-registry.mjs` | Lists the servers shared right now, asks each whether it answers, and takes one out. |
| `s3-push-llm-registry.mjs` | Checks a registry file the way the app does and publishes it whole to `https://www.openworship.app/llm/info.json`. |
| `llm-info.json` | A registry to publish by hand. Empty: the tunnels add and remove their own entries on the site. |
| `llm-info.schema.json` | The JSON Schema of that file (and of the `llm-info-<id>.json` each tunnel writes): what an editor checks and completes it against. |
| `model-benchmarks.json` | Every measurement taken of a model answering for the chatbot, and what it says about which model fits whom. |
| `model-benchmarks.mjs` | Checks that file's shape and prints it, best fit first. |
| `aws-bedrock-info.md` | What Amazon Bedrock offers the chatbot and at what price: which host serves which model, why Claude Haiku 5.5 is the pick, and what wiring it in takes (read off AWS's cards 2026-10-11). |
| `*.test.mjs` | Their tests, run by `npm test`. |

## Run a tunnel

```bash
# The LLM server must listen on this computer: 1234 LM Studio, 8080 llama.cpp,
# 11434 Ollama.
node extra-work/local-llm/llm-tunnel.mjs --port 1234 --name "Church LM Studio" --publish
```

It prints an `https://<words>.trycloudflare.com/v1` address and writes two
files — on the Desktop when there is one, else in `run/` here, or where
`--out` says — named by the tunnel's id:

- `llm-tunnel-connection-<id>.txt` — the address, the API key and a `curl` test;
- `llm-info-<id>.json` — the same as a registry file with this one server.

Both hold the key and are removed when the tunnel closes. Without `--publish`
the address goes into the app by hand: Settings → Others → Custom servers,
with the key.

| Option | Meaning |
| --- | --- |
| `--port <n>` | The LLM server's port on this computer (default 1234). |
| `--host <address>` | The computer the LLM server is on, when it is another one of the local network — a GPU box behind the machine that opens the tunnel. |
| `--name` | What the app's lists call the server. |
| `--id` | What tells one tunnel from another: a slug (`[A-Za-z0-9-]`, up to 48). Left out it is `llm-<port>` (`llm-<host>-<port>` with `--host`), so two tunnels to two servers are two entries without anything typed. Keep it the same across starts, or a chat tab left on the server loses it. |
| `--new-key` / `--no-key` | Make a fresh API key / ask for none (the server's own key is then passed through). |
| `--cloudflared <path>` | Which cloudflared to run. Without it: `CLOUDFLARED`, one beside the script, the app's extra-bin pack, this repo's `extra-work/experiment-building/<platform>/`, then `PATH`. |
| `--check <seconds>` | How often it looks at itself (default 60, never under 10; `0` never). |
| `--publish` | Add this server to the shared registry, and take it out again on stopping. |
| `--out <folder>` | Where the two files above are written. |
| `--log <file>` | Also write what it says to this file (started afresh at 1 MB, one older file kept; the key is never written to it). |
| `--with-reports` | This tunnel's LLM server stays as it is, and its door ALSO keeps the problem reports the app posts to its address (see _Taking problem reports_). Its entry is published marked as taking reports. |
| `--reports` | No LLM server: the door is the report inbox (see _Taking problem reports_). `--port` and `--host` are not used; the name is _Report inbox_ and the id `reports` unless given. |
| `--db <file>` | With `--with-reports` or `--reports`: the SQLite file the reports are kept in (`report-inbox.sqlite` here). |

### Several tunnels

Each tunnel is one server in the registry, known by its id. Start as many as
there are LLM servers — from this same folder, each in its own terminal or as
its own service:

```bash
node extra-work/local-llm/llm-tunnel.mjs --port 1234  --name "Church LM Studio" --publish
node extra-work/local-llm/llm-tunnel.mjs --port 11434 --name "Church Ollama"    --publish
```

- **Starting one adds one**: its entry is put into the registry the site holds
  at that moment — in place of the entry it published before, beside every
  other server, which is left exactly as it is.
- **Stopping one removes that one** (Ctrl+C, a closed terminal, a stopped
  service): only its own entry goes, the others stay. With none running the
  registry is empty and the app's list of shared servers is too.
- A second start of the *same* tunnel leaves the first alone, so starting it
  on a schedule is safe.
- Each has its own lock, log and files, by its id; they share one API key
  (`tunnel-key.txt`).

A tunnel that is killed rather than stopped — the power went, the process was
ended from a task manager — cannot take its entry out. `llm-registry.mjs check`
finds it.

### What the door lets through

Only with `Authorization: Bearer <key>`; anything else is a 401 before the
path is even looked at. Then only `GET /v1/models`, `POST
/v1/chat/completions`, `/v1/completions`, `/v1/embeddings` and the read-only
`GET /api/v0/models`, `/api/tags`, `/api/ps`, `/props`. Everything else is a
404 — a model cannot be loaded, downloaded or deleted through the tunnel.

The key is made on the first start (`tunnel-key.txt` beside the script, not in
git) and reused. On another machine nothing is copied: its first run makes its
own.

### The look it takes at itself

Every `--check` seconds it asks its own public address for `/v1/models`:

- three misses in a row and cloudflared is started again, with a new address,
  which replaces the old one in the registry;
- a cloudflared that has no address after three minutes is started again;
- a model list that changed is written out (and published) again. From LM
  Studio the list is the chat models LOADED, whenever any is: every model
  downloaded used to be listed, and one picked that was not loaded was
  loaded on the spot at its default context — too small for the app, and a
  long wait on that machine. Load another (at 32k) and it is published at
  the next check; with nothing loaded the whole list stands;
- a publish that failed is tried again a few minutes later, and an entry that
  went missing from the registry is put back;
- an LLM server that is not running yet does not stop it: the tunnel opens and
  the address is written out once the server answers.

## The shared registry

```bash
node extra-work/local-llm/llm-registry.mjs list                        # the servers shared right now
node extra-work/local-llm/llm-registry.mjs check                       # which answer; asks about each that does not
node extra-work/local-llm/llm-registry.mjs check --remove-unreachable  # takes those out without asking
node extra-work/local-llm/llm-registry.mjs remove <id>                 # takes one out (asks first; --yes does not)
```

- **`list`** only reads the public `info.json`: each server's id, name,
  address, models, and whether it carries a key — never the key itself.
- **`check`** asks each server for its model list, with the key the registry
  carries, and says _reachable_ or _UNREACHABLE_ with the reason: a dead
  tunnel's error page, a name that is gone, no answer in 10 seconds. For each
  unreachable one it asks _Take it out of the shared registry? [y/N]_ — yours
  to choose, one by one. An address of a local network is said to be one: it
  answers on its own network and nowhere else, which is not the same as gone.
  With no terminal to answer in, it reports and takes nothing out.
- **`remove`** and a yes in `check` write the registry: the copy the site holds
  at that moment, without that server, everything else as it is.

To publish a whole file by hand instead (it REPLACES the registry, the
tunnels' entries too — they put theirs back within a few minutes):

```bash
node extra-work/local-llm/s3-push-llm-registry.mjs extra-work/local-llm/llm-info.json --dry-run
node extra-work/local-llm/s3-push-llm-registry.mjs extra-work/local-llm/llm-info.json
```

Everything in the published file is public, the key too: anyone who reads it
can use the server. The door is what keeps that to chat calls.

### The schema of `llm-info.json`

`llm-info.schema.json` says what a registry file may hold, field by field —
the same shape as [`docs/llm-registry/info.schema.json`](../../docs/llm-registry/info.schema.json),
kept here too so this folder can be copied out whole (`npm test` fails when
the two stop agreeing). An entry is one of two kinds:

```jsonc
{
    "version": 1,
    "updated": "2026-10-13",
    "servers": [
        // An LLM server: offered in the help window as an assistant.
        {
            "id": "church-lmstudio",
            "name": "Church LM Studio",
            "baseUrl": "https://quiet-river-1234.trycloudflare.com/v1",
            "apiKey": "sk-…",
            "isFree": true,
            "models": [{ "model": "qwen/qwen3.5-9b", "name": "Qwen 3.5 9B" }]
        },
        // An LLM server whose tunnel takes reports too (--with-reports)
        // is the entry above with "isAcceptingReport": true added to it.
        // An address that takes problem reports and nothing else: no
        // models, and the app shows it in no list.
        {
            "id": "reports",
            "name": "Report inbox",
            "baseUrl": "https://calm-lake-5678.trycloudflare.com/report",
            "apiKey": "sk-…",
            "isAcceptingReport": true
        }
    ]
}
```

In this repo VS Code checks `llm-info.json` and every `run/llm-info-<id>.json`
against it already (`.vscode/settings.json`, `json.schemas`): a missing
`models`, an id that is not a slug or a misspelt field is underlined, and the
fields complete as you type. Anywhere else, put `"$schema":
"./llm-info.schema.json"` as the file's first line — the app ignores the
field, and the publisher leaves it out of what it sends to the site.

## Taking problem reports

The help window's **Report** button looks into a problem, collects what the
app can read about itself and writes it up; **Send report** posts that
write-up — and with it the picture of the app and whatever the person
attached: pictures, a PDF, text files — to a registry entry marked
`"isAcceptingReport": true` (the contract is in
[`docs/llm-registry/README.md`](../../docs/llm-registry/README.md)).
`llm-report-inbox.mjs` is what takes it. There are two ways to put it on the
internet and into the registry.

**The tunnel you already run, taking reports too** — add one option to it:

```bash
node extra-work/local-llm/llm-tunnel.mjs --port 1234 --name "Church LM Studio" --publish --with-reports
```

Nothing else changes: one cloudflared, one address, one key, one registry
entry — now marked `"isAcceptingReport": true` beside its `models`. The app
posts a report to that entry's own address (`…/v1`), and the door keeps it in
the SQLite file instead of passing it to the LLM server; every chat call goes
where it always went. A tunnel that is running picks the option up when it is
next started.

**A tunnel for the inbox alone**, when reports should keep arriving whatever
the LLM server is doing:

```bash
node extra-work/local-llm/llm-tunnel.mjs --reports --publish
```

That is a tunnel like any other — its own cloudflared, its look at itself, its
entry (`reports`) added on starting and taken out on stopping, a new address
published each time it changes — whose door is the inbox instead of an LLM
server. It runs beside the tunnels to your LLM servers, each a process of its
own, and starts with the computer the same way:

```bash
node extra-work/local-llm/llm-tunnel-startup.mjs install -- --reports --publish
```

Then read what arrived, from any terminal, while it runs:

```bash
node extra-work/local-llm/llm-report-inbox.mjs list                   # newest first
node extra-work/local-llm/llm-report-inbox.mjs show 12                # one report, by its number
node extra-work/local-llm/llm-report-inbox.mjs show OWA-261013-127b   # or by the reference the app gave it
node extra-work/local-llm/llm-report-inbox.mjs files 12               # write its pictures, PDFs and text files out
node extra-work/local-llm/llm-report-inbox.mjs done 12                # dealt with (again: not done after all)
node extra-work/local-llm/llm-report-inbox.mjs list --open            # what is left to do
```

The report is written to be read as a prompt — it opens by saying what it is
and which parts to trust, then the report between `----- BEGIN REPORT …
-----` and `----- END REPORT … -----` — so it can be handed to whatever
reads one:

```bash
node extra-work/local-llm/llm-report-inbox.mjs show 12 | <your agent or model>
```

**`show` marks it as a stranger's words before it hands it over.** The
registry is public and so is its key, so anybody can post here — and the
fence inside the report was written by whoever sent it. So `show` prints
the text between two lines of its own, `===== BEGIN UNTRUSTED REPORT <16
random characters> =====` and the matching `END`, drawn afresh each time so
a report cannot write the line that closes it, under a note saying the
sender is not verified, that the text is data and never instructions, and
which files came with it. Control characters are taken out of everything
printed, so a report cannot drive the terminal it is listed in. `show 12
--raw` prints the text alone. **Do not pipe `--raw` into an agent that has
your repository and your credentials.**

**`files 12`** writes what came with the report into
`report-files/12-OWA-…/` beside the database (`--to <dir>` names another
folder; not in git): the picture of the app as it was when Report was
pressed, and what the person attached. They are a stranger's files too —
look at them, run nothing in them.

### What the inbox does

- **One call**: `POST /report` with a JSON body — `{"prompt": "…",
  "attachments": […]}`, what the app sends — or plain text, the body being
  the report (`curl --data-binary @report.txt`). With `Authorization: Bearer
  <key>` (the same `tunnel-key.txt` the tunnels use) or a 401 before anything
  else is looked at; any other path is a 404, any other method a 405.
- **An attachment is kept for what its bytes are, not for its name.** A
  picture (`png`, `jpg`, `gif`, `webp`), a PDF or a text file, 8 of them at
  most, 5 MB each and 12 MB together — the app's own numbers. One may be an
  object `{name, mimeType, data}` or a bare base64 string or `data:` URL,
  which is then named by what it is (`attachment-1.png`). A kind it does not
  take (`.exe`, `.html`, `.svg`…), a file that is not what its name says
  and one too large are **skipped with a reason**, and the report is kept
  all the same: the answer lists them under `skipped`, and `show` and
  `files` say so.
- **One file**: `report-inbox.sqlite` beside the script (`--db` names
  another), not in git. Two tables. `report`: `id`, `received_at`,
  `reference` (the app's `OWA-…`), `title`, `visitor` (the address it came
  from), `bytes`, `body` — the whole text — `handled_at`, set by `done`, and
  `digest`. `report_file`: `report_id`, `position`, `name`, `mime_type`,
  `bytes`, `data` — the file — or `skipped`, why it was not kept. Any SQLite
  tool opens it.
- **The same report sent twice is one row** (Send pressed again), told by a
  digest of its text.
- **It cannot be made to fill the disk**: the registry is public and so is its
  key, so the text of a report is at most 640 KB and a whole request 18 MB;
  one address — for IPv6, one /64 — gets 20 in ten minutes; all of them
  together 300 and 256 MB an hour; and the inbox keeps 20 000 reports and
  2 GB at the most. **Full, it makes room out of the oldest reports marked
  `done`** — so `done` is also what keeps it taking new ones — and answers
  _full_ only when none is. With room for the words and not the files, the
  words are kept.
- **A request too large is answered `413`**, read to its end first, so the
  app hears _too large_ and sends the words alone.
- **A new report is said on this computer's desktop** — a Windows
  notification (PowerShell), `osascript` on macOS, `notify-send` on Linux —
  _New problem report: <its title> — #12 OWA-… Read it: node
  llm-report-inbox.mjs show 12_, and a line in the log either way. The inbox
  usually runs with no window (behind the tunnel, under the startup task),
  and a report nobody notices helps nobody. One notice a minute at most: what
  arrives inside the minute is counted and said once after it, because the
  key is public. A report's words are passed to the notice as data, never as
  part of a command. `--no-notify` (on `llm-tunnel.mjs` with `--reports` or
  `--with-reports`, and on `llm-report-inbox.mjs serve`) turns it off.
- **While the inbox is away, the app keeps what it is sent.** A copy of the
  app whose Send finds this address not answering — the computer asleep, the
  tunnel restarting — keeps the report (words and files, at most five, for a
  week) and sends it by itself when the inbox is back: a minute after the app
  starts, every half hour while it runs. A restart of the inbox loses no
  report.

`node llm-report-inbox.mjs` alone (`serve`, `--port 8788`) runs the inbox on
this computer only, with no tunnel — for trying it, or for putting it behind a
reverse proxy or a named tunnel of your own, in which case its registry entry
is yours to write: `baseUrl` is the public address ending in `/report`.

### In the registry

- A tunnel started with `--reports --publish` writes and removes its own
  entry, like every tunnel. One kept by hand is published with
  `s3-push-llm-registry.mjs`, and the tunnels leave it where it is.
- `llm-registry.mjs list` says _takes reports_ in place of the models, and
  `check` asks the address with a `GET` — a report is never sent to try it —
  counting any answer the address gives itself as there and a `5xx` or no
  answer as unreachable.
- The app tries the first three such entries in the file's order.

## Start it with the computer

```bash
node extra-work/local-llm/llm-tunnel-startup.mjs install -- --port 1234 --name "Church LM Studio" --publish
node extra-work/local-llm/llm-tunnel-startup.mjs status -- --port 1234
node extra-work/local-llm/llm-tunnel-startup.mjs uninstall -- --port 1234
```

Everything after `--` is handed to `llm-tunnel.mjs`, and it is also what says
WHICH tunnel: one service per tunnel id, so several can be installed side by
side. `status` and `uninstall` take the same options, or `--id <id>`.
`--dry-run` shows what would be written and run, and changes nothing. No
administrator is needed.

| OS | What is installed | Where it speaks |
| --- | --- | --- |
| Linux | A systemd **user** service, `owa-llm-tunnel-<id>.service`, `Restart=always`. `loginctl enable-linger` is tried so it starts at boot and outlives a logout; when that is refused the command to run with `sudo` is shown. With no systemd, two cron lines are printed to add by hand. | `journalctl --user -u owa-llm-tunnel-<id> -f` |
| macOS | A launchd agent, `app.openworship.llm-tunnel.<id>` (`RunAtLoad`, `KeepAlive`): from this user's login. | `tunnel-<id>.log` here |
| Windows | A Task Scheduler task, _Open Worship LLM Tunnel (<id>)_: at this user's logon, and every `--every` minutes (5) from the moment it is installed, starting it whenever it is not running, with no window. Two triggers: a logon trigger's repeat only begins at the next logon, so a task installed mid-session used to run once and never again (`schtasks /Query /TN "<name>" /V /FO LIST` showed _Next Run Time: N/A_). Pass `--out` and `--log` as FULL paths: the task runs in this folder. | `tunnel-<id>.log` here |

Tried for real on Linux (Ubuntu 24.04, systemd) and Windows 11; the macOS
recipe is written from launchd's documentation and has not been run.

On Windows `uninstall` ends the tunnel without its goodbye — a program with
no window cannot be asked to close there — so its two files stay where they
were written and its entry stays in the registry: take it out with
`llm-registry.mjs remove <id>`.

## Which model fits

`model-benchmarks.json` is where a model's measurements are kept once they
are taken — which program ran it, on which machine, with what context, what it
was asked, how long it took, how many tokens, and what came back — so that the
next person choosing a model can be told what is known, not what is hoped.

```bash
node extra-work/local-llm/model-benchmarks.mjs            # every model, best fit first
node extra-work/local-llm/model-benchmarks.mjs --vram 8   # what is known to run in 8 GB of video memory
node extra-work/local-llm/model-benchmarks.mjs --json     # the same rows, for a program
```

| Part | What it holds |
| --- | --- |
| `machines[]` | The computers the measurements were taken on: an `id` the runs name, `what` it is, `vramGb` (0 for no graphics card) and `ramGb` when known. |
| `rules[]` | What the measurements taught that is true of every model: the size of the app's own request, the context to load with. Each with its `source`. |
| `models[].fit` | `good` (answers app questions through the tools, correctly), `usable` (answers, with a stated limit), `limited` (only the no-tool road — `/btw`, a drafted song — is worth using), `poor` (tried, not worth offering) or `unrated` (measured, never judged). |
| `models[].fitNote` | The sentence to tell somebody asking whether this model is for them. Required for every `fit` but `unrated`. |
| `models[].runs[]` | One measurement each: `date`, `program`, `machine`, `contextLength`, `task`, `asked`, `seconds`, `secondsToFirstToken`, `rounds`, `totalTokens`, `promptTokens`, `generatedTokens`, `tokensPerSecond`, `promptTokensPerSecond`, `outcome`, and `source` — where it is written down. A number that was not measured is `null`, never a guess; a speed is never worked out from a whole answer's seconds, which hold the reading of the prompt too. |

Adding a measurement is adding an object to a model's `runs`, or a new model
with its first run; `npm test` refuses a file that has lost its shape.

## Worth knowing

- **The address is new on every start** of cloudflared. `--publish` is what
  carries it to the registry each time; a named Cloudflare tunnel with a fixed
  hostname is the lasting answer.
- **Cloudflare ends a request whose answer has not started within 100
  seconds.** The app asks a custom server for a whole answer at once, so a slow
  round or a model still loading can fail through the tunnel where it works on
  the local network.
- **Load the model with a context of 32k.** The app's own request is about
  13 400 tokens; under 16k it is refused, and at 16k a question that takes
  several rounds overflows.
