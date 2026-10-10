// Custom OpenAI-compatible servers the chatbot can ask -- LM Studio, Ollama,
// llama.cpp, a church's own GPU box, or any hosted service that speaks the
// same protocol. Shared types and pure helpers only: no Electron, renderer or
// filesystem dependency, so the main-process relay, the Settings panel and the
// chatbot window all read ONE set of rules. Written for the electron build's
// ES2015 target -- no `Array.prototype.at`, no `Object.hasOwn`.

// The plain half -- names, addresses and model lists -- and the encrypted
// half, the optional API key per server. Never inside `ai-setting`: that one
// is rebuilt from a fixed list of fields on every save and would drop these.
export const CUSTOM_LLM_SERVERS_SETTING_KEY = 'ai-custom-servers';
export const CUSTOM_LLM_KEYS_SETTING_KEY = 'ai-custom-servers-secret';

export const CUSTOM_LLM_FETCH_CHANNEL = 'main:app:custom-llm-fetch';
export const CUSTOM_LLM_CANCEL_CHANNEL = 'main:app:custom-llm-fetch-cancel';

export const MAX_CUSTOM_SERVERS = 10;
export const MAX_CUSTOM_MODELS = 50;
export const CUSTOM_NAME_MAX = 60;
export const CUSTOM_MODEL_MAX = 200;
export const CUSTOM_URL_MAX = 500;
export const CUSTOM_KEY_MAX = 4096;
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export type CustomModelType = {
    // The row's own id, so a tab keeps pointing at the same row when the
    // model id or name is edited.
    id: string;
    // What the server is asked for (`phi-3.1-mini-128k-instruct`).
    model: string;
    // What the chatbot shows; the model id when blank.
    name: string;
    // Whether the model takes a picture. Only ever TRUE when stored: ticked
    // in Settings, or read off LM Studio's own model list ("vlm"). A blind
    // model sent a picture answers 400, so nothing guesses it.
    canSeeImages?: boolean;
};

export type CustomServerType = {
    id: string;
    name: string;
    // Kept as typed, even when it is not a usable address yet, so the person
    // fixing it sees their own words; `toCustomServerBaseUrl` decides use.
    baseUrl: string;
    models: CustomModelType[];
};

/**
 * LM Studio's own model list, at the ROOT of the server rather than under
 * `/v1`: the one place it says which models are loaded, with what context
 * length, and which of them see pictures -- the three things that decide
 * whether the assistant can work on it. Asked only of a server whose address
 * ends in exactly `/v1`, LM Studio's shape (`toCustomLlmCallUrl`).
 */
export const LM_STUDIO_MODELS_PATH = '/api/v0/models';

/**
 * Ollama's own two lists, at the root as well: every model it has
 * (`/api/tags` -- each with its capabilities, of which `vision` is the one
 * that matters here, and the most context it could take) and the ones in
 * memory right now (`/api/ps`, each with the context it is loaded with).
 * Read-only, like LM Studio's list: the Ollama calls that pull, copy, load
 * or delete a model stay refused.
 */
export const OLLAMA_TAGS_PATH = '/api/tags';
export const OLLAMA_PS_PATH = '/api/ps';

/**
 * llama.cpp's `llama-server` (and llamafile, built on it) says what it is
 * running at `/props`: the context each slot was started with
 * (`default_generation_settings.n_ctx` -- 4096 unless `-c` said otherwise),
 * the model file, and whether it sees pictures (`modalities.vision`).
 * Read-only; the server has one model and no loading door at all.
 */
export const LLAMA_CPP_PROPS_PATH = '/props';

// What a server says about ITSELF, asked at the root of a `/v1` address and
// nowhere else (`toCustomLlmCallUrl`).
const ROOT_CALL_PATH_LIST = [
    LM_STUDIO_MODELS_PATH,
    OLLAMA_TAGS_PATH,
    OLLAMA_PS_PATH,
    LLAMA_CPP_PROPS_PATH,
];

/**
 * The only calls the relay forwards. Everything else a server might answer
 * -- embeddings, file uploads, model loading, admin routes -- is refused,
 * because nothing in the chatbot needs it.
 */
export type CustomLlmCallType =
    | { method: 'GET'; path: '/models' }
    | { method: 'GET'; path: typeof LM_STUDIO_MODELS_PATH }
    | { method: 'GET'; path: typeof OLLAMA_TAGS_PATH }
    | { method: 'GET'; path: typeof OLLAMA_PS_PATH }
    | { method: 'GET'; path: typeof LLAMA_CPP_PROPS_PATH }
    | { method: 'POST'; path: '/chat/completions' };

export function checkIsRootCustomLlmPath(path: unknown): boolean {
    return typeof path === 'string' && ROOT_CALL_PATH_LIST.indexOf(path) !== -1;
}

export function checkIsAllowedCustomLlmCall(
    method: unknown,
    path: unknown,
): boolean {
    return (
        (method === 'GET' &&
            (path === '/models' || checkIsRootCustomLlmPath(path))) ||
        (method === 'POST' && path === '/chat/completions')
    );
}

/**
 * The address one allowed call goes to: under the base URL, except what a
 * server says about itself, which is at the root of a `/v1` address or of
 * a bare one (llama.cpp's server and a LiteLLM proxy answer `/models` at
 * their root, so a Test accepts that address as typed -- measured
 * 2026-10-10 on llama.cpp b11541, whose `/props` then went unasked) and
 * nowhere else -- under a proxy's longer path the root may be somebody
 * else's.
 */
export function toCustomLlmCallUrl(baseUrl: string, path: string) {
    if (!checkIsRootCustomLlmPath(path)) {
        return `${baseUrl}${path}`;
    }
    const url = new URL(baseUrl);
    return url.pathname === '/v1' || url.pathname === '/'
        ? `${url.origin}${path}`
        : null;
}

/** Same scheme, host and port: the same program listening. */
export function checkIsSameOrigin(urlA: string, urlB: string): boolean {
    try {
        return new URL(urlA).origin === new URL(urlB).origin;
    } catch (_error) {
        return false;
    }
}

/**
 * The other addresses on the SAME server where the OpenAI protocol is
 * usually served, best guess first, for a Test that found nothing at the
 * address typed. Measured 2026-10-10: Ollama's own address was typed as
 * `http://localhost:11434/v1/systemone` (a door of its own that answers
 * something else), every call under it was a 404 page, and the chatbot read
 * that as "this model is not available to the account". The protocol lives
 * at `<origin>/v1` on LM Studio, Ollama, llama.cpp and vLLM alike, at the
 * root on a few, and under `<path>/v1` behind a proxy -- so those three,
 * never another host: the server's key goes only where it was saved to go.
 */
export function genCustomServerAddressCandidates(baseUrl: unknown): string[] {
    const base = toCustomServerBaseUrl(baseUrl);
    if (base === null) {
        return [];
    }
    const url = new URL(base);
    const candidates = [`${url.origin}/v1`, url.origin];
    if (!/\/v1$/.test(url.pathname)) {
        candidates.splice(1, 0, `${base}/v1`);
    }
    const unique: string[] = [];
    for (const candidate of candidates) {
        if (candidate !== base && unique.indexOf(candidate) === -1) {
            unique.push(candidate);
        }
    }
    return unique;
}

export type CustomLlmFetchRequestType = {
    serverId: string;
    method: string;
    path: string;
    body?: string;
    requestId: string;
    /**
     * Another address to ask the model list at, in place of the saved one
     * -- one of `genCustomServerAddressCandidates`, so on the SAME origin;
     * the relay refuses any other, and refuses it on every call but
     * `GET /models`. How Settings' Test finds the right path without a
     * wrong one ever being saved.
     */
    probeBaseUrl?: string;
};

export type CustomLlmFailureType =
    | 'ai-off'
    | 'unknown-server'
    | 'not-allowed'
    | 'bad-url'
    | 'unreachable'
    // The server went away while a question was out: its own model list
    // stopped answering on a second connection (`runCustomLlmFetch`).
    | 'lost'
    | 'timeout'
    | 'too-large'
    | 'redirect'
    | 'cancelled';

/**
 * What the relay answers. Never a thrown Error: one sent over IPC keeps only
 * its message, and the renderer needs to tell "nothing answered" from "the
 * server said no".
 */
export type CustomLlmFetchResultType =
    | { ok: true; status: number; contentType: string; text: string }
    | { ok: false; reason: CustomLlmFailureType; detail: string };

function toTrimmedString(value: unknown, maxLength: number) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/**
 * The server's base URL in the one form the relay and the client agree on --
 * `http(s)://host[:port]/path` with no trailing slash -- or null when it is
 * not an address this feature may use: another scheme, credentials written
 * into it (a key goes in the key box, where it is encrypted), a query or a
 * fragment (the SDK appends paths and would mangle them).
 */
export function toCustomServerBaseUrl(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const text = value.trim();
    if (text.length === 0 || text.length > CUSTOM_URL_MAX) {
        return null;
    }
    let url: URL;
    try {
        url = new URL(text);
    } catch (_error) {
        return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
    }
    if (url.username !== '' || url.password !== '') {
        return null;
    }
    if (url.search !== '' || url.hash !== '' || text.includes('?')) {
        return null;
    }
    if (url.hostname === '') {
        return null;
    }
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${pathname}`;
}

function toHostname(value: unknown) {
    const baseUrl = toCustomServerBaseUrl(value);
    return baseUrl === null ? null : new URL(baseUrl).hostname.toLowerCase();
}

/** Whether the server is on THIS computer -- priced at nothing. */
export function checkIsLoopbackUrl(value: unknown): boolean {
    const hostname = toHostname(value);
    if (hostname === null) {
        return false;
    }
    return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '[::1]' ||
        /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
}

// Names only a local network resolves: a bare machine name ("super-computer",
// the way Windows shares name a PC) and the suffixes routers and mDNS hand
// out. A public service always has a dot and a real top-level domain.
const LOCAL_NAME_SUFFIX_LIST = [
    '.local',
    '.lan',
    '.home',
    '.home.arpa',
    '.internal',
    '.localdomain',
];

function checkIsPrivateIpv4(hostname: string) {
    const match = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
    if (match === null) {
        return false;
    }
    const first = Number(match[1]);
    const second = Number(match[2]);
    return (
        first === 10 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        (first === 169 && second === 254) ||
        // Shared address space: what Tailscale and carrier NAT hand out.
        (first === 100 && second >= 64 && second <= 127)
    );
}

/**
 * Whether the server is on this computer or on the church's own network --
 * a machine somebody here owns, so a question to it costs nothing and, when
 * it stops answering, the thing to check is that machine. Read off the
 * ADDRESS only, never by asking the network.
 */
export function checkIsLocalNetworkUrl(value: unknown): boolean {
    if (checkIsLoopbackUrl(value)) {
        return true;
    }
    const hostname = toHostname(value);
    if (hostname === null) {
        return false;
    }
    if (hostname.startsWith('[')) {
        // Unique-local (fc00::/7) and link-local (fe80::/10) IPv6.
        return /^\[(f[cd][0-9a-f]{0,2}|fe[89ab][0-9a-f]?):/.test(hostname);
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
        return checkIsPrivateIpv4(hostname);
    }
    return (
        !hostname.includes('.') ||
        LOCAL_NAME_SUFFIX_LIST.some((suffix) => {
            return hostname.endsWith(suffix);
        })
    );
}

/**
 * The minimum context a model must be LOADED with for the assistant to work
 * at all, and the size it works comfortably in. Measured 2026-10-09 against
 * LM Studio (qwen3.5-9b): the instructions and the tool list alone are ~13 400
 * tokens, and the third round of an ordinary how-do-I reached 15 300 -- so
 * 16k answers the first question and runs out on a follow-up.
 */
export const CUSTOM_CONTEXT_MIN = 16 * 1024;
export const CUSTOM_CONTEXT_COMFORTABLE = 32 * 1024;

/** `16384` -> `16k`, the way LM Studio's own load settings write it. */
export function toContextLabel(tokens: number) {
    return `${Math.round(tokens / 1024)}k`;
}

/**
 * Which program a server turned out to be, read off what it answers at its
 * root (`readCustomServerModelInfo`): LM Studio has its own model list,
 * Ollama its own two, llama.cpp's server (llamafile too) its `/props`, and
 * anything else -- LocalAI, Jan, GPT4All, vLLM, SGLang, a LiteLLM proxy --
 * is asked nothing but the protocol, which is all it needs. Never stored:
 * the program at an address can change.
 */
export type CustomServerKindType =
    'lm-studio' | 'ollama' | 'llama-cpp' | 'other';

/** The program's name for a sentence, when it has one. */
export function toCustomServerKindLabel(kind: CustomServerKindType) {
    switch (kind) {
        case 'lm-studio':
            return 'LM Studio';
        case 'ollama':
            return 'Ollama';
        case 'llama-cpp':
            return 'llama.cpp';
        default:
            return 'the server';
    }
}

/**
 * What a server says about one of its models, the same three things
 * whichever program said them.
 */
export type CustomModelInfoType = {
    // Whether it sits in memory now. A not-loaded one is loaded by the
    // server on the first question (LM Studio when its "JIT" loading is on,
    // Ollama always), which takes a while.
    isLoaded: boolean;
    // The context it is loaded with; null when not loaded.
    loadedContext: number | null;
    // The most it could be loaded with.
    maxContext: number | null;
    canSeeImages: boolean;
};

function toPositiveInteger(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : null;
}

/**
 * LM Studio's own model list (`LM_STUDIO_MODELS_PATH`), by model id, read
 * as untrusted. Null when the text is not that list -- the server is not LM
 * Studio, or an older one -- which every caller treats as "not known".
 */
export function toLmStudioModelInfoMap(
    text: string,
): Map<string, CustomModelInfoType> | null {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }
    if (!Array.isArray(data?.data)) {
        return null;
    }
    const infoMap = new Map<string, CustomModelInfoType>();
    for (const item of data.data) {
        const id = typeof item?.id === 'string' ? item.id.trim() : '';
        if (id.length === 0 || id.length > CUSTOM_MODEL_MAX) {
            continue;
        }
        const isLoaded = item.state === 'loaded';
        infoMap.set(id, {
            isLoaded,
            loadedContext: isLoaded
                ? toPositiveInteger(item.loaded_context_length)
                : null,
            maxContext: toPositiveInteger(item.max_context_length),
            canSeeImages: item.type === 'vlm',
        });
        if (infoMap.size >= MAX_CUSTOM_MODELS * 4) {
            break;
        }
    }
    return infoMap;
}

/**
 * One of Ollama's two lists (`{models: [...]}`), or null when the text is
 * not one -- the server is not Ollama.
 */
function toOllamaModelList(text: string): any[] | null {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }
    return Array.isArray(data?.models) ? data.models : null;
}

/** The id Ollama's OpenAI door lists a model under: `qwen3.5:4b`. */
function toOllamaModelId(item: any): string {
    const value = typeof item?.model === 'string' ? item.model : item?.name;
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Ollama's own word on its models, from the list of what it has
 * (`OLLAMA_TAGS_PATH`) and the list of what is in memory (`OLLAMA_PS_PATH`),
 * read as untrusted. Null when the first is not Ollama's list; a second that
 * is missing or not a list means nothing is loaded. Measured 2026-10-10 on
 * Ollama 0.40: `/api/tags` names each model's `capabilities` (`vision`,
 * `tools`, `completion`, ...) and `details.context_length`, the most it could
 * take; `/api/ps` gives the `context_length` it is loaded with -- which was
 * 2050 on the model tried, pinned by its own Modelfile, and no request can
 * raise it through the OpenAI door.
 */
export function toOllamaModelInfoMap(
    tagsText: string,
    psText: string | null,
): Map<string, CustomModelInfoType> | null {
    const tags = toOllamaModelList(tagsText);
    if (tags === null) {
        return null;
    }
    const loaded = psText === null ? [] : (toOllamaModelList(psText) ?? []);
    const infoMap = new Map<string, CustomModelInfoType>();
    for (const item of tags) {
        const id = toOllamaModelId(item);
        if (id.length === 0 || id.length > CUSTOM_MODEL_MAX) {
            continue;
        }
        const running = loaded.find((one) => {
            return toOllamaModelId(one) === id;
        });
        const capabilities: unknown[] = Array.isArray(item?.capabilities)
            ? item.capabilities
            : [];
        infoMap.set(id, {
            isLoaded: running !== undefined,
            loadedContext:
                running === undefined
                    ? null
                    : toPositiveInteger(running.context_length),
            maxContext: toPositiveInteger(item?.details?.context_length),
            canSeeImages: capabilities.indexOf('vision') !== -1,
        });
        if (infoMap.size >= MAX_CUSTOM_MODELS * 4) {
            break;
        }
    }
    return infoMap;
}

/**
 * What llama.cpp's server says about the one model it runs
 * (`LLAMA_CPP_PROPS_PATH`), read as untrusted: null when the text is not
 * that answer. It is always loaded -- the server IS the model -- with the
 * context each slot was started with, which is what the conversation has
 * to fit; the model's own ceiling is not said. Pictures when the server
 * was started with a projector (`modalities.vision`, newer builds).
 */
export function toLlamaCppModelInfo(text: string): CustomModelInfoType | null {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }
    const settings = data?.default_generation_settings;
    if (settings === null || typeof settings !== 'object') {
        return null;
    }
    return {
        isLoaded: true,
        loadedContext: toPositiveInteger(settings.n_ctx),
        maxContext: null,
        canSeeImages: data?.modalities?.vision === true,
    };
}

function toValidModels(raw: unknown): CustomModelType[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const seenIds = new Set<string>();
    const models: CustomModelType[] = [];
    for (const item of raw) {
        if (models.length >= MAX_CUSTOM_MODELS) {
            break;
        }
        const id = item?.id;
        if (typeof id !== 'string' || !ID_PATTERN.test(id) || seenIds.has(id)) {
            continue;
        }
        seenIds.add(id);
        models.push({
            id,
            model: toTrimmedString(item.model, CUSTOM_MODEL_MAX),
            name: toTrimmedString(item.name, CUSTOM_NAME_MAX),
            // Kept only when true, so a row nobody ticked stays three fields.
            ...(item.canSeeImages === true ? { canSeeImages: true } : {}),
        });
    }
    return models;
}

/**
 * The stored list, read as untrusted: it is a file on disk. Lists the fields
 * it copies rather than spreading, so nothing else rides along, and keeps a
 * half-filled server (no URL yet, no models yet) so the person can finish it.
 */
export function toValidCustomServers(raw: unknown): CustomServerType[] {
    let data = raw;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (_error) {
            return [];
        }
    }
    const list = (data as any)?.servers;
    if (!Array.isArray(list)) {
        return [];
    }
    const seenIds = new Set<string>();
    const servers: CustomServerType[] = [];
    for (const item of list) {
        if (servers.length >= MAX_CUSTOM_SERVERS) {
            break;
        }
        const id = item?.id;
        if (typeof id !== 'string' || !ID_PATTERN.test(id) || seenIds.has(id)) {
            continue;
        }
        seenIds.add(id);
        servers.push({
            id,
            name: toTrimmedString(item.name, CUSTOM_NAME_MAX),
            baseUrl: toTrimmedString(item.baseUrl, CUSTOM_URL_MAX),
            models: toValidModels(item.models),
        });
    }
    return servers;
}

export function toCustomServersText(servers: CustomServerType[]) {
    return JSON.stringify({ servers: toValidCustomServers({ servers }) });
}

/** `{serverId: apiKey}`, read as untrusted, blanks dropped. */
export function toValidCustomServerKeys(raw: unknown): Record<string, string> {
    let data = raw;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (_error) {
            return {};
        }
    }
    const keys: Record<string, string> = {};
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        return keys;
    }
    for (const [serverId, value] of Object.entries(data)) {
        const key = toTrimmedString(value, CUSTOM_KEY_MAX);
        if (ID_PATTERN.test(serverId) && key.length > 0) {
            keys[serverId] = key;
        }
    }
    return keys;
}

/** The rows that name a model, in the order the person put them. */
export function getUsableCustomModels(server: CustomServerType) {
    return server.models.filter((one) => {
        return one.model.length > 0;
    });
}

/**
 * Whether the chatbot may offer this server: a name to show, an address it
 * can reach, and at least one model to ask. Whether the server ANSWERS is the
 * Test button's to find out; a server that is merely switched off today is
 * still the person's choice to keep in the list.
 */
export function checkIsUsableCustomServer(server: CustomServerType) {
    return (
        server.name.length > 0 &&
        toCustomServerBaseUrl(server.baseUrl) !== null &&
        getUsableCustomModels(server).length > 0
    );
}

/**
 * A chatbot model id for one row of one server: `<serverId>/<rowId>`. Ids,
 * not the model's own name, so renaming a row keeps every tab that asks it;
 * and safe as a setting VALUE (setting KEYS become file names).
 */
export function encodeCustomModel(serverId: string, rowId: string) {
    return `${serverId}/${rowId}`;
}

export function decodeCustomModel(
    value: unknown,
): { serverId: string; rowId: string } | null {
    if (typeof value !== 'string') {
        return null;
    }
    const parts = value.split('/');
    if (
        parts.length !== 2 ||
        !ID_PATTERN.test(parts[0]) ||
        !ID_PATTERN.test(parts[1])
    ) {
        return null;
    }
    return { serverId: parts[0], rowId: parts[1] };
}

/** The server and row a chatbot model id points at, when both still exist. */
export function findCustomModel(
    servers: CustomServerType[],
    value: unknown,
): { server: CustomServerType; row: CustomModelType } | null {
    const decoded = decodeCustomModel(value);
    if (decoded === null) {
        return null;
    }
    const server = servers.find((one) => {
        return one.id === decoded.serverId;
    });
    const row = server?.models.find((one) => {
        return one.id === decoded.rowId;
    });
    if (server === undefined || row === undefined || row.model.length === 0) {
        return null;
    }
    return { server, row };
}

/** What a model row is called in the chatbot. */
export function toCustomModelLabel(row: CustomModelType) {
    return row.name.length > 0 ? row.name : row.model;
}

/**
 * A custom server could not answer, with the sentence to say about it
 * already written -- "nothing answered at http://localhost:1234/v1 — check
 * that its server is running" -- because the generic reading of an error with
 * no HTTP status is "the internet may be down", which is wrong for a server
 * on this very computer. Recognised by NAME (`checkIsCustomServerError`), so a
 * test that mocks the module throwing it still matches.
 */
export const CUSTOM_SERVER_ERROR_NAME = 'CustomServerError';

export class CustomServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = CUSTOM_SERVER_ERROR_NAME;
    }
}

export function checkIsCustomServerError(error: unknown): error is Error {
    return (
        (error as any)?.name === CUSTOM_SERVER_ERROR_NAME &&
        typeof (error as any)?.message === 'string'
    );
}
