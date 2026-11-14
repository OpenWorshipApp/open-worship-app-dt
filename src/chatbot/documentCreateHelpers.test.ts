import { describe, expect, test } from 'vitest';

import {
    DOCUMENT_CREATE_TOOL_MAP,
    genDefaultDocumentName,
    genDocumentCreateHint,
    pickFreeDocumentName,
    readDocumentCreateAsk,
    toDocumentDayText,
    withCreatedUndoAction,
} from './documentCreateHelpers';
import { LYRIC_UNDO_LABEL, LYRIC_UNDO_TOOL_NAME } from './lyricChatHelpers';

describe('a new presenting flow or slide document asked for', () => {
    test('the asks the baseline run answered with steps', () => {
        expect(
            readDocumentCreateAsk(
                'Make a new presenting flow for Sunday with Amazing Grace, ' +
                    'John 3:16 and a 5 minute countdown.',
            ),
        ).toEqual({
            kind: 'flow',
            name: null,
            dayName: 'Sunday',
            hasContent: true,
        });
        expect(
            readDocumentCreateAsk(
                'Create a running order called Evening Service.',
            ),
        ).toEqual({
            kind: 'flow',
            name: 'Evening Service',
            dayName: null,
            hasContent: false,
        });
        expect(
            readDocumentCreateAsk(
                'Make a new slide document called Sunday Welcome with a ' +
                    'welcome slide and an announcements slide.',
            ),
        ).toEqual({
            kind: 'slide',
            name: 'Sunday Welcome',
            dayName: null,
            hasContent: true,
        });
        expect(
            readDocumentCreateAsk(
                'Create a slide document with John 3:16 on one slide.',
            ),
        ).toEqual({
            kind: 'slide',
            name: null,
            dayName: null,
            hasContent: true,
        });
    });

    test('the other ways a person says it', () => {
        expect(
            readDocumentCreateAsk(
                'I need a new running order for Easter Sunday',
            ),
        ).toMatchObject({
            kind: 'flow',
            dayName: 'Easter Sunday',
            hasContent: false,
        });
        expect(
            readDocumentCreateAsk('Can you make me a run sheet?'),
        ).toMatchObject({ kind: 'flow', hasContent: false });
        expect(
            readDocumentCreateAsk(
                'Please build an order of service for next Sunday morning',
            ),
        ).toMatchObject({ kind: 'flow', dayName: 'Sunday Morning' });
        expect(
            readDocumentCreateAsk('Make 3 slides for the announcements'),
        ).toMatchObject({ kind: 'slide', hasContent: true });
        expect(
            readDocumentCreateAsk('Create a presentation named "Youth Night"'),
        ).toMatchObject({
            kind: 'slide',
            name: 'Youth Night',
            hasContent: false,
        });
        expect(
            readDocumentCreateAsk('Make a new running order “Harvest” please'),
        ).toMatchObject({ kind: 'flow', name: 'Harvest', hasContent: false });
        expect(
            readDocumentCreateAsk('Start a new slideshow, call it Baptism'),
        ).toMatchObject({ kind: 'slide', name: 'Baptism' });
    });

    test('a running order holding a slide is a running order', () => {
        expect(
            readDocumentCreateAsk(
                'Make a running order with a welcome slide and Amazing Grace',
            ),
        ).toMatchObject({ kind: 'flow', hasContent: true });
    });

    test('an order of service pasted under the ask is something to put in it', () => {
        expect(
            readDocumentCreateAsk(
                'Make a new running order:\n1. Welcome\n2. Amazing Grace',
            ),
        ).toMatchObject({ kind: 'flow', hasContent: true });
    });

    test('a how-to, a change to what exists and other files are not asks for one', () => {
        for (const text of [
            'How do I make a new slide document?',
            'How do I build a running order for a service?',
            'Can I make a new presenting flow?',
            'Is there a way to create a running order?',
            'Make the running order advance by itself',
            'Build it from my order of service',
            'Make the slides bigger',
            'Add a slide that says Welcome',
            'Make a new Bible list called Easter',
            'Create a song called Morning Praise',
            '/new running order',
            '',
        ]) {
            expect(readDocumentCreateAsk(text)).toBeNull();
        }
    });

    test('with a document of that kind open, only a NEW one makes one', () => {
        expect(
            readDocumentCreateAsk('Make a slide that says Welcome', ['slide']),
        ).toBeNull();
        expect(
            readDocumentCreateAsk('Make a running order for Sunday', ['flow']),
        ).toBeNull();
        expect(
            readDocumentCreateAsk('Make another running order for Sunday', [
                'flow',
            ]),
        ).toMatchObject({ kind: 'flow', dayName: 'Sunday' });
        expect(
            readDocumentCreateAsk(
                'Create a new slide document called Notices',
                ['slide'],
            ),
        ).toMatchObject({ kind: 'slide', name: 'Notices' });
        // The other kind open changes nothing.
        expect(
            readDocumentCreateAsk('Make a slide that says Welcome', ['flow']),
        ).toMatchObject({ kind: 'slide', hasContent: true });
    });

    test('a name too long to be one is no name', () => {
        expect(
            readDocumentCreateAsk(
                `Make a running order called ${'x'.repeat(70)}`,
            ),
        ).toMatchObject({ kind: 'flow', name: null });
    });
});

describe('the name a new file gets', () => {
    test('a default with the day it is made', () => {
        const date = new Date(2026, 10, 12, 9, 30);
        expect(toDocumentDayText(date)).toBe('2026-11-12');
        expect(genDefaultDocumentName('flow', date)).toBe(
            'Presenting Flow 2026-11-12',
        );
        expect(genDefaultDocumentName('slide', date)).toBe('Slides 2026-11-12');
    });

    test('never the name of a file there already, letter case aside', () => {
        expect(pickFreeDocumentName('Sunday', ['Easter'])).toBe('Sunday');
        expect(pickFreeDocumentName('Sunday', ['sunday'])).toBe('Sunday (2)');
        expect(pickFreeDocumentName('Sunday', ['Sunday', 'Sunday (2)'])).toBe(
            'Sunday (3)',
        );
    });

    test('each kind is made by its own tool, empty', () => {
        expect(DOCUMENT_CREATE_TOOL_MAP.flow.toolName).toBe(
            'owa_presenting_flow',
        );
        expect(DOCUMENT_CREATE_TOOL_MAP.flow.genArgs('Sunday')).toEqual({
            action: 'create',
            name: 'Sunday',
        });
        expect(DOCUMENT_CREATE_TOOL_MAP.slide.genArgs('Notices')).toEqual({
            action: 'create',
            name: 'Notices',
            content: '{"items":[]}',
        });
    });
});

describe('what the model is told', () => {
    test('it is made already: build into it, never make another', () => {
        const flowHint = genDocumentCreateHint('flow', 'Sunday');
        expect(flowHint).toContain('"Sunday"');
        expect(flowHint).toContain('update-lines');
        expect(flowHint).toContain('Do not make another');
        const slideHint = genDocumentCreateHint('slide', 'Notices');
        expect(slideHint).toContain('add-slides');
        expect(slideHint).toContain('owa_find_verse');
    });
});

describe('Undo this change takes the made file away too', () => {
    const created = {
        kind: 'flow' as const,
        name: 'Sunday',
        filePath: '/data/presenting-flows/Sunday.owpf',
        undoId: 'made-1',
    };

    test('folded under the change made in it, oldest first', () => {
        const actions = withCreatedUndoAction(
            [
                { label: 'Show it in the list', toolName: 'show' },
                {
                    label: LYRIC_UNDO_LABEL,
                    toolName: LYRIC_UNDO_TOOL_NAME,
                    args: {
                        id: 'edit-2',
                        name: 'Sunday',
                        ids: ['edit-1', 'edit-2'],
                    },
                },
            ],
            created,
        );
        expect(actions[1].args).toEqual({
            id: 'edit-2',
            name: 'Sunday',
            ids: ['made-1', 'edit-1', 'edit-2'],
            madeId: 'made-1',
            madePath: '/data/presenting-flows/Sunday.owpf',
        });
        expect(actions).toHaveLength(2);
    });

    test('one change alone keeps its id after the making', () => {
        const actions = withCreatedUndoAction(
            [
                {
                    label: LYRIC_UNDO_LABEL,
                    toolName: LYRIC_UNDO_TOOL_NAME,
                    args: { id: 'edit-1', name: 'Sunday' },
                },
            ],
            created,
        );
        expect(actions[0].args.ids).toEqual(['made-1', 'edit-1']);
    });

    test('nothing put in it: the button takes the file away alone', () => {
        expect(withCreatedUndoAction([], created)).toEqual([
            {
                label: LYRIC_UNDO_LABEL,
                toolName: LYRIC_UNDO_TOOL_NAME,
                args: {
                    id: 'made-1',
                    name: 'Sunday',
                    madeId: 'made-1',
                    madePath: '/data/presenting-flows/Sunday.owpf',
                },
            },
        ]);
    });

    test("another document's change is left alone", () => {
        const other = {
            label: LYRIC_UNDO_LABEL,
            toolName: LYRIC_UNDO_TOOL_NAME,
            args: { id: 'edit-9', name: 'Easter' },
        };
        const actions = withCreatedUndoAction([other], created);
        expect(actions[0]).toBe(other);
        expect(actions[1].args.madeId).toBe('made-1');
    });

    test('no id, no button', () => {
        expect(withCreatedUndoAction([], { ...created, undoId: null })).toEqual(
            [],
        );
    });
});
