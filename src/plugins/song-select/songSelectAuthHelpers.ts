import appProvider from '../../server/appProvider';
import { electronSendAsync } from '../../server/appHelpers';
import {
    checkIsSongSelectConfigured,
    clearSongSelectTokens,
    getSongSelectSetting,
    setSongSelectSetting,
} from './songSelectSettingHelpers';

const SONG_SELECT_AUTHORIZE_URL =
    'https://identityservices.ccli.com/connect/authorize';
const SONG_SELECT_TOKEN_URL = 'https://identityservices.ccli.com/connect/token';
const SONG_SELECT_SCOPE = 'openid cclipartnerapi.read offline_access';
const TOKEN_EXPIRY_MARGIN_MILLISECONDS = 60_000;
// Must mirror `OAUTH_WINDOW_CLOSED_MESSAGE` in electron/oauthHelpers.ts —
// src/ cannot import from electron/.
const WINDOW_CLOSED_MESSAGE_PART = 'window was closed';

// Signed out, or the tokens were rejected: the user must sign in again.
export class SongSelectAuthError extends Error {}

export function checkIsSignInCanceledError(error: unknown) {
    return (
        error instanceof Error &&
        error.message.includes(WINDOW_CLOSED_MESSAGE_PART)
    );
}

function toBase64Url(bytes: Uint8Array) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function genPkcePair() {
    const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = appProvider.cryptoUtils
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
    return { verifier, challenge };
}

type TokenResponseType = {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
};

async function requestToken(body: Record<string, string>) {
    const response = await fetch(SONG_SELECT_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    });
    if (!response.ok) {
        const ErrorClass = [400, 401].includes(response.status)
            ? SongSelectAuthError
            : Error;
        throw new ErrorClass(
            `Token request failed with status ${response.status}`,
        );
    }
    const json: TokenResponseType = await response.json();
    if (typeof json.access_token !== 'string' || !json.access_token) {
        throw new Error('Invalid token response');
    }
    return json;
}

function persistTokens(tokens: TokenResponseType) {
    const setting = getSongSelectSetting();
    setSongSelectSetting({
        ...setting,
        accessToken: tokens.access_token,
        // Refresh tokens are one-time use and rotated on every refresh; keep
        // the old one only when none came back.
        refreshToken: tokens.refresh_token ?? setting.refreshToken,
        accessTokenExpiresAt:
            Date.now() + (Number(tokens.expires_in) || 3600) * 1000,
    });
}

export async function signInSongSelect() {
    const setting = getSongSelectSetting();
    if (!checkIsSongSelectConfigured(setting)) {
        throw new Error('SongSelect credentials are not configured');
    }
    const { verifier, challenge } = genPkcePair();
    const state = crypto.randomUUID();
    const authorizeUrl = `${SONG_SELECT_AUTHORIZE_URL}?${new URLSearchParams({
        client_id: setting.clientId,
        redirect_uri: setting.redirectUri,
        response_type: 'code',
        scope: SONG_SELECT_SCOPE,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    })}`;
    const redirectedUrl = await electronSendAsync<string>(
        'main:app:oauth-authorize',
        { authorizeUrl, redirectUriPrefix: setting.redirectUri },
    );
    const url = new URL(redirectedUrl);
    const errorParam = url.searchParams.get('error');
    if (errorParam) {
        throw new Error(`Sign in failed: ${errorParam}`);
    }
    if (url.searchParams.get('state') !== state) {
        throw new Error('Sign in failed: state mismatch');
    }
    const code = url.searchParams.get('code');
    if (!code) {
        throw new Error('Sign in failed: no authorization code returned');
    }
    const tokens = await requestToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: setting.redirectUri,
        client_id: setting.clientId,
        code_verifier: verifier,
        ...(setting.clientSecret
            ? { client_secret: setting.clientSecret }
            : {}),
    });
    persistTokens(tokens);
}

let refreshingPromise: Promise<string> | null = null;
export function getFreshAccessToken(isForceRefresh = false): Promise<string> {
    const setting = getSongSelectSetting();
    if (
        !isForceRefresh &&
        setting.accessToken &&
        Date.now() <
            setting.accessTokenExpiresAt - TOKEN_EXPIRY_MARGIN_MILLISECONDS
    ) {
        return Promise.resolve(setting.accessToken);
    }
    // Single-flight: the refresh token is one-time use, so concurrent callers
    // must share one request instead of each burning it.
    if (refreshingPromise !== null) {
        return refreshingPromise;
    }
    if (!setting.refreshToken) {
        return Promise.reject(new SongSelectAuthError('Not signed in'));
    }
    refreshingPromise = (async () => {
        try {
            const tokens = await requestToken({
                grant_type: 'refresh_token',
                refresh_token: setting.refreshToken,
                client_id: setting.clientId,
                ...(setting.clientSecret
                    ? { client_secret: setting.clientSecret }
                    : {}),
            });
            persistTokens(tokens);
            return tokens.access_token;
        } catch (error) {
            if (error instanceof SongSelectAuthError) {
                clearSongSelectTokens();
            }
            throw error;
        } finally {
            refreshingPromise = null;
        }
    })();
    return refreshingPromise;
}
