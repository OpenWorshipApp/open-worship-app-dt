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

import {
    checkIsSongSelectConfigured,
    checkIsSongSelectSignedIn,
    clearSongSelectTokens,
    genEmptySongSelectSetting,
    getSongSelectSetting,
    setSongSelectSetting,
} from './songSelectSettingHelpers';

const FULL_SETTING = {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    subscriptionKey: 'subscription-key',
    redirectUri: 'https://example.com/cb',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAt: 1234,
    isDevMock: false,
};

describe('songSelectSettingHelpers secret splitting', () => {
    beforeEach(() => {
        homeStore.clear();
        secureStore.clear();
        vi.clearAllMocks();
    });

    test('only the non-secret fields reach the plaintext store', () => {
        setSongSelectSetting(FULL_SETTING);

        const plainValue = homeStore.get('song-select-setting') as string;
        for (const secretValue of [
            'client-secret',
            'subscription-key',
            'access-token',
            'refresh-token',
        ]) {
            expect(plainValue).not.toContain(secretValue);
        }
        expect(JSON.parse(plainValue)).toEqual({
            clientId: 'client-id',
            redirectUri: 'https://example.com/cb',
            accessTokenExpiresAt: 1234,
            isDevMock: false,
        });
        expect(
            JSON.parse(secureStore.get('song-select-setting-secret') as string),
        ).toEqual({
            clientSecret: 'client-secret',
            subscriptionKey: 'subscription-key',
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });
    });

    test('the merged read is unchanged for callers', () => {
        setSongSelectSetting(FULL_SETTING);

        const setting = getSongSelectSetting();
        expect(setting).toEqual(FULL_SETTING);
        expect(checkIsSongSelectConfigured(setting)).toBe(true);
        expect(checkIsSongSelectSignedIn(setting)).toBe(true);
    });

    test('values are trimmed on both halves', () => {
        setSongSelectSetting({
            ...FULL_SETTING,
            clientId: '  client-id  ',
            refreshToken: '  refresh-token  ',
        });

        const setting = getSongSelectSetting();
        expect(setting.clientId).toBe('client-id');
        expect(setting.refreshToken).toBe('refresh-token');
    });

    test('clearing the tokens keeps the credentials that are still valid', () => {
        setSongSelectSetting(FULL_SETTING);

        clearSongSelectTokens();

        const setting = getSongSelectSetting();
        expect(setting.accessToken).toBe('');
        expect(setting.refreshToken).toBe('');
        expect(setting.accessTokenExpiresAt).toBe(0);
        expect(setting.clientSecret).toBe('client-secret');
        expect(setting.subscriptionKey).toBe('subscription-key');
        expect(setting.clientId).toBe('client-id');
        // still configured, just signed out
        expect(checkIsSongSelectConfigured(setting)).toBe(true);
        expect(checkIsSongSelectSignedIn(setting)).toBe(false);
    });

    test('an all empty setting leaves no phantom blob behind', () => {
        setSongSelectSetting(FULL_SETTING);
        expect(secureStore.has('song-select-setting-secret')).toBe(true);

        // what `disableSongSelectDevMock` writes
        setSongSelectSetting(genEmptySongSelectSetting());

        expect(secureStore.has('song-select-setting-secret')).toBe(false);
        expect(getSongSelectSetting()).toEqual(genEmptySongSelectSetting());
    });

    test('an unreadable store reads as empty rather than throwing', () => {
        homeStore.set('song-select-setting', 'not json');
        secureStore.set('song-select-setting-secret', 'not json either');

        expect(getSongSelectSetting()).toEqual(genEmptySongSelectSetting());
    });
});
