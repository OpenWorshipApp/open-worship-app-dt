import { beforeEach, describe, expect, test, vi } from 'vitest';

// Four stores, faked as maps so every case can say exactly what was on the
// computer before and what is there after. The data folder is `/data`; a
// stored path inside it reads `$DATA_DIR_PATH` on disk, like the real alias.
const h = vi.hoisted(() => {
    const encoder = new TextEncoder();
    return {
        encoder,
        local: new Map<string, string>(),
        home: new Map<string, string>(),
        secure: new Map<string, string>(),
        theme: { value: 'system' },
        secureReads: [] as string[],
        sentData: [] as [string, unknown][],
        manifests: [] as any[],
        tarCreates: [] as { outputFilePath: string; files: string[] }[],
        protects: [] as { plain: string; output: string; password: string }[],
        deletedDirs: [] as string[],
        readable: {
            filePath: '/tmp/import/plain',
            isProtected: false,
        } as { filePath: string; isProtected: boolean } | null,
        extractedManifest: '' as string,
        failTar: false,
    };
});

vi.mock('../../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendDataSync: (channel: string) => {
                return channel === 'main:app:get-theme' ? h.theme.value : null;
            },
            sendData: (channel: string, data: unknown) => {
                h.sentData.push([channel, data]);
                if (channel === 'main:app:set-theme') {
                    h.theme.value = data as string;
                }
            },
        },
    },
}));

vi.mock('../directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        listKeys: async () => Array.from(h.local.keys()),
        toFullPath: (key: string) => `/data/local-storage/${key}`,
        getItemForce: (key: string) => {
            const value = h.local.get(key);
            return value === undefined
                ? null
                : value.replaceAll('$DATA_DIR_PATH/', '/data/');
        },
        // The real one stores the portable form, as `fsWriteFileAtomicSync`
        // does.
        setItem: (key: string, value: string) => {
            h.local.set(key, value.replaceAll('/data/', '$DATA_DIR_PATH/'));
        },
        removeItem: (key: string) => {
            h.local.delete(key);
        },
    },
}));

vi.mock('../../server/appHomeStorage', () => ({
    appHomeStorage: {
        getAllKeys: () => Array.from(h.home.keys()),
        getItem: (key: string) => h.home.get(key) ?? null,
        setItem: (key: string, value: string) => {
            h.home.set(key, value);
        },
        removeItem: (key: string) => {
            h.home.delete(key);
        },
    },
}));

vi.mock('../../server/appSecureStorage', () => ({
    appSecureStorage: {
        getItem: (key: string) => {
            h.secureReads.push(key);
            return h.secure.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
            h.secure.set(key, value);
        },
        removeItem: (key: string) => {
            h.secure.delete(key);
        },
    },
}));

vi.mock('../../server/appHelpers', () => ({
    tarCreate: async (
        _inputDir: string,
        outputFilePath: string,
        files: string[],
    ) => {
        if (h.failTar) {
            throw new Error('tar failed');
        }
        h.tarCreates.push({ outputFilePath, files });
    },
    tarExtract: async () => {},
}));

vi.mock('../../server/fileHelpers', () => ({
    pathJoin: (...parts: string[]) => parts.join('/'),
    pathBasename: (filePath: string) => filePath.split('/').pop() ?? '',
    getDownloadPath: () => '/home/me/Downloads',
    fsCheckFileExist: async (filePath: string) => {
        if (filePath.startsWith('/data/local-storage/')) {
            return h.local.has(filePath.slice('/data/local-storage/'.length));
        }
        return filePath === '/tmp/import/manifest.json'
            ? h.extractedManifest !== ''
            : false;
    },
    fsGetFileSize: async () => h.extractedManifest.length,
    fsReadFileBytes: async (filePath: string) => {
        if (filePath.startsWith('/data/local-storage/')) {
            return h.encoder.encode(
                h.local.get(filePath.slice('/data/local-storage/'.length)),
            );
        }
        return h.encoder.encode(h.extractedManifest);
    },
    // Only paths under the data folder are aliased.
    toPortableFileText: (_filePath: string, text: string) => {
        return text.replaceAll('/data/', '$DATA_DIR_PATH/');
    },
    toRealFileText: (_filePath: string, text: string) => {
        return text.replaceAll('$DATA_DIR_PATH/', '/data/');
    },
}));

vi.mock('../../helper/appArchiveHelpers', () => ({
    ARCHIVE_VERSION: 1,
    MANIFEST_FILE_NAME: 'manifest.json',
    SETTING_ARCHIVE_ITEM_KIND: 'settings',
    createWorkDir: async () => '/tmp/staging',
    safeDeleteDir: async (dirPath: string) => {
        h.deletedDirs.push(dirPath);
    },
    writeArchiveManifest: async (_stagingDir: string, manifest: object) => {
        h.manifests.push(manifest);
    },
}));

vi.mock('../../helper/archivePasswordHelpers', () => ({
    openArchiveForReading: async () => {
        return h.readable === null
            ? null
            : { ...h.readable, dispose: async () => {} };
    },
    protectArchiveFile: async (
        plain: string,
        output: string,
        password: string,
    ) => {
        h.protects.push({ plain, output, password });
        return output;
    },
}));

vi.mock('../../helper/helpers', () => ({
    mapInYieldingBatches: async (
        items: unknown[],
        callee: (item: unknown, index: number) => unknown,
    ) => {
        return Promise.all(items.map(callee));
    },
}));

import {
    countManifestByLeaf,
    createSettingArchive,
    importSettingSections,
    listExportableSettingKeys,
    openSettingArchive,
    validateSettingManifest,
} from './settingArchiveHelpers';

function seedComputer() {
    h.local.set('language-locale', 'km');
    h.local.set('foreground-marquee-top-setting', '{"speed":3}');
    h.local.set('select-dir-image-bg', '$DATA_DIR_PATH/images');
    h.local.set('chatbot-sessions', '[{"secret":"conversation"}]');
    h.local.set('screen-draw-data-0', '{"strokes":[]}');
    h.home.set('ai-setting', '{"isAutoPlay":true}');
    h.home.set('ai-enabled', 'true');
    h.home.set('selected-parent-dir', '/data');
    h.home.set('song-select-setting', '{"clientId":"x"}');
    h.secure.set('ai-setting-secret', '{"openAIAPIKey":"sk-1"}');
    h.secure.set('virtual-display-tls', 'PRIVATE KEY');
    h.theme.value = 'dark';
}

beforeEach(() => {
    h.local.clear();
    h.home.clear();
    h.secure.clear();
    h.theme.value = 'system';
    h.secureReads.length = 0;
    h.sentData.length = 0;
    h.manifests.length = 0;
    h.tarCreates.length = 0;
    h.protects.length = 0;
    h.deletedDirs.length = 0;
    h.readable = { filePath: '/tmp/import/plain', isProtected: false };
    h.extractedManifest = '';
    h.failTar = false;
});

describe('listing what can be exported', () => {
    test('counts by name, and never reads a credential', async () => {
        seedComputer();
        const { refs, countByLeafId } = await listExportableSettingKeys();

        expect(h.secureReads).toEqual([]);
        const keys = refs.map(({ store, key }) => `${store}:${key}`);
        expect(keys).toContain('local:language-locale');
        expect(keys).toContain('home:ai-setting');
        expect(keys).toContain('secure:ai-setting-secret');
        expect(keys).toContain('theme:themeSource');
        for (const excluded of [
            'local:chatbot-sessions',
            'local:screen-draw-data-0',
            'home:ai-enabled',
            'home:selected-parent-dir',
        ]) {
            expect(keys).not.toContain(excluded);
        }
        expect(countByLeafId.get('general.language')).toBe(1);
        // Credentials are listed but not counted: counting would read them.
        expect(countByLeafId.get('secrets.aiKeys')).toBeUndefined();
        // Its plaintext twin is counted.
        expect(countByLeafId.get('secrets.songSelect')).toBe(1);
    });
});

describe('exporting', () => {
    test('writes only the chosen sections, values portable', async () => {
        seedComputer();
        const { refs } = await listExportableSettingKeys();
        const filePath = await createSettingArchive(refs, [
            'general.folders',
            'general.theme',
            'foreground.timers',
            'no.such.leaf',
        ]);

        expect(filePath).toBe('/home/me/Downloads/Settings.owasetting.tar.gz');
        const [manifest] = h.manifests;
        expect(manifest.itemKind).toBe('settings');
        // In catalog order; an empty section is kept so import can reset it.
        expect(manifest.sections).toEqual([
            'general.theme',
            'general.folders',
            'foreground.timers',
        ]);
        expect(manifest.settings).toEqual([
            {
                store: 'local',
                key: 'select-dir-image-bg',
                value: '$DATA_DIR_PATH/images',
            },
            { store: 'theme', key: 'themeSource', value: 'dark' },
        ]);
        expect(h.tarCreates).toEqual([
            {
                outputFilePath: '/home/me/Downloads/Settings.owasetting.tar.gz',
                files: ['manifest.json'],
            },
        ]);
        expect(h.deletedDirs).toEqual(['/tmp/staging']);
    });

    test('a value written before the alias goes out portable too', async () => {
        h.local.set('select-dir-video-bg', '/data/videos');
        const { refs } = await listExportableSettingKeys();
        await createSettingArchive(refs, ['general.folders']);

        expect(h.manifests[0].settings).toEqual([
            {
                store: 'local',
                key: 'select-dir-video-bg',
                value: '$DATA_DIR_PATH/videos',
            },
        ]);
    });

    test('drops credentials from a file without a password', async () => {
        seedComputer();
        const { refs } = await listExportableSettingKeys();
        await createSettingArchive(refs, [
            'secrets.aiKeys',
            'secrets.songSelect',
            'ai.providers',
        ]);

        const [manifest] = h.manifests;
        expect(manifest.sections).toEqual(['ai.providers']);
        expect(manifest.settings).toEqual([
            { store: 'home', key: 'ai-setting', value: '{"isAutoPlay":true}' },
        ]);
        // Not even read.
        expect(h.secureReads).toEqual([]);
    });

    test('protects a file holding credentials', async () => {
        seedComputer();
        const { refs } = await listExportableSettingKeys();
        const filePath = await createSettingArchive(
            refs,
            ['secrets.aiKeys', 'secrets.songSelect'],
            'pw',
        );

        expect(filePath).toBe('/home/me/Downloads/Settings.owasetting.enc');
        const [manifest] = h.manifests;
        expect(manifest.settings).toEqual([
            {
                store: 'home',
                key: 'song-select-setting',
                value: '{"clientId":"x"}',
            },
            {
                store: 'secure',
                key: 'ai-setting-secret',
                value: '{"openAIAPIKey":"sk-1"}',
            },
        ]);
        // The plain tar is written into the staging dir, never Downloads.
        expect(h.tarCreates[0].outputFilePath).toBe(
            '/tmp/staging/plain-archive.tmp',
        );
        expect(h.protects).toEqual([
            {
                plain: '/tmp/staging/plain-archive.tmp',
                output: '/home/me/Downloads/Settings.owasetting.enc',
                password: 'pw',
            },
        ]);
        // Never the TLS key, whatever was chosen.
        expect(h.secureReads).not.toContain('virtual-display-tls');
    });

    test('deletes the staging dir when writing fails', async () => {
        seedComputer();
        h.failTar = true;
        const { refs } = await listExportableSettingKeys();

        await expect(
            createSettingArchive(refs, ['secrets.aiKeys'], 'pw'),
        ).rejects.toThrow('tar failed');
        expect(h.deletedDirs).toEqual(['/tmp/staging']);
    });
});

function genManifest(
    sections: unknown[],
    settings: unknown[],
    extra: object = {},
) {
    return {
        version: 1,
        itemKind: 'settings',
        sections,
        settings,
        dataDirPath: '/elsewhere',
        ...extra,
    };
}

describe('validating a file', () => {
    test('refuses a file that is not one this app wrote', () => {
        expect(() => validateSettingManifest(null, false)).toThrow(
            'Invalid settings archive manifest',
        );
        expect(() =>
            validateSettingManifest(genManifest([], [], { version: 2 }), false),
        ).toThrow('Invalid settings archive manifest');
        expect(() =>
            validateSettingManifest(
                genManifest([], [], { itemKind: 'bible-xml' }),
                false,
            ),
        ).toThrow('This archive holds a "bible-xml", not settings');
        expect(() =>
            validateSettingManifest(genManifest([], {} as any), false),
        ).toThrow('Invalid settings archive manifest');
        expect(() =>
            validateSettingManifest(
                genManifest([], [{ store: 'disk', key: 'a', value: '' }]),
                false,
            ),
        ).toThrow('Invalid setting store at #0');
        expect(() =>
            validateSettingManifest(
                genManifest([], [{ store: 'local', key: 'a', value: 1 }]),
                false,
            ),
        ).toThrow('Invalid setting at #0');
        expect(() =>
            validateSettingManifest(genManifest([], ['x']), false),
        ).toThrow('Invalid setting at #0');
    });

    test('refuses a key that would land outside the settings folder', () => {
        for (const key of ['../evil', '..\\evil', 'C:evil', '.hidden']) {
            expect(() =>
                validateSettingManifest(
                    genManifest(
                        ['general.language'],
                        [{ store: 'local', key, value: 'x' }],
                    ),
                    false,
                ),
            ).toThrow('Invalid setting at #0');
        }
    });

    test('refuses a duplicate and an oversized file', () => {
        const entry = { store: 'local', key: 'language-locale', value: 'km' };
        expect(() =>
            validateSettingManifest(
                genManifest(['general.language'], [entry, entry]),
                false,
            ),
        ).toThrow('Duplicate setting "language-locale"');
        expect(() =>
            validateSettingManifest(
                genManifest(
                    [],
                    [
                        {
                            store: 'local',
                            key: 'a',
                            value: 'x'.repeat(8 * 1024 * 1024 + 1),
                        },
                    ],
                ),
                false,
            ),
        ).toThrow('Setting "a" is too large');
    });

    test('drops what this version will not take', () => {
        const manifest = validateSettingManifest(
            genManifest(
                [
                    'general.language',
                    'ai.providers',
                    'secrets.aiKeys',
                    'no.such.leaf',
                    7,
                ],
                [
                    { store: 'local', key: 'language-locale', value: 'km' },
                    // Outside every section the file lists.
                    { store: 'local', key: 'pdf-full-width', value: 'true' },
                    // Excluded since.
                    { store: 'local', key: 'chatbot-sessions', value: '[]' },
                    { store: 'home', key: 'ai-setting', value: '{}' },
                    { store: 'home', key: 'ai-enabled', value: 'true' },
                    { store: 'home', key: '__proto__', value: '{}' },
                    {
                        store: 'secure',
                        key: 'ai-setting-secret',
                        value: 'planted',
                    },
                    { store: 'theme', key: 'themeSource', value: 'neon' },
                ],
            ),
            false,
        );
        expect(manifest.sections).toEqual(['general.language', 'ai.providers']);
        expect(manifest.settings).toEqual([
            { store: 'local', key: 'language-locale', value: 'km' },
            { store: 'home', key: 'ai-setting', value: '{}' },
        ]);
        expect(manifest).not.toHaveProperty('dataDirPath');
    });

    test('takes credentials only from a protected file', () => {
        const json = genManifest(
            ['secrets.aiKeys'],
            [{ store: 'secure', key: 'ai-setting-secret', value: 'k' }],
        );
        expect(validateSettingManifest(json, false).settings).toEqual([]);
        expect(validateSettingManifest(json, true).settings).toEqual([
            { store: 'secure', key: 'ai-setting-secret', value: 'k' },
        ]);
    });
});

describe('opening a file', () => {
    test('reads the manifest raw, leaving each value portable', async () => {
        h.extractedManifest = JSON.stringify(
            genManifest(
                ['general.folders'],
                [
                    {
                        store: 'local',
                        key: 'select-dir-image-bg',
                        value: '$DATA_DIR_PATH/images',
                    },
                ],
            ),
        );
        const opened = await openSettingArchive(
            '/home/me/Settings.owasetting.tar.gz',
            '/tmp/import',
            'Import Settings',
        );
        expect(opened?.isProtected).toBe(false);
        expect(opened?.manifest.settings[0].value).toBe(
            '$DATA_DIR_PATH/images',
        );
    });

    test('a cancelled password is null, a non-manifest is refused', async () => {
        h.readable = null;
        expect(
            await openSettingArchive(
                '/x.enc',
                '/tmp/import',
                'Import Settings',
            ),
        ).toBeNull();

        h.readable = { filePath: '/tmp/import/plain', isProtected: false };
        await expect(
            openSettingArchive('/x.tar.gz', '/tmp/import', 'Import Settings'),
        ).rejects.toThrow('Invalid settings archive manifest');

        h.extractedManifest = 'not json';
        await expect(
            openSettingArchive('/x.tar.gz', '/tmp/import', 'Import Settings'),
        ).rejects.toThrow('Invalid settings archive manifest');
    });
});

describe('importing replaces each chosen section', () => {
    function genImportManifest() {
        return validateSettingManifest(
            genManifest(
                [
                    'general.language',
                    'general.theme',
                    'general.folders',
                    'foreground.marquee',
                    'ai.providers',
                    'secrets.aiKeys',
                ],
                [
                    { store: 'local', key: 'language-locale', value: 'fr' },
                    {
                        store: 'local',
                        key: 'select-dir-video-bg',
                        value: '$DATA_DIR_PATH/videos',
                    },
                    {
                        store: 'home',
                        key: 'ai-setting',
                        value: '{"isAutoPlay":false}',
                    },
                    {
                        store: 'secure',
                        key: 'ai-custom-servers-secret',
                        value: 'k2',
                    },
                ],
            ),
            true,
        );
    }

    test('removes what the file leaves out, writes what it has', async () => {
        seedComputer();
        const manifest = genImportManifest();
        const result = await importSettingSections(
            manifest,
            [
                'general.language',
                'general.theme',
                'general.folders',
                'foreground.marquee',
                'ai.providers',
                'secrets.aiKeys',
            ],
            true,
        );

        expect(h.local.get('language-locale')).toBe('fr');
        // Expanded for this computer, stored portable again.
        expect(h.local.get('select-dir-video-bg')).toBe(
            '$DATA_DIR_PATH/videos',
        );
        // In a chosen section, absent from the file: back to default.
        expect(h.local.has('select-dir-image-bg')).toBe(false);
        expect(h.local.has('foreground-marquee-top-setting')).toBe(false);
        // Never touched: not in any section, or never travels.
        expect(h.local.get('chatbot-sessions')).toBe(
            '[{"secret":"conversation"}]',
        );
        expect(h.local.has('screen-draw-data-0')).toBe(true);
        expect(h.home.get('ai-enabled')).toBe('true');
        expect(h.home.get('selected-parent-dir')).toBe('/data');
        expect(h.home.get('song-select-setting')).toBe('{"clientId":"x"}');
        expect(h.home.get('ai-setting')).toBe('{"isAutoPlay":false}');
        // The section's credentials are replaced as a whole.
        expect(h.secure.has('ai-setting-secret')).toBe(false);
        expect(h.secure.get('ai-custom-servers-secret')).toBe('k2');
        expect(h.secure.get('virtual-display-tls')).toBe('PRIVATE KEY');
        // No theme in the file: the default.
        expect(h.sentData).toContainEqual(['main:app:set-theme', 'system']);
        expect(result).toEqual({
            writtenCount: 5,
            removedCount: 2,
            needsRelaunch: false,
        });
    });

    test('leaves every section that was not ticked alone', async () => {
        seedComputer();
        const result = await importSettingSections(
            genImportManifest(),
            ['general.language', 'screens.setup'],
            true,
        );

        expect(h.local.get('language-locale')).toBe('fr');
        expect(h.local.get('select-dir-image-bg')).toBe(
            '$DATA_DIR_PATH/images',
        );
        expect(h.local.get('foreground-marquee-top-setting')).toBe(
            '{"speed":3}',
        );
        expect(h.secure.get('ai-setting-secret')).toBe(
            '{"openAIAPIKey":"sk-1"}',
        );
        expect(h.theme.value).toBe('dark');
        // `screens.setup` is not in the file, so it was not taken either.
        expect(result.needsRelaunch).toBe(false);
    });

    test('writes nothing that is already the same', async () => {
        h.local.set('language-locale', 'fr');
        h.theme.value = 'system';
        const result = await importSettingSections(
            genImportManifest(),
            ['general.language', 'general.theme'],
            true,
        );
        expect(result.writtenCount).toBe(0);
        expect(h.sentData).toEqual([]);
    });

    test('never takes credentials out of an unprotected file', async () => {
        seedComputer();
        const manifest = genImportManifest();
        await importSettingSections(manifest, ['secrets.aiKeys'], false);
        expect(h.secure.get('ai-setting-secret')).toBe(
            '{"openAIAPIKey":"sk-1"}',
        );
        expect(h.secure.has('ai-custom-servers-secret')).toBe(false);
    });

    test('asks for a restart when a chosen section needs one', async () => {
        const manifest = validateSettingManifest(
            genManifest(['screens.setup'], []),
            false,
        );
        h.local.set('screen-display--pid-0', '{"displayId":7}');
        const result = await importSettingSections(
            manifest,
            ['screens.setup'],
            false,
        );
        expect(h.local.has('screen-display--pid-0')).toBe(false);
        expect(result).toEqual({
            writtenCount: 0,
            removedCount: 1,
            needsRelaunch: true,
        });
    });

    test('counts the file by section', () => {
        expect(
            Array.from(countManifestByLeaf(genImportManifest()).entries()),
        ).toEqual([
            ['general.language', 1],
            ['general.folders', 1],
            ['ai.providers', 1],
            ['secrets.aiKeys', 1],
        ]);
    });
});
