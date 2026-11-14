// The song-order rules on the shapes the sibling suite leaves dark: words
// too short to judge, blank lines closing a box, a top box of two lines, a
// page too short to carry a running line, a footer that is nothing but one,
// a title too long for the drafter, and a page whose words are all space.

import { describe, expect, test } from 'vitest';

import {
    checkLooksUnreadable,
    genDocumentWords,
    joinDocumentWords,
    type DocumentWordsPageType,
    type DocumentWordsShapeType,
} from './documentWordsRules';

function shape(
    y: number,
    height: number,
    lines: string[],
    family: string,
): DocumentWordsShapeType {
    return {
        x: 40,
        y,
        width: 1200,
        height,
        lines,
        fontCountMap: {
            [family]: lines.join('').replace(/\s/g, '').length,
        },
    };
}

function page(
    number: number,
    shapes: DocumentWordsShapeType[],
): DocumentWordsPageType {
    return {
        number,
        isHidden: false,
        width: 1280,
        height: 720,
        shapes,
        pictures: [],
    };
}

describe('checkLooksUnreadable', () => {
    test('words all shorter than three letters are read, not judged', () => {
        expect(checkLooksUnreadable('I am so')).toBe(false);
        expect(checkLooksUnreadable('O, my')).toBe(false);
    });
});

describe('genDocumentWords', () => {
    test('blank lines closing a box say nothing', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        100,
                        400,
                        ['', 'Amazing grace how sweet', 'the sound', '', ''],
                        'Body',
                    ),
                ]),
            ],
            { fileTitle: 'Grace' },
        );
        expect(result.blocks).toEqual([
            { page: 1, text: 'Amazing grace how sweet\nthe sound' },
        ]);
        expect(result.text).toBe('Grace\n\nAmazing grace how sweet\nthe sound');
    });

    test('a top box of two lines over the verse is sung, never a heading', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        20,
                        70,
                        ['Praise God from whom', 'all blessings flow'],
                        'Display',
                    ),
                    shape(
                        120,
                        500,
                        [
                            'Praise Him all creatures here below',
                            'Praise Him above ye heavenly host',
                        ],
                        'Body',
                    ),
                ]),
            ],
            { fileTitle: 'Doxology' },
        );
        expect(result.headings).toEqual([]);
        expect(result.skipped.headings).toBe(0);
        expect(result.title).toBe('Doxology');
        expect(result.blocks).toEqual([
            {
                page: 1,
                text:
                    'Praise God from whom\nall blessings flow\n\n' +
                    'Praise Him all creatures here below\n' +
                    'Praise Him above ye heavenly host',
            },
        ]);
    });

    test('a footer on every page is dropped, a short page carries no running line', () => {
        const footer = 'Parish Hymnal';
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        100,
                        500,
                        [
                            'Amazing grace how sweet the sound',
                            'That saved a wretch like me',
                        ],
                        'Body',
                    ),
                    shape(680, 20, [footer], 'Small'),
                ]),
                page(2, [
                    shape(
                        100,
                        500,
                        [
                            'I once was lost but now am found',
                            'Was blind but now I see',
                        ],
                        'Body',
                    ),
                    shape(680, 20, [footer], 'Small'),
                ]),
                // Two lines in all: too few to tell a footer by.
                page(3, [
                    shape(100, 500, ['Amen'], 'Body'),
                    shape(680, 20, [footer], 'Small'),
                ]),
            ],
            { fileTitle: 'Grace', isRunningLineDropped: true },
        );
        expect(result.blocks).toEqual([
            {
                page: 1,
                text: 'Amazing grace how sweet the sound\nThat saved a wretch like me',
            },
            {
                page: 2,
                text: 'I once was lost but now am found\nWas blind but now I see',
            },
            // The running line is dropped wherever it stands.
            { page: 3, text: 'Amen' },
        ]);
        expect(result.text).not.toContain(footer);
        expect(result.fontFamily).toBe('Body');
    });

    test('the same footer is kept when running lines are not dropped', () => {
        const footer = 'Parish Hymnal';
        const pages = [1, 2].map((number) => {
            return page(number, [
                shape(
                    100,
                    500,
                    ['Amazing grace how sweet', 'That saved a wretch'],
                    'Body',
                ),
                shape(680, 20, [footer], 'Small'),
            ]);
        });
        const result = genDocumentWords(pages, { fileTitle: 'Grace' });
        expect(result.blocks[0].text).toBe(
            `Amazing grace how sweet\nThat saved a wretch\n\n${footer}`,
        );
    });

    test('a title past 80 characters is cut at a space, its trailing marks taken off', () => {
        const longHeading =
            'Hymn 12 Amazing grace how sweet the sound that saved a wretch ' +
            'like me and you, wonderful grace';
        expect(longHeading.length).toBeGreaterThan(80);
        const result = genDocumentWords(
            [
                page(1, [
                    shape(20, 70, [longHeading], 'Display'),
                    shape(120, 500, ['I once was lost but now'], 'Body'),
                ]),
            ],
            { fileTitle: 'Grace' },
        );
        // Cut at the last space within 80, and the comma before it gone.
        expect(result.title).toBe(
            'Hymn 12 Amazing grace how sweet the sound that saved a wretch like me and you',
        );
        expect(result.title.length).toBeLessThanOrEqual(80);
        expect(result.text.split('\n')[0]).toBe(result.title);
        // The heading itself is named whole.
        expect(result.headings).toEqual([longHeading]);
    });

    test('a title of one long word is cut at 80 characters', () => {
        const word = 'Hallelujah'.repeat(10);
        const result = genDocumentWords(
            [
                page(1, [
                    shape(20, 70, [word], 'Display'),
                    shape(120, 500, ['Praise the Lord'], 'Body'),
                ]),
            ],
            { fileTitle: 'Praise' },
        );
        expect(result.title).toBe(word.slice(0, 80));
    });

    test('a title whose last space falls early is cut at 80, not at the space', () => {
        const heading = `Hymn ${'x'.repeat(90)}`;
        const result = genDocumentWords(
            [
                page(1, [
                    shape(20, 70, [heading], 'Display'),
                    shape(120, 500, ['Praise the Lord'], 'Body'),
                ]),
            ],
            { fileTitle: 'Praise' },
        );
        expect(result.title).toBe(heading.slice(0, 80));
    });
});

describe('joinDocumentWords', () => {
    test('a page whose words are all space is left out, the rest in page order', () => {
        const result = joinDocumentWords('Grace', [
            { page: 3, text: 'I once was lost' },
            { page: 2, text: '  \r\n \n' },
            { page: 1, text: 'Amazing grace\r\nhow sweet' },
        ]);
        expect(result).toEqual({
            text: 'Grace\n\nAmazing grace\nhow sweet\n\nI once was lost',
            isTruncated: false,
        });
    });
});
