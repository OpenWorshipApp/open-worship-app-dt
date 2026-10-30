// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    homeStore: new Map<string, string>(),
    secureStore: new Map<string, string>(),
}));

function genStorage(store: Map<string, string>) {
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
    };
}

// `appHooks` picks `useEffect` itself when this says it is not dev.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: genStorage(h.homeStore),
}));
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: genStorage(h.secureStore),
}));

import type { AISettingType } from './aiHelpers';
import { setAISetting, setIsAIEnabled, useAISetting } from './aiHelpers';

function genSetting(value: Partial<AISettingType>): AISettingType {
    return {
        openAIAPIKey: '',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        bedrockAPIKey: '',
        anthropicWorkspaceId: '',
        bedrockRegion: 'us-west-2',
        isAutoPlay: false,
        ...value,
    };
}

let host: HTMLDivElement;
let root: Root;
let seen: AISettingType[];

function ProbeComp() {
    seen.push(useAISetting());
    return null;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.homeStore.clear();
    h.secureStore.clear();
    seen = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('useAISetting', () => {
    test('starts from what is stored', async () => {
        setAISetting(genSetting({ kimiAPIKey: 'sk-kimi' }));
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)?.kimiAPIKey).toBe('sk-kimi');
    });

    test('redraws with a key saved in Settings while it is shown', async () => {
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)?.openAIAPIKey).toBe('');

        await act(async () => {
            setAISetting(
                genSetting({ openAIAPIKey: 'sk-new', isAutoPlay: true }),
            );
        });
        expect(seen.at(-1)).toMatchObject({
            openAIAPIKey: 'sk-new',
            isAutoPlay: true,
        });
    });

    test('redraws when the master switch is flipped', async () => {
        setAISetting(genSetting({ openAIAPIKey: 'sk', isAutoPlay: true }));
        await act(async () => root.render(<ProbeComp />));
        expect(seen.at(-1)?.isAutoPlay).toBe(true);

        await act(async () => {
            setIsAIEnabled(false);
        });
        expect(seen.at(-1)?.isAutoPlay).toBe(false);
    });

    test('stops listening once unmounted', async () => {
        await act(async () => root.render(<ProbeComp />));
        await act(async () => root.unmount());
        const renderCount = seen.length;
        setAISetting(genSetting({ anthropicAPIKey: 'sk-ant' }));
        setIsAIEnabled(true);
        expect(seen).toHaveLength(renderCount);
        root = createRoot(host);
    });
});
