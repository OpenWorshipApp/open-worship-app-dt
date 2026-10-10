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

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';
import type { AISettingType } from './aiHelpers';
import {
    BEDROCK_REGION_LIST,
    getAIIsAutoPlay,
    getAISetting,
    getBedrockRegion,
    getIsAIEnabled,
    setAISetting,
    setIsAIEnabled,
    toBedrockRegion,
} from './aiHelpers';

// Every field empty, so each test names only the ones it is about -- and a
// field added later is one line here rather than one per test.
function genSetting(value: Partial<AISettingType>): AISettingType {
    return {
        openAIAPIKey: '',
        anthropicAPIKey: '',
        kimiAPIKey: '',
        bedrockAPIKey: '',
        anthropicWorkspaceId: '',
        bedrockRegion: 'us-east-1',
        isAutoPlay: false,
        ...value,
    };
}

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
        setAISetting(
            genSetting({
                openAIAPIKey: '  sk-openai  ',
                anthropicAPIKey: 'sk-ant',
                bedrockAPIKey: 'ABSKsecret',
                isAutoPlay: true,
            }),
        );

        const plainValue = homeStore.get('ai-setting') as string;
        expect(plainValue).not.toContain('sk-openai');
        expect(plainValue).not.toContain('sk-ant');
        expect(plainValue).not.toContain('ABSKsecret');
        expect(JSON.parse(plainValue)).toEqual({
            isAutoPlay: true,
            anthropicWorkspaceId: '',
            bedrockRegion: 'us-east-1',
        });
        expect(
            JSON.parse(secureStore.get('ai-setting-secret') as string),
        ).toEqual({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: 'sk-ant',
            kimiAPIKey: '',
            bedrockAPIKey: 'ABSKsecret',
        });
    });

    test('the merged read is unchanged for callers', () => {
        setAISetting(
            genSetting({
                openAIAPIKey: 'sk-openai',
                anthropicAPIKey: 'sk-ant',
                isAutoPlay: true,
            }),
        );

        expect(getAISetting()).toEqual({
            openAIAPIKey: 'sk-openai',
            anthropicAPIKey: 'sk-ant',
            kimiAPIKey: '',
            bedrockAPIKey: '',
            anthropicWorkspaceId: '',
            bedrockRegion: 'us-east-1',
            isAutoPlay: true,
        });
    });

    test('auto play cannot survive without the OpenAI key it needs', () => {
        setAISetting(
            genSetting({ anthropicAPIKey: 'sk-ant', isAutoPlay: true }),
        );

        // normalised at write time, so the plaintext half is self consistent
        expect(JSON.parse(homeStore.get('ai-setting') as string)).toEqual({
            isAutoPlay: false,
            anthropicWorkspaceId: '',
            bedrockRegion: 'us-east-1',
        });
        expect(getAISetting().isAutoPlay).toBe(false);

        // and again at read time, for a store edited behind the app's back
        homeStore.set('ai-setting', JSON.stringify({ isAutoPlay: true }));
        secureStore.delete('ai-setting-secret');
        expect(getAISetting().isAutoPlay).toBe(false);
    });

    // The blob is rebuilt from scratch on every save, so a key the writer
    // forgot to carry over is not merely stale -- it is gone. Worse, the
    // "nothing to protect" branch would then fire on the very save that stores
    // it: the user types a good key, tabs out of the field, and the switch
    // stays disabled with nothing said.
    test('a key from one provider alone survives a save', () => {
        setAISetting(genSetting({ kimiAPIKey: '  sk-kimi  ' }));

        expect(secureStore.has('ai-setting-secret')).toBe(true);
        expect(getAISetting().kimiAPIKey).toBe('sk-kimi');
    });

    test('a Bedrock key alone survives a save too', () => {
        setAISetting(genSetting({ bedrockAPIKey: '  ABSKbedrock  ' }));

        expect(secureStore.has('ai-setting-secret')).toBe(true);
        expect(getAISetting().bedrockAPIKey).toBe('ABSKbedrock');
    });

    // ...and it must still be there after a save that is about something else
    // entirely, which is what re-listing the fields in two places used to break.
    test('a save about another field keeps the keys it did not mention', () => {
        setAISetting(
            genSetting({
                openAIAPIKey: 'sk-openai',
                kimiAPIKey: 'sk-kimi',
                bedrockAPIKey: 'ABSKbedrock',
            }),
        );
        setAISetting({ ...getAISetting(), anthropicWorkspaceId: 'wrk-1' });
        setAISetting({ ...getAISetting(), bedrockRegion: 'us-west-2' });

        const setting = getAISetting();
        expect(setting.kimiAPIKey).toBe('sk-kimi');
        expect(setting.openAIAPIKey).toBe('sk-openai');
        expect(setting.bedrockAPIKey).toBe('ABSKbedrock');
        expect(setting.anthropicWorkspaceId).toBe('wrk-1');
        expect(setting.bedrockRegion).toBe('us-west-2');
    });

    test('every key empty leaves no phantom blob behind', () => {
        setAISetting(genSetting({ openAIAPIKey: 'sk-openai' }));
        expect(secureStore.has('ai-setting-secret')).toBe(true);

        setAISetting(genSetting({}));
        expect(secureStore.has('ai-setting-secret')).toBe(false);
        expect(appSecureStorage.removeItem).toHaveBeenCalledWith(
            'ai-setting-secret',
        );
    });

    test('getAIIsAutoPlay never decrypts the API keys', () => {
        setAISetting(
            genSetting({ openAIAPIKey: 'sk-openai', isAutoPlay: true }),
        );
        vi.clearAllMocks();

        expect(getAIIsAutoPlay()).toBe(true);
        expect(appSecureStorage.getItem).not.toHaveBeenCalled();
        // Two plaintext reads and no decryption: the master switch
        // (`ai-enabled`) and the auto-play flag.
        expect(appHomeStorage.getItem).toHaveBeenCalledTimes(2);
        expect(appHomeStorage.getItem).toHaveBeenCalledWith('ai-enabled');
    });

    test('the workspace id rides in the plaintext half', () => {
        setAISetting(
            genSetting({
                anthropicAPIKey: 'sk-ant',
                anthropicWorkspaceId: '  wrkspc_123  ',
            }),
        );

        // An id, not a credential: readable on disk, and trimmed on the way in.
        expect(
            JSON.parse(homeStore.get('ai-setting') as string)
                .anthropicWorkspaceId,
        ).toBe('wrkspc_123');
        expect(getAISetting().anthropicWorkspaceId).toBe('wrkspc_123');
    });

    // A place, not a credential -- and a closed list, because each region is
    // a host the chatbot window's CSP has to name.
    test('the Bedrock region rides in the plaintext half, never off the list', () => {
        setAISetting(genSetting({ bedrockRegion: 'eu-central-1' }));
        expect(
            JSON.parse(homeStore.get('ai-setting') as string).bedrockRegion,
        ).toBe('eu-central-1');
        expect(getBedrockRegion()).toBe('eu-central-1');
        expect(appSecureStorage.getItem).not.toHaveBeenCalled();

        // Off the list is the default: us-west-2, the one region that serves
        // every model the chatbot offers.
        homeStore.set(
            'ai-setting',
            JSON.stringify({ bedrockRegion: 'ap-evil-1' }),
        );
        expect(getBedrockRegion()).toBe('us-west-2');
        expect(toBedrockRegion(' us-east-2 ')).toBe('us-east-2');
        expect(toBedrockRegion(42)).toBe('us-west-2');
    });

    // The chatbot window may speak only to the hosts its CSP names, so a
    // region the picker offers and the CSP does not is a question that fails
    // as "the internet may be down", in the packaged build only.
    test('every Bedrock region the picker offers is a host the chatbot may reach', () => {
        // From the repo root: under jsdom `import.meta.url` is not a file URL.
        const html = readFileSync(
            path.resolve(process.cwd(), 'html', 'chatbot.html'),
            'utf8',
        );
        // The directive itself, not the comment above it that explains it.
        const connectSrc = /connect-src 'self'([^;]*);/.exec(html)?.[1] ?? '';
        expect(connectSrc).toContain('https://api.openai.com');
        for (const region of BEDROCK_REGION_LIST) {
            expect(connectSrc).toContain(
                `https://bedrock-mantle.${region}.api.aws`,
            );
        }
    });

    test('the master switch turns auto play off whatever is stored', () => {
        setAISetting(
            genSetting({ openAIAPIKey: 'sk-openai', isAutoPlay: true }),
        );
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
            kimiAPIKey: '',
            bedrockAPIKey: '',
            anthropicWorkspaceId: '',
            bedrockRegion: 'us-west-2',
            isAutoPlay: false,
        });
        expect(getAIIsAutoPlay()).toBe(false);
    });
});
