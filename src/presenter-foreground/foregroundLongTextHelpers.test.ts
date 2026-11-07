import { describe, expect, test } from 'vitest';

import type {
    LongTextOutlineType,
    LongTextResolvedLanguageType,
} from './foregroundLongTextHelpers';
import {
    genLongTextItemData,
    genLongTextLanguage,
    genLongTextRowTexts,
    genLongTextScreenTexts,
    genLongTextStyleByCode,
    genLyricLongTextSession,
    mapLongTextSectionKey,
    parseLongTextSession,
    serializeLongTextSession,
    toInlineSectionText,
    toLongTextAtomLines,
    toLongTextCardText,
    toLongTextOutline,
    toLongTextSettingName,
    toLongTextSourceId,
    toRawResolvedLanguage,
    verifyLongText,
} from './foregroundLongTextHelpers';

function genLyricOutline(
    langCode: string,
    parts: [partName: string, isEmpty?: boolean, lineCount?: number][],
): LongTextOutlineType {
    return {
        langCode,
        source: 'lyric',
        title: `${langCode} song`,
        steps: parts.map(
            ([partName, isEmpty = false, lineCount = isEmpty ? 0 : 1]) => {
                return { partName, isEmpty, lineCount };
            },
        ),
    };
}

function genRawOutline(
    langCode: string,
    isEmptyList: boolean[],
    lineCounts: number[] = [],
): LongTextOutlineType {
    return {
        langCode,
        source: 'raw',
        title: `${langCode} text`,
        steps: isEmptyList.map((isEmpty, index) => {
            return { isEmpty, lineCount: lineCounts[index] ?? 1 };
        }),
    };
}

// What a text that lines up comes to without Atom mode: a screen row per row.
function genPlainResult(rowIndexes: number[]) {
    return {
        problem: null,
        rowIndexes,
        screenRows: rowIndexes.map((_, row) => {
            return { row };
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
                    title: '✝✝✝✝',
                    sections: ['✝✝✝♪', '✝✝✝☀'],
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
                        style: {
                            color: 'red',
                            textAlign: 'center',
                            fontSizeScale: 1.2,
                        },
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
                // A colour and an alignment are the Bible's look now; the
                // size is the language's own.
                style: { fontSizeScale: 1.2 },
            },
        ]);
    });

    test('keeps Stack only while it is on, beside Atom mode', () => {
        const session = {
            languages: [genLongTextLanguage('en')],
            isAtomMode: true as const,
            isStacked: true as const,
        };
        expect(parseLongTextSession(serializeLongTextSession(session))).toEqual(
            session,
        );
        expect(
            parseLongTextSession(
                JSON.stringify({ languages: [], isStacked: 'yes' }),
            ),
        ).toEqual({ languages: [] });
    });

    test('keeps Atom mode only while it is on', () => {
        const session = {
            languages: [genLongTextLanguage('en')],
            isAtomMode: true as const,
        };
        expect(parseLongTextSession(serializeLongTextSession(session))).toEqual(
            session,
        );
        for (const isAtomMode of [false, 'true', 1, null]) {
            expect(
                parseLongTextSession(
                    JSON.stringify({
                        languages: [genLongTextLanguage('en')],
                        isAtomMode,
                    }),
                ),
            ).toEqual({ languages: [genLongTextLanguage('en')] });
        }
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
                        style: { fontSizeScale: 0.8 },
                    },
                    genLongTextLanguage('en'),
                ],
            }),
        ).toEqual({ KM: { fontSizeScale: 0.8 }, EN: undefined });
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

describe('a section in Atom mode', () => {
    test('is its lines, a blank one kept, and no line when it has no words', () => {
        expect(toLongTextAtomLines('one\r\ntwo\n\nfour')).toEqual([
            'one',
            'two',
            '',
            'four',
        ]);
        expect(toLongTextAtomLines('one\n')).toEqual(['one', '']);
        expect(toLongTextAtomLines('one')).toEqual(['one']);
        expect(toLongTextAtomLines('')).toEqual([]);
    });

    test('a card reads its one line, or the whole part run on without one', () => {
        const text = 'Hide me now\n  Under Your wings  \nCover me';
        expect(toLongTextCardText(text)).toBe(
            'Hide me now / Under Your wings / Cover me',
        );
        expect(toLongTextCardText(text, 1)).toBe('Under Your wings');
        expect(toLongTextCardText(text, 7)).toBe('');
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
        ).toEqual(genPlainResult([0, 1, 2, 3]));
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
        ).toEqual(genPlainResult([1, 2]));
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
        ).toEqual(genPlainResult([0, 1]));
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
        ).toEqual(genPlainResult([1, 2]));
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

describe('checking a long text in Atom mode', () => {
    test('every line of a row is a screen row, numbered on through the text', () => {
        const parts: [string, boolean, number][] = [
            ['Verse 1', false, 4],
            ['Chorus', false, 2],
        ];
        expect(
            verifyLongText(
                [genLyricOutline('km', parts), genLyricOutline('en', parts)],
                true,
            ),
        ).toEqual({
            problem: null,
            rowIndexes: [0, 1],
            screenRows: [
                { row: 0, line: 0 },
                { row: 0, line: 1 },
                { row: 0, line: 2 },
                { row: 0, line: 3 },
                { row: 1, line: 0 },
                { row: 1, line: 1 },
            ],
        });
    });

    test('a row broken into another number of lines is named, and nothing goes up', () => {
        expect(
            verifyLongText(
                [
                    genLyricOutline('en', [
                        ['Verse 1', false, 4],
                        ['Chorus', false, 2],
                    ]),
                    genLyricOutline('km', [
                        ['Verse 1', false, 4],
                        ['Chorus', false, 3],
                    ]),
                ],
                true,
            ),
        ).toEqual({
            problem: {
                kind: 'lines',
                index: 1,
                partName: 'Chorus',
                langCode: 'en',
                count: 2,
                otherLangCode: 'km',
                otherCount: 3,
            },
        });
        // Typed text has no part to name; the row is its section.
        expect(
            verifyLongText(
                [
                    genRawOutline('en', [false, false], [1, 2]),
                    genRawOutline('km', [false, false], [1, 1]),
                ],
                true,
            ),
        ).toEqual({
            problem: {
                kind: 'lines',
                index: 1,
                langCode: 'en',
                count: 2,
                otherLangCode: 'km',
                otherCount: 1,
            },
        });
        // Without Atom mode the same text lines up, row for row.
        expect(
            verifyLongText([
                genRawOutline('en', [false, false], [1, 2]),
                genRawOutline('km', [false, false], [1, 1]),
            ]),
        ).toEqual(genPlainResult([0, 1]));
    });

    test('a part one language only plays is no mismatch: it has no lines there', () => {
        expect(
            verifyLongText(
                [
                    genLyricOutline('en', [['Outro', false, 3]]),
                    genLyricOutline('km', [['Outro', true]]),
                    genRawOutline('fr', [false], [3]),
                ],
                true,
            ),
        ).toEqual({
            problem: null,
            rowIndexes: [0],
            screenRows: [
                { row: 0, line: 0 },
                { row: 0, line: 1 },
                { row: 0, line: 2 },
            ],
        });
    });

    test('a refusal that comes before the lines is still the one reported', () => {
        expect(
            verifyLongText(
                [
                    genRawOutline('en', [false, true], [1, 2]),
                    genRawOutline('km', [false, false], [3, 1]),
                ],
                true,
            ),
        ).toEqual({ problem: { kind: 'empty', langCode: 'en', index: 1 } });
    });
});

describe('the mark when a text goes up again in rows of another kind', () => {
    const plainRows = [{ row: 0 }, { row: 1 }];
    const atomRows = [
        { row: 0, line: 0 },
        { row: 0, line: 1 },
        { row: 1, line: 0 },
        { row: 1, line: 1 },
        { row: 1, line: 2 },
    ];

    test('goes to the first line of the row that was marked, and back', () => {
        expect(mapLongTextSectionKey('lt-2', plainRows, atomRows)).toBe('lt-3');
        expect(mapLongTextSectionKey('lt-1', plainRows, atomRows)).toBe('lt-1');
        expect(mapLongTextSectionKey('lt-5', atomRows, plainRows)).toBe('lt-2');
        expect(mapLongTextSectionKey('lt-2', atomRows, plainRows)).toBe('lt-1');
    });

    test('is dropped when nothing was marked, or the row is gone', () => {
        expect(mapLongTextSectionKey(null, plainRows, atomRows)).toBeNull();
        expect(mapLongTextSectionKey('lt-9', plainRows, atomRows)).toBeNull();
        expect(
            mapLongTextSectionKey('lt-2', plainRows, [{ row: 0 }]),
        ).toBeNull();
        expect(
            mapLongTextSectionKey('GEN 1:1', plainRows, atomRows),
        ).toBeNull();
    });
});

describe('building what goes to a screen', () => {
    const lyric: LongTextResolvedLanguageType = {
        langCode: 'km',
        source: 'lyric',
        title: '✝✝✝✝',
        sections: [
            { partName: 'Intro', text: '' },
            { partName: 'Verse 1', text: '✝✝✝♥ １' },
            { partName: 'Chorus', text: '✝✝✝★' },
        ],
    };

    test('an outline keeps the parts and whether each has words, not the words', () => {
        expect(toLongTextOutline(lyric)).toEqual({
            langCode: 'km',
            source: 'lyric',
            title: '✝✝✝✝',
            steps: [
                { partName: 'Intro', isEmpty: true, lineCount: 0 },
                { partName: 'Verse 1', isEmpty: false, lineCount: 1 },
                { partName: 'Chorus', isEmpty: false, lineCount: 1 },
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
            steps: [
                { isEmpty: false, lineCount: 1 },
                { isEmpty: true, lineCount: 1 },
            ],
        });
    });

    test('a lyric gives the rows that are sung; typed text gives every section', () => {
        expect(genLongTextRowTexts(lyric, [1, 2])).toEqual(['✝✝✝♥ １', '✝✝✝★']);
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

    test('a screen row is a row, or in Atom mode one line of it, empty where a language has none', () => {
        const song: LongTextResolvedLanguageType = {
            langCode: 'en',
            source: 'lyric',
            title: 'Song',
            sections: [
                { partName: 'Intro', text: '' },
                { partName: 'Verse 1', text: 'one\ntwo' },
                { partName: 'Outro', text: '' },
            ],
        };
        expect(
            genLongTextScreenTexts(song, [1, 2], [{ row: 0 }, { row: 1 }]),
        ).toEqual(['one\ntwo', '']);
        expect(
            genLongTextScreenTexts(
                song,
                [1, 2],
                [
                    { row: 0, line: 0 },
                    { row: 0, line: 1 },
                    { row: 1, line: 0 },
                ],
            ),
        ).toEqual(['one', 'two', '']);
        // Typed text keeps its blank line as a row of its own.
        expect(
            genLongTextScreenTexts(
                toRawResolvedLanguage({
                    ...genLongTextLanguage('en'),
                    sections: ['a\n\nc'],
                }),
                [0],
                [
                    { row: 0, line: 0 },
                    { row: 0, line: 1 },
                    { row: 0, line: 2 },
                ],
            ),
        ).toEqual(['a', '', 'c']);
    });

    test('stacked, the text says so; side by side it says nothing', () => {
        const column = {
            langCode: 'en',
            locale: 'en-US' as const,
            title: 'Song',
            texts: ['Verse'],
            nums: ['1'],
        };
        expect(
            genLongTextItemData('long-text', [column], { isStacked: true })
                .longTextData.isStacked,
        ).toBe(true);
        expect(
            genLongTextItemData('long-text', [column], { isNumberHidden: true })
                .longTextData,
        ).toEqual(expect.objectContaining({ isNumberHidden: true }));
        const plain = genLongTextItemData('long-text', [column]).longTextData;
        expect(plain).not.toHaveProperty('isStacked');
        expect(plain).not.toHaveProperty('isNumberHidden');
    });

    test('a row has one key for all its languages, and a style only where one is set', () => {
        const data = genLongTextItemData('long-text-s1', [
            {
                langCode: 'km',
                locale: 'km-KH',
                title: '✝✝✝✝',
                texts: ['✝✝✝♥ １', '✝✝✝★'],
                nums: ['１', '２'],
            },
            {
                langCode: 'en',
                locale: 'en-US',
                title: 'Song',
                texts: ['Verse', 'Chorus'],
                nums: ['1', '2'],
                // A colour and a weight of its own are the Bible's look now.
                style: {
                    fontSizeScale: 0.8,
                    color: '#ff0000',
                    fontWeight: '700',
                } as any,
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
            title: '✝✝✝✝',
            sections: [
                { num: '１', text: '✝✝✝♥ １', key: 'lt-1' },
                { num: '２', text: '✝✝✝★', key: 'lt-2' },
            ],
        });
        expect('style' in km).toBe(false);
        expect(en.sections.map(({ key }) => key)).toEqual(['lt-1', 'lt-2']);
        // Only the family and the size a column may have leave the panel.
        expect(en.style).toEqual({ fontSizeScale: 0.8 });
    });
});
