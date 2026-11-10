import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: { initAllLangCss: vi.fn() },
}));

vi.mock('./langHelpers', () => ({
    initAllLangCss: mocks.initAllLangCss,
}));

import { genFontsData } from './data/online/langFontFaces';
import {
    genLangEditorFontFamilies,
    genLangOpenLyricFontFaces,
    genLangStickyNoteFontFamilies,
    getLangFontList,
    mergeLangFontList,
    parseLangFontFaces,
} from './langFontListHelpers';

// A package's fonts as `genFontsData` writes them, with made-up names.
function genPackageCss() {
    return genFontsData(
        {
            uiFamily: 'app-Sample Serif',
            family: 'Sample Serif',
            faces: [
                { file: 'fonts/regular.ttf', weight: 'normal' },
                { file: 'fonts/bold.ttf', weight: 'bold' },
                { file: 'fonts/light.ttf', weight: '300' },
                { file: 'fonts/italic.ttf', weight: 'normal', style: 'italic' },
            ],
            lookAlikes: ['Other Design'],
            stickyNote: { family: 'Sample Hand', file: 'fonts/hand.ttf' },
        },
        {
            'fonts/regular.ttf': 'blob:regular',
            'fonts/bold.ttf': 'blob:bold',
            'fonts/light.ttf': 'blob:light',
            'fonts/italic.ttf': 'blob:italic',
            'fonts/hand.ttf': 'blob:hand',
        },
    ).css;
}

// A second package: the app's default face, no sticky hand.
function genDefaultCss() {
    return genFontsData(
        {
            uiFamily: 'app-Default Sans',
            family: 'Default Sans',
            faces: [{ file: 'fonts/sans.ttf', weight: 'normal' }],
        },
        { 'fonts/sans.ttf': 'blob:sans' },
    ).css;
}

const DEFAULT_LANG = {
    name: 'Default',
    langCode: 'xx',
    fontFamily: 'app-Default Sans',
    genCss: genDefaultCss,
};
const SAMPLE_LANG = {
    name: 'Sample',
    langCode: 'yy',
    fontFamily: 'app-Sample Serif',
    stickyNoteFontFamily: 'Sample Hand',
    genCss: genPackageCss,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("the language packages' fonts in the pickers", () => {
    test('a package lists its app face first, then its family and sticky hand', () => {
        const list = parseLangFontFaces(genPackageCss());
        expect(list).toEqual({
            'app-Sample Serif': ['300', '400', '700'],
            'Sample Serif': ['300', '400', '700'],
            'Sample Hand': ['400'],
        });
        expect(Object.keys(list)[0]).toBe('app-Sample Serif');
    });

    test('a look-alike is never a font of its own', () => {
        expect(parseLangFontFaces(genPackageCss())['Other Design']).toBe(
            undefined,
        );
        expect(parseLangFontFaces('')).toEqual({});
    });

    test('every enabled language is read, every app face on top', async () => {
        mocks.initAllLangCss.mockResolvedValueOnce([
            DEFAULT_LANG,
            SAMPLE_LANG,
            { genCss: () => '' },
        ]);
        const list = await getLangFontList();
        expect(Object.keys(list)).toEqual([
            'app-Default Sans',
            'app-Sample Serif',
            'Default Sans',
            'Sample Hand',
            'Sample Serif',
        ]);
        expect(list['Sample Serif']).toEqual(['300', '400', '700']);
    });

    test('a failing language costs only its fonts', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        mocks.initAllLangCss.mockResolvedValueOnce([
            {
                genCss: () => {
                    throw new Error('broken sheet');
                },
            },
            DEFAULT_LANG,
        ]);
        expect(Object.keys(await getLangFontList())).toEqual([
            'app-Default Sans',
            'Default Sans',
        ]);
        mocks.initAllLangCss.mockRejectedValueOnce(new Error('no plugin'));
        expect(await getLangFontList()).toEqual({});
        expect(errorSpy).toHaveBeenCalledTimes(2);
        errorSpy.mockRestore();
    });

    test("the packages' fonts come first and keep their weights", () => {
        const merged = mergeLangFontList(
            { 'Sample Serif': ['400', '700'] },
            { Arial: ['400', '700'], 'Sample Serif': ['400'] },
        );
        expect(Object.keys(merged!)).toEqual(['Sample Serif', 'Arial']);
        expect(merged!['Sample Serif']).toEqual(['400', '700']);
        expect(mergeLangFontList({}, null)).toBeNull();
        expect(mergeLangFontList({ A: ['400'] }, null)).toEqual({
            A: ['400'],
        });
    });
});

describe("the Bible Note editor's font pickers", () => {
    test('the font box gets every package font, each language its own', () => {
        expect(genLangEditorFontFamilies([DEFAULT_LANG, SAMPLE_LANG])).toEqual([
            // Each language's app face first: pasted text in that
            // language switches to the first font of its code.
            ['app-Default Sans', 'xx'],
            ['app-Sample Serif', 'yy'],
            ['Default Sans', 'xx'],
            ['Sample Hand', 'yy'],
            ['Sample Serif', 'yy'],
        ]);
    });

    test('a package with no sheet still lists its app face', () => {
        expect(
            genLangEditorFontFamilies([
                { langCode: 'yy', fontFamily: 'app-Sample Serif' } as any,
            ]),
        ).toEqual([['app-Sample Serif', 'yy']]);
    });

    test('the sticky-note picker: app faces, the hands, then the rest', () => {
        expect(
            genLangStickyNoteFontFamilies([DEFAULT_LANG, SAMPLE_LANG]),
        ).toEqual([
            'app-Default Sans',
            'app-Sample Serif',
            'Sample Hand',
            'Default Sans',
            'Sample Serif',
        ]);
    });
});

describe("a song's font list", () => {
    test("every package's fonts in its own section, above every other", () => {
        const sections = genLangOpenLyricFontFaces(
            [
                { title: 'System', fontFaces: ['arial'], indexRange: 2 },
                // What a package's own song plugin set: its app face alone.
                {
                    title: 'Sample',
                    fontFaces: ['app-Sample Serif'],
                    indexRange: 2,
                },
            ],
            [DEFAULT_LANG, SAMPLE_LANG],
        );
        expect(sections).toEqual([
            {
                title: 'Default',
                fontFaces: ['app-Default Sans', 'Default Sans'],
                indexRange: -2,
            },
            {
                title: 'Sample',
                fontFaces: ['app-Sample Serif', 'Sample Hand', 'Sample Serif'],
                indexRange: -1,
            },
            { title: 'System', fontFaces: ['arial'], indexRange: 2 },
        ]);
    });

    test('a list that is not one starts empty', () => {
        expect(genLangOpenLyricFontFaces(undefined, [SAMPLE_LANG])).toEqual([
            {
                title: 'Sample',
                fontFaces: ['app-Sample Serif', 'Sample Hand', 'Sample Serif'],
                indexRange: -1,
            },
        ]);
    });
});
