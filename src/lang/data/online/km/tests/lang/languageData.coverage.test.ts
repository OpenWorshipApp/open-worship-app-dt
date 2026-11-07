// @vitest-environment jsdom

import type { LanguageDataType } from '../../../../../langHelpers';
import { EditorPluginKmKh } from 'open-lyric-plugin-km-kh';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadSourceLangData } from '../../../../../langSourceFiles';

// The package as the plugin build makes it: its folder's data through the
// one factory every language shares (`../../../onlineLangPackage.ts`).
const km: LanguageDataType = await loadSourceLangData('km');

// The Khmer half of `src/lang/languagePackages.test.ts`: the code beside the
// dictionary -- digits, sanitizers, fonts, book names and the lookup-data
// doors -- driven with real Khmer text, the real Open Lyric plugin included.
// The package imports nothing at run time but a type from `langHelpers`,
// mocked here so the module never loads.
const h = vi.hoisted(() => {
    return {
        genOpenLyricFontFaces: vi.fn(),
    };
});

vi.mock('../../../../../langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
    genOpenLyricFontFaces: h.genOpenLyricFontFaces,
}));

const ZWSP = '​';
const ZWNJ = '‌';

type FontFace = { title: string; fontFaces: string[]; indexRange: number };

/** A stand-in merge that shows what the package asks to merge. */
function appendFontFace(list: FontFace[], data: FontFace) {
    return [...list, data];
}

function lookupDoors(lang: typeof km) {
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

describe('Khmer package', () => {
    test('names itself, its digits and its fonts', () => {
        expect(km.locale).toBe('km-KH');
        expect(km.langCode).toBe('km');
        expect(km.name).toBe('Khmer');
        expect(km.nativeName).toBe('ខ្មែរ');
        expect(km.numList.join('')).toBe('០១២៣៤៥៦៧៨៩');
        expect(km.fontFamily).toBe('app-Battambang');
        expect(km.globalFontFamily).toBe('Battambang');
        expect(km.stickyNoteFontFamily).toBe('km-font-Fasthand');
        expect(km.bibleAudioAvailable).toBe(false);
        expect(km.getBibleKeyNameMap!()['ពគប']).toBe('ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤');
        expect(km.bibleBooks[0].keys).toContain('អគត');
    });

    test('keeps its dictionary under trimmed, lower-cased keys', () => {
        expect(km.dictionary['reader']).toBe('អានព្រះគម្ពីរ');
        expect(km.dictionary['Reader']).toBeUndefined();
        expect(km.sanitizeTranKey('  Reader \n')).toBe('reader');
    });

    test('tells Khmer text from Latin text', () => {
        expect(km.checkIsThisLang('ព្រះគម្ពីរ')).toBe(true);
        expect(km.checkIsThisLang('Bible ព្រះ')).toBe(true);
        expect(km.checkIsThisLang('Bible 3:16')).toBe(false);
    });

    test('ships six font files and a face for each in its CSS', () => {
        const files = km.getFontFamilyFiles!();
        expect(files).toHaveLength(6);
        const names = files.map((file) => {
            return file.split('/').at(-1);
        });
        expect(names).toEqual([
            'Battambang-Regular.ttf',
            'Battambang-Bold.ttf',
            'Battambang-Light.ttf',
            'Battambang-Thin.ttf',
            'Battambang-Black.ttf',
            'Fasthand-Regular.ttf',
        ]);
        const css = km.genCss();
        expect(css.match(/font-family: app-Battambang;/g)).toHaveLength(5);
        expect(css.match(/font-family: km-font-Fasthand;/g)).toHaveLength(1);
        for (const file of files) {
            expect(css).toContain(`url(${file})`);
        }
    });

    test('drops the invisible joiners, and the spaces from a preview', () => {
        expect(km.sanitizeText(`ព្រះ${ZWSP}យេស៊ូ${ZWNJ}`)).toBe('ព្រះយេស៊ូ');
        expect(km.sanitizePreviewText(`ព្រះ យេស៊ូ${ZWSP} គ្រីស្ទ`)).toBe(
            'ព្រះយេស៊ូគ្រីស្ទ',
        );
    });

    test('a finding text keeps Khmer letters and digits only', () => {
        expect(km.sanitizeFindingText(`«ព្រះ${ZWSP}យេស៊ូ» Jesus, ១២!`)).toBe(
            'ព្រះ យេស៊ូ ១២',
        );
    });

    test('trims the zero-width spaces a word ends with, and adds one back', () => {
        expect(km.trimText(` ${ZWSP}${ZWSP}សួស្តី${ZWSP} `)).toBe('សួស្តី');
        expect(km.trimText(`សួ${ZWSP}ស្តី`)).toBe(`សួ${ZWSP}ស្តី`);
        expect(km.endWord('សួស្តី')).toBe(`សួស្តី${ZWSP}`);
    });

    test('carries its own Bible search words', () => {
        expect(km.bookMarkerWords).toContain('ក្នុង');
        expect(km.findFrameWords).toContain('ស្វែងរក');
        expect(km.stopWords).toContain('និង');
        expect(km.extraBibleContextMenuItems({}, {} as any)).toEqual([]);
    });

    test('a numbered book name also answers with the number first', () => {
        expect(km.transformBibleBookName('ពេត្រុសទី១')).toEqual([
            'ពេត្រុសទី១',
            '១ ពេត្រុស',
        ]);
        expect(km.transformBibleBookName(' យ៉ូហានទី ៣ ')).toEqual([
            'យ៉ូហានទី ៣',
            '៣ យ៉ូហាន',
        ]);
    });

    test('a book name without a single Khmer number after "ទី" stays as it is', () => {
        expect(km.transformBibleBookName('លោកុប្បត្តិ')).toEqual([
            'លោកុប្បត្តិ',
        ]);
        expect(km.transformBibleBookName('ទី១')).toEqual(['ទី១']);
        expect(km.transformBibleBookName('ពេត្រុសទីមួយ')).toEqual([
            'ពេត្រុសទីមួយ',
        ]);
        expect(km.transformBibleBookName('ពេត្រុសទី1')).toEqual(['ពេត្រុសទី1']);
    });

    test('resolves its own cross-reference bundle', () => {
        const resolve = vi.fn(() => '/resolved/km.gz');
        expect(km.getBibleCrossRefBundleFilePath(resolve)).toBe(
            '/resolved/km.gz',
        );
        const [bundle] = resolve.mock.calls[0] as any[];
        expect(bundle.filePath).toMatch(
            /\/src\/lang\/data\/online\/km\/bb-cr\.gz\.bundle$/,
        );
    });

    test('reads the lookup data versions from its own folder', async () => {
        const doors = lookupDoors(km);
        const both = await doors.versions(3, 5);
        expect(both.result).toEqual({ namesMap: 3, locationsMap: 5 });
        expect(both.urls).toHaveLength(2);
        expect(both.urls[0]).toMatch(
            /km\/location-name-map-data\/namesMap\.json/,
        );
        expect(both.urls[1]).toMatch(
            /km\/location-name-map-data\/locationsMap\.json/,
        );
        expect((await doors.versions(null, 5)).result).toBeNull();
        expect((await doors.versions(3, null)).result).toBeNull();
    });

    test('reads the lookup data, and logs a failure as no data', async () => {
        const doors = lookupDoors(km);
        const read = vi.fn(async (url: string) => {
            return { from: url.includes('namesMap') ? 'names' : 'locations' };
        });
        expect(await doors.data(read)).toEqual({
            namesMap: { from: 'names' },
            locationsMap: { from: 'locations' },
        });
        expect(read.mock.calls[0][0]).toMatch(/namesMap\.json/);

        const error = new Error('unreadable');
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        expect(
            await doors.data(async () => {
                throw error;
            }),
        ).toBeNull();
        expect(consoleError).toHaveBeenCalledExactlyOnceWith(error);
        consoleError.mockRestore();
    });

    test('adds its editor plugin and its font to Open Lyric', () => {
        const editor = { addPlugin: vi.fn() };
        const system = { title: 'System', fontFaces: ['Arial'], indexRange: 1 };
        const openLyric: any = { fontFaces: [system] };
        const markdownManager: any = {};
        km.initOpenLyricPlugins!({
            editor: editor as any,
            openLyric,
            openLyricMarkdownManager: markdownManager,
            genOpenLyricFontFaces: h.genOpenLyricFontFaces,
        });

        expect(editor.addPlugin).toHaveBeenCalledOnce();
        const [name, plugin] = editor.addPlugin.mock.calls[0];
        expect(name).toBe('km-KH');
        expect(plugin).toBeInstanceOf(EditorPluginKmKh);
        const khmer = {
            title: 'Khmer',
            fontFaces: ['app-Battambang'],
            indexRange: 2,
        };
        expect(openLyric.fontFaces).toEqual([system, khmer]);
        // A manager with no faces yet starts from none.
        expect(markdownManager.fontFaces).toEqual([khmer]);
    });

    test('skips the Open Lyric parts that are not there', () => {
        expect(() => {
            km.initOpenLyricPlugins!({
                genOpenLyricFontFaces: h.genOpenLyricFontFaces,
            });
        }).not.toThrow();
        expect(h.genOpenLyricFontFaces).not.toHaveBeenCalled();
    });
});
