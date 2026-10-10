---
name: custom-llm-servers
description: "The user's own OpenAI-compatible servers (LM Studio, Ollama, any URL) in the chatbot — one `custom` provider, a row per server, every call through a main-process relay; the server's KIND is read off its root (LM Studio's list, Ollama's /api/tags + /api/ps), Test corrects an address one path off, and a 404 is never 'not available to the account'"
metadata:
  node_type: memory
  type: project
  originSessionId: 029805b0-9f47-4d9c-b38b-fed0e2ab561c
  modified: 2026-10-10T15:14:05.698Z
---

Added 2026-10-09 at the user's ask, tested against their LM Studio
(`http://localhost:1234/v1`, `phi-3.1-mini-128k-instruct`). Settings →
Others → **Custom servers**; shared rules in `electron/customLlmProtocol.ts`.

- **Every call goes through the MAIN process** (`customLlmRelayHelpers.ts`),
  because the user chose "any URL" and the chatbot window's only network
  fence is its prod CSP. The relay forwards only to an address SAVED in
  Settings, only `GET /models` and `POST /chat/completions`, with the key
  read from the secure store in main (a custom key never enters the window),
  on its own in-memory session (`custom-llm-relay`) — not the default one,
  whose fsServe CORS/referer hooks and cookies have no business there.
  Redirects are refused, answers capped at 4 MB, Stop cancels by request id.
  A third call, LM Studio's own `GET /api/v0/models`, was added the same
  day (below); still nothing that loads, unloads or writes.
  Errors are RETURNED (`{ok:false, reason}`), never thrown: an Error over IPC
  keeps only its message.
- **One provider key, `custom`, one row per server.** Per-server provider
  ids would break every exhaustive `Record<LlmProviderType,…>`, crash a
  lookup when a server is deleted under a tab, and put `:` in a setting
  FILE name. A model id is `<serverId>/<rowId>` (uuids), turned into the
  row's own model id only at the request (`toWireModel`). The head row is
  built by `genAssistantRows`; servers and models are re-read on window
  focus, and a tab on a deleted server/row is moved there.
- **The SDK's abort error is named `Error`** (openai 7.8), so
  `checkIsCancelError` only recognises a Stop through the aborted SIGNAL —
  always pass it. The SDK wraps whatever the custom `fetch` threw in an
  `APIConnectionError`, so the relay's sentence is on `cause`
  (`toCustomServerFailure`).
- **"Could not be reached" would be a lie for localhost**; a
  `CustomServerError` carries its own sentence ("nothing answered at … —
  check that its server is running"), and a context-length 400 says to load
  the model with a 32k Context Length (LM Studio often loads at 4k).
- **Settings fields save on blur.** Test/Load read the STORED server at the
  press (the press is what blurs the box), and are never disabled for an
  unsaved address — a press on a disabled button is lost. Driving it over
  CDP: `fill` the box, then `press_key Tab` — a synthetic `owa_click` does
  not blur, and `owa_type` cannot find these boxes by their `<label>`.
- Not done: streaming. Local small models (Phi-3.1-mini) are weak at tool
  calls.

**Measured on the user's LM Studio box down the hall (2026-10-09,
`http://super-computer:1237/v1`, qwen3.5-9b Q4_K_M, loaded at 16k):**

- **The fixed request is ~13 400 tokens** (system prompt ~19.6k chars + 25
  tool schemas ~31.9k chars); round 3 of an ordinary how-do-I reached
  15 300 of 16 384. So `CUSTOM_CONTEXT_MIN` is 16k (refused before a round
  under it) and every sentence recommends 32k (`CUSTOM_CONTEXT_COMFORTABLE`).
  Presenter / Reader how-do-Is answered right in 3 rounds, 21-30 s; prompt
  processing ~1 000 tok/s with LM Studio reusing the cached prefix, so a
  FOCUS change (new system prompt) costs ~10 s more on round 1.
- **`reasoning_effort: "none"` turns qwen3.5's thinking off on LM Studio**
  (1.4 s against 24 s for one plain answer; `"low"` and
  `reasoning: {effort}` changed nothing). In the tool loop it reasoned only
  30-120 tokens a round, so the loop is not where it costs.
- **The machine went to sleep mid-question**: the window waited 516 s and
  said "check that its server is running". Now the relay asks `/models` on
  a SECOND connection every 20 s while a chat call is out and gives up as
  `lost` after two FAILED connections (a list that is merely slow is a busy
  server, never a miss); a non-loopback address is told to check "the
  computer it runs on is on and awake".
- **LM Studio's own list** (`/api/v0/models`, `LM_STUDIO_MODELS_PATH`, at the
  ROOT of an address ending exactly `/v1`) says loaded / context / `vlm`.
  Settings' Test and Load show it under each row; Load ticks **Sees
  pictures** (a row field, `canSeeImages`, stored only when true); the
  chatbot reads it before each ask (1.5 s cap) to refuse a too-small context
  and to say "Waiting for <server> to load <model>" on round 1.
- **A machine on the church's own network is free** (`checkIsLocalNetworkUrl`:
  a bare machine name, `.local`/`.lan`/…, RFC1918, 100.64/10, fc00::/7).

**Made generic for Ollama and the rest (2026-10-10, the user's ask: _make the
custom assistant work generically … it's not working with ollama now … work
with most popular llm server like lmstudio ollama_).** Measured on the user's
Ollama 0.40 (`http://localhost:11434`): the row had been typed as
`http://localhost:11434/v1/systemone` (a decision-model door of Ollama's
own), every call under it was a text `404 page not found`, and the chatbot
read that 404 as _this model is not available to the account_.

- **The server's KIND is read off its root, never stored**
  (`readCustomServerModelInfo` → `{kind, infoMap}`, `CustomServerKindType`
  `lm-studio | ollama | other`): LM Studio's `/api/v0/models` first, else
  Ollama's `/api/tags` (every model with `capabilities` — `vision` is what
  ticks **Sees pictures** — and `details.context_length`) plus `/api/ps`
  (what is in memory, with the `context_length` it is loaded with), all
  three at the ROOT of a `/v1` address only, all read-only
  (`checkIsRootCustomLlmPath`; pull / copy / load / delete stay refused).
  `CustomModelInfoType` replaced `LmStudioModelInfoType`; the LM Studio
  parser is unchanged, `toOllamaModelInfoMap` is the twin. The Settings
  lines and the chatbot's refusal speak in the program's words
  (`genContextTooSmallText(loaded, kind)`: LM Studio reloads a model with a
  Context Length, the Ollama app has ONE setting — Settings → Context
  length — or `OLLAMA_CONTEXT_LENGTH=32768`; Ollama's docs: the default is
  4k under 24 GiB of VRAM). Each is its own literal `tran` key per program,
  so Khmer reads naturally.
- **Test corrects an address one path off** (`listCustomServerModels` →
  `correctedBaseUrl`): when the saved address answers 404 or no list, the
  SAME origin's `/v1`, `<path>/v1` and root are tried
  (`genCustomServerAddressCandidates`) through the relay's `probeBaseUrl`,
  which the relay accepts for `GET /models` only and only on the saved
  origin (`checkIsSameOrigin`) — the key never goes to another host. The
  panel saves the one that answered and says _Address corrected to …_;
  when none answers, the sentence names the two usual addresses.
- **A 404 is read two ways** (`toCustomServerFailure(error, {loadedContext,
  kind, baseUrl, model})`): a 404 the server WROTE (Ollama's `not_found_error`
  JSON — the SDK puts it on `error.error`) is _this server has no model
  called “x”_ (+ `ollama pull x`); a bare page is _nothing speaks the OpenAI
  API at … — check the address and press Test_. A 400 saying `does not
  support tools` is _this model cannot use tools_. Ollama's context 400
  (`exceed_context_size_error`, "exceeds the available context size") matches
  the existing pattern.
- **The rest of the family** (the user's list: _Ollama, LocalAI, Llamafile,
  Respawn, LiteLLM Proxy, LM Studio, Jan, GPT4All, vLLM, SGLang, llama.cpp_):
  all OpenAI-shaped at `<origin>/v1` (LiteLLM at the root too), so the
  address correction, the key box and `/models` already serve them. What
  they needed: **llama.cpp's `/props`** (kind `llama-cpp`, llamafile too —
  `default_generation_settings.n_ctx` is the context the server was started
  with, 4096 unless `-c`; `modalities.vision`; ONE model, so the info is
  `commonInfo` for every row, `findCustomModelInfo`); **error bodies in
  other shapes** — vLLM / SGLang write `{object:"error", message, type,
  code}` with no `error` key and a FastAPI server `{detail}`, which the SDK
  reports as "404 status code (no body)", so `toReadableErrorText` rewraps a
  ≥400 JSON body as `{error:{message,type,code}}` before the SDK sees it;
  and **tool calling that is off server-side** — llama.cpp answers 500
  `tools param requires --jinja flag`, vLLM / SGLang 400 naming
  `--enable-auto-tool-choice` / `--tool-call-parser`
  (`NO_TOOLS_ERROR_LIST`, each with its fix sentence). Usual ports are in
  W-42 step 13. Not measured live: none of them was installed here.
- **Ollama facts measured:** the OpenAI door ignores `options.num_ctx` and a
  top-level `num_ctx` — the context is the server's (or the Modelfile's: the
  user's `tev1:4b` pins `num_ctx 2050`, which no request can raise); unknown
  body fields are ignored, not refused; `reasoning_effort: "none"` turns a
  thinking model's reasoning off (686 ms against 5.3 s), `think: false` is
  ignored there; `/v1/models` lists every pulled model with `owned_by:
  library`. Not shipped: sending `reasoning_effort` to custom servers.
Related: [[bedrock-llm-provider]], [[kimi-third-llm-provider]],
[[secure-storage-safestorage]], [[scratch-dev-instance-beside-user-app]].
