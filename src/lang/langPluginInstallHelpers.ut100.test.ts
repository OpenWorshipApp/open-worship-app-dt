import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// The packaged app's half of Settings > Languages: the catalog read from the
// app's site, a pack downloaded from it, a window that cannot install, an
// extraction with no manifest, and a delete that could not finish. The same
// mock surface as `langPluginInstallHelpers.test.ts`: the disk is a map.

const h = vi.hoisted(() => {
    return {
        isDev: false,
        pluginsDirPath: '/data/lang' as string | null,
        files: new Map<string, string>(),
        lockedDirs: new Set<string>(),
        checksum: 'good',
        extracted: null as Record<string, string> | null,
        toasts: [] as string[],
        notify: vi.fn(),
        logError: vi.fn(),
        initHttpRequest: vi.fn(),
        streamDownloadFile: vi.fn(),
        messageCallback: vi.fn(),
    };
});

vi.mock('../helper/packFileHelpers', () => ({
    pickPackFile: async () => null,
    readPackFileJson: async () => null,
    confirmUnverifiedPackFile: async () => false,
    exportPackFile: async () => null,
    toNotInstallablePackMessage: (detail: string) => {
        return `not installable: ${detail}`;
    },
}));
vi.mock('../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isDev: h.isDev };
        },
        get appInfo() {
            return {
                version: '2026.11.04',
                homepage: 'https://example.invalid',
            };
        },
        messageUtils: { sendDataSync: () => '/repo' },
        langUtils: {
            getLangPluginsDirPath: () => h.pluginsDirPath,
        },
    },
}));
vi.mock('../background/downloadHelper', () => ({
    messageCallback: h.messageCallback,
    streamDownloadFile: async (
        filePath: string,
        response: unknown,
        callback: unknown,
        isOverride: boolean,
    ) => {
        h.streamDownloadFile(filePath, response, callback, isOverride);
        h.files.set(filePath, 'downloaded pack');
    },
}));
vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: async (url: URL) => {
        h.initHttpRequest(url.href);
        return { statusCode: 200 };
    },
}));
vi.mock('../helper/loggerHelpers', () => ({ appError: h.logError }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('../server/appHelpers', () => ({
    tarExtract: async (_filePath: string, dirPath: string) => {
        for (const [name, text] of Object.entries(h.extracted ?? {})) {
            h.files.set(`${dirPath}/${name}`, text);
        }
    },
}));
vi.mock('../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    ensureDirectory: async () => {},
    fsCheckFileExist: async (filePath: string) => h.files.has(filePath),
    fsCloneFile: async (from: string, to: string) => {
        h.files.set(to, h.files.get(from) ?? 'pack');
    },
    fsDeleteFile: async (filePath: string) => {
        h.files.delete(filePath);
    },
    fsDeleteDir: async (dirPath: string) => {
        if (h.lockedDirs.has(dirPath)) {
            throw new Error(`EBUSY ${dirPath}`);
        }
        for (const filePath of [...h.files.keys()]) {
            if (filePath.startsWith(`${dirPath}/`)) {
                h.files.delete(filePath);
            }
        }
    },
    fsMove: async (from: string, to: string) => {
        for (const [filePath, text] of [...h.files]) {
            if (filePath.startsWith(`${from}/`)) {
                h.files.delete(filePath);
                h.files.set(to + filePath.slice(from.length), text);
            }
        }
    },
    fsReadFile: async (filePath: string) => {
        const text = h.files.get(filePath);
        if (text === undefined) {
            throw new Error(`ENOENT ${filePath}`);
        }
        return text;
    },
    getFileChecksum: async () => h.checksum,
    getTempPath: () => '/tmp',
    pathBasename: (filePath: string) => filePath.split('/').pop(),
}));
vi.mock('../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => Promise<unknown>) => {
        return callback();
    },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: (_title: string, message: string) => {
        h.toasts.push(message);
    },
}));
vi.mock('./langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    getCurrentLocale: () => 'en-US',
    getLangCode: (locale: string) => locale.split('-')[0],
    languageNameMap: {},
    setCurrentLocale: vi.fn(),
    tran: (text: string) => text,
}));
vi.mock('./langPluginRegistry', () => ({
    notifyLangPluginsChanged: h.notify,
}));

import {
    deleteLangPlugin,
    getLangCatalogEntries,
    installLangPlugin,
    type LangCatalogEntryType,
} from './langPluginInstallHelpers';

function genEntry(
    langCode: string,
    version: string,
    extra: Partial<LangCatalogEntryType> = {},
): LangCatalogEntryType {
    return {
        apiVersion: 1,
        langCode,
        locale: `${langCode}-XX`,
        name: `Name ${langCode}`,
        nativeName: `Native ${langCode}`,
        description: '',
        version,
        fileFullName: `${langCode}-${version}.tar.gz`,
        checksum: 'good',
        ...extra,
    };
}

function genPlugin(extra: Partial<LangPluginType> = {}): LangPluginType {
    return {
        apiVersion: 1,
        langCode: 'xx',
        locale: 'xx-XX',
        name: 'Name xx',
        nativeName: 'Native xx',
        version: '1.0.0',
        description: '',
        isEnabled: true,
        isBuiltIn: false,
        isRemovable: true,
        builtInVersion: null,
        dirPath: '/data/lang/xx@1.0.0',
        removableDirPaths: ['/data/lang/xx@1.0.0'],
        inlineFiles: {},
        ...extra,
    };
}

// Unicode's first-strong isolate round a name in a sentence.
const ISOLATE_START = String.fromCharCode(0x2068);
const ISOLATE_END = String.fromCharCode(0x2069);

let fetchMock: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

function textResponse(text: string, ok = true, statusText = 'OK') {
    return { ok, statusText, text: async () => text };
}

beforeEach(() => {
    h.isDev = false;
    h.pluginsDirPath = '/data/lang';
    h.files.clear();
    h.lockedDirs.clear();
    h.checksum = 'good';
    h.extracted = null;
    h.toasts = [];
    h.notify.mockClear();
    h.logError.mockClear();
    h.initHttpRequest.mockClear();
    h.streamDownloadFile.mockClear();
    h.messageCallback.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('the published catalog', () => {
    test('is read from the app’s site, fresh, and listed by name', async () => {
        fetchMock.mockResolvedValue(
            textResponse(
                JSON.stringify({
                    version: 1,
                    languages: {
                        yy: [null, 'junk', genEntry('yy', '1.0.0')],
                        xx: [
                            genEntry('xx', '1.0.0', { name: 'Alpha' }),
                            genEntry('xx', '1.0.2', { name: 'Alpha' }),
                        ],
                        zz: 'not a list',
                    },
                }),
            ),
        );

        const list = await getLangCatalogEntries();

        expect(fetchMock).toHaveBeenCalledWith(
            'https://example.invalid/lang/info.json',
            { method: 'GET', cache: 'no-cache' },
        );
        // By name: Alpha before Name yy; the broken rows are skipped.
        expect(list?.map((entry) => [entry.langCode, entry.version])).toEqual([
            ['xx', '1.0.2'],
            ['yy', '1.0.0'],
        ]);
    });

    test('a refused answer, an oversized catalog and no network are null, logged', async () => {
        fetchMock.mockResolvedValueOnce(
            textResponse('', false, 'Service Unavailable'),
        );
        await expect(getLangCatalogEntries()).resolves.toBeNull();
        expect(h.logError).toHaveBeenLastCalledWith(
            'Error fetching the language catalog:',
            new Error('Service Unavailable'),
        );

        fetchMock.mockResolvedValueOnce(
            textResponse(' '.repeat(1024 * 1024 + 1)),
        );
        await expect(getLangCatalogEntries()).resolves.toBeNull();
        expect(h.logError).toHaveBeenLastCalledWith(
            'Error fetching the language catalog:',
            new Error('The language catalog is too large.'),
        );

        fetchMock.mockRejectedValueOnce(new Error('offline'));
        await expect(getLangCatalogEntries()).resolves.toBeNull();
        expect(h.logError).toHaveBeenCalledTimes(3);
        // Offline is not the dev "not built" toast.
        expect(h.toasts).toEqual([]);
    });
});

describe('installing from the published catalog', () => {
    const goodPack = {
        'meta.json': JSON.stringify({ apiVersion: 1, langCode: 'xx' }),
        'index.js': 'plugin',
    };

    test('a pack is downloaded from its folder in the catalog, checked, then installed', async () => {
        h.extracted = goodPack;

        const isInstalled = await installLangPlugin(
            genEntry('xx', '1.0.1'),
            null,
        );

        expect(isInstalled).toBe(true);
        expect(h.initHttpRequest).toHaveBeenCalledWith(
            'https://example.invalid/lang/xx/xx-1.0.1.tar.gz',
        );
        expect(h.streamDownloadFile).toHaveBeenCalledWith(
            '/data/lang/.download-xx-1.0.1.tar.gz',
            { statusCode: 200 },
            h.messageCallback,
            true,
        );
        expect(h.messageCallback).toHaveBeenCalledWith('Downloading...');
        expect(h.files.get('/data/lang/xx@1.0.1/index.js')).toBe('plugin');
        // The archive is not kept.
        expect(h.files.has('/data/lang/.download-xx-1.0.1.tar.gz')).toBe(false);
        expect(h.toasts).toEqual([
            `Installed "${ISOLATE_START}Native xx${ISOLATE_END}" 1.0.1`,
        ]);
    });

    test('a pack the catalog gives an address of its own is fetched from there', async () => {
        h.extracted = goodPack;

        await installLangPlugin(
            genEntry('xx', '1.0.1', {
                url: 'https://cdn.example.invalid/packs/xx.tar.gz',
            }),
            null,
        );

        expect(h.initHttpRequest).toHaveBeenCalledWith(
            'https://cdn.example.invalid/packs/xx.tar.gz',
        );
    });

    test('a pack with no manifest inside is damaged, and nothing is installed', async () => {
        h.extracted = { 'index.js': 'plugin' };

        const isInstalled = await installLangPlugin(
            genEntry('xx', '1.0.1'),
            null,
        );

        expect(isInstalled).toBe(false);
        expect(h.toasts).toEqual([
            'Error: Error: The downloaded language is damaged.',
        ]);
        expect(h.files.has('/data/lang/xx@1.0.1/index.js')).toBe(false);
        expect(h.notify).not.toHaveBeenCalled();
    });

    test('a window with no plugin folder cannot install', async () => {
        h.pluginsDirPath = null;

        await expect(
            installLangPlugin(genEntry('xx', '1.0.1'), null),
        ).rejects.toThrow('This window cannot install languages.');
        expect(h.initHttpRequest).not.toHaveBeenCalled();
    });
});

describe('deleting a language whose files are in use', () => {
    test('what could go goes, the rest is logged and the person told to restart', async () => {
        h.files.set('/data/lang/xx@1.0.0/index.js', 'in use');
        h.files.set('/data/lang/xx@0.9.0/index.js', 'old');
        h.lockedDirs.add('/data/lang/xx@1.0.0');

        const isDeleted = await deleteLangPlugin(
            genPlugin({
                removableDirPaths: [
                    '/data/lang/xx@1.0.0',
                    '/data/lang/xx@0.9.0',
                ],
            }),
        );

        expect(isDeleted).toBe(false);
        expect(h.logError).toHaveBeenCalledWith(
            new Error('EBUSY /data/lang/xx@1.0.0'),
        );
        expect(h.files.has('/data/lang/xx@1.0.0/index.js')).toBe(true);
        expect(h.files.has('/data/lang/xx@0.9.0/index.js')).toBe(false);
        expect(h.toasts).toEqual([
            'Some files are in use. Close the app, then press it again to finish.',
        ]);
        expect(h.notify).toHaveBeenCalledOnce();
    });
});
