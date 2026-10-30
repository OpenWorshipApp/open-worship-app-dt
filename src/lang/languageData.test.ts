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
vi.mock('open-lyric-plugin-km-kh', () => ({
    EditorPluginKmKh: class EditorPluginKmKh {
        isKhmerPlugin = true;
    },
}));

import en from './data/en/index';
import fr from './data/fr/index';
import km from './data/km/index';

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

describe('the lookup data every language loads the same way', () => {
    test.each([
        ['Khmer', km],
        ['English', en],
        ['French', fr],
    ])(
        '%s reads both maps, and says nothing when either is missing',
        async (_name, lang) => {
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
            await expect(
                lang.getLookupDataVersion!(partial),
            ).resolves.toBeNull();
            const resolve = vi.fn(
                (bundle: { filePath: string }) => `resolved:${bundle.filePath}`,
            );
            expect(lang.getBibleCrossRefBundleFilePath!(resolve)).toMatch(
                /^resolved:/,
            );
        },
    );

    test.each([
        ['Khmer', km],
        ['French', fr],
    ])('%s logs an unreadable map and answers nothing', async (_name, lang) => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const readers = genReaders({});

        await expect(lang.getLookupData!(readers)).resolves.toBeNull();
        expect(consoleError).toHaveBeenCalledOnce();
        consoleError.mockRestore();
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

describe('English and French language data', () => {
    test('English is the default, claims every text and searches plain letters and digits', () => {
        expect(en.locale).toBe('en-US');
        expect(en.langCode).toBe('en');
        expect(en.checkIsThisLang('ព្រះ')).toBe(true);
        expect(en.genCss()).toBe('');
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

    test('French never claims a text, and keeps its accents when searching', () => {
        expect(fr.locale).toBe('fr-FR');
        expect(fr.checkIsThisLang('Jean 3:16')).toBe(false);
        expect(fr.genCss()).toBe('');
        expect(fr.sanitizeText(' a ')).toBe(' a ');
        expect(fr.sanitizePreviewText(' a ')).toBe(' a ');
        expect(
            fr.sanitizeFindingText('  Aimez vos ENNEMIS — Élie, 3:16 '),
        ).toBe('aimez vos ennemis élie 3 16');
        expect(fr.trimText('  mot ')).toBe('mot');
        expect(fr.endWord('mot')).toBe('mot ');
        expect(fr.sanitizeTranKey(' Lecteur ')).toBe('lecteur');
        expect(fr.dictionary.reader).toBe('Lecteur');
        expect(fr.transformBibleBookName('1 Jean')).toEqual(['1 Jean']);
        expect(fr.extraBibleContextMenuItems({} as never, {} as never)).toEqual(
            [],
        );
        expect(fr.getBibleKeyNameMap()).toBeTypeOf('object');
    });
});
