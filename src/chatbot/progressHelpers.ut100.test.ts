import { describe, expect, test } from 'vitest';

import { describeToolStep } from './progressHelpers';

// The wait line for the three tools a conversation about ONE item uses: a
// slide document, a run sheet and a Bible note.

describe('describeToolStep for the one-item edit tools', () => {
    test('a slide document change is said as the slide tool says it, named by the file', () => {
        const named = describeToolStep('owa_slide_edit', {
            action: 'update-slides',
            file: 'C:\\Users\\me\\Documents\\Sunday.ows',
        });
        // Many slides at once, and a background, are "the document changed".
        expect(
            describeToolStep('owa_slide_edit', {
                action: 'set-background',
                file: 'C:/Users/me/Documents/Sunday.ows',
            }),
        ).toBe(named);
        expect(
            describeToolStep('owa_slide_file', {
                action: 'update',
                name: 'Sunday',
            }),
        ).toBe(named);
        expect(named).toContain('“Sunday”');
        expect(named).not.toContain('.ows');
        expect(named).not.toContain('Documents');
    });

    test('adding many slides is said as adding a slide; one slide keeps its number', () => {
        expect(
            describeToolStep('owa_slide_edit', {
                action: 'add-slides',
                file: '/home/me/Sunday.OWS',
            }),
        ).toBe(
            describeToolStep('owa_slide_file', {
                action: 'add-slide',
                name: 'Sunday',
            }),
        );
        expect(
            describeToolStep('owa_slide_edit', {
                action: 'update-slide',
                file: 'Sunday.ows',
                slide: 3,
            }),
        ).toBe('Changing slide 3 of “Sunday”');
    });

    test('a slide document with no file name is said without one', () => {
        expect(describeToolStep('owa_slide_edit', { action: 'slides' })).toBe(
            'Reading the slides',
        );
        expect(
            describeToolStep('owa_slide_edit', {
                action: 'update-slide',
                file: 42,
                slide: 2,
            }),
        ).toBe('Changing slide 2');
    });

    test('a run sheet in its own conversation says what is done to it', () => {
        expect(
            describeToolStep('owa_presenting_flow_edit', { action: 'lines' }),
        ).toBe('Reading a run sheet');
        expect(
            describeToolStep('owa_presenting_flow_edit', {
                action: 'update-lines',
            }),
        ).toBe('Working on a run sheet');
        expect(
            describeToolStep('owa_presenting_flow_edit', {
                action: 'remove-lines',
            }),
        ).toBe('Taking a line off a run sheet');
    });

    test('a Bible note is read, and every other action changes it', () => {
        expect(describeToolStep('owa_note_edit', { action: 'read' })).toBe(
            'Reading a Bible note',
        );
        for (const action of ['edit', 'undo', 'redo', 'view']) {
            expect(describeToolStep('owa_note_edit', { action })).toBe(
                'Changing a Bible note',
            );
        }
    });
});
