import { describe, expect, it, vi } from 'vitest';

vi.mock('./helpBotHelpers', () => {
    return { BUILTIN_TOOL_NAME: 'owa-builtin' };
});

import {
    READER_ROUTE_TEXT,
    checkIsBibleReadingAsk,
    genReaderRouteAdvice,
    toMainWindowFocus,
} from './readerRouteHelpers';

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

    // Showing it to the room is what the Presenter is for.
    it('leaves a question about presenting, and one about something else, alone', () => {
        for (const asked of [
            'how do I show a verse on the screen',
            'put the bible on the projector',
            'how do I present a passage to the congregation',
            'open the bible on the second display',
            'how do I add a song',
            'how do I change the background',
            'the bible',
            'open the settings',
            // "Open" describing a window: a question about the help window.
            'How do I get help with another open window, like a Bible Reader window?',
            'Which open windows does the help know, the Bible Note too?',
            '',
        ]) {
            expect(checkIsBibleReadingAsk(asked), asked).toBe(false);
        }
    });

    it('is offered under such an answer on the Presenter and the Document Editor', () => {
        for (const focus of ['presenter', 'appDocumentEditor']) {
            expect(genReaderRouteAdvice('how can I open bible', focus)).toEqual(
                {
                    text: READER_ROUTE_TEXT,
                    action: {
                        label: 'Go to the Bible Reader',
                        // The window's own command: the person's press, no
                        // model's.
                        toolName: 'owa-builtin',
                        args: { command: '/goto reader' },
                    },
                },
            );
        }
        // Said so that nobody fears for what is showing.
        expect(READER_ROUTE_TEXT).toContain('projector is left as it is');
    });

    // A tab opened from the Reader still says "Bible Reader" after the
    // stray press: the page is read off the app, not off the tab.
    it('goes by the page the main window is on now', () => {
        expect(
            toMainWindowFocus({ mainWindow: { page: 'presenter.html' } }),
        ).toBe('presenter');
        expect(toMainWindowFocus({ mainWindow: { page: 'reader.html' } })).toBe(
            'reader',
        );
        expect(
            toMainWindowFocus({
                mainWindow: { page: 'appDocumentEditor.html' },
            }),
        ).toBe('appDocumentEditor');
        // Nothing read, or a page nobody knows: no guess.
        expect(toMainWindowFocus(null)).toBeNull();
        expect(toMainWindowFocus({ mainWindow: null })).toBeNull();
        expect(
            toMainWindowFocus({ mainWindow: { page: 'x.html' } }),
        ).toBeNull();
        // The whole of it: on the Presenter now, whatever the tab reads.
        expect(
            genReaderRouteAdvice(
                'how can I open bible',
                toMainWindowFocus({ mainWindow: { page: 'presenter.html' } }) ??
                    'reader',
            ),
        ).not.toBeNull();
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

    it('is not offered where it would say nothing new', () => {
        // Already there.
        expect(
            genReaderRouteAdvice('how can I open bible', 'reader'),
        ).toBeNull();
        // A window of its own: the main window is behind it, untouched.
        for (const focus of ['setting', 'bibleNote', 'lyricEditor', '']) {
            expect(
                genReaderRouteAdvice('how can I open bible', focus),
            ).toBeNull();
        }
        // Not about reading the Bible.
        expect(
            genReaderRouteAdvice(
                'how do I show a verse on the screen',
                'presenter',
            ),
        ).toBeNull();
        // The answer carries the button already.
        expect(
            genReaderRouteAdvice('how can I open bible', 'presenter', [
                {
                    label: 'Bible Reader',
                    toolName: 'owa-builtin',
                    args: { command: '/goto reader' },
                },
            ]),
        ).toBeNull();
        // Another button of the same kind is not that one.
        expect(
            genReaderRouteAdvice('how can I open bible', 'presenter', [
                {
                    label: 'Go to the Presenter',
                    toolName: 'owa-builtin',
                    args: { command: '/goto presenter' },
                },
            ]),
        ).not.toBeNull();
    });
});
