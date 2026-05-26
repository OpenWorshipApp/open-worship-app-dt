// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

async function loadModule() {
    vi.resetModules();
    globalThis.localStorage.clear();
    history.replaceState(null, '', '/setting.html');
    document.title = 'Browser Mock';
    return await import('./appProvider.mock');
}

describe('appProvider.mock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        globalThis.localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        globalThis.localStorage.clear();
        history.replaceState(null, '', '/setting.html');
    });

    test('supports browser utilities and message dispatch helpers', async () => {
        const openMock = vi.fn();
        vi.stubGlobal('open', openMock);
        const { default: appProviderMock } = await loadModule();

        const onceMock = vi.fn();
        appProviderMock.messageUtils.listenOnceForData(
            'browser:once',
            onceMock,
        );
        appProviderMock.messageUtils.sendData('browser:once', 'first');
        appProviderMock.messageUtils.sendData('browser:once', 'second');

        expect(onceMock).toHaveBeenCalledTimes(1);
        expect(
            appProviderMock.messageUtils.sendDataSync('main:app:get-theme'),
        ).toBe('system');
        expect(
            appProviderMock.messageUtils.sendDataSync(
                'main:app:set-theme',
                'dark',
            ),
        ).toBe(true);
        expect(
            appProviderMock.messageUtils.sendDataSync('main:app:get-theme'),
        ).toBe('dark');

        const displays = appProviderMock.messageUtils.sendDataSync(
            'main:app:get-displays',
        );
        expect(displays.primaryDisplay.id).toBe(0);
        expect(displays.displays).toHaveLength(1);

        expect(
            appProviderMock.browserUtils.pathToFileURL('/docs/test.txt'),
        ).toContain('/docs/test.txt');
        appProviderMock.browserUtils.openExternalURL('https://example.com');
        expect(openMock).toHaveBeenCalledWith(
            'https://example.com',
            '_blank',
            'noopener,noreferrer',
        );
    });

    test('supports mock file, system, database, and helper utilities', async () => {
        const openMock = vi.fn();
        const writeTextMock = vi.fn();
        vi.stubGlobal('open', openMock);
        vi.stubGlobal('navigator', {
            clipboard: {
                writeText: writeTextMock,
            },
        });

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const { default: appProviderMock } = await loadModule();

        appProviderMock.fileUtils.mkdirSync('/browser-data/files');
        appProviderMock.fileUtils.writeFileSync(
            '/browser-data/files/source.txt',
            'hello',
        );
        expect(
            appProviderMock.fileUtils.readFileSync(
                '/browser-data/files/source.txt',
                'utf8',
            ),
        ).toBe('hello');
        expect(
            appProviderMock.fileUtils.existsSync(
                '/browser-data/files/source.txt',
            ),
        ).toBe(true);

        await new Promise<void>((resolve, reject) => {
            appProviderMock.fileUtils.copyFile(
                '/browser-data/files/source.txt',
                '/browser-data/files/copied.txt',
                (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                },
            );
        });
        expect(
            appProviderMock.fileUtils.readFileSync(
                '/browser-data/files/copied.txt',
                'utf8',
            ),
        ).toBe('hello');

        appProviderMock.fileUtils.writeFileFromBase64Sync(
            '/browser-data/files/base64.txt',
            'data:text/plain;base64,aGk=',
        );
        expect(
            appProviderMock.fileUtils.readFileSync(
                '/browser-data/files/base64.txt',
                'utf8',
            ),
        ).toBe('hi');

        appProviderMock.systemUtils.copyToClipboard('copied');
        appProviderMock.systemUtils.openFile('/browser-data/files/source.txt');
        expect(writeTextMock).toHaveBeenCalledWith('copied');
        expect(openMock).toHaveBeenCalledWith(
            expect.stringContaining('data:text/plain;base64,'),
            '_blank',
        );

        await expect(
            appProviderMock.systemUtils.generateFileMD5(
                '/browser-data/files/source.txt',
            ),
        ).resolves.toMatch(/^[0-9a-f]{8}$/);
        expect(appProviderMock.systemUtils.generateMD5('abc')).toMatch(
            /^[0-9a-f]{8}$/,
        );

        expect(appProviderMock.appUtils.base64Decode('aGVsbG8=')).toBe('hello');
        expect(appProviderMock.appUtils.base64Encode('hello')).toBe('aGVsbG8=');
        appProviderMock.appUtils.handleError(new Error('boom'));
        expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));

        const database =
            await appProviderMock.databaseUtils.getSQLiteDatabaseInstance('db');
        expect(database.getAll('select 1')).toEqual([]);
        expect(database.database.prepare('select 1').get()).toBeNull();

        const ytHelper = await appProviderMock.ytUtils.getYTHelper();
        expect(
            ytHelper
                .exec([])
                .on('progress', () => {})
                .off('progress', () => {}),
        ).toBe(ytHelper);
        expect(ytHelper.ytDlpProcess.pid).toBe(0);
        errorSpy.mockRestore();
    });
});
