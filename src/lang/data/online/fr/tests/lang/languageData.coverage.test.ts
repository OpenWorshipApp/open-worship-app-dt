// @vitest-environment jsdom

import type { LanguageDataType } from '../../../../../langHelpers';
import { describe, expect, test, vi } from 'vitest';

import { loadSourceLangData } from '../../../../../langSourceFiles';

// The package as the plugin build makes it: its folder's data through the
// one factory every language shares (`../../../onlineLangPackage.ts`).
const fr: LanguageDataType = await loadSourceLangData('fr');

// The French half of `src/lang/languagePackages.test.ts`: the code beside the
// dictionary -- digits, sanitizers, book names and the lookup-data doors --
// driven with real French text.
// The package imports nothing at run time but a type from `langHelpers`,
// mocked here so the module never loads.
vi.mock('../../../../../langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    DEFAULT_LOCALE: 'en-US',
}));

function lookupDoors(lang: typeof fr) {
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

describe('French package', () => {
    test('names itself and uses Latin digits with no font of its own', () => {
        expect(fr.locale).toBe('fr-FR');
        expect(fr.langCode).toBe('fr');
        expect(fr.name).toBe('French');
        expect(fr.nativeName).toBe('Français');
        expect(fr.numList.join('')).toBe('0123456789');
        expect(fr.genCss()).toBe('');
        expect(fr.fontFamily).toBeUndefined();
        expect(fr.bibleAudioAvailable).toBe(false);
        expect(fr.initOpenLyricPlugins).toBeUndefined();
        expect(fr.getBibleKeyNameMap!()['LSG']).toBe(
            'La Sainte Bible, Louis Segond',
        );
    });

    test('keeps its dictionary under trimmed, lower-cased keys', () => {
        expect(fr.dictionary['reader']).toBe('Lecteur');
        expect(fr.sanitizeTranKey(' Reader ')).toBe('reader');
    });

    test('never claims Latin text, which English already owns', () => {
        expect(fr.checkIsThisLang('Bonjour à tous')).toBe(false);
    });

    test('leaves display text as it is', () => {
        expect(fr.sanitizeText('  Élise ')).toBe('  Élise ');
        expect(fr.sanitizePreviewText('  Élise ')).toBe('  Élise ');
        expect(fr.trimText('  Élise ')).toBe('Élise');
        expect(fr.endWord('mot')).toBe('mot ');
        expect(fr.transformBibleBookName('1 Pierre')).toEqual(['1 Pierre']);
        expect(fr.extraBibleContextMenuItems({}, {} as any)).toEqual([]);
    });

    test('a finding text keeps the accents and drops the punctuation', () => {
        expect(
            fr.sanitizeFindingText('Où est-ce que JÉSUS a dit « Je suis » ?'),
        ).toBe('où est ce que jésus a dit je suis');
        // A decomposed accent is composed first, so it is kept, not split.
        expect(fr.sanitizeFindingText('Récit 3:16')).toBe('récit 3 16');
    });

    test('carries its own Bible search words', () => {
        expect(fr.bookMarkerWords).toEqual(['dans', 'livre']);
        expect(fr.findFrameWords).toContain('récit');
        expect(fr.stopWords).toContain('le');
    });

    test('resolves its own bundle and lookup data', async () => {
        const resolve = vi.fn((bundle: { filePath: string }) => {
            return bundle.filePath;
        });
        expect(fr.getBibleCrossRefBundleFilePath(resolve)).toMatch(
            /\/src\/lang\/data\/online\/fr\/bb-cr\.gz\.bundle$/,
        );

        const doors = lookupDoors(fr);
        const both = await doors.versions(1, 2);
        expect(both.result).toEqual({ namesMap: 1, locationsMap: 2 });
        expect(both.urls[0]).toMatch(
            /fr\/location-name-map-data\/namesMap\.json/,
        );
        expect((await doors.versions(1, null)).result).toBeNull();

        expect(
            await doors.data(async (url: string) => {
                return url.includes('namesMap') ? 'names' : 'locations';
            }),
        ).toEqual({ namesMap: 'names', locationsMap: 'locations' });
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
});
