import appProvider from '../../server/appProvider';
import {
    genEmptySongSelectSetting,
    getSongSelectSetting,
    setSongSelectSetting,
} from './songSelectSettingHelpers';

// Dev-only escape hatch: CCLI retired new partner signups, so there is no way
// to get real credentials to try the feature against. The mock fills fake
// credentials and tokens (so the signed-in gates open) and makes the API layer
// serve canned catalog data instead of calling api.ccli.com.

export function checkShouldUseSongSelectDevMock() {
    return appProvider.systemUtils.isDev && getSongSelectSetting().isDevMock;
}

export function enableSongSelectDevMock() {
    setSongSelectSetting({
        clientId: 'dev-mock-client',
        clientSecret: '',
        subscriptionKey: 'dev-mock-subscription-key',
        redirectUri: 'http://localhost/owa-oauth-callback',
        accessToken: 'dev-mock-access-token',
        refreshToken: 'dev-mock-refresh-token',
        accessTokenExpiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
        isDevMock: true,
    });
}

export function disableSongSelectDevMock() {
    setSongSelectSetting(genEmptySongSelectSetting());
}
