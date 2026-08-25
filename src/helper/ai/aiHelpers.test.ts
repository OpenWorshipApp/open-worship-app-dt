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
import { getAIIsAutoPlay, getAISetting, setAISetting } from './aiHelpers';

describe('aiHelpers secret splitting', () => {
    beforeEach(() => {
        homeStore.clear();
        secureStore.clear();
        vi.clearAllMocks();
    });

    test('the API keys go to the secure store and never to the plaintext one', () => {
        setAISetting({
            openAIAPIKey: '  sk-openai  ',
            anthropicAPIKey: 'sk-ant',
            isAutoPlay: true,
        });

        const plainValue = homeStore.get('ai-setting') as string;
        expect(plainValue).not.toContain('sk-openai');
        expect(plainValue).not.toContain('sk-ant');
        expect(JSON.parse(plainValue)).toEqual({ isAutoPlay: true });
        expect(
            JSON.parse(secureStore.get('ai-setting-secret') as string),
        ).toEqual({ openAIAPIKey: 'sk-openai', anthropicAPIKey: 'sk-ant' });
    });

    test('the merged read is unchanged for callers', () => {
        setAISetting({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: 'sk-ant',
            isAutoPlay: true,
        });

        expect(getAISetting()).toEqual({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: 'sk-ant',
            isAutoPlay: true,
        });
    });

    test('auto play cannot survive without the OpenAI key it needs', () => {
        setAISetting({
            openAIAPIKey: '',
            anthropicAPIKey: 'sk-ant',
            isAutoPlay: true,
        });

        // normalised at write time, so the plaintext half is self consistent
        expect(JSON.parse(homeStore.get('ai-setting') as string)).toEqual({
            isAutoPlay: false,
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
            isAutoPlay: false,
        });
        expect(secureStore.has('ai-setting-secret')).toBe(true);

        setAISetting({
            openAIAPIKey: '',
            anthropicAPIKey: '',
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
            isAutoPlay: true,
        });
        vi.clearAllMocks();

        expect(getAIIsAutoPlay()).toBe(true);
        expect(appSecureStorage.getItem).not.toHaveBeenCalled();
        expect(appHomeStorage.getItem).toHaveBeenCalledTimes(1);
    });

    test('an unreadable store reads as empty rather than throwing', () => {
        homeStore.set('ai-setting', 'not json');
        secureStore.set('ai-setting-secret', 'not json either');

        expect(getAISetting()).toEqual({
            openAIAPIKey: '',
            anthropicAPIKey: '',
            isAutoPlay: false,
        });
        expect(getAIIsAutoPlay()).toBe(false);
    });
});
