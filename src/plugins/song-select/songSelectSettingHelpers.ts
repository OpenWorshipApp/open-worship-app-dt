import { useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';
import { appHomeStorage } from '../../server/appHomeStorage';
import { appSecureStorage } from '../../server/appSecureStorage';

export type SongSelectSettingType = {
    clientId: string;
    // Empty for a public PKCE client.
    clientSecret: string;
    // Sent as the `Ocp-Apim-Subscription-Key` header on every API request.
    subscriptionKey: string;
    // Must exactly match the redirect URI registered with CCLI.
    redirectUri: string;
    accessToken: string;
    refreshToken: string;
    // Milliseconds epoch; 0 when signed out.
    accessTokenExpiresAt: number;
    // Dev-only: serve canned catalog data instead of calling api.ccli.com.
    isDevMock: boolean;
};

// Non-secret half, readable plaintext on disk.
const SONG_SELECT_SETTING_NAME = 'song-select-setting';
// Client secret, subscription key and both OAuth tokens, encrypted at rest by
// the OS. Never write these to the plaintext store.
const SONG_SELECT_SECRET_SETTING_NAME = 'song-select-setting-secret';

const PLAIN_TEXT_FIELD_NAMES = ['clientId', 'redirectUri'] as const;
const SECRET_TEXT_FIELD_NAMES = [
    'clientSecret',
    'subscriptionKey',
    'accessToken',
    'refreshToken',
] as const;

export function genEmptySongSelectSetting(): SongSelectSettingType {
    return {
        clientId: '',
        clientSecret: '',
        subscriptionKey: '',
        redirectUri: '',
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: 0,
        isDevMock: false,
    };
}

function assignTextFields(
    setting: SongSelectSettingType,
    settingStr: string,
    fieldNames: readonly (keyof SongSelectSettingType)[],
) {
    try {
        const data = JSON.parse(settingStr);
        for (const fieldName of fieldNames) {
            const value = data[fieldName];
            (setting as any)[fieldName] =
                typeof value === 'string' ? value.trim() : '';
        }
        return data;
    } catch (_error) {
        return null;
    }
}

export function getSongSelectSetting(): SongSelectSettingType {
    const setting = genEmptySongSelectSetting();
    const data = assignTextFields(
        setting,
        appHomeStorage.getItem(SONG_SELECT_SETTING_NAME) || '{}',
        PLAIN_TEXT_FIELD_NAMES,
    );
    if (data !== null) {
        if (typeof data.accessTokenExpiresAt === 'number') {
            setting.accessTokenExpiresAt = data.accessTokenExpiresAt;
        }
        setting.isDevMock = data.isDevMock === true;
    }
    assignTextFields(
        setting,
        appSecureStorage.getItem(SONG_SELECT_SECRET_SETTING_NAME) || '{}',
        SECRET_TEXT_FIELD_NAMES,
    );
    return setting;
}

const changingListeners = new Set<() => void>();
export function setSongSelectSetting(value: SongSelectSettingType) {
    const secretSetting: Record<string, string> = {};
    let hasAnySecret = false;
    for (const fieldName of SECRET_TEXT_FIELD_NAMES) {
        const fieldValue = (value[fieldName] ?? '').trim();
        secretSetting[fieldName] = fieldValue;
        hasAnySecret = hasAnySecret || fieldValue.length > 0;
    }
    const plainSetting: Record<string, any> = {
        accessTokenExpiresAt: value.accessTokenExpiresAt,
        isDevMock: value.isDevMock,
    };
    for (const fieldName of PLAIN_TEXT_FIELD_NAMES) {
        plainSetting[fieldName] = (value[fieldName] ?? '').trim();
    }
    appHomeStorage.setItem(
        SONG_SELECT_SETTING_NAME,
        JSON.stringify(plainSetting),
    );
    if (hasAnySecret) {
        appSecureStorage.setItem(
            SONG_SELECT_SECRET_SETTING_NAME,
            JSON.stringify(secretSetting),
        );
    } else {
        // Signed out with no credentials left; leave no phantom blob behind.
        appSecureStorage.removeItem(SONG_SELECT_SECRET_SETTING_NAME);
    }
    for (const listener of changingListeners) {
        listener();
    }
}

export function useSongSelectSetting() {
    const [setting, setSetting] = useState<SongSelectSettingType>(() => {
        return getSongSelectSetting();
    });
    useAppEffect(() => {
        const listener = () => {
            setSetting(getSongSelectSetting());
        };
        changingListeners.add(listener);
        return () => {
            changingListeners.delete(listener);
        };
    }, []);
    return setting;
}

export function checkIsSongSelectConfigured(setting: SongSelectSettingType) {
    return !!(
        setting.clientId &&
        setting.subscriptionKey &&
        setting.redirectUri
    );
}

export function checkIsSongSelectSignedIn(setting: SongSelectSettingType) {
    return !!(setting.subscriptionKey && setting.refreshToken);
}

export function clearSongSelectTokens() {
    setSongSelectSetting({
        ...getSongSelectSetting(),
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: 0,
    });
}
