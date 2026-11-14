import { describe, expect, it, vi } from 'vitest';

// A slide document read for the help window, past the paths the main test
// walks: one listed a page at a time (the tool's note, a slide with more
// boxes than it lists), and a size asked in another language's own words --
// a size in pixels held to the range the window sets, and a longer sentence
// than the English reader takes. The installed language (`xx`, ASCII
// patterns) is this file's own: the store answers only its files.
vi.mock('../lang/langFileStore', async (importOriginal) => {
    const real = await importOriginal<object>();
    const fileMap: Record<string, { langCode: string; file: unknown }[]> = {
        'assistant.json': [
            {
                langCode: 'en',
                file: {
                    name: 'English',
                    nativeName: 'English',
                    scriptPattern: '[A-Za-z]',
                },
            },
            {
                langCode: 'xx',
                file: {
                    name: 'Xxish',
                    nativeName: 'Xxish',
                    scriptPattern: '[A-Za-z]',
                    textSizeAsks: {
                        larger: ['^grow the (?:\\w+ )+please$'],
                        set: ['^xsize (?<size>\\d+)$'],
                    },
                },
            },
        ],
    };
    return {
        ...real,
        listLangFiles: (fileName: string) => fileMap[fileName] ?? [],
    };
});

import {
    SLIDE_SIZE_LARGER_FACTOR,
    readSlideSizeAsk,
    toSlideDocumentText,
} from './slideChatHelpers';

describe('a slide document listed a page at a time', () => {
    it('keeps the note on where the list goes on, and says how many boxes a slide has in all', () => {
        const note =
            'Slides 1 to 1 of 30 are listed. Ask again with slide: 2 for ' +
            'the ones after.';
        const text = toSlideDocumentText({
            slideCount: 30,
            width: 1920,
            height: 1080,
            note,
            slides: [
                {
                    number: 1,
                    items: [
                        {
                            id: 1,
                            type: 'image',
                            file: 'bg.jpg',
                            left: 0,
                            top: 0,
                            width: 1920,
                            height: 1080,
                        },
                    ],
                    itemCount: 12,
                },
            ],
        });

        expect(text).toBe(
            [
                'Slides: 30 · each 1920 x 1080 pixels',
                note,
                '',
                'Slide 1',
                '  box 1 · image bg.jpg · at 0,0 size 1920x1080',
                '  … 12 boxes in all',
            ].join('\n'),
        );
    });
});

describe('a size asked in an installed language’s own words', () => {
    it('a size in pixels is set when the window can draw it, and nothing otherwise', () => {
        expect(readSlideSizeAsk('xsize 40')).toEqual({ kind: 'set', size: 40 });
        expect(readSlideSizeAsk('xsize 8')).toEqual({ kind: 'set', size: 8 });
        expect(readSlideSizeAsk('xsize 600')).toEqual({
            kind: 'set',
            size: 600,
        });
        expect(readSlideSizeAsk('xsize 7')).toBe(null);
        expect(readSlideSizeAsk('xsize 601')).toBe(null);
    });

    it('a sentence longer than the English reader takes is still read in it', () => {
        const asked =
            'grow the words on every one of these slides for the people ' +
            'at the back of the room please';
        expect(asked.length).toBeGreaterThan(80);
        expect(readSlideSizeAsk(asked)).toEqual({
            kind: 'scale',
            factor: SLIDE_SIZE_LARGER_FACTOR,
        });
        // Past what any language reader takes, it is the assistant's.
        const tooLong = `grow the ${'very '.repeat(24)}please`;
        expect(tooLong.length).toBeGreaterThan(120);
        expect(readSlideSizeAsk(tooLong)).toBe(null);
    });
});
