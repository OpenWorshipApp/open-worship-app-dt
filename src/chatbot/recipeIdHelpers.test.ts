import { describe, expect, it } from 'vitest';

import {
    learnPageTitles,
    scrubAnswerRecipeIds,
    scrubAnswerToolFields,
} from './recipeIdHelpers';

const TITLES = {
    'W-08': 'Set the background (color / image / video / web)',
    'W-01b': 'Do things to a document from its row',
};

describe('scrubAnswerRecipeIds', () => {
    it('leaves an answer with no id untouched', () => {
        const text = 'Click the **Background** bar at the bottom.';
        expect(scrubAnswerRecipeIds(text, TITLES)).toBe(text);
    });
    it('turns the id that opened a real answer into the page title', () => {
        // Verbatim, Claude Sonnet 5, 2026-09-08, "Where is the button to
        // change the background?" -- two rounds, one search, no page opened.
        expect(
            scrubAnswerRecipeIds(
                'W-08 has exactly what you need. In the Presenter, look at ' +
                    'the bottom of the middle column.',
                TITLES,
            ),
        ).toBe(
            'The guide page “Set the background (color / image / video / ' +
                'web)” has exactly what you need. In the Presenter, look at ' +
                'the bottom of the middle column.',
        );
    });
    it('says "the guide page" for an id no tool result named', () => {
        expect(scrubAnswerRecipeIds('This is covered in W-22.', TITLES)).toBe(
            'This is covered in the guide page.',
        );
    });
    it('drops an aside built around an id whole', () => {
        expect(
            scrubAnswerRecipeIds(
                'Open the **Background** panel (W-08 step 1) and pick a tab.',
                TITLES,
            ),
        ).toBe('Open the **Background** panel and pick a tab.');
    });
    it('keeps the letter of a lettered id with the id', () => {
        expect(
            scrubAnswerRecipeIds('Right-click the row, see W-01b.', TITLES),
        ).toBe(
            'Right-click the row, see the guide page “Do things to a ' +
                'document from its row”.',
        );
    });
    it('leaves real-world tokens of the same shape alone', () => {
        const text = 'Save it as UTF-8 (UTF-8 is the default) on USB-3.';
        expect(scrubAnswerRecipeIds(text, TITLES)).toBe(text);
    });
    it('capitalises after a full stop and not mid-sentence', () => {
        expect(
            scrubAnswerRecipeIds('Two pages help. W-08 first, then W-22.', {}),
        ).toBe('Two pages help. The guide page first, then the guide page.');
    });
});

describe('learnPageTitles', () => {
    it('reads titles off a search result and a page', () => {
        const titles: Record<string, string> = {};
        learnPageTitles(
            titles,
            'owa_help_search',
            { query: 'background' },
            JSON.stringify([
                { id: 'W-15', title: 'Create and edit slides', score: 66 },
                { id: 'W-08', title: 'Set the background', score: 46 },
            ]),
        );
        learnPageTitles(
            titles,
            'owa_help_page',
            { id: 'W-22' },
            '# Build a running order\n\n**Goal:** ...',
        );
        expect(titles).toEqual({
            'W-15': 'Create and edit slides',
            'W-08': 'Set the background',
            'W-22': 'Build a running order',
        });
    });
    it('learns nothing from prose, and does not throw', () => {
        const titles: Record<string, string> = {};
        learnPageTitles(titles, 'owa_help_search', {}, 'Nothing matches.');
        learnPageTitles(titles, 'owa_list_screens', {}, '{"screens":[]}');
        expect(titles).toEqual({});
    });
});

// The answers this was written from, 2026-09-08, both on the panic question
// the moment the symptom rule asked the model to say which fault it found.
describe('scrubAnswerToolFields', () => {
    it('drops a bracket quoting a tool field as evidence, and keeps the sentence', () => {
        expect(
            scrubAnswerToolFields(
                'No screen is currently showing anything -- the projector ' +
                    "display isn't turned on at all in the app right now " +
                    '(isAnyShowing is false). That is an easy fix.',
            ),
        ).toBe(
            'No screen is currently showing anything -- the projector ' +
                "display isn't turned on at all in the app right now. " +
                'That is an easy fix.',
        );
        expect(
            scrubAnswerToolFields(
                'Found it -- no screen is showing at all right now ' +
                    '(isAnyShowing is false), which is why nothing appears.',
            ),
        ).toBe(
            'Found it -- no screen is showing at all right now, which is ' +
                'why nothing appears.',
        );
        expect(scrubAnswerToolFields('It pressed it (didChange: true).')).toBe(
            'It pressed it.',
        );
    });
    it('leaves every other bracket alone', () => {
        for (const text of [
            'Press F5 (or the show/hide button) to turn it on.',
            'Type the first letters (e.g. Joh for John).',
            'It also works on a tablet (iPad) or a phone (iPhone).',
            'Pick the version (KJV) first.',
            'The label reads Toggle showing screen (F5).',
        ]) {
            expect(scrubAnswerToolFields(text)).toBe(text);
        }
        expect(scrubAnswerToolFields('')).toBe('');
        expect(scrubAnswerToolFields(undefined as any)).toBe('');
    });
});
