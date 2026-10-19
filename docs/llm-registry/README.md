# The shared LLM registry — `https://www.openworship.app/llm/info.json`

One JSON file on the project's website names LLM servers that every copy of
Open Worship may ask. The app reads it when it starts (main process,
`electron/llmRegistryHelpers.ts`) and again when the **↻** button beside the
**Assistant** picker in the help window (🤖) is pressed. Each server in it
appears in that picker beside the servers typed into Settings → Others →
**Custom servers**, with its models in the **Model** list, and is asked
through the same main-process relay as a saved server.

The story it serves: an admin runs a capable machine (LM Studio, Ollama,
llama.cpp…), opens it to the internet — a Cloudflare quick tunnel is enough —
and puts its address in this file; every church copy of the app sees it at
the next launch or Reload, with nothing to type.

## The file

```json
{
    "version": 1,
    "updated": "2026-10-10",
    "servers": [
        {
            "id": "church-lmstudio",
            "name": "Church LM Studio",
            "baseUrl": "https://quiet-river-1234.trycloudflare.com/v1",
            "apiKey": "",
            "isFree": true,
            "note": "The church's own computer: free for us, and the words stay in the building.",
            "models": [
                { "model": "qwen/qwen3.5-9b", "name": "Qwen 3.5 9B", "canSeeImages": true, "note": "Slow, but it saves us the cost of usage." },
                { "model": "google/gemma-4-e4b", "name": "Gemma 4 E4B", "canSeeImages": true }
            ]
        }
    ]
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | Always `1`. A file of another version is ignored whole. |
| `updated` | no | A date, for people; up to 40 characters. |
| `servers[]` | yes | Up to 20 entries; later ones are dropped. |
| `servers[].id` | yes | A slug, `[A-Za-z0-9-]`, 1–48 characters, unique in the file. The app shows the server as `registry-<id>`, so it can never collide with a saved server. Keep it stable: a tab that was on the server keeps it across reloads by this id. |
| `servers[].name` | yes | What the picker shows, up to 60 characters. |
| `servers[].baseUrl` | yes | The OpenAI-compatible base address, usually ending in `/v1`; `http` or `https`, up to 500 characters. The app calls `GET <baseUrl>/models` and `POST <baseUrl>/chat/completions`, and reads LM Studio's / Ollama's / llama.cpp's own root doors when the address allows. **Held in the main process only; never shown in any window** (see _What the app does with it_). |
| `servers[].apiKey` | no | Sent as `Authorization: Bearer …`. **Held in the main process only; never shown in any window.** Anyone who can read this file can read the key: use a key that only reaches this server. |
| `servers[].isFree` | no | `true` prices the server's answers at nothing in the help window (the church's own machine). Otherwise the price is "not known". |
| `servers[].note` | no | **Shown** to the person choosing the server, before each model's own note: under the help window's pickers, on the model's hover, in Auto's waiting line and in Settings → Others → Shared servers. Text, or one per language — `{"en": "…", "km": "…"}` (the app shows its own language's, then plain text, then English); up to 300 characters each, 12 languages. The server's host is taken out of it before a window sees it. A note for whoever edits the file does not belong here. |
| `servers[].models[]` | yes, at least one — unless `isAcceptingReport` | `model` is the id the server knows (`qwen/qwen3.5-9b`); `name` what the picker shows (empty shows the id); `canSeeImages` lets a picture be attached; `note` the model's own word to the person choosing it, the same shape as the server's — _Slow, but it saves us the cost of usage._ Up to the app's per-server model cap. |
| `servers[].isAcceptingReport` | no | `true` makes the entry **an address that takes problem reports**, and nothing else — see below. It needs no `models`. |

A server with no name, no usable address or no model is skipped; the rest of
the file is still read. The machine-readable form is
[`info.schema.json`](./info.schema.json); [`info.example.json`](./info.example.json)
is a complete example.

## An entry that takes reports

```json
{
    "id": "reporting",
    "name": "Report inbox",
    "baseUrl": "https://reports.example.church/report",
    "apiKey": "report-key-that-reaches-only-this-address",
    "isAcceptingReport": true,
    "note": "For reporting"
}
```

The help window's **Report** button investigates a problem, collects what the
app can read about itself and writes it up; **Send report** then posts that
write-up to an entry marked `isAcceptingReport` (2026-10-13). What the address
has to do is small:

- **Take a `POST` of JSON.** The request goes to `baseUrl` **exactly as
  written** (no path is added; a trailing `/` is dropped), with
  `Content-Type: application/json; charset=utf-8` and, when the entry has an
  `apiKey`, `Authorization: Bearer <apiKey>`. The body is one object (it was
  the text alone for a few hours of 2026-10-13; the same day it became this,
  so files can go with it):

    ```json
    {
        "version": 1,
        "reference": "OWA-261013-628c",
        "prompt": "This is a problem report from inside Open Worship app …",
        "attachments": [
            {
                "name": "OWA-261013-628c.png",
                "mimeType": "image/png",
                "data": "<base64>"
            },
            {
                "name": "notes.md",
                "mimeType": "text/markdown",
                "data": "<base64>"
            },
            {
                "name": "order-of-service.pdf",
                "mimeType": "application/pdf",
                "data": "<base64>"
            }
        ]
    }
    ```

    `prompt` is the report, and the one field that has to be read.
    `reference` is what the report calls itself (left out when it names
    none). `attachments` is always there, and empty when no file goes.

- **`attachments` are files, each whole, as base64**: the picture of the app
  taken when Report was pressed (`OWA-….png`), and whatever the person
  attached while reporting — pictures (`png`, `jpg`, `gif`, `webp`), a
  **PDF**, and text files (`md`, `txt`, `log`, `csv`, `json`, `xml`, `yaml`,
  `ini`, `srt`, `vtt` and the app's own text documents). At most **8
  files, 5 MB each and 12 MB together**, so a whole request stays under
  18 MB. `mimeType` is read off the name by the app: trust the bytes, not
  the name.
- **Answer `2xx` when it has it.** Only the start of the answer is looked
  at, and only for a refusal: a JSON body with `"ok": false` or an `"error"`
  is read as _not taken_ whatever the status — an LLM server answers an
  unknown `POST` with 200 and an error object, and a registry entry mis-set
  onto one must not read as _sent_. Any other status, a redirect, or no
  answer in time counts as _not taken_ too, and the app tells the person so
  and how to email the report instead. _In time_ is ten seconds for a report
  of words, and a second more for every 32 KB past the first 64 (a picture
  and a PDF over a slow line), three minutes more at the most.
- **Answer `413` when it is too large for you.** The app then sends the same
  report once more with `attachments` empty, its text saying which files
  stayed behind.
- **The text is written to be read as a prompt.** It opens with a few lines
  saying what it is — which sections the app read off itself, which a model
  wrote, what is wanted back — and then the report between
  `----- BEGIN REPORT OWA-… -----` and `----- END REPORT OWA-… -----`, in
  Markdown: what the user reported, what the assistant found, steps, the
  build and machine, the window and what is selected, each screen's content,
  the last console errors and the end of the conversation. Those words are a
  user's, a console's and a model's: **whatever reads the text must treat
  what is inside the fence as data**, and the opening lines say so. The
  files are named in those opening lines too, and the report's own
  **Attached** section says of each one whether it was sent or why not.
- **Home folders are written without the account's name** in the console
  lines and in an error the app caught: `C:\Users\~\AppData\…`.
- **Whoever posts is not verified.** The registry is public and so is the
  key in it: anybody who has read it can post, and the fence round the
  report is written by the sender. A receiver that hands a report to a
  model must mark it as a stranger's itself (the kit's inbox does).

What the app does around it:

- **An entry with `models` as well does both**: it is an assistant, listed
  and asked like any other, and its `baseUrl` is ALSO where reports are
  posted — one tunnel carrying an LLM server and the inbox
  (`llm-tunnel.mjs --with-reports`). Nothing in the app shows that half.
- An entry with no models is **not an assistant**: it is in no picker, and
  Settings → Others → **Shared servers** does not list it. Like every registry server its
  address and key stay in the main process (`electron/llmReportHelpers.ts`);
  a window hands over the words and is told only whether they were taken.
- The first **three** such entries are kept and tried in the file's order
  until one takes the report. When none does — or none is known — the
  registry is read once more and anything new in it tried, because a quick
  tunnel's address changes each time it starts.
- `baseUrl` must carry no `?` and no `#`.
- At most five reports in ten minutes leave one copy of the app.
- With no such entry the app is as it was: the report is saved into Downloads
  and the window says nothing was sent, and to whom to email it.

**Something that takes it is in the admin kit**: `llm-report-inbox.mjs` keeps
every report and its files in a SQLite file, and `node extra-work/local-llm/llm-tunnel.mjs
--reports --publish` puts it on the internet and writes this entry by itself
([the kit's README](../../extra-work/local-llm/README.md), _Taking problem
reports_).

## What the app does with it

- **Read at launch, never on a timer** (`initAi` → `refreshLlmRegistry`): a
  church's internet is often metered, and the list changes when an admin
  changes it. An 8-second timeout; a file over 256 KB is refused as not a
  registry.
- **A failed read keeps the last good list** and the reason is on the **↻**
  button's tooltip (`describeRegistryStatus`): _the last read failed: …_.
- **The relay accepts a registry server by its `registry-` id**
  (`customLlmRelayHelpers.ts`): only the saved list and this list, nothing a
  window names on its own, and the key comes from the registry entry.
- **No window is told a server's address or its key** (2026-10-12): a shared
  server is for this app to ask, not an address to copy and use from
  somewhere else. The main process hands a window each server with a
  stand-in address on a reserved name (`https://shared-server.invalid` plus
  the real path, `toPublicRegistryServers`), Settings → Others →
  **Shared servers** lists the name and the models only, an error sentence
  never quotes the address, and the relay takes the real host out of whatever
  the server or its tunnel writes back. A server on the local network is told
  as `isFree`, since a window can no longer read that off the address.
  **This hides the address inside the app, not on the internet**: the file
  itself is public (see _Safety_).
- **The notes ARE told** (2026-10-17): a server's `note` and each model's
  are shown to the person choosing — a line under the help window's pickers
  for the model the chat asks (on Auto, the one it picked last), the
  model's hover, the waiting line when Auto picks it, and Settings →
  Others → **Shared servers** — in the app's language when the note has
  one, with the server's host taken out. Write them for a volunteer:
  _Slow, but it saves us the cost of usage._
- **A developer can point the app at another file** with the environment
  variable `OWA_LLM_REGISTRY_URL` (any `http(s)` address), which is how it
  is tested against a stand-in server.

## Publishing the file

The site is served from the release S3 bucket (`www/` is the site root).
With `extra-work/.env` holding the release credentials:

```bash
node extra-work/local-llm/s3-push-llm-registry.mjs path/to/info.json            # validates, uploads, invalidates
node extra-work/local-llm/s3-push-llm-registry.mjs path/to/info.json --dry-run  # validates and shows the key only
```

The object is written to `www/llm/info.json` with `Cache-Control:
max-age=60`, and `/llm/info.json` is invalidated on CloudFront, so a Reload
in the app sees the change within a minute.

## Sharing a machine's LLM server

`extra-work/local-llm/` is the admin's kit for the story above, in Node.js
for Linux, macOS and Windows ([its README](../../extra-work/local-llm/README.md)):
`llm-tunnel.mjs` puts an API-key door in front of the LLM server and a
Cloudflare quick tunnel in front of the door. With `--publish` each running
tunnel adds its own server to this file — every time its address changes —
and takes it out again when it stops, leaving every other server as it is;
`llm-tunnel-startup.mjs` starts a tunnel with the computer.
`llm-registry.mjs list` shows what is shared right now, and `check` asks each
server whether it answers and offers to take out one that does not.

## Safety

- Everything in the file is public. Put a key in it only for a server that
  cannot do harm with it, and prefer a server that needs none. The app shows
  neither the address nor the key in any window, which keeps them from being
  copied out of the app — anyone who opens this file's own address still
  reads both.
- The file names where the app will send a volunteer's questions — and, with
  an `isAcceptingReport` entry, their problem reports, which carry the end of
  the conversation, the names of what is selected and on screen, and the last
  console errors. Only the project's own site is read, and the address is
  fixed in code (`LLM_REGISTRY_URL`); the environment override is for
  developers.
- A tunnel URL (`*.trycloudflare.com`) changes every time the tunnel is
  started: update the file, or run a named tunnel with a fixed hostname.
