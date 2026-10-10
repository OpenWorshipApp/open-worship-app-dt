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
    LM_STUDIO_MODELS_PATH,
    checkIsLoopbackUrl,
    checkIsUsableCustomServer,
    toCustomLlmCallUrl,
    toCustomServerBaseUrl,
    toLmStudioModelInfoMap,
    toCustomServersText,
    toValidCustomServerKeys,
    toValidCustomServers,
    type CustomLlmFetchRequestType,
    type CustomLlmFetchResultType,
    type CustomModelType,
    type CustomServerType,
    type LmStudioModelInfoType,
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
    { ok: true; models: string[] } | { ok: false; message: string };

/**
 * The chat models the server says it has -- the Test button's proof that the
 * address answers, and what "Load models from server" adds.
 */
export async function listCustomServerModels(
    server: CustomServerType,
): Promise<CustomServerModelsAnswerType> {
    const result = await requestCustomLlm({
        serverId: server.id,
        method: 'GET',
        path: '/models',
    });
    if (!result.ok) {
        return {
            ok: false,
            message: describeCustomLlmFailure(result, server.baseUrl),
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
        };
    }
    let data: any;
    try {
        data = JSON.parse(result.text);
    } catch (_error) {
        return {
            ok: false,
            message: 'the server did not answer with a model list',
        };
    }
    const list = Array.isArray(data?.data) ? data.data : null;
    if (list === null) {
        return {
            ok: false,
            message: 'the server did not answer with a model list',
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

export type LmStudioModelInfoMapType = Map<string, LmStudioModelInfoType>;

/**
 * What LM Studio says about its models -- loaded or not, the context each is
 * loaded with, which ones see pictures -- or null when the server is not LM
 * Studio, did not answer, or took longer than `timeoutMilliseconds`. Never
 * held: what is loaded changes whenever somebody uses LM Studio.
 *
 * Bounded, because the chatbot asks it in front of a question: a machine
 * that is switched off takes ~20 s to fail a connection, and the question
 * itself will say so -- this must not make the person wait twice.
 */
export async function readLmStudioModels(
    server: CustomServerType,
    timeoutMilliseconds = 60 * 1000,
): Promise<LmStudioModelInfoMapType | null> {
    const baseUrl = toCustomServerBaseUrl(server.baseUrl);
    if (
        baseUrl === null ||
        toCustomLlmCallUrl(baseUrl, LM_STUDIO_MODELS_PATH) === null
    ) {
        return null;
    }
    const requestId = crypto.randomUUID();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
            cancelCustomLlmRequest(requestId);
            resolve(null);
        }, timeoutMilliseconds);
    });
    const reading = requestCustomLlm(
        { serverId: server.id, method: 'GET', path: LM_STUDIO_MODELS_PATH },
        requestId,
    ).then((result) => {
        if (!result.ok || result.status < 200 || result.status >= 300) {
            return null;
        }
        return toLmStudioModelInfoMap(result.text);
    });
    try {
        return await Promise.race([reading, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * The server's rows with every listed model present: new ones appended in the
 * server's order, rows already there kept with their ids and names, so a tab
 * asking one of them keeps asking it. When LM Studio said which models see
 * pictures, every row it named takes that answer -- the press asked the
 * server, and the server knows.
 */
export function mergeCustomServerModels(
    server: CustomServerType,
    models: string[],
    infoMap: LmStudioModelInfoMapType | null = null,
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
