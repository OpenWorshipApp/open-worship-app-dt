import {
    LLM_REGISTRY_URL,
    toPublicRegistryServers,
    toValidLlmRegistry,
    type LlmRegistryServerType,
    type LlmRegistryStatusType,
    type LlmRegistryType,
} from './customLlmProtocol';

/**
 * The shared LLM registry, held in the MAIN process: one small JSON file on
 * the project's own site naming servers every copy of the app may ask
 * (`customLlmProtocol.ts` has the shape and the why). Read once at launch
 * (`initAi`) and again when the chatbot's Reload button is pressed; never on
 * a timer, because a church's internet is often metered and the list
 * changes when an admin changes it.
 *
 * Held here rather than in a window because the relay
 * (`customLlmRelayHelpers.ts`) forwards only to addresses main knows, and a
 * registry server's key must never enter a renderer: a window is told the
 * servers through `getLlmRegistryStatus`, keys left out.
 *
 * A read that fails keeps the servers of the last read that worked, and
 * says why in `error`: a volunteer whose internet dropped should not lose
 * the assistant they were using.
 */

const FETCH_TIMEOUT_MILLISECONDS = 8000;
// A registry is a list of a few servers; anything bigger is not one.
const MAX_BODY_BYTES = 256 * 1024;

type RegistryStateType = {
    registry: LlmRegistryType | null;
    fetchedAt: number | null;
    error: string | null;
};

const state: RegistryStateType = {
    registry: null,
    fetchedAt: null,
    error: null,
};

let inFlight: Promise<LlmRegistryStatusType> | null = null;

/** The official file, or a developer's own for a test (`OWA_LLM_REGISTRY_URL`). */
export function getLlmRegistryUrl() {
    const override = process.env.OWA_LLM_REGISTRY_URL;
    return typeof override === 'string' && override.trim().length > 0
        ? override.trim()
        : LLM_REGISTRY_URL;
}

export type LlmRegistryDepsType = {
    fetch: (url: string, init: RequestInit) => Promise<Response>;
    now?: () => number;
};

function describeReadFailure(error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
        return 'openworship.app did not answer in time';
    }
    const message = error instanceof Error ? error.message : String(error);
    return message.length > 0 && message.length < 160
        ? message
        : 'openworship.app could not be reached';
}

/**
 * Reads the registry afresh. One read at a time: a Reload pressed twice
 * shares the request. Resolves to the status in every case -- a failure is
 * a status with an `error`, never a rejection.
 */
export function refreshLlmRegistry(
    deps: LlmRegistryDepsType = { fetch: globalThis.fetch },
): Promise<LlmRegistryStatusType> {
    if (inFlight !== null) {
        return inFlight;
    }
    inFlight = readLlmRegistry(deps).finally(() => {
        inFlight = null;
    });
    return inFlight;
}

async function readLlmRegistry(
    deps: LlmRegistryDepsType,
): Promise<LlmRegistryStatusType> {
    const url = getLlmRegistryUrl();
    const now = deps.now ?? Date.now;
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, FETCH_TIMEOUT_MILLISECONDS);
    try {
        if (!/^https?:\/\//.test(url)) {
            throw new Error('the registry address is not a web address');
        }
        const response = await deps.fetch(url, {
            method: 'GET',
            headers: { accept: 'application/json' },
            signal: controller.signal,
            redirect: 'follow',
        });
        if (!response.ok) {
            throw new Error(
                `openworship.app answered ${response.status} for the registry`,
            );
        }
        const text = await response.text();
        if (text.length > MAX_BODY_BYTES) {
            throw new Error('the registry file is too large to be one');
        }
        const registry = toValidLlmRegistry(text);
        if (registry === null) {
            throw new Error('the registry file is not in the known shape');
        }
        state.registry = registry;
        state.fetchedAt = now();
        state.error = null;
    } catch (error) {
        state.error = describeReadFailure(error);
    } finally {
        clearTimeout(timer);
    }
    return getLlmRegistryStatus();
}

/** For the relay: the servers WITH their keys. Never sent to a window. */
export function getLlmRegistryServers(): LlmRegistryServerType[] {
    return state.registry?.servers ?? [];
}

/** For a window: the servers without their keys, and how the read went. */
export function getLlmRegistryStatus(): LlmRegistryStatusType {
    return {
        url: getLlmRegistryUrl(),
        servers: toPublicRegistryServers(getLlmRegistryServers()),
        fetchedAt: state.fetchedAt,
        error: state.error,
    };
}

/** Tests only: back to never read. */
export function resetLlmRegistryForTests() {
    state.registry = null;
    state.fetchedAt = null;
    state.error = null;
    inFlight = null;
}
