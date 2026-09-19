import { beforeEach, describe, expect, test, vi } from 'vitest';

const { settingStore, appProviderState } = vi.hoisted(() => ({
    settingStore: { value: {} as any },
    appProviderState: { isDev: true },
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isDev: appProviderState.isDev };
        },
    },
}));

vi.mock('./songSelectSettingHelpers', () => ({
    genEmptySongSelectSetting: () => ({
        clientId: '',
        clientSecret: '',
        subscriptionKey: '',
        redirectUri: '',
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: 0,
        isDevMock: false,
    }),
    getSongSelectSetting: () => ({ ...settingStore.value }),
    setSongSelectSetting: (value: any) => {
        settingStore.value = value;
    },
}));

import {
    checkShouldUseSongSelectDevMock,
    disableSongSelectDevMock,
    enableSongSelectDevMock,
} from './songSelectDevMockHelpers';

describe('songSelectDevMockHelpers', () => {
    beforeEach(() => {
        settingStore.value = { isDevMock: false };
        appProviderState.isDev = true;
    });

    test('enabling opens every signed-in gate', () => {
        enableSongSelectDevMock();
        const setting = settingStore.value;
        expect(setting.isDevMock).toBe(true);
        expect(setting.accessTokenExpiresAt).toBeGreaterThan(Date.now());
        // The fields the configured/signed-in checks gate on must all be set.
        expect(setting.clientId).toBeTruthy();
        expect(setting.subscriptionKey).toBeTruthy();
        expect(setting.redirectUri).toBeTruthy();
        expect(setting.refreshToken).toBeTruthy();
        expect(checkShouldUseSongSelectDevMock()).toBe(true);
    });

    test('disabling resets to a clean empty setting', () => {
        enableSongSelectDevMock();
        disableSongSelectDevMock();
        expect(settingStore.value.isDevMock).toBe(false);
        expect(settingStore.value.clientId).toBe('');
        expect(settingStore.value.refreshToken).toBe('');
        expect(checkShouldUseSongSelectDevMock()).toBe(false);
    });

    test('the mock is ignored outside dev builds', () => {
        enableSongSelectDevMock();
        appProviderState.isDev = false;
        expect(checkShouldUseSongSelectDevMock()).toBe(false);
    });
});
