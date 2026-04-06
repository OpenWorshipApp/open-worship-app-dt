export type AgentDebugValueType =
    | null
    | boolean
    | number
    | string
    | AgentDebugValueType[]
    | { [key: string]: AgentDebugValueType };

type AgentDebugInputValue =
    | AgentDebugValueType
    | { [key: string]: unknown }
    | unknown[];

type AgentDebugProviderType = () =>
    | AgentDebugInputValue
    | Promise<AgentDebugInputValue>;

export type AgentDebugSnapshotType = {
    title: string;
    locationHref: string;
    registeredData: Record<string, AgentDebugValueType>;
    providerData: Record<string, AgentDebugValueType>;
    timestamp: string;
};

export type AgentDebugBridgeType = {
    getSnapshot: () => Promise<AgentDebugSnapshotType>;
    setData: (key: string, value: unknown) => void;
    clearData: (key: string) => void;
    registerProvider: (
        key: string,
        provider: AgentDebugProviderType,
    ) => () => void;
};

declare global {
    interface Window {
        __OPEN_WORSHIP_AGENT_DEBUG__?: AgentDebugBridgeType;
    }
}

const AGENT_DEBUG_BRIDGE_KEY = '__OPEN_WORSHIP_AGENT_DEBUG__';
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_ENTRIES = 50;
const MAX_STRING_LENGTH = 5000;

function sanitizeAgentDebugValue(
    value: unknown,
    depth = 0,
): AgentDebugValueType {
    if (depth > MAX_DEPTH) {
        return '[max-depth]';
    }
    if (value === null || value === undefined) {
        return value ?? null;
    }
    if (typeof value === 'string') {
        return value.length > MAX_STRING_LENGTH
            ? value.slice(0, MAX_STRING_LENGTH)
            : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY_ITEMS).map((item) => {
            return sanitizeAgentDebugValue(item, depth + 1);
        });
    }
    if (typeof value === 'object') {
        const result: { [key: string]: AgentDebugValueType } = {};
        for (const [key, item] of Object.entries(value).slice(
            0,
            MAX_OBJECT_ENTRIES,
        )) {
            result[key] = sanitizeAgentDebugValue(item, depth + 1);
        }
        return result;
    }
    return `[unsupported:${typeof value}]`;
}

export function initAgentDebugBridge() {
    const existingBridge = (globalThis as any)[AGENT_DEBUG_BRIDGE_KEY] as
        | AgentDebugBridgeType
        | undefined;
    if (existingBridge) {
        return existingBridge;
    }
    const registeredData = new Map<string, AgentDebugValueType>();
    const providers = new Map<string, AgentDebugProviderType>();
    const bridge: AgentDebugBridgeType = {
        async getSnapshot() {
            const providerEntries = await Promise.all(
                Array.from(providers.entries()).map(async ([key, provider]) => {
                    try {
                        const value = await provider();
                        return [key, sanitizeAgentDebugValue(value)] as const;
                    } catch (error) {
                        return [
                            key,
                            sanitizeAgentDebugValue({
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            }),
                        ] as const;
                    }
                }),
            );
            return {
                title: document.title,
                locationHref: globalThis.location?.href ?? '',
                registeredData: Object.fromEntries(registeredData.entries()),
                providerData: Object.fromEntries(providerEntries),
                timestamp: new Date().toISOString(),
            };
        },
        setData(key: string, value: unknown) {
            registeredData.set(key, sanitizeAgentDebugValue(value));
        },
        clearData(key: string) {
            registeredData.delete(key);
        },
        registerProvider(key: string, provider: AgentDebugProviderType) {
            providers.set(key, provider);
            return () => {
                providers.delete(key);
            };
        },
    };
    (globalThis as any)[AGENT_DEBUG_BRIDGE_KEY] = bridge;
    return bridge;
}

export function setAgentDebugData(key: string, value: unknown) {
    const bridge = initAgentDebugBridge();
    bridge.setData(key, value);
}

export function clearAgentDebugData(key: string) {
    const bridge = initAgentDebugBridge();
    bridge.clearData(key);
}

export function registerAgentDebugProvider(
    key: string,
    provider: AgentDebugProviderType,
) {
    const bridge = initAgentDebugBridge();
    return bridge.registerProvider(key, provider);
}
