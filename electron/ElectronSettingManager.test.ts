import { beforeEach, describe, expect, test, vi } from 'vitest';

const { readFileSync, writeFileSync, genTimeoutAttempt } = vi.hoisted(() => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    genTimeoutAttempt: vi.fn(() => {
        return (callback: () => void) => callback();
    }),
}));

vi.mock('node:fs', () => ({
    default: {
        readFileSync,
        writeFileSync,
    },
}));

vi.mock('electron', async () => {
    const mod = await import('./testElectronModule');
    return mod.createElectronModuleMock();
});

vi.mock('./electronHelpers', () => ({
    genTimeoutAttempt,
}));

import ElectronSettingManager from './ElectronSettingManager';
import { electronMockState } from './testElectronModule';
import { createMockBrowserWindow } from './testUtils';

describe('ElectronSettingManager', () => {
    beforeEach(() => {
        electronMockState.reset();
        readFileSync.mockReset();
        writeFileSync.mockReset();
    });

    test('loads persisted settings from disk', () => {
        readFileSync.mockReturnValue(
            JSON.stringify({
                mainWinBounds: { x: 1, y: 2, width: 3, height: 4 },
                appScreenDisplayId: 9,
                mainHtmlPath: 'setting.html',
                themeSource: 'dark',
            }),
        );

        const manager = new ElectronSettingManager();

        expect(manager.mainWinBounds).toEqual({
            x: 1,
            y: 2,
            width: 3,
            height: 4,
        });
        expect(manager.mainHtmlPath).toBe('setting.html');
        expect(electronMockState.nativeTheme.themeSource).toBe('dark');
    });

    test('saves updated bounds and theme information', () => {
        readFileSync.mockImplementation(() => {
            throw Object.assign(new Error('missing'), { code: 'ENOENT' });
        });
        const manager = new ElectronSettingManager();

        // the window reports its own current geometry
        manager.applyMainWindowBounds(createMockBrowserWindow() as any);
        expect(manager.mainWinBounds).toEqual({
            x: 10,
            y: 20,
            width: 1200,
            height: 800,
        });

        const win = createMockBrowserWindow({
            getPosition: vi.fn(() => [20, 30]),
            getSize: vi.fn(() => [1000, 700]),
        });

        manager.themeSource = 'light';
        manager.applyMainWindowBounds(win as any);

        expect(writeFileSync).toHaveBeenCalled();
        const lastCall = writeFileSync.mock.lastCall;
        expect(lastCall).toBeDefined();
        const [, savedJson] = lastCall!;
        const parsed = JSON.parse(savedJson);
        expect(parsed.mainWinBounds).toEqual({
            x: 20,
            y: 30,
            width: 1000,
            height: 700,
        });
        expect(parsed.themeSource).toBe('light');
    });

    test('restores main window bounds to primary display', () => {
        readFileSync.mockReturnValue('{}');
        const manager = new ElectronSettingManager();
        const win = createMockBrowserWindow();

        manager.restoreMainBounds(win as any);

        expect(win.setBounds).toHaveBeenCalledWith({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        });
    });

    function genManagerWithDisplays(popupWinBoundsMap: any = {}) {
        electronMockState.screen.getAllDisplays.mockReturnValue([
            {
                id: 1,
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                workArea: { x: 0, y: 0, width: 1920, height: 1040 },
            },
        ] as any);
        readFileSync.mockReturnValue(JSON.stringify({ popupWinBoundsMap }));
        return new ElectronSettingManager();
    }

    test('remembers where a popup window was left', () => {
        const manager = genManagerWithDisplays();

        manager.setPopupWinBounds('chatbot.html', {
            x: 1400,
            y: 120,
            width: 460,
            height: 640,
            isMaximized: false,
        });

        expect(manager.getPopupWinBounds('chatbot.html')).toEqual({
            x: 1400,
            y: 120,
            width: 460,
            height: 640,
            isMaximized: false,
        });
        expect(manager.getPopupWinBounds('about.html')).toBeNull();
        expect(writeFileSync).toHaveBeenCalledTimes(1);

        // dragging fires a move event per frame; re-writing the whole setting
        // file for geometry that did not change is pure churn
        manager.setPopupWinBounds('chatbot.html', {
            x: 1400,
            y: 120,
            width: 460,
            height: 640,
            isMaximized: false,
        });
        expect(writeFileSync).toHaveBeenCalledTimes(1);

        manager.clearPopupWinBounds();
        expect(manager.getPopupWinBounds('chatbot.html')).toBeNull();
        expect(writeFileSync).toHaveBeenCalledTimes(2);
        // nothing left to forget
        manager.clearPopupWinBounds();
        expect(writeFileSync).toHaveBeenCalledTimes(2);
    });

    test('drops a remembered popup position no display can reach', () => {
        const manager = genManagerWithDisplays({
            // the second monitor it was left on is gone
            'setting.html': { x: 2600, y: 300, width: 700, height: 500 },
            // only a sliver would be grabbable
            'about.html': { x: -690, y: 100, width: 700, height: 500 },
            'chatbot.html': { x: 1500, y: 100, width: 700, height: 500 },
            // junk in the file is not geometry
            'reader.html': { x: 10, y: 10, width: 0, height: 500 },
            'presenter.html': 'nonsense',
        });

        expect(manager.getPopupWinBounds('setting.html')).toBeNull();
        expect(manager.getPopupWinBounds('about.html')).toBeNull();
        expect(manager.getPopupWinBounds('chatbot.html')).not.toBeNull();
        expect(manager.getPopupWinBounds('reader.html')).toBeNull();
        expect(manager.getPopupWinBounds('presenter.html')).toBeNull();
    });

    test('tolerates an empty or unreadable setting file', () => {
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            readFileSync.mockReturnValue('   ');
            const emptyManager = new ElectronSettingManager();
            expect(emptyManager.mainHtmlPath).toBe('reader.html');
            expect(emptyManager.getAllClientSettingKeys()).toEqual([]);

            readFileSync.mockImplementation(() => {
                throw Object.assign(new Error('denied'), { code: 'EACCES' });
            });
            const brokenManager = new ElectronSettingManager();
            expect(brokenManager.mainHtmlPath).toBe('reader.html');
            expect(writeFileSync).not.toHaveBeenCalled();
        } finally {
            consoleLogSpy.mockRestore();
        }
    });

    test('reports a maximized window and resolves displays by id', () => {
        readFileSync.mockReturnValue('{}');
        const manager = new ElectronSettingManager();

        // no persisted bounds yet, so nothing is treated as maximized
        expect(manager.isWinMaximized).toBe(false);
        expect(manager.themeSource).toBe('system');

        manager.mainWinBounds = { x: 0, y: 0, width: 1920, height: 1080 };
        expect(manager.isWinMaximized).toBe(true);

        // the host reports no displays until one is attached
        expect(manager.allDisplays).toEqual([]);

        electronMockState.screen.getAllDisplays.mockReturnValue([
            { id: 1 },
            { id: 8 },
        ] as any);
        expect(manager.allDisplays).toHaveLength(2);
        expect(manager.getDisplayById(8)).toEqual({ id: 8 });
        expect(manager.getDisplayById(99)).toBeUndefined();
    });

    test('syncs the main window bounds on resize, maximize, and move', () => {
        readFileSync.mockReturnValue(
            JSON.stringify({
                mainWinBounds: { x: 0, y: 0, width: 1920, height: 1080 },
            }),
        );
        const manager = new ElectronSettingManager();
        const win = createMockBrowserWindow({
            getPosition: vi.fn(() => [5, 6]),
            getSize: vi.fn(() => [640, 480]),
        });

        manager.syncMainWindow(win as any);

        expect(win.setBounds).toHaveBeenCalledWith({
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        });
        expect(win.maximize).toHaveBeenCalledTimes(1);

        const handlerOf = (eventName: string) => {
            return win.on.mock.calls.find(
                ([event]) => event === eventName,
            )?.[1] as () => void;
        };

        handlerOf('resize')();
        expect(manager.mainWinBounds).toEqual({
            x: 5,
            y: 6,
            width: 640,
            height: 480,
        });

        // maximizing snaps back to the whole primary display
        handlerOf('maximize')();
        expect(manager.mainWinBounds).toEqual({
            x: 5,
            y: 6,
            width: 1920,
            height: 1080,
        });

        handlerOf('move')();
        expect(manager.mainWinBounds).toEqual({
            x: 5,
            y: 6,
            width: 640,
            height: 480,
        });
    });

    test('persists the landing page and the renderer client settings', () => {
        readFileSync.mockReturnValue('{}');
        const manager = new ElectronSettingManager();

        manager.mainHtmlPath = 'presenter.html';
        expect(manager.mainHtmlPath).toBe('presenter.html');

        // only strings survive the round trip through the setting file
        manager.setClientSetting('theme', 'dark');
        manager.setClientSetting('count', 12);
        expect(manager.getClientSetting('theme')).toBe('dark');
        expect(manager.getClientSetting('count')).toBeNull();
        expect(manager.getClientSetting('missing')).toBeNull();
        expect(manager.getAllClientSettingKeys()).toEqual(['theme', 'count']);

        manager.deleteClientSetting('count');
        expect(manager.getAllClientSettingKeys()).toEqual(['theme']);

        manager.clearClientSettings();
        expect(manager.getAllClientSettingKeys()).toEqual([]);
    });

    test('encrypts secure settings and never writes the plaintext', () => {
        readFileSync.mockReturnValue('{}');
        const manager = new ElectronSettingManager();

        manager.setSecureSetting('ai-setting-secret', 'sk-openai');

        expect(manager.getSecureSetting('ai-setting-secret')).toBe('sk-openai');
        const written = writeFileSync.mock.calls.at(-1)?.[1] as string;
        expect(written).not.toContain('sk-openai');
        expect(JSON.parse(written).secureSetting['ai-setting-secret']).toBe(
            Buffer.from('enc:sk-openai', 'utf8').toString('base64'),
        );
        // not the coerce-to-null of `setClientSetting`: a non-string must not
        // overwrite a real credential
        manager.setSecureSetting('ai-setting-secret', 12);
        expect(manager.getSecureSetting('ai-setting-secret')).toBe('sk-openai');
        expect(manager.getSecureSetting('missing')).toBeNull();

        manager.deleteSecureSetting('ai-setting-secret');
        expect(manager.getSecureSetting('ai-setting-secret')).toBeNull();
    });

    test('reads back an encrypted value written by an earlier run', () => {
        readFileSync.mockReturnValue(
            JSON.stringify({
                secureSetting: {
                    'ai-setting-secret': Buffer.from(
                        'enc:sk-openai',
                        'utf8',
                    ).toString('base64'),
                },
            }),
        );
        const manager = new ElectronSettingManager();

        expect(manager.getSecureSetting('ai-setting-secret')).toBe('sk-openai');
        // the second read is served from the cache, so the OS is hit once
        expect(manager.getSecureSetting('ai-setting-secret')).toBe('sk-openai');
        expect(
            electronMockState.safeStorage.decryptString,
        ).toHaveBeenCalledTimes(1);

        manager.clearSecureSettings();
        expect(manager.getSecureSetting('ai-setting-secret')).toBeNull();
    });

    test('drops a blob it cannot decrypt, e.g. a profile copied between users', () => {
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            readFileSync.mockReturnValue(
                JSON.stringify({
                    secureSetting: {
                        'ai-setting-secret':
                            Buffer.from('from-another-user').toString('base64'),
                    },
                }),
            );
            const manager = new ElectronSettingManager();

            expect(manager.getSecureSetting('ai-setting-secret')).toBeNull();
            // dropped, so the UI reads "not set" rather than showing a saved
            // credential nothing can use
            expect(manager.settingObject.secureSetting).toEqual({});
        } finally {
            consoleLogSpy.mockRestore();
        }
    });

    test('keeps credentials for the session but off disk with no OS store', () => {
        electronMockState.safeStorage.isEncryptionAvailable.mockReturnValue(
            false,
        );
        readFileSync.mockReturnValue(
            JSON.stringify({
                secureSetting: { 'ai-setting-secret': 'c3RhbGU=' },
            }),
        );
        const manager = new ElectronSettingManager();

        manager.setSecureSetting('ai-setting-secret', 'sk-openai');

        expect(manager.getSecureSetting('ai-setting-secret')).toBe('sk-openai');
        // usable now, but nothing was written, and the stale blob is gone so it
        // cannot resurrect once the keyring unlocks
        expect(manager.settingObject.secureSetting).toEqual({});
        expect(
            electronMockState.safeStorage.encryptString,
        ).not.toHaveBeenCalled();
    });

    test('strips legacy cleartext credentials on load, exactly once', () => {
        readFileSync.mockReturnValue(
            JSON.stringify({
                clientSetting: {
                    'ai-setting': JSON.stringify({
                        openAIAPIKey: 'sk-openai',
                        isAutoPlay: true,
                    }),
                    'selected-parent-dir': 'C:\data',
                },
            }),
        );
        const manager = new ElectronSettingManager();

        expect(writeFileSync).toHaveBeenCalledTimes(1);
        const written = writeFileSync.mock.calls[0][1] as string;
        expect(written).not.toContain('sk-openai');
        expect(manager.getClientSetting('ai-setting')).toBe(
            JSON.stringify({ isAutoPlay: false }),
        );
        expect(manager.getClientSetting('selected-parent-dir')).toBe('C:\data');

        // an already clean file must not be rewritten on the next launch
        writeFileSync.mockClear();
        readFileSync.mockReturnValue(
            JSON.stringify({
                clientSetting: { 'ai-setting': JSON.stringify({}) },
            }),
        );
        new ElectronSettingManager();
        expect(writeFileSync).not.toHaveBeenCalled();
    });

    test('a failed write is logged instead of crashing the app', () => {
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        try {
            readFileSync.mockReturnValue('{}');
            const manager = new ElectronSettingManager();
            writeFileSync.mockImplementation(() => {
                throw new Error('disk full');
            });

            expect(() => {
                manager.clearClientSettings();
            }).not.toThrow();
            expect(consoleLogSpy).toHaveBeenCalledWith(
                'Error saving setting',
                expect.any(Error),
            );
        } finally {
            consoleLogSpy.mockRestore();
        }
    });
});
