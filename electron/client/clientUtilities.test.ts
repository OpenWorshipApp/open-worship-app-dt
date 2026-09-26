// @vitest-environment jsdom

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { electronMock, fsMock, httpRequestMock, httpsRequestMock, helperState } =
    vi.hoisted(() => ({
        electronMock: {
            ipcRenderer: {
                off: vi.fn(),
                on: vi.fn(),
                once: vi.fn(),
                send: vi.fn(),
                sendSync: vi.fn(),
            },
            shell: {
                openExternal: vi.fn(),
                openPath: vi.fn(),
            },
            webUtils: { getPathForFile: vi.fn() },
        },
        fsMock: {
            closeSync: vi.fn(),
            copyFile: vi.fn(),
            createReadStream: vi.fn(),
            createWriteStream: vi.fn(),
            existsSync: vi.fn(),
            fstatSync: vi.fn(),
            mkdir: vi.fn(),
            mkdirSync: vi.fn(),
            openSync: vi.fn(),
            readFile: vi.fn(),
            readFileSync: vi.fn(),
            readSync: vi.fn(),
            readdir: vi.fn(),
            readdirSync: vi.fn(),
            rename: vi.fn(),
            renameSync: vi.fn(),
            rmdir: vi.fn(),
            stat: vi.fn(),
            unlink: vi.fn(),
            unlinkSync: vi.fn(),
            watch: vi.fn(),
            writeFile: vi.fn(),
            writeFileSync: vi.fn(),
        },
        httpRequestMock: vi.fn(),
        httpsRequestMock: vi.fn(),
        helperState: { isSecured: false },
    }));

vi.mock('electron', () => electronMock);
vi.mock('node:fs', () => ({ default: fsMock, ...fsMock }));
vi.mock('node:http', () => ({
    default: { request: httpRequestMock },
    request: httpRequestMock,
}));
vi.mock('node:https', () => ({
    default: { request: httpsRequestMock },
    request: httpsRequestMock,
}));
vi.mock('../electronHelpers', () => ({
    POPUP_FRAME_NAME_PREFIX: 'owa-popup',
    commitHash: 'test-commit',
    isArm64: false,
    isDev: true,
    isFedora: false,
    isGlassCapable: true,
    isLinux: false,
    isMac: false,
    get isSecured() {
        return helperState.isSecured;
    },
    isUbuntu: false,
    isWindows: true,
    isWindowsStore: false,
    is64System: true,
    messageChannels: ['one', 'two'],
}));
vi.mock('../fsServe', () => ({ rootUrlAccess: 'owa' }));

import appUtils from './appUtils';
import browserUtils from './browserUtils';
import cryptoUtils from './cryptoUtils';
import envUtils from './envUtils';
import fileUtils from './fileUtils';
import fontUtils from './fontUtils';
import { provider } from './fullProvider';
import httpUtils from './httpUtils';
import messageUtils from './messageUtils';
import pathUtils from './pathUtils';
import systemUtils from './systemUtils';

beforeEach(() => {
    vi.clearAllMocks();
    helperState.isSecured = false;
    electronMock.shell.openExternal.mockResolvedValue(undefined);
    electronMock.shell.openPath.mockResolvedValue('');
    electronMock.webUtils.getPathForFile.mockReturnValue('/tmp/item.txt');
});

describe('cryptoUtils', () => {
    test('round-trips authenticated text and exposes hashes', () => {
        const key = '12345678901234567890123456789012';
        const encrypted = cryptoUtils.encrypt('church data', key);

        expect(encrypted).not.toContain('church data');
        expect(cryptoUtils.decrypt(encrypted, key)).toBe('church data');
        expect(cryptoUtils.createHash('sha256').update('x').digest('hex')).toBe(
            crypto.createHash('sha256').update('x').digest('hex'),
        );
    });

    test('still decrypts the legacy CBC format', () => {
        const key = '12345678901234567890123456789012';
        const cipher = crypto.createCipheriv(
            'aes-256-cbc',
            key,
            '6ce2b3237d3d6690',
        );
        const encrypted = Buffer.concat([
            cipher.update('old setting', 'utf8'),
            cipher.final(),
        ]).toString('base64');

        expect(cryptoUtils.decrypt(encrypted, key)).toBe('old setting');
    });
});

describe('fileUtils', () => {
    test('writes raw and data-url base64 bytes', () => {
        fileUtils.writeFileFromBase64Sync('/tmp/a', 'aGVsbG8=');
        fileUtils.writeFileFromBase64Sync(
            '/tmp/b',
            'data:text/plain;base64,d29ybGQ=',
        );

        expect(fsMock.writeFileSync).toHaveBeenNthCalledWith(
            1,
            '/tmp/a',
            Buffer.from('hello'),
        );
        expect(fsMock.writeFileSync).toHaveBeenNthCalledWith(
            2,
            '/tmp/b',
            Buffer.from('world'),
        );
    });

    test('adds the Electron path to selected and dropped files', () => {
        const selected = new File(['a'], 'selected.txt');
        const input = document.createElement('input');
        Object.defineProperty(input, 'files', { value: [selected] });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect((selected as File & { appFilePath: string }).appFilePath).toBe(
            '/tmp/item.txt',
        );

        electronMock.webUtils.getPathForFile.mockReturnValue('/tmp/drop.txt');
        const dropped = new File(['b'], 'drop.txt');
        const dropEvent = new Event('drop', { bubbles: true });
        Object.defineProperty(dropEvent, 'dataTransfer', {
            value: { files: [dropped] },
        });
        document.dispatchEvent(dropEvent);
        expect((dropped as File & { appFilePath: string }).appFilePath).toBe(
            '/tmp/drop.txt',
        );
    });

    test('leaves a file alone when Electron has no path', () => {
        electronMock.webUtils.getPathForFile.mockReturnValue('');
        const file = new File(['a'], 'memory.txt');
        expect((file as File & { appFilePath?: string }).appFilePath).toBe('');
    });

    test('ignores unrelated and empty file-list events', () => {
        electronMock.webUtils.getPathForFile.mockReturnValue('');
        const selected = new File(['a'], 'memory.txt');
        const input = document.createElement('input');
        Object.defineProperty(input, 'files', { value: [selected] });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        document.dispatchEvent(new Event('change', { bubbles: true }));
        document.dispatchEvent(new Event('drop', { bubbles: true }));

        expect(Object.hasOwn(selected, 'appFilePath')).toBe(false);
    });

    test('defers installation until File exists and installs only once', async () => {
        const RealFile = globalThis.File;
        const descriptor = Object.getOwnPropertyDescriptor(
            RealFile.prototype,
            'appFilePath',
        );
        if (descriptor !== undefined) {
            delete (RealFile.prototype as any).appFilePath;
        }
        const addEventListener = vi.spyOn(globalThis, 'addEventListener');
        Object.defineProperty(globalThis, 'File', {
            configurable: true,
            value: undefined,
        });
        vi.resetModules();
        try {
            await import('./fileUtils');
            const install = addEventListener.mock.calls.find(
                ([name]) => name === 'DOMContentLoaded',
            )?.[1] as EventListener;
            expect(install).toBeTypeOf('function');

            Object.defineProperty(globalThis, 'File', {
                configurable: true,
                value: RealFile,
            });
            install(new Event('DOMContentLoaded'));
            install(new Event('DOMContentLoaded'));
            expect(
                Object.getOwnPropertyDescriptor(
                    RealFile.prototype,
                    'appFilePath',
                ),
            ).toBeDefined();
        } finally {
            Object.defineProperty(globalThis, 'File', {
                configurable: true,
                value: RealFile,
            });
        }
    });
});

describe('message, HTTP, browser and system utilities', () => {
    test('routes every message operation through ipcRenderer', () => {
        const callback = vi.fn();
        electronMock.ipcRenderer.sendSync.mockReturnValue('reply');

        messageUtils.sendData('channel', 1, 2);
        expect(messageUtils.sendDataSync('sync', 3)).toBe('reply');
        messageUtils.listenForData('channel', callback);
        messageUtils.listenOnceForData('once', callback);
        messageUtils.removeListener('channel', callback);

        expect(electronMock.ipcRenderer.send).toHaveBeenCalledWith(
            'channel',
            1,
            2,
        );
        expect(electronMock.ipcRenderer.sendSync).toHaveBeenCalledWith(
            'sync',
            3,
        );
        expect(electronMock.ipcRenderer.on).toHaveBeenCalledWith(
            'channel',
            callback,
        );
        expect(electronMock.ipcRenderer.once).toHaveBeenCalledWith(
            'once',
            callback,
        );
        expect(electronMock.ipcRenderer.off).toHaveBeenCalledWith(
            'channel',
            callback,
        );
        expect(messageUtils.messageChannels).toEqual(['one', 'two']);
    });

    test('keeps HTTP and HTTPS requests separate', () => {
        const callback = vi.fn();
        const secureRequest = {};
        const plainRequest = {};
        httpsRequestMock.mockReturnValue(secureRequest);
        httpRequestMock.mockReturnValue(plainRequest);

        expect(httpUtils.request({ host: 'secure' }, callback)).toBe(
            secureRequest,
        );
        expect(httpUtils.requestHttp({ host: 'plain' }, callback)).toBe(
            plainRequest,
        );
    });

    test('opens safe file and web paths and reports failures', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        systemUtils.openFile('/tmp/a.txt');
        await Promise.resolve();
        expect(logSpy).toHaveBeenCalledWith(
            'File opened with default application.',
        );

        electronMock.shell.openPath.mockResolvedValueOnce('not found');
        systemUtils.openFile('/tmp/missing.txt');
        await Promise.resolve();
        expect(errorSpy).toHaveBeenCalledWith('Error opening file: not found');

        browserUtils.openExternalURL('https://example.com');
        await Promise.resolve();
        expect(electronMock.shell.openExternal).toHaveBeenCalledWith(
            'https://example.com',
        );

        electronMock.shell.openExternal.mockRejectedValueOnce(
            new Error('blocked'),
        );
        browserUtils.openExternalURL('https://bad.example');
        await Promise.resolve();
        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to open URL:',
            expect.any(Error),
        );
    });

    test('copies text and hashes strings and files', async () => {
        systemUtils.copyToClipboard('copy me');
        expect(electronMock.ipcRenderer.send).toHaveBeenCalledWith(
            'main:app:copy-to-clipboard',
            'copy me',
        );
        expect(systemUtils.generateMD5('abc')).toBe(
            crypto.createHash('md5').update('abc').digest('hex'),
        );

        const stream = new EventEmitter();
        fsMock.createReadStream.mockReturnValue(stream);
        const result = systemUtils.generateFileMD5('/tmp/a');
        stream.emit('data', Buffer.from('abc'));
        stream.emit('end');
        await expect(result).resolves.toBe(
            crypto.createHash('md5').update('abc').digest('hex'),
        );

        const failingStream = new EventEmitter();
        fsMock.createReadStream.mockReturnValue(failingStream);
        const failing = systemUtils.generateFileMD5('/tmp/b');
        failingStream.emit('error', new Error('unreadable'));
        await expect(failing).rejects.toThrow('unreadable');
    });
});

describe('small provider utilities', () => {
    test('encodes app values and handles logged errors', () => {
        const traceSpy = vi
            .spyOn(console, 'trace')
            .mockImplementation(() => {});
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        expect(appUtils.base64Decode(appUtils.base64Encode('សួស្តី'))).toBe(
            'សួស្តី',
        );
        appUtils.handleError(new Error('broken'));
        expect(traceSpy).toHaveBeenCalledWith('An error occurred:');
        expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });

    test('exposes path, font, environment and platform behaviour', () => {
        expect(pathUtils.basename(pathUtils.join('a', 'b.txt'))).toBe('b.txt');
        expect(pathUtils.dirname(pathUtils.join('a', 'b.txt'))).toContain('a');
        expect(pathUtils.resolve('.')).toBeTruthy();
        expect(pathUtils.sep).toBeTruthy();
        expect(fontUtils.getFonts()).toEqual({});
        expect(envUtils.isFEUseEffectWarning).toBe(false);
        expect(systemUtils.commitHash).toBe('test-commit');
        expect(systemUtils.isDev).toBe(true);
        expect(systemUtils.isWindows).toBe(true);
    });

    test('composes the renderer provider from the tested utilities', () => {
        expect(provider).toEqual(
            expect.objectContaining({
                appType: 'desktop',
                isDesktop: true,
                appUtils,
                browserUtils,
                cryptoUtils,
                fileUtils,
                fontUtils,
                httpUtils,
                messageUtils,
                pathUtils,
                systemUtils,
            }),
        );
        expect(provider.POPUP_FRAME_NAME_PREFIX).toBe('owa-popup');
    });

    test('converts file paths without invoking a shell', () => {
        const converted = browserUtils.pathToFileURL('/tmp/a b.txt');
        expect(converted).toMatch(/^file:/);
        expect(converted).toContain('a%20b.txt');
    });

    test('converts secured file paths to the app protocol', async () => {
        helperState.isSecured = true;
        vi.resetModules();
        const securedBrowserUtils = (await import('./browserUtils')).default;

        expect(securedBrowserUtils.pathToFileURL('/tmp/a b.txt')).toMatch(
            /^owa:\/\//,
        );
    });
});
