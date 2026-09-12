// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    settingStore,
    clearSongSelectTokensMock,
    signInSongSelectMock,
    pendingApplyMock,
    showSimpleToastMock,
    openExternalURLMock,
} = vi.hoisted(() => ({
    settingStore: { value: {} as any },
    clearSongSelectTokensMock: vi.fn(),
    signInSongSelectMock: vi.fn(),
    pendingApplyMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    openExternalURLMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
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
    useSongSelectSetting: () => ({ ...settingStore.value }),
    clearSongSelectTokens: clearSongSelectTokensMock,
    checkIsSongSelectConfigured: (setting: any) => {
        return !!(
            setting.clientId &&
            setting.subscriptionKey &&
            setting.redirectUri
        );
    },
    checkIsSongSelectSignedIn: (setting: any) => {
        return !!(setting.subscriptionKey && setting.refreshToken);
    },
}));

vi.mock('./songSelectAuthHelpers', () => ({
    signInSongSelect: signInSongSelectMock,
    checkIsSignInCanceledError: (error: unknown) => {
        return (
            error instanceof Error &&
            error.message.includes('window was closed')
        );
    },
}));

vi.mock('../../setting/SettingApplyComp', () => ({
    applyStore: { pendingApply: pendingApplyMock },
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: vi.fn(),
}));

// The card probes for an OS credential store while rendering.
vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: { checkIsAvailable: () => true },
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        browserUtils: { openExternalURL: openExternalURLMock },
        systemUtils: { isDev: true },
    },
}));

import SettingOthersSongSelectComp from './SettingOthersSongSelectComp';

function genSetting(overrides: any = {}) {
    return {
        clientId: '',
        clientSecret: '',
        subscriptionKey: '',
        redirectUri: '',
        accessToken: '',
        refreshToken: '',
        accessTokenExpiresAt: 0,
        isDevMock: false,
        ...overrides,
    };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function render() {
    await act(async () => {
        root = createRoot(container);
        root.render(<SettingOthersSongSelectComp />);
    });
}

function findButton(label: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent?.includes(label);
    });
}

describe('SettingOthersSongSelectComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        settingStore.value = genSetting();
        container = document.createElement('div');
        document.body.appendChild(container);
    });
    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('renders the credential fields with their stored values', async () => {
        settingStore.value = genSetting({
            clientId: 'client-1',
            subscriptionKey: 'sub-1',
        });
        await render();
        const inputs = Array.from(
            container.querySelectorAll('input'),
        ) as HTMLInputElement[];
        expect(inputs).toHaveLength(4);
        expect(inputs[0].defaultValue).toBe('client-1');
        expect(inputs[2].defaultValue).toBe('sub-1');
        // The two secrets are masked; this machine usually drives the
        // projector, so a key left on screen is readable from the pews.
        expect(inputs.map((input) => input.type)).toEqual([
            'text',
            'password',
            'password',
            'text',
        ]);
        // Every field is reachable by its own label.
        for (const input of inputs) {
            const label = container.querySelector(
                `label[for="${input.id}"]`,
            ) as HTMLLabelElement | null;
            expect(label).not.toBeNull();
        }
        expect(container.textContent).toContain('Client ID');
        expect(container.textContent).toContain('Client Secret');
        expect(container.textContent).toContain('Subscription Key');
        expect(container.textContent).toContain('Redirect URI');
        expect(container.textContent).toContain('Not signed in');
    });

    test('saves a field on blur and marks the settings as pending', async () => {
        await render();
        const input = container.querySelector(
            'input[type="text"]',
        ) as HTMLInputElement;
        await act(async () => {
            input.focus();
            input.value = ' new-client ';
            input.blur();
        });
        expect(settingStore.value.clientId).toBe('new-client');
        expect(pendingApplyMock).toHaveBeenCalled();
        // Blurring again without an actual change saves nothing new.
        pendingApplyMock.mockClear();
        await act(async () => {
            input.focus();
            input.blur();
        });
        expect(pendingApplyMock).not.toHaveBeenCalled();
    });

    test('enables Sign In only once configured, then signs in', async () => {
        await render();
        expect(findButton('Sign In')?.disabled).toBe(true);
        settingStore.value = genSetting({
            clientId: 'c',
            subscriptionKey: 's',
            redirectUri: 'http://localhost/cb',
        });
        await act(async () => root?.unmount());
        root = null;
        await render();
        const signInButton = findButton('Sign In');
        expect(signInButton?.disabled).toBe(false);
        signInSongSelectMock.mockResolvedValue(undefined);
        await act(async () => {
            signInButton?.click();
        });
        expect(signInSongSelectMock).toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Sign In',
            'Signed in to SongSelect successfully',
        );
    });

    test('a closed sign-in window toasts as canceled', async () => {
        settingStore.value = genSetting({
            clientId: 'c',
            subscriptionKey: 's',
            redirectUri: 'http://localhost/cb',
        });
        await render();
        signInSongSelectMock.mockRejectedValue(
            new Error('Sign in window was closed'),
        );
        await act(async () => {
            findButton('Sign In')?.click();
        });
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Sign in failed',
            'Sign in was canceled',
        );
    });

    test('shows the signed-in state and signs out', async () => {
        settingStore.value = genSetting({
            clientId: 'c',
            subscriptionKey: 's',
            redirectUri: 'http://localhost/cb',
            accessToken: 'a',
            refreshToken: 'r',
        });
        await render();
        expect(container.textContent).toContain('Signed in');
        const signOutButton = findButton('Sign Out');
        await act(async () => {
            signOutButton?.click();
        });
        expect(clearSongSelectTokensMock).toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Sign Out',
            'Signed out from SongSelect',
        );
    });

    test('the dev mock button fills fake credentials and signs in', async () => {
        await render();
        const mockButton = findButton('(dev) Use Mock Data');
        expect(mockButton).toBeDefined();
        await act(async () => {
            mockButton?.click();
        });
        expect(settingStore.value.isDevMock).toBe(true);
        expect(settingStore.value.clientId).toBe('dev-mock-client');
        expect(settingStore.value.subscriptionKey).toBe(
            'dev-mock-subscription-key',
        );
        expect(settingStore.value.refreshToken).toBe('dev-mock-refresh-token');
        expect(settingStore.value.accessTokenExpiresAt).toBeGreaterThan(
            Date.now(),
        );
        // Re-render to pick the store change up (the mocked hook has no
        // subscription).
        await act(async () => root?.unmount());
        root = null;
        await render();
        expect(container.textContent).toContain('Signed in');
        expect(container.textContent).toContain('(mock)');
        expect(findButton('(dev) Use Mock Data')).toBeUndefined();
    });

    test('signing out of mock mode resets the whole setting', async () => {
        settingStore.value = genSetting({
            clientId: 'dev-mock-client',
            subscriptionKey: 'dev-mock-subscription-key',
            refreshToken: 'dev-mock-refresh-token',
            isDevMock: true,
        });
        await render();
        await act(async () => {
            findButton('Sign Out')?.click();
        });
        expect(clearSongSelectTokensMock).not.toHaveBeenCalled();
        expect(settingStore.value).toEqual(genSetting());
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Sign Out',
            'Signed out from SongSelect',
        );
    });

    test('opens the SongSelect website externally', async () => {
        await render();
        await act(async () => {
            findButton('SongSelect')?.click();
        });
        expect(openExternalURLMock).toHaveBeenCalledWith(
            'https://songselect.ccli.com',
        );
    });
});
