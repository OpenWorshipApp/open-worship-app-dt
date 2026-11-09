// A messy note formatted by the chatbot (BN-58, 2026-11-09, the user:
// _imagine user made a messy content then ask chatbot to do reformating,
// chatbot should do the job of formating the note to be well form and easy
// to read_). Asked to tidy a note whose three questions were one line,
// gemma4:cloud tried five calls and ended with the line whole as one bullet
// and two of its questions added again beside it.
import { describe, expect, test } from 'vitest';

import { applyNoteEdit, readNoteBlocks } from './agentNoteBlockHelpers';
import { expandBlockSplits } from './agentNoteMarkupHelpers';

type NodeType = Record<string, any>;

function text(words: string): NodeType {
    return {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: words,
        type: 'text',
        version: 1,
    };
}

function paragraph(words: string): NodeType {
    return {
        children: [text(words)],
        direction: null,
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
        textFormat: 0,
        textStyle: '',
    };
}

function noteOf(...blocks: NodeType[]) {
    return JSON.stringify({
        root: {
            children: blocks,
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    });
}

const QUESTIONS =
    'questions: who is lost today? how can we help them come home? have ' +
    'you ever been lost yourself?';
// 1 the title line, 2 "points", 3 the questions run together, 4 a prayer.
const MESSY = noteOf(
    paragraph('sunday lesson    the lost sheep'),
    paragraph('points'),
    paragraph(QUESTIONS),
    paragraph('lord help us to see the lost like you do amen'),
);

function edit(changes: any[]) {
    const result = applyNoteEdit({ content: MESSY, changes });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return readNoteBlocks(result.content)!.blocks.map((block) => {
        return `${block.kind}: ${block.text}`;
    });
}

describe('a block made several', () => {
    test('a list kind and its lines: one item a line, every word kept', () => {
        expect(
            edit([
                { block: 1, kind: 'h1', text: 'The Lost Sheep' },
                { after: 2, kind: 'h2', text: 'Questions' },
                {
                    block: 3,
                    kind: 'bullet',
                    text:
                        'Who is lost today?\nHow can we help them come ' +
                        'home?\n- Have you ever been lost yourself?',
                },
            ]),
        ).toEqual([
            'h1: The Lost Sheep',
            'paragraph: points',
            'h2: Questions',
            'bullet: Who is lost today?',
            'bullet: How can we help them come home?',
            // The model's own list mark is not words.
            'bullet: Have you ever been lost yourself?',
            'paragraph: lord help us to see the lost like you do amen',
        ]);
    });

    test('a section: a block a line, each its kind off the line', () => {
        expect(
            edit([
                {
                    block: 3,
                    kind: 'section',
                    text:
                        '## Questions\\n1. Who is lost today?\\n2. How can we ' +
                        'help them come home?\\n3. Have you ever been lost ' +
                        'yourself?',
                },
                { block: 2, kind: 'section', text: '## Points' },
            ]),
        ).toEqual([
            'paragraph: sunday lesson    the lost sheep',
            'h2: Points',
            'h2: Questions',
            'number: Who is lost today?',
            'number: How can we help them come home?',
            'number: Have you ever been lost yourself?',
            'paragraph: lord help us to see the lost like you do amen',
        ]);
    });

    test("lines that drop most of the block's words are still refused", () => {
        const refused = applyNoteEdit({
            content: MESSY,
            changes: [{ block: 3, kind: 'bullet', text: 'Lost\nFound' }],
        });
        expect('reason' in refused && refused.reason).toContain(
            'would lose its own words',
        );
    });

    test('parts added while the block keeps them all are refused, the split shown', () => {
        // gemma4:cloud's own fifth call.
        const refused = applyNoteEdit({
            content: MESSY,
            changes: [
                { block: 3, kind: 'bullet' },
                {
                    after: 3,
                    kind: 'bullet',
                    text: 'How can we help them come home?',
                },
            ],
        });
        expect('reason' in refused && refused.reason).toContain(
            'Block 3 already holds the words',
        );
        expect('reason' in refused && refused.reason).toContain(
            'kind: "bullet", text: "first line\\nsecond line"',
        );
    });

    test('a block given back its own words is never split', () => {
        const changes = expandBlockSplits(
            [{ block: 1, kind: 'bullet', text: 'first\nsecond' }],
            () => 'first\nsecond',
        );
        expect(changes).toEqual([
            { block: 1, kind: 'bullet', text: 'first\nsecond' },
        ]);
        // No kind, or a heading's: the words go in as they always did.
        expect(
            expandBlockSplits([{ block: 1, text: 'a\nb' }], () => 'x'),
        ).toEqual([{ block: 1, text: 'a\nb' }]);
    });
});

// The run-on note, one paragraph, formatted the way gemma4:cloud wrote it:
// the paragraph removed and the new blocks numbered as they will stand.
const RUN_ON = noteOf(
    paragraph(
        'today we talk about prayer. first, prayer is just talking to god. ' +
            'then ask the class what do you pray about.',
    ),
);

function editRunOn(changes: any[]) {
    const result = applyNoteEdit({ content: RUN_ON, changes });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return readNoteBlocks(result.content)!.blocks.map((block) => {
        return `${block.kind}: ${block.text}`;
    });
}

describe('a note rewritten as blocks numbered as they will stand', () => {
    test('each part after the one before, the old paragraph gone', () => {
        // gemma4:cloud's third call, word for word but shorter.
        expect(
            editRunOn([
                { block: 1, remove: true },
                { after: 0, kind: 'h1', text: 'Today We Talk About Prayer' },
                {
                    after: 1,
                    kind: 'section',
                    text: '## Main Points\n- Prayer is just talking to God.',
                },
                {
                    after: 2,
                    kind: 'section',
                    text: '## Class Discussion\n- What do you pray about?',
                },
            ]),
        ).toEqual([
            'h1: Today We Talk About Prayer',
            'h2: Main Points',
            'bullet: Prayer is just talking to God.',
            'h2: Class Discussion',
            'bullet: What do you pray about?',
        ]);
    });

    test('new blocks after a block the call removes take its place', () => {
        expect(
            edit([
                { block: 3, remove: true },
                { after: 3, kind: 'h2', text: 'Questions' },
                { after: 3, kind: 'bullet', text: 'Who is lost today?' },
            ]),
        ).toEqual([
            'paragraph: sunday lesson    the lost sheep',
            'paragraph: points',
            'h2: Questions',
            'bullet: Who is lost today?',
            'paragraph: lord help us to see the lost like you do amen',
        ]);
    });

    test('a model cannot set the marks the app sets itself', () => {
        // `chain` from a model is dropped: "after: 9" in a 4-block note is
        // still refused as a block that is not there.
        const refused = applyNoteEdit({
            content: MESSY,
            changes: [{ after: 9, kind: 'paragraph', text: 'x', chain: true }],
        });
        expect('reason' in refused && refused.reason).toContain(
            '`after` is 0 (the top) or a block number',
        );
    });
});

describe('a block made a heading with its parts after it', () => {
    test('is a split: its words carried by the blocks after it', () => {
        // gemma4:cloud's first call on the run-on note, shorter.
        expect(
            editRunOn([
                { block: 1, kind: 'h1', text: 'Today We Talk About Prayer' },
                {
                    after: 1,
                    kind: 'section',
                    text: '## Main Points\n- First, prayer is just talking to God.',
                },
                {
                    after: 2,
                    kind: 'section',
                    text: '## Class\n- Then ask the class what do you pray about.',
                },
            ]),
        ).toEqual([
            'h1: Today We Talk About Prayer',
            'h2: Main Points',
            'bullet: First, prayer is just talking to God.',
            'h2: Class',
            'bullet: Then ask the class what do you pray about.',
        ]);
    });

    test('a heading of other words with nothing after it still loses them', () => {
        const refused = applyNoteEdit({
            content: RUN_ON,
            changes: [{ block: 1, kind: 'h1', text: 'Prayer' }],
        });
        expect('reason' in refused && refused.reason).toContain(
            'would lose its own words',
        );
    });
});
