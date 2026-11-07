import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    clearLangPluginsCache,
    configureLangPlugins,
    findLangPluginAssetFilePath,
    getBuiltInLangPluginsDirPath,
    getLangPlugins,
    getLangPluginsDirPath,
    parseLangPluginRoute,
    resolveLangPluginFilePath,
    scanLangPlugins,
} from './langPluginHelpers';
import {
    LANG_PLUGIN_API_VERSION,
    checkIsLangVersionNewer,
    parseDisabledLangCodes,
    toLangPluginBaseUrl,
    toLangPluginMeta,
} from './langPluginProtocol';

// Both homes of a language plugin, as real folders on disk: the scanner only
// ever reads them.
let rootDir = '';
let builtInDirPath = '';
let dataDirPath = '';

function writePlugin(
    parentDir: string,
    folderName: string,
    meta: Record<string, unknown> | string,
    files: Record<string, string> = { 'index.js': 'module.exports = 1;' },
) {
    const dirPath = path.join(parentDir, folderName);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(
        path.join(dirPath, 'meta.json'),
        typeof meta === 'string' ? meta : JSON.stringify(meta),
    );
    for (const [fileName, text] of Object.entries(files)) {
        const filePath = path.join(dirPath, fileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, text);
    }
    return dirPath;
}

function genMeta(langCode: string, version: string, extra = {}) {
    return {
        apiVersion: LANG_PLUGIN_API_VERSION,
        langCode,
        locale: `${langCode}-XX`,
        name: `Name ${langCode}`,
        nativeName: `Native ${langCode}`,
        version,
        description: `About ${langCode}`,
        ...extra,
    };
}

function scan(disabledLangCodes: string[] = [], appVersion = '2026.11.04') {
    return scanLangPlugins({
        builtInDirPath,
        dataDirPath,
        disabledLangCodes,
        appVersion,
    });
}

beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owa-lang-plugins-'));
    builtInDirPath = path.join(rootDir, 'electron-build', 'lang');
    dataDirPath = path.join(rootDir, 'data');
    fs.mkdirSync(builtInDirPath, { recursive: true });
    fs.mkdirSync(path.join(dataDirPath, 'lang'), { recursive: true });
});

afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    configureLangPlugins(() => {
        return {
            builtInDirPath: path.join(os.tmpdir(), 'owa-lang-none'),
            dataDirPath: path.join(os.tmpdir(), 'owa-lang-none'),
            disabledLangCodes: [],
            appVersion: '0',
        };
    });
});

describe('scanLangPlugins: both homes, one format', () => {
    test('a language shipped with the app and one installed are found alike', () => {
        writePlugin(
            builtInDirPath,
            'xx',
            genMeta('xx', '0.0.1', { order: 2 }),
            {
                'index.js': '',
                'script.json': '{"scriptPattern":"[x]"}',
            },
        );
        writePlugin(
            path.join(dataDirPath, 'lang'),
            'yy@1.0.0',
            genMeta('yy', '1.0.0', { order: 1 }),
        );
        const list = scan();
        expect(list.map((plugin) => plugin.langCode)).toEqual(['yy', 'xx']);
        const [installed, builtIn] = list;
        expect(builtIn).toMatchObject({
            isBuiltIn: true,
            isRemovable: false,
            builtInVersion: '0.0.1',
            removableDirPaths: [],
            inlineFiles: { 'script.json': { scriptPattern: '[x]' } },
        });
        expect(installed).toMatchObject({
            isBuiltIn: false,
            isRemovable: true,
            builtInVersion: null,
            isEnabled: true,
        });
        expect(installed.removableDirPaths).toEqual([
            path.join(dataDirPath, 'lang', 'yy@1.0.0'),
        ]);
    });

    test('the highest version wins wherever it is; a tie goes to the app', () => {
        writePlugin(builtInDirPath, 'xx', genMeta('xx', '0.0.2'));
        const installedDir = writePlugin(
            path.join(dataDirPath, 'lang'),
            'xx@0.0.10',
            genMeta('xx', '0.0.10'),
        );
        const [newer] = scan();
        expect(newer).toMatchObject({
            version: '0.0.10',
            isBuiltIn: false,
            builtInVersion: '0.0.2',
            dirPath: installedDir,
        });
        fs.rmSync(installedDir, { recursive: true });
        const sameDir = writePlugin(
            path.join(dataDirPath, 'lang'),
            'xx@0.0.2',
            genMeta('xx', '0.0.2'),
        );
        const [tie] = scan();
        expect(tie.isBuiltIn).toBe(true);
        // Still listed, so Delete takes the redundant copy too.
        expect(tie.removableDirPaths).toEqual([sameDir]);
    });

    test('what is not a loadable plugin is no language', () => {
        const langDir = path.join(dataDirPath, 'lang');
        // An install in progress.
        writePlugin(langDir, '.staging-aa-1', genMeta('aa', '1.0.0'));
        // No code.
        writePlugin(langDir, 'bb', genMeta('bb', '1.0.0'), {});
        // A broken manifest, another contract, English, no version.
        writePlugin(langDir, 'cc', '{not json');
        writePlugin(langDir, 'dd', genMeta('dd', '1.0.0', { apiVersion: 99 }));
        writePlugin(langDir, 'en', genMeta('en', '9.0.0'));
        writePlugin(langDir, 'ee', genMeta('ee', ''));
        // Built for a newer app than this one.
        writePlugin(
            langDir,
            'ff',
            genMeta('ff', '1.0.0', { minAppVersion: '2099.01.01' }),
        );
        fs.writeFileSync(path.join(langDir, 'stray.txt'), '');
        expect(scan()).toEqual([]);
    });

    test('a language turned off is still listed, as off', () => {
        writePlugin(builtInDirPath, 'xx', genMeta('xx', '0.0.1'));
        writePlugin(builtInDirPath, 'yy', genMeta('yy', '0.0.1'));
        const list = scan(['xx']);
        expect(
            list.map((plugin) => [plugin.langCode, plugin.isEnabled]),
        ).toEqual([
            ['xx', false],
            ['yy', true],
        ]);
    });

    test('a home that does not exist lists nothing', () => {
        expect(
            scanLangPlugins({
                builtInDirPath: path.join(rootDir, 'missing'),
                dataDirPath: path.join(rootDir, 'missing-too'),
                disabledLangCodes: [],
                appVersion: '1',
            }),
        ).toEqual([]);
    });
});

describe('files a page may ask for', () => {
    test('only inside the plugin folder', () => {
        const dirPath = writePlugin(
            builtInDirPath,
            'xx',
            genMeta('xx', '1.0.0'),
            {
                'index.js': '',
                'assets/font.ttf': 'x',
            },
        );
        expect(resolveLangPluginFilePath(dirPath, 'assets/font.ttf')).toBe(
            path.join(dirPath, 'assets', 'font.ttf'),
        );
        expect(resolveLangPluginFilePath(dirPath, '../xx/meta.json')).toBe(
            path.join(dirPath, 'meta.json'),
        );
        expect(resolveLangPluginFilePath(dirPath, '../../data')).toBeNull();
        expect(resolveLangPluginFilePath(dirPath, 'assets')).toBeNull();
        expect(resolveLangPluginFilePath(dirPath, 'gone.js')).toBeNull();
    });

    test('a route names a language and a path, and nothing else', () => {
        expect(parseLangPluginRoute('/@lang/km/assets/a%20b.ttf')).toEqual({
            langCode: 'km',
            relativePath: 'assets/a b.ttf',
        });
        expect(parseLangPluginRoute('/@lang/KM/x.js')).toBeNull();
        expect(parseLangPluginRoute('/assets/x.js')).toBeNull();
        expect(parseLangPluginRoute('/@lang/km/%E0%A4%A')).toBeNull();
    });

    test('the registry answers from the language in use, and forgets on a change', () => {
        const oldDir = writePlugin(
            builtInDirPath,
            'xx',
            genMeta('xx', '0.0.1'),
            {
                'index.js': '',
                'assets/a.txt': 'old',
            },
        );
        configureLangPlugins(() => {
            return {
                builtInDirPath,
                dataDirPath,
                disabledLangCodes: [],
                appVersion: '1',
            };
        });
        expect(findLangPluginAssetFilePath('/@lang/xx/assets/a.txt')).toBe(
            path.join(oldDir, 'assets', 'a.txt'),
        );
        expect(
            findLangPluginAssetFilePath('/@lang/zz/assets/a.txt'),
        ).toBeNull();
        const newDir = writePlugin(
            path.join(dataDirPath, 'lang'),
            'xx@0.0.2',
            genMeta('xx', '0.0.2'),
            { 'index.js': '', 'assets/a.txt': 'new' },
        );
        // Cached for a moment, read again once told.
        expect(getLangPlugins()[0].version).toBe('0.0.1');
        clearLangPluginsCache();
        expect(findLangPluginAssetFilePath('/@lang/xx/assets/a.txt')).toBe(
            path.join(newDir, 'assets', 'a.txt'),
        );
        expect(getLangPluginsDirPath()).toBe(path.join(dataDirPath, 'lang'));
    });

    test('the shipped folder is read unpacked from the asar', () => {
        expect(
            getBuiltInLangPluginsDirPath(
                path.join('C:', 'app', 'resources', 'app.asar'),
            ),
        ).toBe(
            path.join(
                'C:',
                'app',
                'resources',
                'app.asar.unpacked',
                'electron-build',
                'lang',
            ),
        );
    });
});

describe('langPluginProtocol', () => {
    test('versions compare by their numbers', () => {
        expect(checkIsLangVersionNewer('0.0.9', '0.0.10')).toBe(true);
        expect(checkIsLangVersionNewer('1.2', '1.2.0')).toBe(false);
        expect(checkIsLangVersionNewer('2026.11.04', '2026.11.03')).toBe(false);
    });

    test('a manifest is read with its defaults', () => {
        expect(
            toLangPluginMeta(
                {
                    apiVersion: LANG_PLUGIN_API_VERSION,
                    langCode: 'xx',
                    locale: 'xx-XX',
                    version: '1.0.0',
                },
                '1',
            ),
        ).toEqual({
            apiVersion: LANG_PLUGIN_API_VERSION,
            langCode: 'xx',
            locale: 'xx-XX',
            name: 'xx',
            nativeName: 'xx',
            version: '1.0.0',
            description: '',
            order: undefined,
            minAppVersion: undefined,
        });
        expect(toLangPluginMeta(null, '1')).toBeNull();
        expect(toLangPluginMeta({ langCode: 'x1' }, '1')).toBeNull();
    });

    test('the switch setting reads junk as nothing turned off', () => {
        expect(parseDisabledLangCodes('["xx",3,"yy"]')).toEqual(['xx', 'yy']);
        expect(parseDisabledLangCodes('{')).toEqual([]);
        expect(parseDisabledLangCodes('{"a":1}')).toEqual([]);
        expect(parseDisabledLangCodes(null)).toEqual([]);
    });

    test('a plugin is served under its code', () => {
        expect(toLangPluginBaseUrl('owa://local', 'xx')).toBe(
            'owa://local/@lang/xx/',
        );
    });
});
