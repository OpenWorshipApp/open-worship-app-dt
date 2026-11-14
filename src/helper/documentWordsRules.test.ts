import { describe, expect, it } from 'vitest';

import { draftOpenLyricText } from '../../tools/owa-devtools-mcp/openLyricDraft.mjs';
import {
    checkIsSlideNumberLine,
    checkLooksUnreadable,
    genDocumentWords,
    MAX_DOCUMENT_WORDS_CHARS,
    mergePictureWords,
    toReadingOrder,
    type DocumentWordsPageType,
    type DocumentWordsShapeType,
} from './documentWordsRules';

const WIDTH = 1280;
const HEIGHT = 720;

function shape(
    y: number,
    height: number,
    lines: string[],
    family: string,
    extra: Partial<DocumentWordsShapeType> = {},
): DocumentWordsShapeType {
    return {
        x: 49,
        y,
        width: 1180,
        height,
        lines,
        fontCountMap: {
            [family]: lines.join('').replace(/\s/g, '').length,
        },
        ...extra,
    };
}

function page(
    number: number,
    shapes: DocumentWordsShapeType[],
    extra: Partial<DocumentWordsPageType> = {},
): DocumentWordsPageType {
    return {
        number,
        isHidden: false,
        width: WIDTH,
        height: HEIGHT,
        shapes,
        pictures: [],
        ...extra,
    };
}

// Shaped like the real deck that prompted this (two hymns in one deck): a
// heading box in a display face over a taller verse box in the body face,
// an "Amen" slide, a hidden slide, a slide with the audio icon alone.
const HYMN_DECK: DocumentWordsPageType[] = [
    page(1, [
        shape(44, 70, ['21 Praise Song No. 1 (HYMN #1)'], 'Display Face'),
        shape(
            127,
            549,
            [
                'Praise God from whom all blessings flow',
                'Praise Him all creatures here below',
                'Praise Him above ye heavenly host',
                'Praise Father Son and Holy Ghost',
            ],
            'Body Face',
        ),
    ]),
    page(2, [
        shape(44, 70, ['22 Praise Song No. 2 (HYMN #2)'], 'Display Face'),
        shape(
            127,
            549,
            [
                'Praise God the source of all our gifts',
                'Praise Jesus Christ whose power uplifts',
                'Praise the Spirit Holy Spirit',
                'Praise to the Triune God of grace',
            ],
            'Body Face',
        ),
    ]),
    page(3, [shape(127, 549, ['Amen'], 'Body Face')]),
    page(4, [], { isHidden: true }),
    page(5, [shape(183, 100, [''], 'Body Face')], {
        pictures: [{ x: 614, y: 244, width: 51, height: 51 }],
    }),
];

describe('documentWordsRules', () => {
    it('reads boxes top to bottom, a row left to right', () => {
        const ordered = toReadingOrder([
            { x: 300, y: 104 },
            { x: 10, y: 400 },
            { x: 10, y: 100 },
        ]);
        expect(ordered).toEqual([
            { x: 10, y: 100 },
            { x: 300, y: 104 },
            { x: 10, y: 400 },
        ]);
    });

    it('knows a slide number from a sung line', () => {
        expect(checkIsSlideNumberLine('12')).toBe(true);
        expect(checkIsSlideNumberLine('3 / 10')).toBe(true);
        expect(checkIsSlideNumberLine('Amen')).toBe(false);
        expect(checkIsSlideNumberLine('1 Amazing grace')).toBe(false);
    });

    it('calls a legacy font text layer unreadable, never a short word', () => {
        expect(checkLooksUnreadable('eyIgxJ;ecHRBHGg kMBugEtyIg ;sMeLg')).toBe(
            true,
        );
        expect(checkLooksUnreadable('�� broken words')).toBe(true);
        expect(checkLooksUnreadable('12 34')).toBe(true);
        expect(checkLooksUnreadable('Amen')).toBe(false);
        expect(
            checkLooksUnreadable("Don't be afraid, e.g. McDonald's iPhone"),
        ).toBe(false);
    });

    it('takes the heading out, keeps the body font and every verse', () => {
        const result = genDocumentWords(HYMN_DECK, { fileTitle: 'Hymns' });
        expect(result.title).toBe('21 Praise Song No. 1 (HYMN #1)');
        expect(result.headings).toEqual([
            '21 Praise Song No. 1 (HYMN #1)',
            '22 Praise Song No. 2 (HYMN #2)',
        ]);
        expect(result.fontFamily).toBe('Body Face');
        expect(result.skipped).toEqual({
            hidden: 1,
            headings: 2,
            numbers: 0,
            empty: 1,
        });
        expect(result.readablePages).toEqual([1, 2, 3]);
        expect(result.pictureNeededPages).toEqual([]);
        expect(result.text.split('\n\n')).toEqual([
            '21 Praise Song No. 1 (HYMN #1)',
            [
                'Praise God from whom all blessings flow',
                'Praise Him all creatures here below',
                'Praise Him above ye heavenly host',
                'Praise Father Son and Holy Ghost',
            ].join('\n'),
            [
                'Praise God the source of all our gifts',
                'Praise Jesus Christ whose power uplifts',
                'Praise the Spirit Holy Spirit',
                'Praise to the Triune God of grace',
            ].join('\n'),
            'Amen',
        ]);
        expect(result.isTruncated).toBe(false);
    });

    it('drafts as a valid song, the headings unsung', () => {
        const result = genDocumentWords(HYMN_DECK, { fileTitle: 'Hymns' });
        const drafted = draftOpenLyricText(result.text, {
            title: result.title,
        });
        // Tier 1 (sections worked out) and valid: the window draws Create.
        expect(drafted.startsWith('Drafted a song from the text.\n')).toBe(
            true,
        );
        expect(drafted).toContain('Valid Open Lyric. No problems found.');
        expect(drafted).toContain('- Title: 21 Praise Song No. 1 (HYMN #1)');
        expect(drafted).toContain('Praise God from whom all blessings flow');
        expect(drafted).toContain('Amen');
        expect(drafted).not.toContain('HYMN #2');
    });

    it('folds a slide sung twice into one chorus', () => {
        const chorus = ['Glory glory hallelujah', 'His truth is marching on'];
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        100,
                        400,
                        ['Mine eyes have seen', 'the glory'],
                        'Face',
                    ),
                ]),
                page(2, [shape(100, 400, chorus, 'Face')]),
                page(3, [
                    shape(
                        100,
                        400,
                        ['He has trampled out', 'the vintage'],
                        'Face',
                    ),
                ]),
                page(4, [shape(100, 400, chorus, 'Face')]),
            ],
            { fileTitle: 'Battle Hymn' },
        );
        expect(result.title).toBe('Battle Hymn');
        const drafted = draftOpenLyricText(result.text, {
            title: result.title,
        });
        expect(drafted).toContain('Valid Open Lyric. No problems found.');
        expect(drafted).toContain('```ol:Chorus');
        expect(drafted).toMatch(/- Structure: V1CV2C/);
    });

    it('reads a title page, and a repeated top box as a heading', () => {
        const result = genDocumentWords(
            [
                page(1, [shape(300, 100, ['Holy Holy Holy'], 'Face')]),
                page(2, [
                    shape(20, 60, ['Hymn 1'], 'Face'),
                    shape(
                        100,
                        500,
                        ['Holy holy holy', 'Lord God Almighty'],
                        'Face',
                    ),
                ]),
                page(3, [
                    shape(20, 60, ['Hymn 1'], 'Face'),
                    shape(
                        100,
                        500,
                        ['Early in the morning', 'our song shall rise'],
                        'Face',
                    ),
                ]),
            ],
            { fileTitle: 'file' },
        );
        expect(result.title).toBe('Holy Holy Holy');
        expect(result.headings).toEqual(['Hymn 1']);
        expect(result.text).not.toContain('Hymn 1');
        expect(result.text.startsWith('Holy Holy Holy\n\nHoly holy holy')).toBe(
            true,
        );
    });

    it('keeps a section label box for the drafter', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(20, 60, ['Chorus'], 'Label Face'),
                    shape(100, 500, ['Sing it out', 'Sing it loud'], 'Face'),
                ]),
                page(2, [
                    shape(100, 500, ['Verse words', 'go here now'], 'Face'),
                ]),
            ],
            { fileTitle: 'Song' },
        );
        expect(result.headings).toEqual([]);
        expect(result.text).toContain('Chorus\n\nSing it out');
    });

    it('takes a lone first line as the title, as a Word hymn starts', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        0,
                        1,
                        [
                            'Amazing Grace',
                            '',
                            'Amazing grace how sweet',
                            'the sound',
                        ],
                        'Face',
                    ),
                ]),
            ],
            { fileTitle: 'file name' },
        );
        expect(result.title).toBe('Amazing Grace');
        expect(result.text).toBe(
            'Amazing Grace\n\nAmazing grace how sweet\nthe sound',
        );
    });

    it('drops slide numbers and a running header', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        0,
                        1,
                        ['Hymn Book', 'Line one of it', 'Line two of it', '1'],
                        'Face',
                    ),
                ]),
                page(2, [
                    shape(
                        0,
                        1,
                        ['Hymn Book', 'Line three here', 'Line four here', '2'],
                        'Face',
                    ),
                ]),
            ],
            { fileTitle: 'Hymns', isRunningLineDropped: true },
        );
        expect(result.skipped.numbers).toBe(2);
        expect(result.text).not.toContain('Hymn Book');
        expect(result.text).toContain('Line one of it\nLine two of it');
    });

    it('sends unreadable words and covering pictures to the picture route', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        100,
                        400,
                        ['Real words here', 'and more of them'],
                        'Face',
                    ),
                ]),
                page(2, [
                    shape(
                        100,
                        400,
                        ['eyIgxJ;ecHRBHGg kMBugEtyIg ;sMeLg'],
                        'Legacy',
                    ),
                ]),
                page(3, [], {
                    pictures: [{ x: 0, y: 0, width: WIDTH, height: HEIGHT }],
                }),
                page(4, [shape(10, 20, ['4'], 'Face')]),
            ],
            { fileTitle: 'Mixed' },
        );
        expect(result.readablePages).toEqual([1]);
        expect(result.pictureNeededPages).toEqual([2, 3]);
        expect(result.skipped.empty).toBe(1);
        expect(result.fontFamily).toBe('Face');
    });

    it('stops on a block boundary at the cap', () => {
        const long = 'word '.repeat(300).trim();
        const pages = Array.from({ length: 20 }, (_, index) => {
            return page(index + 1, [
                shape(100, 400, [long, `line ${index}`], 'Face'),
            ]);
        });
        const result = genDocumentWords(pages, { fileTitle: 'Long' });
        expect(result.isTruncated).toBe(true);
        expect(result.text.length).toBeLessThanOrEqual(
            MAX_DOCUMENT_WORDS_CHARS,
        );
        expect(
            result.text.endsWith(`line ${result.readablePages.length - 1}`),
        ).toBe(false);
        expect(result.text.split('\n\n').at(-1)).toMatch(/^word/);
    });

    it('falls back to the file name for a title that is a section label', () => {
        const result = genDocumentWords(
            [
                page(1, [
                    shape(
                        0,
                        1,
                        ['Verse 1', '', 'Words of the song', 'go on'],
                        'Face',
                    ),
                ]),
            ],
            { fileTitle: 'My Song' },
        );
        expect(result.title).toBe('My Song');
    });

    it('merges words read off pictures back in page order', () => {
        const merged = mergePictureWords(
            [
                page(1, [
                    shape(100, 400, ['First slide words', 'two'], 'Face'),
                ]),
                page(2, [], {
                    pictures: [{ x: 0, y: 0, width: WIDTH, height: HEIGHT }],
                }),
            ],
            new Map([[2, 'Read off the picture\nsecond line']]),
        );
        const result = genDocumentWords(merged, { fileTitle: 'Song' });
        expect(result.pictureNeededPages).toEqual([]);
        expect(result.text).toBe(
            'Song\n\nFirst slide words\ntwo\n\nRead off the picture\nsecond line',
        );
    });
});
