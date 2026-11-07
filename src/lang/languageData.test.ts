// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    fontFamilies: ['Arial', 'Georgia'],
    handleError: vi.fn(),
    genFontFaces: vi.fn(),
}));

vi.mock('./langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    genOpenLyricFontFaces: state.genFontFaces,
}));
vi.mock('../server/fontHelpers', () => ({
    getFontFamilies: async () => state.fontFamilies,
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: state.handleError,
}));

import en from './data/en/index';

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

describe('the lookup data English loads like every language', () => {
    test('reads both maps, and says nothing when either is missing', async () => {
        const readers = genReaders({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        await expect(en.getLookupData!(readers)).resolves.toEqual({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        await expect(en.getLookupDataVersion!(readers)).resolves.toEqual({
            namesMap: { adam: 1 },
            locationsMap: { eden: 2 },
        });
        const partial = genReaders(
            { namesMap: { adam: 1 } },
            { namesMap: '1.0' },
        );
        await expect(en.getLookupDataVersion!(partial)).resolves.toBeNull();
        const resolve = vi.fn(
            (bundle: { filePath: string }) => `resolved:${bundle.filePath}`,
        );
        expect(en.getBibleCrossRefBundleFilePath!(resolve)).toMatch(
            /^resolved:/,
        );
    });

    test('English reports an unreadable map through the app error handler', async () => {
        await expect(en.getLookupData!(genReaders({}))).resolves.toBeNull();
        expect(state.handleError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('unreadable'),
            }),
        );
    });
});

describe('English language data', () => {
    test('English is the default, claims every text and searches plain letters and digits', () => {
        expect(en.locale).toBe('en-US');
        expect(en.langCode).toBe('en');
        expect(en.checkIsThisLang('✝ 📖')).toBe(true);
        // Its face is the app's default (`languagePackages.test.ts`).
        expect(en.fontFamily).toBe('app-Google-Sans');
        expect(en.sanitizeText(' a ')).toBe(' a ');
        expect(en.sanitizePreviewText(' a ')).toBe(' a ');
        expect(en.sanitizeFindingText('  Love,  YOUR enemies! 5:44 ')).toBe(
            'love your enemies 5 44',
        );
        expect(en.trimText('  word ')).toBe('word');
        expect(en.endWord('word')).toBe('word ');
        expect(en.sanitizeTranKey(' Key ')).toBe(' Key ');
        expect(en.transformBibleBookName('1 John')).toEqual(['1 John']);
        expect(en.extraBibleContextMenuItems({} as never, {} as never)).toEqual(
            [],
        );
        expect(en.getBibleKeyNameMap()).toBeTypeOf('object');
    });

    test('English offers the computer’s own fonts to both Open Lyric surfaces', async () => {
        const openLyric = { fontFaces: ['Old'] };
        const markdownManager = { fontFaces: undefined };

        en.initOpenLyricPlugins!({
            openLyric,
            openLyricMarkdownManager: markdownManager,
        } as never);

        await vi.waitFor(() => {
            expect(markdownManager.fontFaces).toEqual(['System']);
        });
        expect(openLyric.fontFaces).toEqual(['Old', 'System']);
        expect(state.genFontFaces).toHaveBeenCalledWith(['Old'], {
            title: 'System',
            fontFaces: ['Arial', 'Georgia'],
            indexRange: 2,
        });
    });
});
