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
 * The only three calls the relay forwards. Everything else a server might
 * answer -- embeddings, file uploads, model loading, admin routes -- is
 * refused, because nothing in the chatbot needs it.
 */
export type CustomLlmCallType =
    | { method: 'GET'; path: '/models' }
    | { method: 'GET'; path: typeof LM_STUDIO_MODELS_PATH }
    | { method: 'POST'; path: '/chat/completions' };

export function checkIsAllowedCustomLlmCall(
    method: unknown,
    path: unknown,
): boolean {
    return (
        (method === 'GET' && path === '/models') ||
        (method === 'GET' && path === LM_STUDIO_MODELS_PATH) ||
        (method === 'POST' && path === '/chat/completions')
    );
}

/**
 * The address one allowed call goes to: under the base URL, except LM
 * Studio's own list, which is at the root of a `/v1` address and nowhere
 * else -- under a proxy's longer path the root may be somebody else's.
 */
export function toCustomLlmCallUrl(baseUrl: string, path: string) {
    if (path !== LM_STUDIO_MODELS_PATH) {
        return `${baseUrl}${path}`;
    }
    const url = new URL(baseUrl);
    return url.pathname === '/v1' ? `${url.origin}${path}` : null;
}

export type CustomLlmFetchRequestType = {
    serverId: string;
    method: string;
    path: string;
    body?: string;
    requestId: string;
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

export type LmStudioModelInfoType = {
    // Whether it sits in memory now. A not-loaded one is loaded by the
    // server on the first question (when its "JIT" loading is on), which
    // takes a while.
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
): Map<string, LmStudioModelInfoType> | null {
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        return null;
    }
    if (!Array.isArray(data?.data)) {
        return null;
    }
    const infoMap = new Map<string, LmStudioModelInfoType>();
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
