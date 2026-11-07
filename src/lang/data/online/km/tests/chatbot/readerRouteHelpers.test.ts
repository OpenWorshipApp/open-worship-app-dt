import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../../chatbot/helpBotHelpers', () => {
    return { BUILTIN_TOOL_NAME: 'owa-builtin' };
});

import {
    checkIsBibleReadingAsk,
    genReaderRouteAdvice,
} from '../../../../../../chatbot/readerRouteHelpers';

// "The elderly user might accidentally changed page to presenter, if user
// ask question like bible reading open bible or find bible let add extra
// follow up to let user know they also should change page to reader."
describe('the way back to the Bible Reader', () => {
    it('knows a question about reading, opening or finding the Bible', () => {
        for (const asked of [
            'how can I open bible',
            'bible reading',
            'find bible',
            'How do I read the Bible?',
            'where is the bible',
            'I want to look up a verse',
            'search the scriptures for a word',
            'open the Psalms',
            // Still a request to open one, with "window" after it.
            'How do I open a Bible Reader window?',
            'តើខ្ញុំអានព្រះគម្ពីរយ៉ាងដូចម្តេច',
        ]) {
            expect(checkIsBibleReadingAsk(asked), asked).toBe(true);
        }
    });

    // "Where did a Bible I imported come from?" -- Settings' own question --
    // carries "Bible" and "where", and came back with the way to the
    // Reader under an answer about where a Bible file came from.
    it('is not offered under a supported question filed on another page', () => {
        const asked = 'Where did a Bible I imported come from?';
        expect(checkIsBibleReadingAsk(asked)).toBe(true);
        expect(
            genReaderRouteAdvice(asked, 'presenter', [], {
                text: 'Where did a Bible I imported come from?',
                page: 'settings',
            }),
        ).toBeNull();
        // A Reader row is about reading, wherever it is asked from.
        const readerAsk = 'Where do I read a Bible passage?';
        expect(
            genReaderRouteAdvice(readerAsk, 'presenter', [], {
                text: readerAsk,
                page: 'reader',
            }),
        ).not.toBeNull();
        // In a Khmer window the row SHOWS Khmer and a pressed chip asks its
        // English: either wording is the row (EC-321).
        expect(
            genReaderRouteAdvice(
                'Where do I find a Bible’s publisher and copyright?',
                'presenter',
                [],
                {
                    text: 'តើខ្ញុំរកអ្នកបោះពុម្ព និងសិទ្ធិអ្នកនិពន្ធរបស់ព្រះគម្ពីរនៅឯណា?',
                    textEn: 'Where do I find a Bible’s publisher and copyright?',
                    page: 'settings',
                },
            ),
        ).toBeNull();
        expect(
            genReaderRouteAdvice(
                'តើខ្ញុំរកអ្នកបោះពុម្ព និងសិទ្ធិអ្នកនិពន្ធរបស់ព្រះគម្ពីរនៅឯណា?',
                'presenter',
                [],
                {
                    text: 'តើខ្ញុំរកអ្នកបោះពុម្ព និងសិទ្ធិអ្នកនិពន្ធរបស់ព្រះគម្ពីរនៅឯណា?',
                    textEn: 'Where do I find a Bible’s publisher and copyright?',
                    page: 'settings',
                },
            ),
        ).toBeNull();
        // A row for every window is the Reader's too, and keeps its button.
        const backAsk =
            'I only want to read the Bible — how do I get back to the Bible Reader?';
        expect(
            genReaderRouteAdvice(backAsk, 'presenter', [], {
                text: 'ខ្ញុំគ្រាន់តែចង់អានព្រះគម្ពីរ',
                textEn: backAsk,
                page: 'common',
            }),
        ).not.toBeNull();
        // Words of the person's own that a row's phrase matched are still
        // read by their words: only the row itself, word for word, decides.
        expect(
            genReaderRouteAdvice('how can I open bible', 'presenter', [], {
                text: 'How do I open the Bible Lookup?',
                page: 'presenter',
            }),
        ).not.toBeNull();
    });
});
