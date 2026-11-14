import { describe, expect, test, vi } from 'vitest';

import type { LangPluginType } from '../../electron/langPluginProtocol';
import { genLangData } from './data/online/onlineLangPackage';
import type { LangFontsFileType } from './data/online/langFontFaces';
import {
    genLangFontData,
    readLangFacts,
    type LangFactsType,
} from './langFontDataHelpers';

// A made-up language `xx` (ASCII names only), with every kind of face a
// `fonts.json` can carry: two weights, a look-alike, a sticky-note hand and
// a song order.
const FONTS: LangFontsFileType = {
    uiFamily: 'app-Xx',
    family: 'Xx Sans',
    faces: [
        { file: 'fonts/Xx-Regular.ttf', weight: 'normal' },
        { file: 'fonts/Xx-Bold.ttf', weight: 'bold' },
        { file: 'fonts/Xx-Italic.ttf', weight: 'normal', style: 'italic' },
    ],
    display: 'swap',
    lookAlikes: ['Xx Old'],
    stickyNote: { family: 'Xx Hand', file: 'fonts/Xx-Hand.ttf' },
    songOrder: 3,
};
const FONT_FILES = {
    'fonts/Xx-Regular.ttf': 'assets/Xx-Regular-a1.ttf',
    'fonts/Xx-Bold.ttf': 'assets/Xx-Bold-b2.ttf',
    'fonts/Xx-Italic.ttf': 'assets/Xx-Italic-c3.ttf',
    'fonts/Xx-Hand.ttf': 'assets/Xx-Hand-d4.ttf',
};
const BASE_URL = 'owa://local/@lang/xx/';

function genPlugin(facts: LangFactsType | null | object) {
    return {
        langCode: 'xx',
        name: 'Name xx',
        inlineFiles: facts === null ? {} : { 'langFacts.json': facts },
    } satisfies Pick<LangPluginType, 'langCode' | 'name' | 'inlineFiles'>;
}

// What the plugin's own factory makes of the same folder, with each file
// served where `host.assetUrl` would put it.
function genFactoryLangData() {
    return genLangData({
        langCode: 'xx',
        meta: {
            locale: 'xx-XX',
            name: 'Name xx',
            nativeName: 'Native xx',
            version: '1.0.0',
        },
        dictionary: {},
        flagSVG: '<svg></svg>',
        fonts: FONTS,
        fontUrls: Object.fromEntries(
            Object.entries(FONT_FILES).map(([fileName, relativePath]) => {
                return [fileName, new URL(relativePath, BASE_URL).href];
            }),
        ),
    });
}

function genSongTargets() {
    const genOpenLyricFontFaces = vi.fn(
        (
            list: { title: string; fontFaces: string[]; indexRange: number }[],
            section: { title: string; fontFaces: string[]; indexRange: number },
        ) => {
            return [...list, section];
        },
    );
    return {
        openLyric: { fontFaces: [] as unknown },
        openLyricMarkdownManager: { fontFaces: [] as unknown },
        genOpenLyricFontFaces,
    };
}

describe('readLangFacts', () => {
    test('a plugin built before the facts file has none, and is loaded instead', () => {
        expect(readLangFacts(genPlugin(null))).toBeNull();
        expect(readLangFacts({ inlineFiles: undefined as any })).toBeNull();
    });

    test('a facts file that does not read as one is none', () => {
        expect(readLangFacts(genPlugin({}))).toBeNull();
        expect(readLangFacts(genPlugin({ fonts: { faces: [] } }))).toBeNull();
        expect(readLangFacts(genPlugin({ fonts: 'app-Xx' }))).toBeNull();
    });

    test('a language with no fonts says so', () => {
        expect(readLangFacts(genPlugin({ fonts: null }))).toEqual({
            fonts: null,
        });
    });
});

describe('genLangFontData', () => {
    test('a language that ships no fonts registers nothing and loads nothing', () => {
        const fontData = genLangFontData(
            genPlugin({ fonts: null, hasLookupData: false }),
            BASE_URL,
        );
        expect(fontData?.genCss()).toBe('');
        expect(fontData?.fontFamily).toBeUndefined();
        expect(fontData?.initOpenLyricPlugins).toBeUndefined();
    });

    test("gives exactly what the plugin's own factory gives", () => {
        const fontData = genLangFontData(
            genPlugin({ fonts: FONTS, fontFiles: FONT_FILES }),
            BASE_URL,
        );
        const langData = genFactoryLangData();
        expect(fontData).not.toBeNull();
        expect(fontData!.genCss()).toBe(langData.genCss());
        expect(fontData!.genCss()).toContain(
            'url(owa://local/@lang/xx/assets/Xx-Bold-b2.ttf)',
        );
        expect(fontData!.getFontFamilyFiles?.()).toEqual(
            langData.getFontFamilyFiles?.(),
        );
        expect(fontData!.fontFamily).toBe(langData.fontFamily);
        expect(fontData!.globalFontFamily).toBe(langData.globalFontFamily);
        expect(fontData!.stickyNoteFontFamily).toBe(
            langData.stickyNoteFontFamily,
        );
    });

    test("a song's font list gets the same section from either", () => {
        const fromFacts = genSongTargets();
        const fromFactory = genSongTargets();
        genLangFontData(
            genPlugin({ fonts: FONTS, fontFiles: FONT_FILES }),
            BASE_URL,
        )!.initOpenLyricPlugins!(fromFacts as any);
        genFactoryLangData().initOpenLyricPlugins!(fromFactory as any);
        expect(fromFacts.openLyric.fontFaces).toEqual([
            { title: 'Name xx', fontFaces: ['app-Xx'], indexRange: 3 },
        ]);
        expect(fromFacts.openLyric.fontFaces).toEqual(
            fromFactory.openLyric.fontFaces,
        );
        expect(fromFacts.openLyricMarkdownManager.fontFaces).toEqual(
            fromFactory.openLyricMarkdownManager.fontFaces,
        );
    });

    test('resolves each file against the base the window fetches from', () => {
        const fontData = genLangFontData(
            genPlugin({ fonts: FONTS, fontFiles: FONT_FILES }),
            'http://127.0.0.1:39240/@lang/xx/',
        );
        expect(fontData!.getFontFamilyFiles?.()).toContain(
            'http://127.0.0.1:39240/@lang/xx/assets/Xx-Hand-d4.ttf',
        );
    });

    test('a facts file missing a font is not used: the plugin is loaded instead', () => {
        const { 'fonts/Xx-Hand.ttf': _hand, ...fontFiles } = FONT_FILES;
        expect(
            genLangFontData(genPlugin({ fonts: FONTS, fontFiles }), BASE_URL),
        ).toBeNull();
        expect(genLangFontData(genPlugin(null), BASE_URL)).toBeNull();
    });
});
