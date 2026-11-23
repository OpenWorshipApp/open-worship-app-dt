import { describe, expect, it } from 'vitest';

import { readDeckSongAsk } from './deckSongAskHelpers';
import {
    checkIsPptxFileName,
    genPptxSlidesFailedText,
    genPptxSlidesListAnswer,
    genPptxSlidesMadeText,
    genPptxSlidesProgressText,
    MAX_PPTX_BUTTON_COUNT,
    pickPptxFiles,
    PPTX_SLIDES_TOOL_NAME,
    readPptxSlidesArgs,
    readPptxSlidesAsk,
    readPptxSlidesResult,
} from './pptxSlideAskHelpers';

// The user's story (2026-11-20): _as a user I want to ask chatbot to help
// convert the pptx file to app-document file_.
describe('readPptxSlidesAsk', () => {
    it('reads the asks a volunteer types for slides out of a PowerPoint', () => {
        for (const asked of [
            'convert .pptx to .ows',
            'convert pptx to ows',
            'Convert my PowerPoint to an ows file',
            'help me convert the pptx file to app-document file',
            'turn the PowerPoint into a slide document',
            'Can you make a slide document from my PowerPoint?',
            'make slide document out of the Easter powerpoint',
            'import the deck as slides',
            'turn my powerpoint into editable slides',
            'Change "Worship 15.11.2026.pptx" into a slide document',
            'convert the power point to this app format',
            'make slides from the Sunday PowerPoint',
            // No verb, as the drafter takes _powerpoint to lyric_.
            'pptx to ows',
            'PowerPoint to slide document',
        ]) {
            expect(readPptxSlidesAsk(asked), asked).not.toBeNull();
        }
    });

    it('leaves a song out of a deck to the song drafter', () => {
        for (const asked of [
            'turn powerpoint to lyric',
            'convert pptx to song',
            'make a song from my PowerPoint slides',
            'import a powerpoint song into slides',
        ]) {
            expect(readPptxSlidesAsk(asked), asked).toBeNull();
        }
        // ...and the drafter still reads them.
        expect(readDeckSongAsk('convert pptx to song')).not.toBeNull();
    });

    it('is not every sentence with PowerPoint or slides in it', () => {
        for (const asked of [
            'How do I open a PowerPoint?',
            'present the PowerPoint',
            'the powerpoint slides look blurry',
            'export my slide document to PowerPoint',
            'turn the slide document into a PowerPoint',
            'make a new slide document',
            'next slide',
            'powerpoint to slides',
            'the slide document and the pptx are both in the documents list',
            '/convert pptx to ows',
            'convert pptx to ows\nand then show it',
            'convert https://example.com/a.pptx to ows',
            '',
        ]) {
            expect(readPptxSlidesAsk(asked), asked).toBeNull();
        }
    });

    it('keeps the words that may name the PowerPoint', () => {
        expect(
            readPptxSlidesAsk(
                'make slide document out of the Easter powerpoint',
            )?.nameWords,
        ).toEqual(['easter']);
        expect(readPptxSlidesAsk('convert pptx to ows')?.nameWords).toEqual([]);
        // A quoted name is the name, whatever else is said.
        expect(
            readPptxSlidesAsk(
                'Change "Worship 15.11.2026.pptx" into a slide document',
            )?.nameWords,
        ).toEqual(['worship', '15', '11', '2026']);
        // The app's own name is no deck's.
        expect(
            readPptxSlidesAsk(
                'convert my powerpoint to an Open Worship slide document',
            )?.nameWords,
        ).toEqual([]);
    });
});

describe('pickPptxFiles', () => {
    const names = [
        'Easter.pptx',
        'Easter.ows',
        'Sermon notes.docx',
        'Old deck.ppt',
        'Worship 15.11.2026.pptx',
    ];

    it('offers every PowerPoint the converter reads, and nothing else', () => {
        expect(pickPptxFiles(names, [])).toEqual({
            files: ['Easter.pptx', 'Worship 15.11.2026.pptx'],
            isNamed: false,
        });
        expect(checkIsPptxFileName('Old deck.ppt')).toBe(false);
        expect(checkIsPptxFileName('A.PPTX')).toBe(true);
    });

    it('settles on the one the words name', () => {
        expect(pickPptxFiles(names, ['worship'])).toEqual({
            files: ['Worship 15.11.2026.pptx'],
            isNamed: true,
        });
        // A word naming none of them names nothing.
        expect(pickPptxFiles(names, ['christmas']).isNamed).toBe(false);
    });
});

describe('genPptxSlidesListAnswer', () => {
    it('says how to put a PowerPoint there when there is none', () => {
        const answer = genPptxSlidesListAnswer('/docs', []);
        expect(answer.actions).toEqual([]);
        expect(answer.text).toContain('no PowerPoint');
    });

    it('offers each PowerPoint as a button that converts it', () => {
        const answer = genPptxSlidesListAnswer('/docs', ['Easter.pptx']);
        expect(answer.actions).toEqual([
            {
                label: 'Make a slide document from "Easter.pptx"',
                toolName: PPTX_SLIDES_TOOL_NAME,
                args: { filePath: '/docs/Easter.pptx', name: 'Easter.pptx' },
            },
        ]);
    });

    it('says how many more there are past the buttons', () => {
        const files = Array.from(
            { length: MAX_PPTX_BUTTON_COUNT + 2 },
            (_, index) => {
                return `Deck ${index}.pptx`;
            },
        );
        const answer = genPptxSlidesListAnswer('C:\\Docs', files);
        expect(answer.actions).toHaveLength(MAX_PPTX_BUTTON_COUNT);
        expect(answer.actions[0].args.filePath).toBe('C:\\Docs\\Deck 0.pptx');
        expect(answer.text).toContain(
            `These are ${MAX_PPTX_BUTTON_COUNT} of the ${files.length}`,
        );
    });
});

describe('readPptxSlidesArgs', () => {
    it('takes a PowerPoint button, and nothing that is not one', () => {
        expect(
            readPptxSlidesArgs({ filePath: '/d/A.pptx', name: 'A.pptx' }),
        ).toEqual({ filePath: '/d/A.pptx', name: 'A.pptx' });
        expect(readPptxSlidesArgs({ filePath: 'C:\\d\\B.pptx' })).toEqual({
            filePath: 'C:\\d\\B.pptx',
            name: 'B.pptx',
        });
        expect(readPptxSlidesArgs({ filePath: '/d/A.ows' })).toBeNull();
        expect(readPptxSlidesArgs({ name: 'A.pptx' })).toBeNull();
        expect(readPptxSlidesArgs(null)).toBeNull();
    });
});

const RESULT = {
    created: 'Worship 15.11.2026.ows',
    from: 'Worship 15.11.2026.pptx',
    filePath: '/docs/Worship 15.11.2026.ows',
    slideCount: 73,
    stepSlideCount: 22,
    likeness: {
        percent: 99.6,
        lowestSlide: 41,
        lowestPercent: 98.2,
        measuredSlides: [1, 10, 20, 30, 41, 50, 60, 73],
    },
    missingFonts: ['Khmer OS Muol Light', 'Calibri'],
    leftOut: { videoSlides: [5], audioSlides: [], transitionSlides: [2, 5] },
    undoId: 'undo-1',
};

describe('readPptxSlidesResult', () => {
    it('takes a conversion, and nothing that is not one', () => {
        expect(readPptxSlidesResult(RESULT)).toBe(RESULT);
        expect(readPptxSlidesResult({ ...RESULT, filePath: '/a.pptx' })).toBe(
            null,
        );
        expect(readPptxSlidesResult({ ...RESULT, created: '' })).toBeNull();
        expect(readPptxSlidesResult({ error: 'no' })).toBeNull();
        expect(readPptxSlidesResult(null)).toBeNull();
    });
});

describe('genPptxSlidesMadeText', () => {
    it('says what was made, how alike it measured and what is left out', () => {
        const text = genPptxSlidesMadeText(RESULT);
        expect(text).toContain(
            'I made “Worship 15.11.2026.ows” from “Worship 15.11.2026.pptx”: 73 slides',
        );
        expect(text).toContain(
            '8 of its slides look 99.6% like the PowerPoint. The least alike is slide 41, at 98.2%.',
        );
        expect(text).toContain('a slide for each click');
        expect(text).toContain('Khmer OS Muol Light, Calibri.');
        expect(text).toContain('(slides 2, 5)');
    });

    it('says nothing it has nothing to say about', () => {
        const text = genPptxSlidesMadeText({
            created: 'A.ows',
            from: 'A.pptx',
            filePath: '/d/A.ows',
            slideCount: 3,
        });
        expect(text.split('\n\n')).toHaveLength(1);
    });

    it('keeps a long list short', () => {
        const text = genPptxSlidesMadeText({
            ...RESULT,
            leftOut: {
                transitionSlides: Array.from({ length: 20 }, (_, index) => {
                    return index + 1;
                }),
            },
        });
        expect(text).toContain(
            '(slides 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, …)',
        );
    });

    it('ends a cut font list on its ellipsis, with no stop after it', () => {
        const text = genPptxSlidesMadeText({
            ...RESULT,
            missingFonts: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        });
        expect(text).toContain('another font is used: A, B, C, D, E, F, …');
        expect(text).not.toContain('….');
        expect(
            genPptxSlidesMadeText({ ...RESULT, missingFonts: ['A'] }),
        ).toContain('another font is used: A.');
    });
});

describe('the other sentences', () => {
    it('name the PowerPoint', () => {
        expect(genPptxSlidesFailedText('A.pptx')).toContain('“A.pptx”');
        expect(genPptxSlidesProgressText('A.pptx')).toBe(
            'Making a slide document of “A.pptx”',
        );
    });
});
