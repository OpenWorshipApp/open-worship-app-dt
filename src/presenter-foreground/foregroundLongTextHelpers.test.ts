import { describe, expect, test } from 'vitest';

import type {
    LongTextOutlineType,
    LongTextResolvedLanguageType,
} from './foregroundLongTextHelpers';
import {
    genLongTextItemData,
    genLongTextLanguage,
    genLongTextRowTexts,
    genLongTextStyleByCode,
    genLyricLongTextSession,
    parseLongTextSession,
    serializeLongTextSession,
    toInlineSectionText,
    toLongTextOutline,
    toLongTextSettingName,
    toLongTextSourceId,
    toRawResolvedLanguage,
    verifyLongText,
} from './foregroundLongTextHelpers';

function genLyricOutline(
    langCode: string,
    parts: [partName: string, isEmpty?: boolean][],
): LongTextOutlineType {
    return {
        langCode,
        source: 'lyric',
        title: `${langCode} song`,
        steps: parts.map(([partName, isEmpty = false]) => {
            return { partName, isEmpty };
        }),
    };
}

function genRawOutline(
    langCode: string,
    isEmptyList: boolean[],
): LongTextOutlineType {
    return {
        langCode,
        source: 'raw',
        title: `${langCode} text`,
        steps: isEmptyList.map((isEmpty) => {
            return { isEmpty };
        }),
    };
}

describe('a Long Text Show session', () => {
    test('is kept under one key per session, outside what Screen Mirror hands to a guest', () => {
        expect(toLongTextSettingName('')).toBe('long-text-setting');
        expect(toLongTextSettingName('-s1')).toBe('long-text-setting-s1');
        // `screenBootstrapHelpers` sends every `foreground-…` setting across.
        expect(toLongTextSettingName('').startsWith('foreground-')).toBe(false);
        expect(toLongTextSourceId('')).toBe('long-text');
        expect(toLongTextSourceId('-s1')).toBe('long-text-s1');
    });

    test('round-trips what it holds', () => {
        const session = {
            languages: [
                {
                    ...genLongTextLanguage('km'),
                    title: 'ចម្រៀង',
                    sections: ['មួយ', 'ពីរ'],
                    style: { fontFamily: 'Battambang', fontSizeScale: 1.2 },
                },
                {
                    ...genLongTextLanguage('en'),
                    source: 'lyric' as const,
                    lyricFilePath: '/docs/grace.owl',
                    sectionView: 'cards' as const,
                },
            ],
        };
        expect(parseLongTextSession(serializeLongTextSession(session))).toEqual(
            session,
        );
    });

    test('started from a lyric is that file as English, read back as it was written', () => {
        const session = genLyricLongTextSession('/docs/still.owl');
        expect(session).toEqual({
            languages: [
                {
                    langCode: 'en',
                    source: 'lyric',
                    title: '',
                    sections: [''],
                    lyricFilePath: '/docs/still.owl',
                    // Its parts as text cards, as every new language's are.
                    sectionView: 'cards',
                },
            ],
        });
        expect(parseLongTextSession(serializeLongTextSession(session))).toEqual(
            session,
        );
        expect(
            genLyricLongTextSession('/docs/still.owl', 'km').languages[0]
                .langCode,
        ).toBe('km');
    });

    test('starts a new language as text cards, and keeps a stored one as it was', () => {
        expect(genLongTextLanguage('km').sectionView).toBe('cards');
        // Stored before the default changed, or switched back to buttons:
        // either way no view is written, and the buttons are kept.
        const stored = parseLongTextSession(
            JSON.stringify({
                languages: [
                    {
                        langCode: 'en',
                        source: 'lyric',
                        lyricFilePath: '/docs/grace.owl',
                    },
                ],
            }),
        );
        expect(stored.languages[0].sectionView).toBeUndefined();
    });

    test('keeps a language once and drops what is not one', () => {
        const session = parseLongTextSession(
            JSON.stringify({
                languages: [
                    { langCode: 'km', title: 'first', sections: ['a', 5, 'b'] },
                    { langCode: 'km', title: 'second' },
                    { langCode: 'EN' },
                    { langCode: 'x' },
                    'en',
                    null,
                    {
                        langCode: 'fr',
                        // Not a view there is: the parts stay buttons.
                        sectionView: 'grid',
                        source: 'nonsense',
                        style: { color: 'red', textAlign: 'center' },
                    },
                ],
            }),
        );
        expect(session.languages).toEqual([
            {
                langCode: 'km',
                source: 'raw',
                title: 'first',
                sections: ['a', 'b'],
                lyricFilePath: '',
            },
            {
                langCode: 'fr',
                source: 'raw',
                title: '',
                sections: [],
                lyricFilePath: '',
                // The colour was not one; the alignment was.
                style: { textAlign: 'center' },
            },
        ]);
    });

    test('reads nothing, garbage and the wrong shape as an empty session', () => {
        expect(parseLongTextSession(null)).toEqual({ languages: [] });
        expect(parseLongTextSession('')).toEqual({ languages: [] });
        expect(parseLongTextSession('{not json')).toEqual({ languages: [] });
        expect(parseLongTextSession('null')).toEqual({ languages: [] });
        expect(parseLongTextSession('{"languages":{}}')).toEqual({
            languages: [],
        });
    });

    test('names each column style by the code its column carries on a screen', () => {
        expect(
            genLongTextStyleByCode({
                languages: [
                    {
                        ...genLongTextLanguage('km'),
                        style: { color: '#ffffff' },
                    },
                    genLongTextLanguage('en'),
                ],
            }),
        ).toEqual({ KM: { color: '#ffffff' }, EN: undefined });
    });
});

describe('a section on a card of the panel', () => {
    test('runs its lines on, a slash between them', () => {
        expect(
            toInlineSectionText(
                'Hide me now\r\n  Under Your wings  \n\nCover me\n',
            ),
        ).toBe('Hide me now / Under Your wings / Cover me');
        expect(toInlineSectionText('one line')).toBe('one line');
        expect(toInlineSectionText('')).toBe('');
    });
});

describe('checking the languages of a long text against each other', () => {
    test('there has to be a language, and it has to be readable', () => {
        expect(verifyLongText([])).toEqual({
            problem: { kind: 'no-language' },
        });
        expect(
            verifyLongText([
                genRawOutline('km', [false]),
                {
                    ...genLyricOutline('en', []),
                    readProblem: { kind: 'missing-part', partName: 'Bridge' },
                },
            ]),
        ).toEqual({
            problem: {
                kind: 'unreadable',
                langCode: 'en',
                reason: 'missing-part',
                partName: 'Bridge',
            },
        });
    });

    test('two lyric files sung in the same order go up, a repeat being a row each time', () => {
        const parts: [string][] = [
            ['Verse 1'],
            ['Chorus'],
            ['Verse 2'],
            ['Chorus'],
        ];
        expect(
            verifyLongText([
                genLyricOutline('km', parts),
                genLyricOutline('en', parts),
            ]),
        ).toEqual({ problem: null, rowIndexes: [0, 1, 2, 3] });
    });

    test('a different part at the same step is named, and nothing goes up', () => {
        expect(
            verifyLongText([
                genLyricOutline('km', [['Verse 1'], ['Chorus'], ['Verse 2']]),
                genLyricOutline('en', [['Verse 1'], ['Bridge'], ['Verse 2']]),
            ]),
        ).toEqual({
            problem: {
                kind: 'structure',
                langCode: 'km',
                otherLangCode: 'en',
                index: 1,
                partName: 'Chorus',
                otherPartName: 'Bridge',
            },
        });
    });

    test('a song that ends a step early is a different structure too', () => {
        expect(
            verifyLongText([
                genLyricOutline('km', [['Verse 1'], ['Chorus']]),
                genLyricOutline('en', [['Verse 1']]),
            ]),
        ).toEqual({
            problem: {
                kind: 'structure',
                langCode: 'km',
                otherLangCode: 'en',
                index: 1,
                partName: 'Chorus',
            },
        });
    });

    test('a part nobody has words for is no row; one only some have is kept', () => {
        expect(
            verifyLongText([
                genLyricOutline('km', [
                    ['Intro', true],
                    ['Verse 1'],
                    ['Outro', true],
                ]),
                genLyricOutline('en', [
                    ['Intro', true],
                    ['Verse 1'],
                    // The English has a sung outro, the Khmer has none.
                    ['Outro'],
                ]),
            ]),
        ).toEqual({ problem: null, rowIndexes: [1, 2] });
    });

    test('a song of chords alone has nothing to show', () => {
        expect(
            verifyLongText([genLyricOutline('en', [['Intro', true]])]),
        ).toEqual({ problem: { kind: 'no-section' } });
        expect(verifyLongText([genRawOutline('en', [])])).toEqual({
            problem: { kind: 'no-section' },
        });
    });

    test('typed languages need the same number of sections, none of them empty', () => {
        expect(
            verifyLongText([
                genRawOutline('km', [false, false]),
                genRawOutline('en', [false, false]),
            ]),
        ).toEqual({ problem: null, rowIndexes: [0, 1] });
        expect(
            verifyLongText([
                genRawOutline('km', [false, false]),
                genRawOutline('en', [false]),
            ]),
        ).toEqual({
            problem: {
                kind: 'count',
                langCode: 'en',
                count: 1,
                expectedCount: 2,
            },
        });
        expect(
            verifyLongText([
                genRawOutline('km', [false, true]),
                genRawOutline('en', [false, false]),
            ]),
        ).toEqual({ problem: { kind: 'empty', langCode: 'km', index: 1 } });
    });

    test('a typed language beside a lyric file has one section per row of the song', () => {
        const lyric = genLyricOutline('km', [
            ['Intro', true],
            ['Verse 1'],
            ['Chorus'],
        ]);
        // Two rows: the Intro has no words.
        expect(
            verifyLongText([lyric, genRawOutline('en', [false, false])]),
        ).toEqual({ problem: null, rowIndexes: [1, 2] });
        expect(
            verifyLongText([lyric, genRawOutline('en', [false, false, false])]),
        ).toEqual({
            problem: {
                kind: 'count',
                langCode: 'en',
                count: 3,
                expectedCount: 2,
            },
        });
    });
});

describe('building what goes to a screen', () => {
    const lyric: LongTextResolvedLanguageType = {
        langCode: 'km',
        source: 'lyric',
        title: 'ចម្រៀង',
        sections: [
            { partName: 'Intro', text: '' },
            { partName: 'Verse 1', text: 'ខ ១' },
            { partName: 'Chorus', text: 'បន្ទរ' },
        ],
    };

    test('an outline keeps the parts and whether each has words, not the words', () => {
        expect(toLongTextOutline(lyric)).toEqual({
            langCode: 'km',
            source: 'lyric',
            title: 'ចម្រៀង',
            steps: [
                { partName: 'Intro', isEmpty: true },
                { partName: 'Verse 1', isEmpty: false },
                { partName: 'Chorus', isEmpty: false },
            ],
        });
        expect(
            toLongTextOutline(
                toRawResolvedLanguage({
                    ...genLongTextLanguage('en'),
                    title: 'Song',
                    sections: ['one', '   '],
                }),
            ),
        ).toEqual({
            langCode: 'en',
            source: 'raw',
            title: 'Song',
            steps: [{ isEmpty: false }, { isEmpty: true }],
        });
    });

    test('a lyric gives the rows that are sung; typed text gives every section', () => {
        expect(genLongTextRowTexts(lyric, [1, 2])).toEqual(['ខ ១', 'បន្ទរ']);
        expect(
            genLongTextRowTexts(
                toRawResolvedLanguage({
                    ...genLongTextLanguage('en'),
                    sections: ['one', 'two'],
                }),
                [1, 2],
            ),
        ).toEqual(['one', 'two']);
    });

    test('a row has one key for all its languages, and a style only where one is set', () => {
        const data = genLongTextItemData('long-text-s1', [
            {
                langCode: 'km',
                locale: 'km-KH',
                title: 'ចម្រៀង',
                texts: ['ខ ១', 'បន្ទរ'],
                nums: ['១', '២'],
            },
            {
                langCode: 'en',
                locale: 'en-US',
                title: 'Song',
                texts: ['Verse', 'Chorus'],
                nums: ['1', '2'],
                style: { color: '#ff0000', fontWeight: 'heavy' as any },
            },
        ]);
        expect(data.type).toBe('long-text');
        expect(data.locale).toBe('km-KH');
        expect(data.scroll).toBe(0);
        expect(data.selectedKJVVerseKey).toBeNull();
        expect(data.longTextData.sourceId).toBe('long-text-s1');
        const [km, en] = data.longTextData.renderedList;
        expect(km).toEqual({
            locale: 'km-KH',
            code: 'KM',
            title: 'ចម្រៀង',
            sections: [
                { num: '១', text: 'ខ ១', key: 'lt-1' },
                { num: '២', text: 'បន្ទរ', key: 'lt-2' },
            ],
        });
        expect('style' in km).toBe(false);
        expect(en.sections.map(({ key }) => key)).toEqual(['lt-1', 'lt-2']);
        // What cannot be drawn never leaves the panel.
        expect(en.style).toEqual({ color: '#ff0000' });
    });
});
