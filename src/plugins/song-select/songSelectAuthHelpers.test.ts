import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { electronSendAsyncMock, settingStore } = vi.hoisted(() => ({
    electronSendAsyncMock: vi.fn(),
    settingStore: { value: {} as any },
}));

vi.mock('../../server/appProvider', async () => {
    const nodeCrypto = await import('node:crypto');
    return {
        default: {
            cryptoUtils: {
                createHash: (algorithm: string) => {
                    return nodeCrypto.createHash(algorithm);
                },
            },
        },
    };
});

vi.mock('../../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('./songSelectSettingHelpers', () => ({
    getSongSelectSetting: () => ({ ...settingStore.value }),
    setSongSelectSetting: (value: any) => {
        settingStore.value = value;
    },
    clearSongSelectTokens: () => {
        settingStore.value = {
            ...settingStore.value,
            accessToken: '',
            refreshToken: '',
            accessTokenExpiresAt: 0,
        };
    },
    checkIsSongSelectConfigured: (setting: any) => {
        return !!(
            setting.clientId &&
            setting.subscriptionKey &&
            setting.redirectUri
        );
    },
}));

import {
    checkIsSignInCanceledError,
    getFreshAccessToken,
    signInSongSelect,
    SongSelectAuthError,
} from './songSelectAuthHelpers';

const REDIRECT_URI = 'http://localhost/owa-oauth-callback';

function genSetting(overrides: any = {}) {
    return {
        clientId: 'client-1',
        clientSecret: '',
        subscriptionKey: 'sub-1',
        redirectUri: REDIRECT_URI,
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: 0,
        ...overrides,
    };
}

function genTokenResponse(json: any, status = 200) {
    return new Response(JSON.stringify(json), { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    electronSendAsyncMock.mockReset();
    settingStore.value = genSetting();
});

describe('signInSongSelect', () => {
    test('runs the PKCE flow and persists the tokens', async () => {
        let challenge: string | null = null;
        electronSendAsyncMock.mockImplementation(
            async (eventName: string, data: any) => {
                expect(eventName).toBe('main:app:oauth-authorize');
                expect(data.redirectUriPrefix).toBe(REDIRECT_URI);
                const url = new URL(data.authorizeUrl);
                expect(url.origin + url.pathname).toBe(
                    'https://identityservices.ccli.com/connect/authorize',
                );
                expect(url.searchParams.get('client_id')).toBe('client-1');
                expect(url.searchParams.get('response_type')).toBe('code');
                expect(url.searchParams.get('scope')).toBe(
                    'openid cclipartnerapi.read offline_access',
                );
                expect(url.searchParams.get('code_challenge_method')).toBe(
                    'S256',
                );
                challenge = url.searchParams.get('code_challenge');
                const state = url.searchParams.get('state');
                return `${REDIRECT_URI}?code=code-1&state=${state}`;
            },
        );
        fetchMock.mockResolvedValue(
            genTokenResponse({
                access_token: 'access-1',
                refresh_token: 'refresh-1',
                expires_in: 3600,
            }),
        );
        await signInSongSelect();
        const [tokenUrl, init] = fetchMock.mock.calls[0];
        expect(tokenUrl).toBe(
            'https://identityservices.ccli.com/connect/token',
        );
        const body = new URLSearchParams(init.body);
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(body.get('code')).toBe('code-1');
        expect(body.get('redirect_uri')).toBe(REDIRECT_URI);
        expect(body.get('client_id')).toBe('client-1');
        expect(body.get('client_secret')).toBeNull();
        const verifier = body.get('code_verifier') as string;
        expect(verifier.length).toBeGreaterThanOrEqual(43);
        expect(createHash('sha256').update(verifier).digest('base64url')).toBe(
            challenge,
        );
        expect(settingStore.value.accessToken).toBe('access-1');
        expect(settingStore.value.refreshToken).toBe('refresh-1');
        expect(settingStore.value.accessTokenExpiresAt).toBeGreaterThan(
            Date.now(),
        );
    });

    test('sends the client secret only when one is set', async () => {
        settingStore.value = genSetting({ clientSecret: 'secret-1' });
        electronSendAsyncMock.mockImplementation(async (_: any, data: any) => {
            const state = new URL(data.authorizeUrl).searchParams.get('state');
            return `${REDIRECT_URI}?code=code-1&state=${state}`;
        });
        fetchMock.mockResolvedValue(
            genTokenResponse({ access_token: 'a', expires_in: 60 }),
        );
        await signInSongSelect();
        const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
        expect(body.get('client_secret')).toBe('secret-1');
    });

    test('rejects on a state mismatch without exchanging the code', async () => {
        electronSendAsyncMock.mockResolvedValue(
            `${REDIRECT_URI}?code=code-1&state=wrong-state`,
        );
        await expect(signInSongSelect()).rejects.toThrow('state mismatch');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('rejects on an error parameter', async () => {
        electronSendAsyncMock.mockImplementation(async (_: any, data: any) => {
            const state = new URL(data.authorizeUrl).searchParams.get('state');
            return `${REDIRECT_URI}?error=access_denied&state=${state}`;
        });
        await expect(signInSongSelect()).rejects.toThrow('access_denied');
    });

    test('a closed window is reported as canceled', async () => {
        electronSendAsyncMock.mockRejectedValue(
            new Error('Sign in window was closed'),
        );
        let caught: unknown = null;
        try {
            await signInSongSelect();
        } catch (error) {
            caught = error;
        }
        expect(checkIsSignInCanceledError(caught)).toBe(true);
        expect(checkIsSignInCanceledError(new Error('other'))).toBe(false);
    });

    test('refuses to start unconfigured', async () => {
        settingStore.value = genSetting({ clientId: '' });
        await expect(signInSongSelect()).rejects.toThrow('not configured');
    });
});

describe('getFreshAccessToken', () => {
    test('returns a still-valid token without any request', async () => {
        settingStore.value = genSetting({
            accessToken: 'valid-token',
            refreshToken: 'refresh-1',
            accessTokenExpiresAt: Date.now() + 10 * 60 * 1000,
        });
        await expect(getFreshAccessToken()).resolves.toBe('valid-token');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('refreshes an expired token and persists the rotated pair', async () => {
        settingStore.value = genSetting({
            accessToken: 'stale-token',
            refreshToken: 'refresh-old',
            accessTokenExpiresAt: Date.now() - 1000,
        });
        fetchMock.mockResolvedValue(
            genTokenResponse({
                access_token: 'access-new',
                refresh_token: 'refresh-new',
                expires_in: 3600,
            }),
        );
        await expect(getFreshAccessToken()).resolves.toBe('access-new');
        const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
        expect(body.get('grant_type')).toBe('refresh_token');
        expect(body.get('refresh_token')).toBe('refresh-old');
        expect(settingStore.value.refreshToken).toBe('refresh-new');
        expect(settingStore.value.accessToken).toBe('access-new');
    });

    test('concurrent callers share a single refresh request', async () => {
        settingStore.value = genSetting({
            refreshToken: 'refresh-1',
            accessTokenExpiresAt: 0,
        });
        let resolveResponse: (response: Response) => void = () => {};
        fetchMock.mockReturnValue(
            new Promise((resolve) => {
                resolveResponse = resolve;
            }),
        );
        const first = getFreshAccessToken();
        const second = getFreshAccessToken(true);
        resolveResponse(
            genTokenResponse({ access_token: 'shared', expires_in: 3600 }),
        );
        await expect(first).resolves.toBe('shared');
        await expect(second).resolves.toBe('shared');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('a rejected refresh clears the stored tokens', async () => {
        settingStore.value = genSetting({
            refreshToken: 'refresh-dead',
            accessTokenExpiresAt: 0,
        });
        fetchMock.mockResolvedValue(genTokenResponse({}, 400));
        await expect(getFreshAccessToken()).rejects.toBeInstanceOf(
            SongSelectAuthError,
        );
        expect(settingStore.value.refreshToken).toBe('');
        expect(settingStore.value.accessToken).toBe('');
    });

    test('signed out rejects immediately', async () => {
        settingStore.value = genSetting();
        await expect(getFreshAccessToken()).rejects.toBeInstanceOf(
            SongSelectAuthError,
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
