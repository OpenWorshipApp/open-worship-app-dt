import { describe, expect, test } from 'vitest';

import { genQuickReplies, parseAnswerFrames } from './quickReplyHelpers';

// What an answer's closing frames give the window when a small model wrote
// them out of order, twice, or too many; and the either-or questions whose
// two halves cannot be named as buttons.

describe('the SHOWS frame among the others', () => {
    test('a control and a file are offered, whichever frame came first', () => {
        expect(
            parseAnswerFrames(
                [
                    'Press it here.',
                    'OPTIONS: Yes | No thanks',
                    'SHOWS: Clear All | file:C:/Users/one/Downloads/OWA-1.md',
                ].join('\n'),
            ),
        ).toEqual({
            text: 'Press it here.',
            options: ['Yes', 'No thanks'],
            requests: [],
            shows: [
                { kind: 'control', value: 'Clear All', name: 'Clear All' },
                {
                    kind: 'file',
                    value: 'C:/Users/one/Downloads/OWA-1.md',
                    name: 'OWA-1.md',
                },
            ],
        });
    });

    test('a control written in two frames is one chip', () => {
        expect(
            parseAnswerFrames(
                [
                    'Look here.',
                    'SHOWS: Clear All',
                    'NEEDS: screenshot',
                    'SHOWS: Clear All | Font Size',
                ].join('\n'),
            ),
        ).toEqual({
            text: 'Look here.',
            options: [],
            requests: ['screenshot'],
            shows: [
                { kind: 'control', value: 'Clear All', name: 'Clear All' },
                { kind: 'control', value: 'Font Size', name: 'Font Size' },
            ],
        });
    });

    test('three chips at most, however many frames carry them', () => {
        const parsed = parseAnswerFrames(
            [
                'Here they are.',
                'SHOWS: Previous Slide',
                'NEEDS: file',
                'SHOWS: Clear All | Font Size | Next Slide',
            ].join('\n'),
        );
        expect(parsed.shows.map((show) => show.value)).toEqual([
            'Clear All',
            'Font Size',
            'Next Slide',
        ]);
        expect(parsed.requests).toEqual(['file']);
        // Every frame is off the words, the one with no room as well.
        expect(parsed.text).toBe('Here they are.');
    });
});

describe('an either-or whose halves are no choice to name', () => {
    test('a half that runs back into the verb that asked it is no button', () => {
        // The left half is taken as many words as the right one has, and
        // here it starts on "need".
        expect(
            genQuickReplies('Do you need the Presenter or the Bible Reader?'),
        ).toEqual([]);
    });

    test('a right half too long to be a choice is none', () => {
        expect(
            genQuickReplies(
                'Should it go on screen 1 or on every screen you have ' +
                    'connected right now?',
            ),
        ).toEqual([]);
    });

    test('two halves that are the same choice are not two buttons', () => {
        expect(genQuickReplies('Do you mean screen 1 or Screen 1?')).toEqual(
            [],
        );
        // Two that differ are.
        expect(genQuickReplies('Do you mean screen 1 or screen 2?')).toEqual([
            'screen 1',
            'screen 2',
        ]);
    });
});
