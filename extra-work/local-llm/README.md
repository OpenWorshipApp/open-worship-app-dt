# Local LLM kit

Everything an admin needs to share one computer's LLM server (LM Studio,
Ollama, llama.cpp, …) with every copy of Open Worship: a key-checking door, a
Cloudflare quick tunnel in front of it, and the shared registry on the site
that the tunnels write themselves into. What the app does with the registry is
in [`docs/llm-registry/README.md`](../../docs/llm-registry/README.md).

All of it is plain Node.js (18 or newer) with no npm packages, for Linux,
macOS and Windows. Only writing the registry needs this repo's `node_modules`
and `extra-work/.env`; the two tunnel scripts can be copied to a machine that
has neither.

| File | What it is |
| --- | --- |
| `llm-tunnel.mjs` | The door, cloudflared and the look it takes at itself. With `--publish` it adds its own server to the registry and takes it out again when it stops. |
| `llm-tunnel-startup.mjs` | Starts a tunnel with the computer and brings it back when it stops. |
| `llm-registry.mjs` | Lists the servers shared right now, asks each whether it answers, and takes one out. |
| `s3-push-llm-registry.mjs` | Checks a registry file the way the app does and publishes it whole to `https://www.openworship.app/llm/info.json`. |
| `llm-info.json` | A registry to publish by hand. Empty: the tunnels add and remove their own entries on the site. |
| `model-benchmarks.json` | Every measurement taken of a model answering for the chatbot, and what it says about which model fits whom. |
| `model-benchmarks.mjs` | Checks that file's shape and prints it, best fit first. |
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
- a model list that changed is written out (and published) again;
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
| Windows | A Task Scheduler task, _Open Worship LLM Tunnel (<id>)_: at this user's logon and again every `--every` minutes (5) while it is not running, with no window. | `tunnel-<id>.log` here |

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
