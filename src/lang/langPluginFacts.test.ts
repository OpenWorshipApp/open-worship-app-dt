import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
    LANG_PLUGIN_FACTS_FILE_NAME,
    LANG_PLUGIN_INLINE_FILE_NAMES,
} from '../../electron/langPluginProtocol';
import {
    LANG_PLUGIN_FACTS_FILE_NAME as BUILD_FACTS_FILE_NAME,
    assetSourcePlugin,
    genLangFacts,
} from '../../extra-work/build-lang-plugins.mjs';

// The plugin build's `langFacts.json` (EN-59): what a window needs to draw a
// language without loading it. Made-up package folders in the temp dir.

const dirList: string[] = [];
afterEach(() => {
    for (const dirPath of dirList.splice(0)) {
        rmSync(dirPath, { recursive: true, force: true });
    }
});

function genSourceDir(files: Record<string, string>) {
    const srcDir = mkdtempSync(path.join(tmpdir(), 'owa-lang-facts-'));
    dirList.push(srcDir);
    for (const [relativePath, text] of Object.entries(files)) {
        const filePath = path.join(srcDir, relativePath);
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, text);
    }
    return srcDir;
}

// What the build's own asset plugin records for these emitted files.
function genAssetMap(srcDir: string, emitted: Record<string, string>) {
    const assetMap = new Map<string, string>();
    const bundle = Object.fromEntries(
        Object.entries(emitted).map(([relativePath, fileName]) => {
            return [
                fileName,
                {
                    type: 'asset',
                    fileName,
                    // As the bundler reports them: absolute, forward slashes.
                    originalFileNames: [
                        path
                            .join(srcDir, relativePath)
                            .split(path.sep)
                            .join('/'),
                    ],
                },
            ];
        }),
    );
    (assetSourcePlugin(assetMap) as any).generateBundle({}, bundle);
    return assetMap;
}

const FONTS = {
    uiFamily: 'app-Xx',
    family: 'Xx Sans',
    faces: [
        { file: 'fonts/Xx-Regular.ttf', weight: 'normal' },
        { file: 'fonts/Xx-Bold.ttf', weight: 'bold' },
    ],
    stickyNote: { family: 'Xx Hand', file: 'fonts/Xx-Hand.ttf' },
};

describe('genLangFacts', () => {
    test('the build and the app name the same file, and the app carries it inline', () => {
        expect(BUILD_FACTS_FILE_NAME).toBe(LANG_PLUGIN_FACTS_FILE_NAME);
        expect(LANG_PLUGIN_INLINE_FILE_NAMES).toContain(
            LANG_PLUGIN_FACTS_FILE_NAME,
        );
    });

    test('a language with no fonts says so, and nothing has to be loaded for it', () => {
        const srcDir = genSourceDir({ 'meta.json': '{}' });
        expect(
            genLangFacts({ code: 'xx', srcDir, assetMap: new Map() }),
        ).toEqual({ fonts: null, hasLookupData: false });
    });

    test('maps every font fonts.json names to the asset the build wrote', () => {
        const srcDir = genSourceDir({
            'fonts.json': JSON.stringify(FONTS),
            'location-name-map-data/namesMap.json': '{}',
            'location-name-map-data/locationsMap.json': '{}',
        });
        const assetMap = genAssetMap(srcDir, {
            'fonts/Xx-Regular.ttf': 'assets/Xx-Regular-a1.ttf',
            'fonts/Xx-Bold.ttf': 'assets/Xx-Bold-b2.ttf',
            'fonts/Xx-Hand.ttf': 'assets/Xx-Hand-c3.ttf',
            'location-name-map-data/namesMap.json': 'assets/namesMap-d4.json',
        });
        expect(genLangFacts({ code: 'xx', srcDir, assetMap })).toEqual({
            fonts: FONTS,
            fontFiles: {
                'fonts/Xx-Regular.ttf': 'assets/Xx-Regular-a1.ttf',
                'fonts/Xx-Bold.ttf': 'assets/Xx-Bold-b2.ttf',
                'fonts/Xx-Hand.ttf': 'assets/Xx-Hand-c3.ttf',
            },
            hasLookupData: true,
        });
    });

    test('a font the build did not write fails the build, by name', () => {
        const srcDir = genSourceDir({ 'fonts.json': JSON.stringify(FONTS) });
        const assetMap = genAssetMap(srcDir, {
            'fonts/Xx-Regular.ttf': 'assets/Xx-Regular-a1.ttf',
            'fonts/Xx-Bold.ttf': 'assets/Xx-Bold-b2.ttf',
        });
        expect(() => {
            genLangFacts({ code: 'xx', srcDir, assetMap });
        }).toThrow('fonts/Xx-Hand.ttf');
    });
});
