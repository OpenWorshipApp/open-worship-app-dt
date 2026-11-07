// @vitest-environment jsdom

import type { LanguageDataType } from '../../../../../langHelpers';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    fontFamilies: ['Arial', 'Georgia'],
    handleError: vi.fn(),
    genFontFaces: vi.fn(),
}));

vi.mock('../../../../../langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    genOpenLyricFontFaces: state.genFontFaces,
}));
vi.mock('../../../../../../server/fontHelpers', () => ({
    getFontFamilies: async () => state.fontFamilies,
}));
vi.mock('../../../../../../helper/errorHelpers', () => ({
    handleError: state.handleError,
}));
vi.mock('open-lyric-plugin-km-kh', () => ({
    EditorPluginKmKh: class EditorPluginKmKh {
        isKhmerPlugin = true;
    },
}));

import { loadSourceLangData } from '../../../../../langSourceFiles';

// The package as the plugin build makes it: its folder's data through the
// one factory every language shares (`../../../onlineLangPackage.ts`).
const km: LanguageDataType = await loadSourceLangData('km');

// Both readers in one object: each method takes the one it reads with.
function genReaders(files: Record<string, unknown>, versions = files) {
    const readJsonFile = vi.fn(async (url: string) => {
        const key = Object.keys(files).find((name) => url.includes(name));
        if (key === undefined) {
            throw new Error(`unreadable ${url}`);
        }
        return files[key];
    });
    const readJsonFileVersion = vi.fn(async (url: string) => {
        const key = Object.keys(versions).find((name) => url.includes(name));
        return key === undefined ? null : versions[key];
    });
    return { readJsonFile, readJsonFileVersion, packageDir: '' } as any;
}

beforeEach(() => {
    state.genFontFaces.mockImplementation(
        (fontFaces: unknown[], option: { title: string }) => [
            ...fontFaces,
            option.title,
        ],
    );
});

describe('Khmer language data', () => {
    test('recognises Khmer letters and nothing else', () => {
        expect(km.checkIsThisLang('ព្រះគម្ពីរ')).toBe(true);
        expect(km.checkIsThisLang('John 3:16')).toBe(false);
        expect(km.numList).toEqual([
            '០',
            '១',
            '២',
            '៣',
            '៤',
            '៥',
            '៦',
            '៧',
            '៨',
            '៩',
        ]);
    });

    test('drops the invisible spacing marks a Khmer text carries, and spaces too for a preview', () => {
        const text = 'ព្រះ\u200Bគម្ពីរ\u200C ខ្មែរ';

        expect(km.sanitizeText(text)).toBe('ព្រះគម្ពីរ ខ្មែរ');
        expect(km.sanitizePreviewText(text)).toBe('ព្រះគម្ពីរខ្មែរ');
    });

    test('keeps only Khmer letters and digits in a search, one space between words', () => {
        expect(km.sanitizeFindingText('  ព្រះ, John ៣:១៦!  ')).toBe(
            'ព្រះ ៣ ១៦',
        );
        expect(km.trimText('\u200B\u200Bព្រះ\u200B')).toBe('ព្រះ');
        expect(km.trimText('  ព្រះ  ')).toBe('ព្រះ');
        expect(km.endWord('ព្រះ')).toBe('ព្រះ\u200B');
    });

    test('reads a numbered book name both ways round', () => {
        expect(km.transformBibleBookName(' ពេត្រុសទី១ ')).toEqual([
            'ពេត្រុសទី១',
            '១ ពេត្រុស',
        ]);
        // No number after the ordinal, or nothing before it: as written.
        expect(km.transformBibleBookName('យ៉ូហាន')).toEqual(['យ៉ូហាន']);
        expect(km.transformBibleBookName('ទី១')).toEqual(['ទី១']);
    });

    test('matches dictionary keys whatever their case and padding', () => {
        expect(km.sanitizeTranKey('  Reader ')).toBe('reader');
        expect(km.dictionary.reader).toBe('អានព្រះគម្ពីរ');
        expect(km.getBibleKeyNameMap()).toBeTypeOf('object');
        expect(km.extraBibleContextMenuItems({} as never, {} as never)).toEqual(
            [],
        );
    });

    test('ships every Battambang weight and the sticky-note face', () => {
        const files = km.getFontFamilyFiles!();
        expect(files).toHaveLength(6);
        const css = km.genCss();
        for (const file of files) {
            expect(css).toContain(`url(${file})`);
        }
        expect(css).toContain('font-family: km-font-Fasthand;');
    });

    test('adds the Khmer editor plugin and its font to both Open Lyric surfaces', () => {
        const editor = { addPlugin: vi.fn() };
        const openLyric = { fontFaces: ['System'] };
        const markdownManager = { fontFaces: undefined };

        km.initOpenLyricPlugins!({
            editor,
            openLyric,
            openLyricMarkdownManager: markdownManager,
            genOpenLyricFontFaces: state.genFontFaces,
        } as never);

        expect(editor.addPlugin).toHaveBeenCalledWith(
            'km-KH',
            expect.objectContaining({ isKhmerPlugin: true }),
        );
        expect(openLyric.fontFaces).toEqual(['System', 'Khmer']);
        expect(markdownManager.fontFaces).toEqual(['Khmer']);
        expect(state.genFontFaces).toHaveBeenCalledWith(['System'], {
            title: 'Khmer',
            fontFaces: ['app-Battambang'],
            indexRange: 2,
        });

        // Neither surface present: only the editor gets the plugin.
        state.genFontFaces.mockClear();
        km.initOpenLyricPlugins!({
            editor: undefined,
            genOpenLyricFontFaces: state.genFontFaces,
        } as never);
        expect(state.genFontFaces).not.toHaveBeenCalled();
    });
});

describe('the lookup data Khmer loads like every language', () => {
    test('reads both maps, and says nothing when either is missing', async () => {
        const lang = km;
        const readers = genReaders({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        await expect(lang.getLookupData!(readers)).resolves.toEqual({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        await expect(lang.getLookupDataVersion!(readers)).resolves.toEqual({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });

        const partial = genReaders(
            { namesMap: { adam: 1 } },
            { namesMap: '1.0' },
        );
        await expect(lang.getLookupDataVersion!(partial)).resolves.toBeNull();
        const resolve = vi.fn(
            (bundle: { filePath: string }) => `resolved:${bundle.filePath}`,
        );
        expect(lang.getBibleCrossRefBundleFilePath!(resolve)).toMatch(
            /^resolved:/,
        );
    });

    test('logs an unreadable map and answers nothing', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const readers = genReaders({});

        await expect(km.getLookupData!(readers)).resolves.toBeNull();
        expect(consoleError).toHaveBeenCalledOnce();
        consoleError.mockRestore();
    });
});
