/**
 * A language's song plugin (`open-lyric-plugin-<lang>-<region>`: a keyboard,
 * a spellcheck, fonts for songs in it) is the LANGUAGE's dependency, never
 * the app's (2026-11-05, the user: a language's song plugin has to ship
 * with that language's bundle). The language declares it in its own
 * `package.json`, `extra-work/install-lang-deps.mjs` installs it into the
 * language's own `node_modules`, and `extra-work/build-lang-plugins.mjs`
 * bundles nothing from outside the language's folder. Found by folder: this
 * names no language and holds with every one of them deleted.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { listScannedFiles } from '../../extra-work/language-confinement.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const ONLINE_DIR = path.join(REPO_ROOT, 'src', 'lang', 'data', 'online');
// A locale-named one: `open-lyric-plugin-player` belongs to no language.
const LANG_SONG_PLUGIN_PATTERN = /^open-lyric-plugin-[a-z]{2,3}-[a-z]{2}$/;
const LANG_SONG_PLUGIN_IMPORT_PATTERN =
    /['"](open-lyric-plugin-[a-z]{2,3}-[a-z]{2})(?:\/[^'"]*)?['"]/g;
const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

type ManifestType = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
};

function readDependencyNames(filePath: string) {
    const manifest = JSON.parse(readFileSync(filePath, 'utf8')) as ManifestType;
    return Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
        ...manifest.optionalDependencies,
    });
}

function listLangManifestDirs() {
    if (!existsSync(ONLINE_DIR)) {
        return [];
    }
    return readdirSync(ONLINE_DIR, { withFileTypes: true })
        .filter((entry) => {
            return (
                entry.isDirectory() &&
                existsSync(path.join(ONLINE_DIR, entry.name, 'package.json'))
            );
        })
        .map((entry) => {
            return entry.name;
        });
}

describe("a language's song plugin is the language's own", () => {
    test('the app declares none', () => {
        expect(
            readDependencyNames(path.join(REPO_ROOT, 'package.json')).filter(
                (name) => {
                    return LANG_SONG_PLUGIN_PATTERN.test(name);
                },
            ),
        ).toEqual([]);
    });

    // Read while the suite is collected, as the confinement test reads the
    // same list: thousands of files, which a test's own timeout is not for.
    const codeFileList = listScannedFiles().filter((file: string) => {
        return CODE_FILE_PATTERN.test(file);
    });
    const importList = codeFileList.flatMap((file: string) => {
        const text = readFileSync(path.join(REPO_ROOT, file), 'utf8');
        return [...text.matchAll(LANG_SONG_PLUGIN_IMPORT_PATTERN)].map(
            (match) => {
                return `${file}: ${match[1]}`;
            },
        );
    });

    test('no code outside the language folders imports one', () => {
        expect(codeFileList).toContain('src/lyric-list/lyricHelpers.ts');
        expect(importList).toEqual([]);
    });

    test.each(listLangManifestDirs())(
        '%s declares only its own song plugin, with a lockfile, its peer left to the app',
        (code) => {
            const dirPath = path.join(ONLINE_DIR, code);
            for (const name of readDependencyNames(
                path.join(dirPath, 'package.json'),
            )) {
                expect(name).toMatch(LANG_SONG_PLUGIN_PATTERN);
                expect(name.startsWith(`open-lyric-plugin-${code}-`)).toBe(
                    true,
                );
            }
            expect(existsSync(path.join(dirPath, 'package-lock.json'))).toBe(
                true,
            );
            // The plugin's peer, `open-lyric`, is the app's copy and on no
            // registry: resolving it here would fail the install.
            expect(readFileSync(path.join(dirPath, '.npmrc'), 'utf8')).toMatch(
                /^legacy-peer-deps=true$/m,
            );
        },
    );
});
