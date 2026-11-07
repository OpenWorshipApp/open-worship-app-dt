import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';

// Settings > Languages' work: the catalog, the search, a language turned off,
// installed, updated and deleted. Every app module it reaches is this file's
// own mock (no shared provider mock); the disk is a map of paths.

const h = vi.hoisted(() => {
    return {
        isDev: true,
        appVersion: '2026.11.04',
        files: new Map<string, string>(),
        dirs: new Set<string>(),
        home: new Map<string, string>(),
        locale: 'en-US',
        // English's locale table, where a test needs it to differ from "the
        // tag's language part": `null` is a locale it has no row for.
        localeTable: {} as Record<string, string | null>,
        checksum: 'good',
        extracted: null as Record<string, string> | null,
        toasts: [] as string[],
        notify: vi.fn(),
        tarExtract: vi.fn(),
        setCurrentLocale: vi.fn(),
        // What a picked file's `meta.json` reads as (`readPackFileJson`).
        packJson: null as unknown,
        isConfirmed: false,
        confirm: vi.fn(),
        exportPackFile: vi.fn(),
        getFileChecksum: vi.fn(),
    };
});

vi.mock('../helper/packFileHelpers', () => ({
    pickPackFile: async () => null,
    readPackFileJson: async () => h.packJson,
    confirmUnverifiedPackFile: async () => {
        h.confirm();
        return h.isConfirmed;
    },
    exportPackFile: async (title: string, filePath: string, name: string) => {
        // What was on disk at the moment it was copied out.
        h.exportPackFile(title, filePath, name, h.files.get(filePath));
        return `/downloads/${name}`;
    },
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
                version: h.appVersion,
                homepage: 'https://example.invalid',
            };
        },
        messageUtils: { sendDataSync: () => '/repo' },
        langUtils: { getLangPluginsDirPath: () => '/data/lang' },
    },
}));
vi.mock('../background/downloadHelper', () => ({
    messageCallback: vi.fn(),
    streamDownloadFile: vi.fn(),
}));
vi.mock('../helper/loggerHelpers', () => ({ appError: vi.fn() }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('../server/appHelpers', () => ({
    tarExtract: async (filePath: string, dirPath: string) => {
        h.tarExtract(filePath, dirPath);
        for (const [name, text] of Object.entries(h.extracted ?? {})) {
            h.files.set(`${dirPath}/${name}`, text);
        }
    },
}));
vi.mock('../server/appHomeStorage', () => ({
    appHomeStorage: {
        getItem: (key: string) => h.home.get(key) ?? null,
        setItem: (key: string, value: string) => h.home.set(key, value),
        removeItem: (key: string) => h.home.delete(key),
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    ensureDirectory: async (dirPath: string) => {
        h.dirs.add(dirPath);
    },
    fsCheckFileExist: async (filePath: string) => h.files.has(filePath),
    fsCloneFile: async (from: string, to: string) => {
        h.files.set(to, h.files.get(from) ?? 'pack');
    },
    fsDeleteFile: async (filePath: string) => {
        h.files.delete(filePath);
    },
    fsDeleteDir: async (dirPath: string) => {
        h.dirs.delete(dirPath);
        for (const filePath of [...h.files.keys()]) {
            if (filePath.startsWith(`${dirPath}/`)) {
                h.files.delete(filePath);
            }
        }
    },
    fsMove: async (from: string, to: string) => {
        h.dirs.delete(from);
        h.dirs.add(to);
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
    getFileChecksum: async (filePath: string) => {
        h.getFileChecksum(filePath);
        return h.checksum;
    },
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
    getCurrentLocale: () => h.locale,
    getLangCode: (locale: string) => {
        return Object.hasOwn(h.localeTable, locale)
            ? h.localeTable[locale]
            : locale.split('-')[0];
    },
    languageNameMap: { he: 'Hebrew (A)', xx: 'Example (Y)' },
    setCurrentLocale: h.setCurrentLocale,
    tran: (text: string) => text,
}));
vi.mock('./langPluginRegistry', () => ({
    notifyLangPluginsChanged: h.notify,
}));

import {
    checkIsLangUpdateAvailable,
    deleteLangPlugin,
    getDisabledLangCodes,
    getLangCatalogEntries,
    importLangPluginFromFile,
    installLangPlugin,
    isolateText,
    listLangUpdateCodes,
    saveLangPackToDownloads,
    searchLangCatalog,
    setLangPluginEnabled,
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

beforeEach(() => {
    h.isDev = true;
    h.files.clear();
    h.dirs.clear();
    h.home.clear();
    h.locale = 'en-US';
    h.localeTable = {};
    h.checksum = 'good';
    h.extracted = null;
    h.toasts = [];
    h.notify.mockClear();
    h.tarExtract.mockClear();
    h.setCurrentLocale.mockClear();
    h.packJson = null;
    h.isConfirmed = false;
    h.confirm.mockClear();
    h.exportPackFile.mockClear();
    h.getFileChecksum.mockClear();
});

describe('the catalog', () => {
    test('the newest pack of each language this app can load', async () => {
        h.files.set(
            '/repo/extra-work/lang/info.json',
            JSON.stringify({
                version: 1,
                languages: {
                    xx: [
                        genEntry('xx', '1.0.10'),
                        genEntry('xx', '1.0.9'),
                        genEntry('xx', '2.0.0', { apiVersion: 2 }),
                    ],
                    yy: [
                        genEntry('yy', '1.0.0', {
                            minAppVersion: '2099.01.01',
                        }),
                    ],
                    zz: [genEntry('zz', '0.1.0', { fileFullName: '../evil' })],
                    en: [genEntry('en', '9.9.9')],
                },
            }),
        );
        const list = await getLangCatalogEntries();
        expect(list?.map((entry) => [entry.langCode, entry.version])).toEqual([
            ['xx', '1.0.10'],
        ]);
    });

    test('a language the English locale table has no row for is still offered', async () => {
        // Before, an entry whose locale the table did not name was dropped
        // without a word: eleven packed languages never showed in the list.
        h.localeTable = { 'qq-QQ': null, 'rr-QQ': 'ss' };
        h.files.set(
            '/repo/extra-work/lang/info.json',
            JSON.stringify({
                version: 1,
                languages: {
                    qq: [genEntry('qq', '0.0.1', { locale: 'qq-QQ' })],
                    // The table says this locale is another language's.
                    rr: [genEntry('rr', '0.0.1', { locale: 'rr-QQ' })],
                    // Its locale is of another language altogether.
                    tt: [genEntry('tt', '0.0.1', { locale: 'qq-QQ' })],
                },
            }),
        );
        const list = await getLangCatalogEntries();
        expect(list?.map((entry) => entry.langCode)).toEqual(['qq']);
    });

    test('no catalog reads as null, never as an empty catalog', async () => {
        await expect(getLangCatalogEntries()).resolves.toBeNull();
        expect(h.toasts[0]).toContain('build-lang-plugins.mjs --pack');
    });

    test('the launch look reads it quietly: no toast nobody asked for', async () => {
        await expect(getLangCatalogEntries(true)).resolves.toBeNull();
        expect(h.toasts).toEqual([]);
    });

    test('a person finds their language by any name they can type', () => {
        const list = [genEntry('he', '1.0.0', { nativeName: 'Own' })];
        expect(searchLangCatalog(list, '')).toEqual(list);
        expect(searchLangCatalog(list, ' HEB ')).toEqual(list);
        expect(searchLangCatalog(list, 'own')).toEqual(list);
        expect(searchLangCatalog(list, 'he-xx')).toEqual(list);
        expect(searchLangCatalog(list, 'spanish')).toEqual([]);
    });

    test('an update is a newer version than the one in use', () => {
        const plugin = genPlugin({ version: '1.0.9' });
        expect(
            checkIsLangUpdateAvailable(plugin, genEntry('xx', '1.0.10')),
        ).toBe(true);
        expect(
            checkIsLangUpdateAvailable(plugin, genEntry('xx', '1.0.9')),
        ).toBe(false);
        expect(checkIsLangUpdateAvailable(plugin, undefined)).toBe(false);
    });

    test('the installed languages with a newer pack, by code', () => {
        const pluginList = [
            genPlugin({ langCode: 'xx', version: '1.0.9' }),
            genPlugin({ langCode: 'yy', version: '2.0.0' }),
            genPlugin({ langCode: 'zz', version: '0.1.0' }),
        ];
        expect(
            listLangUpdateCodes(pluginList, [
                genEntry('yy', '2.0.0'),
                genEntry('xx', '1.0.10'),
                genEntry('ww', '9.0.0'),
            ]),
        ).toEqual(['xx']);
        expect(listLangUpdateCodes(pluginList, [])).toEqual([]);
    });
});

describe('turning a language off', () => {
    test('off falls back to English when it is the language in use', () => {
        h.locale = 'xx-XX';
        setLangPluginEnabled('xx', false);
        expect(getDisabledLangCodes()).toEqual(['xx']);
        expect(h.setCurrentLocale).toHaveBeenCalledWith('en-US');
        expect(h.notify).toHaveBeenCalledOnce();
        setLangPluginEnabled('xx', true);
        expect(getDisabledLangCodes()).toEqual([]);
        expect(h.home.has('disabled-lang-codes')).toBe(false);
    });

    test('off for another language leaves the one in use alone', () => {
        h.locale = 'yy-XX';
        setLangPluginEnabled('xx', false);
        expect(h.setCurrentLocale).not.toHaveBeenCalled();
    });
});

describe('installing', () => {
    test('a verified pack replaces the copy in use', async () => {
        h.files.set('/repo/extra-work/lang/xx-1.0.1.tar.gz', 'pack');
        h.files.set('/data/lang/xx@1.0.0/index.js', 'old');
        h.dirs.add('/data/lang/xx@1.0.0');
        h.extracted = {
            'meta.json': JSON.stringify({ apiVersion: 1, langCode: 'xx' }),
            'index.js': 'new',
        };
        const isInstalled = await installLangPlugin(
            genEntry('xx', '1.0.1'),
            genPlugin(),
        );
        expect(isInstalled).toBe(true);
        expect(h.files.get('/data/lang/xx@1.0.1/index.js')).toBe('new');
        expect(h.files.has('/data/lang/xx@1.0.0/index.js')).toBe(false);
        // Nothing left behind: no archive, no staging folder.
        expect(
            [...h.files.keys()].filter((filePath) => filePath.includes('/.')),
        ).toEqual([]);
        expect(h.notify).toHaveBeenCalledOnce();
    });

    test('a pack that fails its checksum is never extracted', async () => {
        h.files.set('/repo/extra-work/lang/xx-1.0.1.tar.gz', 'pack');
        h.checksum = 'bad';
        const isInstalled = await installLangPlugin(
            genEntry('xx', '1.0.1'),
            null,
        );
        expect(isInstalled).toBe(false);
        expect(h.tarExtract).not.toHaveBeenCalled();
        expect(h.toasts[0]).toContain('damaged');
        expect(h.notify).not.toHaveBeenCalled();
    });

    test('a pack of another language is refused after extraction', async () => {
        h.files.set('/repo/extra-work/lang/xx-1.0.1.tar.gz', 'pack');
        h.extracted = {
            'meta.json': JSON.stringify({ apiVersion: 1, langCode: 'yy' }),
            'index.js': 'other',
        };
        const isInstalled = await installLangPlugin(
            genEntry('xx', '1.0.1'),
            null,
        );
        expect(isInstalled).toBe(false);
        expect(h.files.has('/data/lang/xx@1.0.1/index.js')).toBe(false);
    });
});

describe('deleting', () => {
    test('a language with no copy in the app falls back to English', async () => {
        h.locale = 'xx-XX';
        h.files.set('/data/lang/xx@1.0.0/index.js', 'x');
        const isDeleted = await deleteLangPlugin(genPlugin());
        expect(isDeleted).toBe(true);
        expect(h.files.size).toBe(0);
        expect(h.setCurrentLocale).toHaveBeenCalledWith('en-US');
        expect(h.notify).toHaveBeenCalledOnce();
    });

    test('an update of a shipped language goes back to the shipped one', async () => {
        h.locale = 'xx-XX';
        await deleteLangPlugin(genPlugin({ builtInVersion: '0.0.1' }));
        expect(h.setCurrentLocale).not.toHaveBeenCalled();
    });

    test('a name of another direction is kept apart in a sentence', () => {
        expect(isolateText('abc')).toBe('"⁨abc⁩"');
    });
});

function genPackMeta(extra: Record<string, unknown> = {}) {
    return {
        apiVersion: 1,
        langCode: 'xx',
        locale: 'xx-XX',
        name: 'Name xx',
        nativeName: 'Native xx',
        version: '1.0.0',
        ...extra,
    };
}

function setCatalog(entries: LangCatalogEntryType[]) {
    h.files.set(
        '/repo/extra-work/lang/info.json',
        JSON.stringify({ version: 1, languages: { xx: entries } }),
    );
}

describe('importing a language from a file', () => {
    test('a published pack, even an older one, installs with no question and replaces the copy in use', async () => {
        setCatalog([
            genEntry('xx', '1.0.0', { checksum: 'older' }),
            genEntry('xx', '1.0.1', { checksum: 'good' }),
        ]);
        h.checksum = 'older';
        h.packJson = genPackMeta();
        h.extracted = {
            'meta.json': JSON.stringify(genPackMeta()),
            'index.js': 'from the file',
        };
        h.files.set('/data/lang/xx@1.0.1/index.js', 'newer');
        const installed = genPlugin({
            version: '1.0.1',
            dirPath: '/data/lang/xx@1.0.1',
            removableDirPaths: ['/data/lang/xx@1.0.1'],
        });

        const isInstalled = await importLangPluginFromFile(
            [installed],
            '/usb/xx-1.0.0.tar.gz',
        );

        expect(isInstalled).toBe(true);
        expect(h.confirm).not.toHaveBeenCalled();
        // Extracted where it lies: nothing downloaded, nothing copied first.
        expect(h.tarExtract).toHaveBeenCalledWith(
            '/usb/xx-1.0.0.tar.gz',
            '/data/lang/.staging-xx-1.0.0',
        );
        expect(h.files.get('/data/lang/xx@1.0.0/index.js')).toBe(
            'from the file',
        );
        expect(h.files.has('/data/lang/xx@1.0.1/index.js')).toBe(false);
        expect(h.toasts.at(-1)).toContain('Native xx');
        expect(h.notify).toHaveBeenCalledOnce();
    });

    test('a pack the catalog never published is asked about; no installs nothing', async () => {
        setCatalog([genEntry('xx', '1.0.0', { checksum: 'good' })]);
        h.checksum = 'made-by-someone';
        h.packJson = genPackMeta();
        h.extracted = {
            'meta.json': JSON.stringify(genPackMeta()),
            'index.js': 'x',
        };

        expect(await importLangPluginFromFile([], '/usb/xx.tar.gz')).toBe(
            false,
        );
        expect(h.confirm).toHaveBeenCalledOnce();
        expect(h.tarExtract).not.toHaveBeenCalled();
        expect(h.notify).not.toHaveBeenCalled();

        h.isConfirmed = true;
        expect(await importLangPluginFromFile([], '/usb/xx.tar.gz')).toBe(true);
        expect(h.files.get('/data/lang/xx@1.0.0/index.js')).toBe('x');
    });

    test('offline (no catalog), the person is asked', async () => {
        h.packJson = genPackMeta();
        await importLangPluginFromFile([], '/usb/xx.tar.gz');
        expect(h.confirm).toHaveBeenCalledOnce();
        // Read quietly: the dev "no catalog built" toast is not for this.
        expect(h.toasts).toEqual([]);
    });

    test('a file no newer than the copy that came with the app is refused', async () => {
        h.packJson = genPackMeta({ version: '1.0.0' });
        const shipped = genPlugin({
            isBuiltIn: true,
            isRemovable: false,
            builtInVersion: '1.0.0',
            removableDirPaths: [],
        });

        expect(
            await importLangPluginFromFile([shipped], '/usb/xx.tar.gz'),
        ).toBe(false);
        expect(h.toasts[0]).toContain('Built in');
        expect(h.getFileChecksum).not.toHaveBeenCalled();
        expect(h.tarExtract).not.toHaveBeenCalled();

        // A newer one is an update of the shipped language.
        h.packJson = genPackMeta({ version: '1.0.1' });
        h.isConfirmed = true;
        h.extracted = {
            'meta.json': JSON.stringify(genPackMeta({ version: '1.0.1' })),
            'index.js': 'x',
        };
        expect(
            await importLangPluginFromFile([shipped], '/usb/xx.tar.gz'),
        ).toBe(true);
    });

    test.each([
        ['nothing readable', null],
        ['another api', genPackMeta({ apiVersion: 2 })],
        ['English', genPackMeta({ langCode: 'en', locale: 'en-US' })],
        ['a locale of another language', genPackMeta({ locale: 'yy-YY' })],
        ['a version that climbs out', genPackMeta({ version: '1/../../x' })],
        ['a newer app needed', genPackMeta({ minAppVersion: '2099.01.01' })],
    ])(
        'a file with %s is no language this app can install',
        async (_case, meta) => {
            h.packJson = meta;
            expect(
                await importLangPluginFromFile([], '/usb/photo.tar.gz'),
            ).toBe(false);
            expect(h.toasts).toEqual(['not installable: "photo.tar.gz"']);
            expect(h.tarExtract).not.toHaveBeenCalled();
        },
    );

    test('closing the file dialog imports nothing', async () => {
        expect(await importLangPluginFromFile([])).toBe(false);
        expect(h.toasts).toEqual([]);
    });
});

describe('saving a catalog pack to pass on', () => {
    test('the checked pack is copied out under its own name, and the download is cleaned up', async () => {
        h.files.set('/repo/extra-work/lang/xx-1.0.1.tar.gz', 'pack');

        const filePath = await saveLangPackToDownloads(genEntry('xx', '1.0.1'));

        expect(filePath).toBe('/downloads/xx-1.0.1.tar.gz');
        const [title, tempFilePath, name, content] =
            h.exportPackFile.mock.calls[0];
        expect([title, name, content]).toEqual([
            'Languages',
            'xx-1.0.1.tar.gz',
            'pack',
        ]);
        expect(tempFilePath).toMatch(
            /^\/tmp\/owa-lang-xx-1\.0\.1-\d+\.tar\.gz$/,
        );
        expect(h.files.has(tempFilePath)).toBe(false);
        // Saved, not installed.
        expect(h.tarExtract).not.toHaveBeenCalled();
        expect(h.notify).not.toHaveBeenCalled();
    });

    test('a pack that fails its checksum is never handed out', async () => {
        h.files.set('/repo/extra-work/lang/xx-1.0.1.tar.gz', 'pack');
        h.checksum = 'bad';

        expect(await saveLangPackToDownloads(genEntry('xx', '1.0.1'))).toBe(
            null,
        );
        expect(h.exportPackFile).not.toHaveBeenCalled();
        expect(h.toasts[0]).toContain('damaged');
        expect(
            [...h.files.keys()].filter((filePath) => {
                return filePath.startsWith('/tmp/');
            }),
        ).toEqual([]);
    });
});
