import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

import {
    checkIsSafeStorageAvailable,
    decryptFromBase64,
    encryptToBase64,
    scrubLegacyPlaintextSecrets,
} from './electronSecureSettingHelpers';
import { electronMockState } from './testElectronModule';

function withSilentLog(callback: () => void) {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
        callback();
    } finally {
        consoleLogSpy.mockRestore();
    }
}

describe('checkIsSafeStorageAvailable', () => {
    beforeEach(() => {
        electronMockState.reset();
    });

    test('is available when the OS reports a real backend', () => {
        expect(checkIsSafeStorageAvailable()).toBe(true);
    });

    test('is unavailable before the app is ready', () => {
        electronMockState.app.isReady.mockReturnValue(false);

        expect(checkIsSafeStorageAvailable()).toBe(false);
        // the guard must short circuit, not probe the OS
        expect(
            electronMockState.safeStorage.isEncryptionAvailable,
        ).not.toHaveBeenCalled();
    });

    test('is unavailable when the OS reports no encryption', () => {
        electronMockState.safeStorage.isEncryptionAvailable.mockReturnValue(
            false,
        );

        expect(checkIsSafeStorageAvailable()).toBe(false);
    });

    test('refuses the linux basic_text backend, which uses a hardcoded key', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        try {
            electronMockState.safeStorage.getSelectedStorageBackend.mockReturnValue(
                'basic_text',
            );
            expect(checkIsSafeStorageAvailable()).toBe(false);

            electronMockState.safeStorage.getSelectedStorageBackend.mockReturnValue(
                'unknown',
            );
            expect(checkIsSafeStorageAvailable()).toBe(false);

            electronMockState.safeStorage.getSelectedStorageBackend.mockReturnValue(
                'kwallet',
            );
            expect(checkIsSafeStorageAvailable()).toBe(true);
        } finally {
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
            });
        }
    });

    test('a throwing OS check is treated as unavailable', () => {
        electronMockState.safeStorage.isEncryptionAvailable.mockImplementation(
            () => {
                throw new Error('dbus is not running');
            },
        );

        withSilentLog(() => {
            expect(checkIsSafeStorageAvailable()).toBe(false);
        });
    });
});

describe('secure setting encryption', () => {
    beforeEach(() => {
        electronMockState.reset();
    });

    test('round trips a value as base64', () => {
        const encryptedValue = encryptToBase64('sk-secret');

        expect(encryptedValue).not.toBeNull();
        // the plaintext must not be recognisable in what lands on disk
        expect(encryptedValue).not.toContain('sk-secret');
        expect(encryptedValue).toBe(
            Buffer.from('enc:sk-secret', 'utf8').toString('base64'),
        );
        expect(decryptFromBase64(encryptedValue as string)).toBe('sk-secret');
    });

    test('an undecryptable blob returns null instead of throwing', () => {
        withSilentLog(() => {
            expect(
                decryptFromBase64(
                    Buffer.from('from-another-machine').toString('base64'),
                ),
            ).toBeNull();
            expect(decryptFromBase64('not base64 at all !!')).toBeNull();
        });
    });

    test('a failing encrypt returns null instead of throwing', () => {
        electronMockState.safeStorage.encryptString.mockImplementation(() => {
            throw new Error('keychain locked');
        });

        withSilentLog(() => {
            expect(encryptToBase64('sk-secret')).toBeNull();
        });
    });
});

describe('scrubLegacyPlaintextSecrets', () => {
    test('strips the AI keys and disables auto play, keeping nothing else', () => {
        const clientSetting: Record<string, any> = {
            'ai-setting': JSON.stringify({
                openAIAPIKey: 'sk-openai',
                anthropicAPIKey: 'sk-ant',
                isAutoPlay: true,
            }),
        };

        expect(scrubLegacyPlaintextSecrets(clientSetting)).toBe(true);
        expect(JSON.parse(clientSetting['ai-setting'])).toEqual({
            // auto play with no key left behind would be a lie
            isAutoPlay: false,
        });
    });

    test('strips the SongSelect secrets, keeps the rest, and zeroes the expiry', () => {
        const clientSetting: Record<string, any> = {
            'song-select-setting': JSON.stringify({
                clientId: 'client-id',
                clientSecret: 'client-secret',
                subscriptionKey: 'subscription-key',
                redirectUri: 'https://example.com/cb',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                accessTokenExpiresAt: 1234,
                isDevMock: true,
            }),
        };

        expect(scrubLegacyPlaintextSecrets(clientSetting)).toBe(true);
        expect(JSON.parse(clientSetting['song-select-setting'])).toEqual({
            clientId: 'client-id',
            redirectUri: 'https://example.com/cb',
            accessTokenExpiresAt: 0,
            isDevMock: true,
        });
    });

    test('leaves unrelated settings alone', () => {
        const clientSetting: Record<string, any> = {
            'selected-parent-dir': 'C:\data',
            'bible-note-abc': 'some note',
        };

        expect(scrubLegacyPlaintextSecrets(clientSetting)).toBe(false);
        expect(clientSetting).toEqual({
            'selected-parent-dir': 'C:\data',
            'bible-note-abc': 'some note',
        });
    });

    test('reports no change for an already scrubbed store, so it does not rewrite', () => {
        const clientSetting: Record<string, any> = {
            'ai-setting': JSON.stringify({ isAutoPlay: false }),
            'song-select-setting': JSON.stringify({ clientId: 'client-id' }),
        };

        expect(scrubLegacyPlaintextSecrets(clientSetting)).toBe(false);
    });

    test('drops an unparsable entry entirely, since it may still hold a key', () => {
        const clientSetting: Record<string, any> = {
            'ai-setting': '{"openAIAPIKey": "sk-truncated',
        };

        expect(scrubLegacyPlaintextSecrets(clientSetting)).toBe(true);
        expect('ai-setting' in clientSetting).toBe(false);
    });

    test('ignores non-string and non-object entries', () => {
        const clientSetting: Record<string, any> = {
            'ai-setting': 42,
            'song-select-setting': JSON.stringify(null),
        };

        expect(scrubLegacyPlaintextSecrets(clientSetting)).toBe(false);
    });
});
