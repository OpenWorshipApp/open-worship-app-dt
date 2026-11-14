/**
 * `owa_note_edit`'s block rules (`agentNoteBlockHelpers.ts`) at the edges
 * the other suites leave: inline nodes with no words, a range token given
 * back to a block, new blocks numbered past the note's end, and a drawing's
 * refusals -- lines that draw nothing, a size in px, data no board reads --
 * and a drawing kept inside a quote.
 */
import { describe, expect, test } from 'vitest';

import {
    applyNoteEdit,
    collectNewNoteVerseRefs,
    readNoteBlocks,
} from './agentNoteBlockHelpers';
import { genNoteDrawingNode } from './agentNoteDrawingHelpers';

type NodeType = Record<string, any>;

function text(words: string, extra: NodeType = {}): NodeType {
    return {
        detail: 0,
        format: 0,
        mode: 'normal',
        style: '',
        text: words,
        type: 'text',
        version: 1,
        ...extra,
    };
}

function element(type: string, children: any[], extra: NodeType = {}) {
    return {
        children,
        direction: null,
        format: '',
        indent: 0,
        type,
        version: 1,
        ...extra,
    };
}

function paragraph(children: any[]) {
    return element('paragraph', children, { textFormat: 0, textStyle: '' });
}

function noteOf(children: any[]) {
    return JSON.stringify({ root: element('root', children) });
}

function drawingOf(lines: string): NodeType {
    const made = genNoteDrawingNode(lines, {
        now: new Date(2026, 10, 9),
        genId: () => 'abcde',
    });
    if ('reason' in made) {
        throw new Error(made.reason);
    }
    return made.node;
}

function reasonOf(content: string, changes: any[]) {
    const result = applyNoteEdit({ content, changes });
    if (!('reason' in result)) {
        throw new Error('expected a refusal');
    }
    // A refusal hands back no content to write.
    expect(result).toEqual({ reason: result.reason });
    return result.reason;
}

function textsOf(content: string) {
    return readNoteBlocks(content)!.blocks.map((block) => block.text);
}

const NEEDS_LINES =
    'A drawing needs its boxes in `text`: a line a box, or "A -> B" for an ' +
    'arrow from box A to box B; 40 lines at most.';
const NOT_READ = 'That drawing could not be read.';

describe('a block read', () => {
    test('an inline node with no words of its own adds none', () => {
        const { text: _words, ...wordless } = text('');
        const content = noteOf([
            paragraph([
                text('Grace'),
                { type: 'emoji', version: 1 },
                wordless,
                text(' abounds'),
            ]),
        ]);
        expect(textsOf(content)).toEqual(['Grace abounds']);
    });
});

describe('a verse a change would add', () => {
    const RANGE_MENTION = {
        detail: 1,
        format: 0,
        mode: 'segmented',
        style: '',
        text: 'John 3:16-18',
        type: 'mention',
        version: 1,
        mentionData: null,
        mentionId: null,
        mentionKind: 'bible-verse',
        mentionName: 'John 3:16-18',
    };
    const CONTENT = noteOf([
        paragraph([RANGE_MENTION]),
        paragraph([text('Old words')]),
    ]);

    test("a block's own range chip given back stays the chip", () => {
        expect(textsOf(CONTENT)[0]).toBe('[^John 3:16-18]');
        expect(
            collectNewNoteVerseRefs(CONTENT, [
                { block: 1, text: '[^John 3:16-18]' },
            ]),
        ).toEqual([]);
    });

    test('a range token alone in another block is that passage, read anew', () => {
        expect(
            collectNewNoteVerseRefs(CONTENT, [
                { block: 2, text: '[^Romans 8:28-30]' },
            ]),
        ).toEqual(['Romans 8:28-30']);
        // The range the note has as a chip, put in place of other words, is
        // a passage printed whole, which the chip does not stand in for.
        expect(
            collectNewNoteVerseRefs(CONTENT, [
                { block: 2, text: '[^John 3:16-18]' },
            ]),
        ).toEqual(['John 3:16-18']);
    });
});

describe('new blocks numbered past the note', () => {
    test('a block after one this call adds goes after the same block, in order', () => {
        const content = noteOf([
            paragraph([text('One')]),
            paragraph([text('Two')]),
        ]);
        // "after: 3" in a two-block note is the first new block.
        const result = applyNoteEdit({
            content,
            changes: [
                { after: 1, kind: 'paragraph', text: 'First new' },
                { after: 3, kind: 'paragraph', text: 'Second new' },
            ],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(textsOf(result.content)).toEqual([
            'One',
            'First new',
            'Second new',
            'Two',
        ]);
    });
});

describe('a drawing changed', () => {
    const DRAWING_NOTE = noteOf([
        paragraph([text('Main points')]),
        paragraph([drawingOf('Knows -> Leads')]),
    ]);

    test('new lines that name no box are refused', () => {
        expect(readNoteBlocks(DRAWING_NOTE)!.blocks[1]).toMatchObject({
            kind: 'drawing',
            text: 'Knows -> Leads',
        });
        expect(reasonOf(DRAWING_NOTE, [{ block: 2, text: ' ; ' }])).toBe(
            NEEDS_LINES,
        );
    });

    test('a new drawing takes no size in px', () => {
        expect(
            reasonOf(DRAWING_NOTE, [
                { after: 2, kind: 'drawing', text: 'A -> B', size: 20 },
            ]),
        ).toBe(
            'A new drawing is a drawing: it takes new lines in `text` (a line ' +
                'a box, "A -> B" an arrow, a first line "layout: across", ' +
                '"circle" or "center"), `background` (its boxes), `color` ' +
                '(its lines), `size` "larger" or "smaller", and `align`.',
        );
    });

    test('a drawing whose saved data is broken is not coloured', () => {
        const broken = { ...drawingOf('Knows -> Leads'), data: 'not a scene' };
        const content = noteOf([
            paragraph([text('Main points')]),
            paragraph([broken]),
        ]);
        expect(reasonOf(content, [{ block: 2, background: 'red' }])).toBe(
            NOT_READ,
        );
    });

    test('a board object standing alone outside a paragraph is not changed', () => {
        // The editor keeps a drawing INSIDE a paragraph; one written at the
        // top level is read, but no change reaches into it.
        const content = noteOf([
            paragraph([text('Main points')]),
            drawingOf('Knows -> Leads'),
        ]);
        expect(readNoteBlocks(content)!.blocks[1].kind).toBe('drawing');
        expect(reasonOf(content, [{ block: 2, background: 'red' }])).toBe(
            NOT_READ,
        );
    });

    test('a drawing kept inside a quote is made larger where it sits', () => {
        const drawing = drawingOf('Knows -> Leads');
        const content = noteOf([
            paragraph([text('Main points')]),
            element('quote', [paragraph([drawing])]),
        ]);
        const result = applyNoteEdit({
            content,
            changes: [{ block: 2, size: 'larger' }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const quote = JSON.parse(result.content).root.children[1];
        expect(quote.type).toBe('quote');
        const changed = quote.children[0].children[0];
        expect(changed.type).toBe('excalidraw');
        expect(changed.width).toBeGreaterThan(drawing.width);
        expect(changed.height).toBeGreaterThan(drawing.height);
        // The drawing is the same one, only drawn larger.
        expect(changed.data).toBe(drawing.data);
    });
});
