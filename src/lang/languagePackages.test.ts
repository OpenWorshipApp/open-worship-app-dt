// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

import en from './data/en/index';

// The code that lives beside the English dictionary: sanitizers, fonts, book
// names and the lookup-data doors. Every other package's half of this file is
// in its own `tests/lang/languageData.coverage.test.ts`. The English package
// imports `langHelpers`, `fontHelpers` and `errorHelpers` at run time, so
// those are mocked.
const h = vi.hoisted(() => {
    return {
        genOpenLyricFontFaces: vi.fn(),
        getFontFamilies: vi.fn(),
        handleError: vi.fn(),
    };
});

vi.mock('./langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    genOpenLyricFontFaces: h.genOpenLyricFontFaces,
}));
vi.mock('../server/fontHelpers', () => ({
    getFontFamilies: h.getFontFamilies,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));

type FontFace = { title: string; fontFaces: string[]; indexRange: number };

/** A stand-in merge that shows what the package asks to merge. */
function appendFontFace(list: FontFace[], data: FontFace) {
    return [...list, data];
}

async function flush() {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
}

function lookupDoors(lang: typeof en) {
    return {
        async versions(names: number | null, locations: number | null) {
            const readJsonFileVersion = vi.fn(async (url: string) => {
                return url.includes('namesMap') ? names : locations;
            });
            const result = await lang.getLookupDataVersion!({
                readJsonFileVersion,
                packageDir: '',
            } as any);
            return { result, urls: readJsonFileVersion.mock.calls.flat() };
        },
        async data(readJsonFile: (url: string) => Promise<unknown>) {
            return await lang.getLookupData!({
                readJsonFile,
                packageDir: '',
            } as any);
        },
    };
}

beforeEach(() => {
    h.genOpenLyricFontFaces.mockImplementation(appendFontFace);
});

describe('English package', () => {
    test('is the default package and claims any text', () => {
        expect(en.locale).toBe('en-US');
        expect(en.langCode).toBe('en');
        expect(en.dictionary).toEqual({});
        expect(en.checkIsThisLang('✝ ♪ ☀')).toBe(true);
        expect(en.bibleAudioAvailable).toBe(true);
        expect(en.getBibleKeyNameMap!()['KJV']).toBe('King James Version');
    });

    test("ships Google Sans, the app's default face, under both its names", () => {
        const css = en.genCss();
        expect(en.fontFamily).toBe('app-Google-Sans');
        // Six faces, each under the app's name and the font's real one, so a
        // slide or a PowerPoint asking for "Google Sans" gets the shipped file.
        expect(css.match(/font-family: app-Google-Sans;/g)).toHaveLength(6);
        expect(css.match(/font-family: "Google Sans";/g)).toHaveLength(6);
        expect(css.match(/font-style: italic;/g)).toHaveLength(4);
        for (const weight of ['normal', '500', '600', 'bold']) {
            expect(css).toContain(`font-weight: ${weight};`);
        }
        expect(css.match(/GoogleSans-[A-Za-z]+\.ttf/g)?.sort()).toEqual([
            'GoogleSans-Bold.ttf',
            'GoogleSans-Bold.ttf',
            'GoogleSans-BoldItalic.ttf',
            'GoogleSans-BoldItalic.ttf',
            'GoogleSans-Italic.ttf',
            'GoogleSans-Italic.ttf',
            'GoogleSans-Medium.ttf',
            'GoogleSans-Medium.ttf',
            'GoogleSans-Regular.ttf',
            'GoogleSans-Regular.ttf',
            'GoogleSans-SemiBold.ttf',
            'GoogleSans-SemiBold.ttf',
        ]);
        // Not a Bible's script face: a Word export of an English Bible never
        // offers to copy the files (`bibleHelpers.ts`).
        expect(en.globalFontFamily).toBeUndefined();
        expect(en.getFontFamilyFiles).toBeUndefined();
    });

    test('translates nothing and cleans finding text to plain words', () => {
        expect(en.sanitizeTranKey(' Save ')).toBe(' Save ');
        expect(en.sanitizeText(' Hi ')).toBe(' Hi ');
        expect(en.sanitizePreviewText(' Hi ')).toBe(' Hi ');
        expect(en.sanitizeFindingText('Hello, WORLD!  John 3:16')).toBe(
            'hello world john 3 16',
        );
        expect(en.trimText('  Hi ')).toBe('Hi');
        expect(en.endWord('Hi')).toBe('Hi ');
        expect(en.transformBibleBookName('1 Peter')).toEqual(['1 Peter']);
        expect(en.extraBibleContextMenuItems({}, {} as any)).toEqual([]);
    });

    test('resolves its own bundle and lookup data versions', async () => {
        expect(
            en.getBibleCrossRefBundleFilePath((bundle) => bundle.filePath),
        ).toMatch(/\/src\/lang\/data\/en\/bb-cr\.gz\.bundle$/);
        const doors = lookupDoors(en);
        expect((await doors.versions(4, 4)).result).toEqual({
            namesMap: 4,
            locationsMap: 4,
        });
        expect((await doors.versions(null, null)).result).toBeNull();
    });

    test('reads the lookup data, and reports a failure as no data', async () => {
        const doors = lookupDoors(en);
        expect(
            await doors.data(async (url: string) => {
                return url.includes('namesMap') ? 'names' : 'locations';
            }),
        ).toEqual({ namesMap: 'names', locationsMap: 'locations' });

        const error = new Error('unreadable');
        expect(
            await doors.data(async () => {
                throw error;
            }),
        ).toBeNull();
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
    });

    test('offers the system fonts to Open Lyric once they are listed', async () => {
        h.getFontFamilies.mockResolvedValue(['Arial', 'Noto Sans']);
        // A group another package added before this one.
        const other = {
            title: 'Other',
            fontFaces: ['app-xx-face'],
            indexRange: 2,
        };
        const openLyric: any = { fontFaces: [other] };
        const markdownManager: any = {};
        en.initOpenLyricPlugins!({
            openLyric,
            openLyricMarkdownManager: markdownManager,
            genOpenLyricFontFaces: () => {
                throw new Error('English uses the shared helper');
            },
        });
        expect(h.genOpenLyricFontFaces).not.toHaveBeenCalled();
        await flush();

        const system = {
            title: 'System',
            fontFaces: ['Arial', 'Noto Sans'],
            indexRange: 2,
        };
        expect(h.genOpenLyricFontFaces.mock.calls).toEqual([
            [[other], system],
            [[], system],
        ]);
        expect(openLyric.fontFaces).toEqual([other, system]);
        expect(markdownManager.fontFaces).toEqual([system]);
    });

    test('lists the fonts but changes nothing without Open Lyric parts', async () => {
        h.getFontFamilies.mockResolvedValue(['Arial']);
        en.initOpenLyricPlugins!({ genOpenLyricFontFaces: vi.fn() as any });
        await flush();
        expect(h.getFontFamilies).toHaveBeenCalledOnce();
        expect(h.genOpenLyricFontFaces).not.toHaveBeenCalled();
    });
});
