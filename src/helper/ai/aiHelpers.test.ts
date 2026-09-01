/**
 * @vitest-environment jsdom
 */
// `appHooks` -> `appProvider` touches `document` at module scope.
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { homeStore, secureStore } = vi.hoisted(() => ({
    homeStore: new Map<string, string>(),
    secureStore: new Map<string, string>(),
}));

function genStorageMock(store: Map<string, string>) {
    return {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
            store.delete(key);
        }),
    };
}

// `appHooks` reads `systemUtils.isDev` at module load.
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: genStorageMock(homeStore),
}));
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: genStorageMock(secureStore),
}));

import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';
import {
    getAIIsAutoPlay,
    getAISetting,
    getIsAIEnabled,
    setAISetting,
    setIsAIEnabled,
} from './aiHelpers';

describe('aiHelpers secret splitting', () => {
    beforeEach(() => {
        homeStore.clear();
        secureStore.clear();
        // These tests are about where the keys go, not about the master
        // switch, which is off by default outside dev -- so they turn it on.
        homeStore.set('ai-enabled', 'true');
        vi.clearAllMocks();
    });

    test('the API keys go to the secure store and never to the plaintext one', () => {
        setAISetting({
            openAIAPIKey: '  sk-openai  ',
            anthropicAPIKey: 'sk-ant',
            anthropicWorkspaceId: '',
            isAutoPlay: true,
        });

        const plainValue = homeStore.get('ai-setting') as string;
        expect(plainValue).not.toContain('sk-openai');
        expect(plainValue).not.toContain('sk-ant');
        expect(JSON.parse(plainValue)).toEqual({
            isAutoPlay: true,
            anthropicWorkspaceId: '',
        });
        expect(
            JSON.parse(secureStore.get('ai-setting-secret') as string),
        ).toEqual({ openAIAPIKey: 'sk-openai', anthropicAPIKey: 'sk-ant' });
    });

    test('the merged read is unchanged for callers', () => {
        setAISetting({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: 'sk-ant',
            anthropicWorkspaceId: '',
            isAutoPlay: true,
        });

        expect(getAISetting()).toEqual({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: 'sk-ant',
            anthropicWorkspaceId: '',
            isAutoPlay: true,
        });
    });

    test('auto play cannot survive without the OpenAI key it needs', () => {
        setAISetting({
            openAIAPIKey: '',
            anthropicAPIKey: 'sk-ant',
            anthropicWorkspaceId: '',
            isAutoPlay: true,
        });

        // normalised at write time, so the plaintext half is self consistent
        expect(JSON.parse(homeStore.get('ai-setting') as string)).toEqual({
            isAutoPlay: false,
            anthropicWorkspaceId: '',
        });
        expect(getAISetting().isAutoPlay).toBe(false);

        // and again at read time, for a store edited behind the app's back
        homeStore.set('ai-setting', JSON.stringify({ isAutoPlay: true }));
        secureStore.delete('ai-setting-secret');
        expect(getAISetting().isAutoPlay).toBe(false);
    });

    test('two empty keys leave no phantom blob behind', () => {
        setAISetting({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: '',
            anthropicWorkspaceId: '',
            isAutoPlay: false,
        });
        expect(secureStore.has('ai-setting-secret')).toBe(true);

        setAISetting({
            openAIAPIKey: '',
            anthropicAPIKey: '',
            anthropicWorkspaceId: '',
            isAutoPlay: false,
        });
        expect(secureStore.has('ai-setting-secret')).toBe(false);
        expect(appSecureStorage.removeItem).toHaveBeenCalledWith(
            'ai-setting-secret',
        );
    });

    test('getAIIsAutoPlay never decrypts the API keys', () => {
        setAISetting({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: '',
            anthropicWorkspaceId: '',
            isAutoPlay: true,
        });
        vi.clearAllMocks();

        expect(getAIIsAutoPlay()).toBe(true);
        expect(appSecureStorage.getItem).not.toHaveBeenCalled();
        // Two plaintext reads and no decryption: the master switch
        // (`ai-enabled`) and the auto-play flag.
        expect(appHomeStorage.getItem).toHaveBeenCalledTimes(2);
        expect(appHomeStorage.getItem).toHaveBeenCalledWith('ai-enabled');
    });

    test('the workspace id rides in the plaintext half', () => {
        setAISetting({
            openAIAPIKey: '',
            anthropicAPIKey: 'sk-ant',
            anthropicWorkspaceId: '  wrkspc_123  ',
            isAutoPlay: false,
        });

        // An id, not a credential: readable on disk, and trimmed on the way in.
        expect(
            JSON.parse(homeStore.get('ai-setting') as string)
                .anthropicWorkspaceId,
        ).toBe('wrkspc_123');
        expect(getAISetting().anthropicWorkspaceId).toBe('wrkspc_123');
    });

    test('the master switch turns auto play off whatever is stored', () => {
        setAISetting({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: '',
            anthropicWorkspaceId: '',
            isAutoPlay: true,
        });
        expect(getAIIsAutoPlay()).toBe(true);

        setIsAIEnabled(false);

        expect(getIsAIEnabled()).toBe(false);
        expect(getAIIsAutoPlay()).toBe(false);
    });

    // The switch decides whether the main process opens a debugging endpoint
    // and an MCP host at all, and both drive a renderer with node
    // integration. An install that has never been asked gets neither.
    test('an unwritten switch is off outside dev, and on in dev', async () => {
        homeStore.delete('ai-enabled');
        expect(getIsAIEnabled()).toBe(false);

        const appProvider = (await import('../../server/appProvider')).default;
        appProvider.systemUtils.isDev = true;
        try {
            expect(getIsAIEnabled()).toBe(true);
        } finally {
            appProvider.systemUtils.isDev = false;
        }
    });

    test('an explicit choice wins over the default', () => {
        setIsAIEnabled(true);
        expect(getIsAIEnabled()).toBe(true);
        setIsAIEnabled(false);
        expect(getIsAIEnabled()).toBe(false);
    });

    test('an unreadable store reads as empty rather than throwing', () => {
        homeStore.set('ai-setting', 'not json');
        secureStore.set('ai-setting-secret', 'not json either');

        expect(getAISetting()).toEqual({
            openAIAPIKey: '',
            anthropicAPIKey: '',
            anthropicWorkspaceId: '',
            isAutoPlay: false,
        });
        expect(getAIIsAutoPlay()).toBe(false);
    });
});
