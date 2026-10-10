import { useState } from 'react';

import { useAppEffect } from '../appHooks';
import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';
import appProvider from '../../server/appProvider';
import { electronSendAsync } from '../../server/electronSendHelpers';
import {
    CUSTOM_KEY_MAX,
    CUSTOM_LLM_CANCEL_CHANNEL,
    CUSTOM_LLM_FETCH_CHANNEL,
    CUSTOM_LLM_KEYS_SETTING_KEY,
    CUSTOM_LLM_SERVERS_SETTING_KEY,
    LLAMA_CPP_PROPS_PATH,
    LM_STUDIO_MODELS_PATH,
    OLLAMA_PS_PATH,
    OLLAMA_TAGS_PATH,
    checkIsLoopbackUrl,
    checkIsUsableCustomServer,
    genCustomServerAddressCandidates,
    toCustomLlmCallUrl,
    toCustomServerBaseUrl,
    toLlamaCppModelInfo,
    toLmStudioModelInfoMap,
    toOllamaModelInfoMap,
    toCustomServersText,
    toValidCustomServerKeys,
    toValidCustomServers,
    type CustomLlmFetchRequestType,
    type CustomLlmFetchResultType,
    type CustomModelInfoType,
    type CustomModelType,
    type CustomServerKindType,
    type CustomServerType,
} from '../../../electron/customLlmProtocol';

/**
 * The custom model servers the user added in Settings -> Others (LM Studio,
 * Ollama, ...): the list, its encrypted keys, and the calls the Settings panel
 * makes through the main-process relay. No SDK here -- the panel needs none,
 * and the chatbot's client lives in `customServerClientHelpers`.
 *
 * Read fresh every time, never cached: `appHomeStorage` is an uncached sync
 * read, and the list is edited in one window and read in another.
 */

export function getCustomServers(): CustomServerType[] {
    return toValidCustomServers(
        appHomeStorage.getItem(CUSTOM_LLM_SERVERS_SETTING_KEY),
    );
}

export function getUsableCustomServers(): CustomServerType[] {
    return getCustomServers().filter(checkIsUsableCustomServer);
}

const changingListener = new Set<() => void>();

function notifyChanging() {
    for (const listener of changingListener) {
        listener();
    }
}

export function setCustomServers(servers: CustomServerType[]) {
    appHomeStorage.setItem(
        CUSTOM_LLM_SERVERS_SETTING_KEY,
        toCustomServersText(servers),
    );
    notifyChanging();
}

export function useCustomServers() {
    const [servers, setServers] = useState(getCustomServers);
    useAppEffect(() => {
        const listener = () => {
            setServers(getCustomServers());
        };
        changingListener.add(listener);
        return () => {
            changingListener.delete(listener);
        };
    }, []);
    return servers;
}

function getCustomServerKeys() {
    return toValidCustomServerKeys(
        appSecureStorage.getItem(CUSTOM_LLM_KEYS_SETTING_KEY),
    );
}

/** For the Settings box only; the chatbot never reads a custom key. */
export function getCustomServerKey(serverId: string) {
    return getCustomServerKeys()[serverId] ?? '';
}

/**
 * Written as ONE object and then asked whether it holds anything, like
 * `setAISetting`: a key removed must not leave a blob behind.
 */
export function setCustomServerKey(serverId: string, key: string) {
    const keys = getCustomServerKeys();
    const trimmedKey = key.trim().slice(0, CUSTOM_KEY_MAX);
    if (trimmedKey.length > 0) {
        keys[serverId] = trimmedKey;
    } else {
        delete keys[serverId];
    }
    if (Object.keys(keys).length === 0) {
        appSecureStorage.removeItem(CUSTOM_LLM_KEYS_SETTING_KEY);
    } else {
        appSecureStorage.setItem(
            CUSTOM_LLM_KEYS_SETTING_KEY,
            JSON.stringify(keys),
        );
    }
    notifyChanging();
}

export function genCustomServer(): CustomServerType {
    return { id: crypto.randomUUID(), name: '', baseUrl: '', models: [] };
}

export function genCustomModelRow(model = '', name = ''): CustomModelType {
    return { id: crypto.randomUUID(), model, name };
}

/** One call through the relay. Never rejects for anything the network did. */
export function requestCustomLlm(
    request: Omit<CustomLlmFetchRequestType, 'requestId'>,
    requestId: string = crypto.randomUUID(),
) {
    return electronSendAsync<CustomLlmFetchResultType>(
        CUSTOM_LLM_FETCH_CHANNEL,
        { ...request, requestId },
    );
}

export function cancelCustomLlmRequest(requestId: string) {
    appProvider.messageUtils.sendData(CUSTOM_LLM_CANCEL_CHANNEL, {
        requestId,
    });
}

/**
 * What went wrong, in a phrase that reads after "<server> could not answer —"
 * and on its own in Settings. No closing stop: the window adds one.
 */
export function describeCustomLlmFailure(
    result: Extract<CustomLlmFetchResultType, { ok: false }>,
    baseUrl: string,
) {
    // On this computer, the thing to check is the program; anywhere else,
    // first the machine -- the LM Studio box down the hall that went to sleep
    // mid-question is how this sentence came to be written twice.
    const toCheck = checkIsLoopbackUrl(baseUrl)
        ? 'check that its server is running'
        : 'check that the computer it runs on is on and awake, and that ' +
          'its server is running';
    switch (result.reason) {
        case 'unreachable':
            return (
                `nothing answered at ${toCustomServerBaseUrl(baseUrl) ?? baseUrl}` +
                ` — ${toCheck}`
            );
        case 'lost':
            return `it went quiet in the middle of the question — ${toCheck}`;
        case 'timeout':
            return 'the server took too long to answer';
        case 'ai-off':
            return 'AI features are turned off in Settings';
        case 'unknown-server':
            return 'this server is no longer in Settings';
        case 'bad-url':
            return 'the server address is not a web address';
        case 'redirect':
            return 'the server sent the request to another address';
        case 'too-large':
            return 'the server answered with too much';
        case 'cancelled':
            return 'stopped';
        default:
            return 'that call is not one the chatbot makes';
    }
}

/** The server's own sentence out of an error body, when it wrote one. */
export function readServerErrorMessage(text: string): string {
    try {
        const data = JSON.parse(text);
        const message =
            typeof data?.error === 'string'
                ? data.error
                : (data?.error?.message ?? data?.message);
        return typeof message === 'string' ? message.trim().slice(0, 200) : '';
    } catch (_error) {
        return '';
    }
}

// Ids a chat model is never called: embedding and reranking models answer
// `/models` beside the chat ones and cannot hold a conversation.
const NOT_CHAT_MODEL_PATTERN = /embed|rerank|whisper|tts/i;

export type CustomServerModelsAnswerType =
    | {
          ok: true;
          models: string[];
          // Set when the list came from another address of the same server
          // than the one saved (`genCustomServerAddressCandidates`): the one
          // to save instead.
          correctedBaseUrl?: string;
      }
    | { ok: false; message: string };

type ModelListReadType =
    | { ok: true; models: string[] }
    | {
          ok: false;
          message: string;
          // The address answered, but not with the protocol -- a 404 page,
          // or something that is not a model list -- so the protocol may
          // live at another path of the same server.
          isWrongPath: boolean;
      };

// What every popular server's address looks like, for the sentence that
// says the typed one answered nothing.
const ADDRESS_EXAMPLES_TEXT =
    'Ollama: http://localhost:11434/v1, LM Studio: http://localhost:1234/v1';

async function readCustomServerModelList(
    server: CustomServerType,
    probeBaseUrl?: string,
): Promise<ModelListReadType> {
    const result = await requestCustomLlm({
        serverId: server.id,
        method: 'GET',
        path: '/models',
        ...(probeBaseUrl === undefined ? {} : { probeBaseUrl }),
    });
    if (!result.ok) {
        return {
            ok: false,
            message: describeCustomLlmFailure(
                result,
                probeBaseUrl ?? server.baseUrl,
            ),
            isWrongPath: false,
        };
    }
    if (result.status < 200 || result.status >= 300) {
        const reason = readServerErrorMessage(result.text);
        return {
            ok: false,
            message:
                result.status === 401 || result.status === 403
                    ? 'the server refused the API key'
                    : `the server answered ${result.status}` +
                      (reason.length > 0 ? `: ${reason}` : ''),
            isWrongPath: result.status === 404,
        };
    }
    let data: any;
    try {
        data = JSON.parse(result.text);
    } catch (_error) {
        data = null;
    }
    const list = Array.isArray(data?.data) ? data.data : null;
    if (list === null) {
        return {
            ok: false,
            message: 'the server did not answer with a model list',
            isWrongPath: true,
        };
    }
    const models: string[] = [];
    for (const item of list) {
        const id = typeof item?.id === 'string' ? item.id.trim() : '';
        if (
            id.length > 0 &&
            !NOT_CHAT_MODEL_PATTERN.test(id) &&
            !models.includes(id)
        ) {
            models.push(id);
        }
    }
    return { ok: true, models };
}

/**
 * The chat models the server says it has -- the Test button's proof that the
 * address answers, and what "Load models from server" adds.
 *
 * When the saved address answers, but not with the protocol, the other
 * addresses of the same server are tried (`genCustomServerAddressCandidates`)
 * and the one that answers comes back as `correctedBaseUrl`, for the caller
 * to save: an address typed one path off -- Ollama's root, LM Studio's
 * without the `/v1`, Ollama's own `/v1/systemone` door -- is the commonest
 * way a server that is running answers nothing.
 */
export async function listCustomServerModels(
    server: CustomServerType,
): Promise<CustomServerModelsAnswerType> {
    const first = await readCustomServerModelList(server);
    if (first.ok) {
        return { ok: true, models: first.models };
    }
    if (!first.isWrongPath) {
        return { ok: false, message: first.message };
    }
    for (const candidate of genCustomServerAddressCandidates(server.baseUrl)) {
        const next = await readCustomServerModelList(server, candidate);
        if (next.ok) {
            return {
                ok: true,
                models: next.models,
                correctedBaseUrl: candidate,
            };
        }
    }
    return {
        ok: false,
        message:
            `${first.message} — nothing at this address speaks the OpenAI ` +
            `API; the address usually ends in /v1 (${ADDRESS_EXAMPLES_TEXT})`,
    };
}

export type CustomModelInfoMapType = Map<string, CustomModelInfoType>;

export type CustomServerInfoType = {
    kind: CustomServerKindType;
    // By the model id the server lists it under. Empty for a server that
    // says nothing about its models (`kind` other), and for one that runs a
    // single model under whatever id it was given (llama.cpp), whose word is
    // `commonInfo`.
    infoMap: CustomModelInfoMapType;
    // What the server says of every model it serves, when it says it of all
    // of them at once rather than by id.
    commonInfo: CustomModelInfoType | null;
};

/** What the server said about one model, by its id or of all of them. */
export function findCustomModelInfo(
    serverInfo: CustomServerInfoType | null,
    modelId: string,
): CustomModelInfoType | null {
    if (serverInfo === null) {
        return null;
    }
    return serverInfo.infoMap.get(modelId) ?? serverInfo.commonInfo;
}

/**
 * One call at the root of the server, given up at `deadline` (and the
 * relay told to drop it): the text of a 2xx answer, else null.
 */
async function readRootCallText(
    server: CustomServerType,
    path: string,
    deadline: number,
): Promise<string | null> {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
        return null;
    }
    const requestId = crypto.randomUUID();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
            cancelCustomLlmRequest(requestId);
            resolve(null);
        }, remaining);
    });
    const reading = requestCustomLlm(
        { serverId: server.id, method: 'GET', path },
        requestId,
    ).then((result) => {
        if (!result.ok || result.status < 200 || result.status >= 300) {
            return null;
        }
        return result.text;
    });
    try {
        return await Promise.race([reading, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * What the server says about itself: which program it is, and for each
 * model whether it is loaded, the context it is loaded with and whether it
 * sees pictures -- LM Studio through its own list, Ollama through its two,
 * llama.cpp's server through `/props`, any other server nothing beyond
 * `kind` other. Null when the address is not shaped to be asked (only a
 * `/v1` address has a root worth asking) or the server answered nothing in
 * `timeoutMilliseconds` in all. Never held: what is loaded changes whenever
 * somebody uses the server.
 *
 * Bounded, because the chatbot asks it in front of a question: a machine
 * that is switched off takes ~20 s to fail a connection, and the question
 * itself will say so -- this must not make the person wait twice.
 */
export async function readCustomServerModelInfo(
    server: CustomServerType,
    timeoutMilliseconds = 60 * 1000,
): Promise<CustomServerInfoType | null> {
    const baseUrl = toCustomServerBaseUrl(server.baseUrl);
    if (
        baseUrl === null ||
        toCustomLlmCallUrl(baseUrl, LM_STUDIO_MODELS_PATH) === null
    ) {
        return null;
    }
    const deadline = Date.now() + timeoutMilliseconds;
    const lmStudioText = await readRootCallText(
        server,
        LM_STUDIO_MODELS_PATH,
        deadline,
    );
    if (lmStudioText !== null) {
        const infoMap = toLmStudioModelInfoMap(lmStudioText);
        if (infoMap !== null) {
            return { kind: 'lm-studio', infoMap, commonInfo: null };
        }
    }
    const tagsText = await readRootCallText(server, OLLAMA_TAGS_PATH, deadline);
    if (tagsText !== null) {
        const psText = await readRootCallText(server, OLLAMA_PS_PATH, deadline);
        const infoMap = toOllamaModelInfoMap(tagsText, psText);
        if (infoMap !== null) {
            return { kind: 'ollama', infoMap, commonInfo: null };
        }
    }
    const propsText = await readRootCallText(
        server,
        LLAMA_CPP_PROPS_PATH,
        deadline,
    );
    if (propsText !== null) {
        const commonInfo = toLlamaCppModelInfo(propsText);
        if (commonInfo !== null) {
            return { kind: 'llama-cpp', infoMap: new Map(), commonInfo };
        }
    }
    // Every door asked and none answered in time: the server is away, which
    // is not the same as a server that is simply something else.
    if (Date.now() >= deadline) {
        return null;
    }
    return { kind: 'other', infoMap: new Map(), commonInfo: null };
}

/**
 * The server's rows with every listed model present: new ones appended in the
 * server's order, rows already there kept with their ids and names, so a tab
 * asking one of them keeps asking it. When the server said which models see
 * pictures (LM Studio's `vlm`, Ollama's `vision`), every row it named takes
 * that answer -- the press asked the server, and the server knows.
 */
export function mergeCustomServerModels(
    server: CustomServerType,
    models: string[],
    infoMap: CustomModelInfoMapType | null = null,
): CustomServerType {
    const known = new Set(
        server.models.map((one) => {
            return one.model;
        }),
    );
    const added = models
        .filter((model) => {
            return !known.has(model);
        })
        .map((model) => {
            return genCustomModelRow(model);
        });
    const rows = [...server.models, ...added].map((row) => {
        const info = infoMap?.get(row.model);
        if (info === undefined) {
            return row;
        }
        const { canSeeImages: _old, ...rest } = row;
        return info.canSeeImages ? { ...rest, canSeeImages: true } : rest;
    });
    return { ...server, models: rows };
}
