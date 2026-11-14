/**
 * The language registry before anything set it up, and a request that is no
 * `@lang/<code>/` address at all. A fresh module per test: the registry is
 * module state, and "not configured yet" is a state of its own -- what main
 * answers in the moments before the data folder is known.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type * as LangPluginHelpers from './langPluginHelpers';
import { LANG_PLUGIN_API_VERSION } from './langPluginProtocol';

let rootDir = '';
let helpers: typeof LangPluginHelpers;

function writePlugin(parentDir: string, langCode: string) {
    const dirPath = path.join(parentDir, langCode);
    fs.mkdirSync(path.join(dirPath, 'assets'), { recursive: true });
    fs.writeFileSync(
        path.join(dirPath, 'meta.json'),
        JSON.stringify({
            apiVersion: LANG_PLUGIN_API_VERSION,
            langCode,
            locale: `${langCode}-XX`,
            version: '1.0.0',
        }),
    );
    fs.writeFileSync(path.join(dirPath, 'index.js'), 'module.exports = 1;');
    fs.writeFileSync(path.join(dirPath, 'assets', 'Face.ttf'), 'font');
    return dirPath;
}

beforeEach(async () => {
    rootDir = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), 'owa-lang-ut102-')),
    );
    vi.resetModules();
    helpers = await import('./langPluginHelpers');
});

afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('before the registry is configured', () => {
    test('there is no plugin, no plugin folder and no plugin file', () => {
        const builtInDirPath = path.join(rootDir, 'built-in');
        writePlugin(builtInDirPath, 'xx');

        expect(helpers.getLangPlugins()).toEqual([]);
        expect(helpers.getLangPluginsDirPath()).toBeNull();
        expect(
            helpers.findLangPluginAssetFilePath('/@lang/xx/assets/Face.ttf'),
        ).toBeNull();

        // Configured, the same folder is found at once.
        helpers.configureLangPlugins(() => ({
            builtInDirPath,
            dataDirPath: path.join(rootDir, 'data'),
            disabledLangCodes: [],
            appVersion: '2026.11.14',
        }));
        expect(helpers.getLangPlugins().map((item) => item.langCode)).toEqual([
            'xx',
        ]);
        expect(helpers.getLangPluginsDirPath()).toBe(
            path.join(rootDir, 'data', 'lang'),
        );
    });
});

describe('findLangPluginAssetFilePath', () => {
    test('answers only an @lang address, even for a file that is there', () => {
        const builtInDirPath = path.join(rootDir, 'built-in');
        const dirPath = writePlugin(builtInDirPath, 'xx');
        helpers.configureLangPlugins(() => ({
            builtInDirPath,
            dataDirPath: path.join(rootDir, 'data'),
            disabledLangCodes: [],
            appVersion: '2026.11.14',
        }));

        expect(
            helpers.findLangPluginAssetFilePath('/@lang/xx/assets/Face.ttf'),
        ).toBe(path.join(dirPath, 'assets', 'Face.ttf'));
        for (const urlPathname of [
            '/lang/xx/assets/Face.ttf',
            '/@lang/xx/',
            '/@lang/XX/assets/Face.ttf',
            '/@lang/xx/a%zz.ttf',
            'assets/Face.ttf',
        ]) {
            expect(helpers.findLangPluginAssetFilePath(urlPathname)).toBeNull();
        }
    });
});
