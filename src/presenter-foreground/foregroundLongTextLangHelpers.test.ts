import { beforeEach, describe, expect, test, vi } from 'vitest';

// What Long Text Show needs of a language: the list to pick from, the name to
// show, the locale a column is drawn in and the column itself.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        titles: {
            en: 'English',
            km: 'Khmer',
            fr: 'French',
            de: 'German',
            ar: 'Arabic',
            ja: 'Japanese',
        } as Record<string, string>,
    },
    mocks: {
        getLanguageTitle: vi.fn(),
        getLangDataByCodeAsync: vi.fn(),
    },
}));

// One list, as the real one is until the window's languages change.
const SUPPORTED_LANG_CODES = vi.hoisted(() => ['en', 'km', 'fr']);
vi.mock('../lang/langHelpers', () => ({
    DEFAULT_LOCALE: 'en-US',
    ensureLangPlugins: async () => [],
    getSupportedLangCodes: () => SUPPORTED_LANG_CODES,
    reversedLocalesMap: {
        en: 'en-US',
        km: 'km-KH',
        fr: 'fr-FR',
        de: 'de-DE',
        ar: 'ar-SA',
        ja: 'ja-JP',
    },
    getLanguageTitle: mocks.getLanguageTitle,
    getLangDataByCodeAsync: mocks.getLangDataByCodeAsync,
    // A package's own digits, recognisable per locale.
    toLocaleNum: async (locale: string, n: number) => {
        return `${locale}#${n}`;
    },
}));

import {
    genLongTextColumnInput,
    getLongTextLangCodes,
    toLongTextLanguageLabel,
    toLongTextLocale,
} from './foregroundLongTextLangHelpers';

beforeEach(() => {
    mocks.getLanguageTitle.mockImplementation(
        ({ langCode }: { langCode: string }) => {
            return state.titles[langCode] ?? 'Unknown';
        },
    );
    mocks.getLangDataByCodeAsync.mockImplementation(
        async (langCode: string) => {
            return langCode === 'km' ? { locale: 'km-KH' } : null;
        },
    );
});

describe('Long Text languages', () => {
    test('a language reads as its code and its name', () => {
        expect(toLongTextLanguageLabel('km')).toBe('KM - Khmer');
        expect(mocks.getLanguageTitle).toHaveBeenCalledWith({ langCode: 'km' });
    });

    test('the app own languages come first, then the rest by name, built once', () => {
        const langCodes = getLongTextLangCodes();
        expect(langCodes).toEqual(['en', 'km', 'fr', 'ar', 'de', 'ja']);
        const callCount = mocks.getLanguageTitle.mock.calls.length;
        expect(callCount).toBeGreaterThan(0);
        // The same list again, without sorting the table a second time.
        expect(getLongTextLangCodes()).toBe(langCodes);
        expect(mocks.getLanguageTitle).toHaveBeenCalledTimes(callCount);
    });

    test('a column is drawn in the package locale, else the table one, else English', async () => {
        await expect(toLongTextLocale('km')).resolves.toBe('km-KH');
        await expect(toLongTextLocale('de')).resolves.toBe('de-DE');
        await expect(toLongTextLocale('xx')).resolves.toBe('en-US');
        expect(mocks.getLangDataByCodeAsync).toHaveBeenCalledWith('xx');
    });

    test('typed text keeps every section, numbered in its own digits', async () => {
        const column = await genLongTextColumnInput(
            {
                langCode: 'km',
                source: 'raw',
                title: 'Typed',
                sections: ['one', 'two'],
                lyricFilePath: '',
                style: { fontFamily: 'Georgia' },
            },
            {
                langCode: 'km',
                source: 'raw',
                title: 'Typed title',
                sections: [{ text: 'one' }, { text: 'two' }],
            },
            [7],
            [{ row: 0 }, { row: 1 }],
        );
        expect(column).toEqual({
            langCode: 'km',
            locale: 'km-KH',
            title: 'Typed title',
            texts: ['one', 'two'],
            nums: ['km-KH#1', 'km-KH#2'],
            style: { fontFamily: 'Georgia' },
        });
    });

    test('a lyric keeps the rows asked for, and a column with no look carries none', async () => {
        const column = await genLongTextColumnInput(
            {
                langCode: 'de',
                source: 'lyric',
                title: '',
                sections: [],
                lyricFilePath: '/songs/lied.lyric',
            },
            {
                langCode: 'de',
                source: 'lyric',
                title: 'Lied',
                sections: [
                    { partName: 'Verse 1', text: 'Erste' },
                    { partName: 'Chorus', text: 'Kehrvers' },
                ],
            },
            [1, 0, 5],
            [{ row: 0 }, { row: 1 }, { row: 2 }],
        );
        expect(column).toEqual({
            langCode: 'de',
            locale: 'de-DE',
            title: 'Lied',
            // A row past this song's end is an empty row, not a crash.
            texts: ['Kehrvers', 'Erste', ''],
            nums: ['de-DE#1', 'de-DE#2', 'de-DE#3'],
        });
        expect(column).not.toHaveProperty('style');
    });

    test('in Atom mode a line is a row, numbered on through the whole text', async () => {
        const column = await genLongTextColumnInput(
            {
                langCode: 'km',
                source: 'lyric',
                title: '',
                sections: [],
                lyricFilePath: '/songs/still.lyric',
            },
            {
                langCode: 'km',
                source: 'lyric',
                title: 'Still',
                sections: [
                    {
                        partName: 'Verse 1',
                        text: 'Hide me now\nUnder Your wings',
                    },
                    { partName: 'Chorus', text: 'When the oceans rise' },
                ],
            },
            [0, 1],
            [
                { row: 0, line: 0 },
                { row: 0, line: 1 },
                { row: 1, line: 0 },
            ],
        );
        expect(column.texts).toEqual([
            'Hide me now',
            'Under Your wings',
            'When the oceans rise',
        ]);
        expect(column.nums).toEqual(['km-KH#1', 'km-KH#2', 'km-KH#3']);
    });
});
