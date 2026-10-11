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
            "note": "LM Studio on the church's computer, through a Cloudflare tunnel",
            "models": [
                { "model": "qwen/qwen3.5-9b", "name": "Qwen 3.5 9B", "canSeeImages": true },
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
| `servers[].baseUrl` | yes | The OpenAI-compatible base address, usually ending in `/v1`; `http` or `https`, up to 500 characters. The app calls `GET <baseUrl>/models` and `POST <baseUrl>/chat/completions`, and reads LM Studio's / Ollama's / llama.cpp's own root doors when the address allows. |
| `servers[].apiKey` | no | Sent as `Authorization: Bearer …`. **Held in the main process only; never shown in any window.** Anyone who can read this file can read the key: use a key that only reaches this server. |
| `servers[].isFree` | no | `true` prices the server's answers at nothing in the help window (the church's own machine). Otherwise the price is "not known". |
| `servers[].note` | no | For people reading the file; up to 300 characters; not shown in the app. |
| `servers[].models[]` | yes, at least one | `model` is the id the server knows (`qwen/qwen3.5-9b`); `name` what the picker shows (empty shows the id); `canSeeImages` lets a picture be attached. Up to the app's per-server model cap. |

A server with no name, no usable address or no model is skipped; the rest of
the file is still read. The machine-readable form is
[`info.schema.json`](./info.schema.json); [`info.example.json`](./info.example.json)
is a complete example.

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
  cannot do harm with it, and prefer a server that needs none.
- The file names where the app will send a volunteer's questions. Only the
  project's own site is read, and the address is fixed in code
  (`LLM_REGISTRY_URL`); the environment override is for developers.
- A tunnel URL (`*.trycloudflare.com`) changes every time the tunnel is
  started: update the file, or run a named tunnel with a fixed hostname.
