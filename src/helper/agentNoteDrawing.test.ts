// A drawing the chatbot makes and changes in a Bible note (BN-51,
// 2026-11-09, the user: _make sure chatbot can help drawing_). Asked to make
// a drawing larger, gemma4:cloud sent `size` on its block, nothing changed,
// and the answer said it was larger: a drawing now takes what changes IT --
// new lines (drawn again), its boxes' fill, its lines' colour, larger or
// smaller -- and refuses the rest, saying so.
import { describe, expect, test } from 'vitest';

import { applyNoteEdit, readNoteBlocks } from './agentNoteBlockHelpers';
import {
    changeNoteDrawingNode,
    checkIsDarkColor,
    genNoteDrawingNode,
    readNoteDrawingLines,
    readNoteDrawingScene,
    toNoteDrawingText,
} from './agentNoteDrawingHelpers';

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

function paragraph(children: NodeType[]): NodeType {
    return {
        children,
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

const FIXED = { now: new Date(2026, 10, 9, 9, 0), genId: () => 'abcde' };

function drawingNode(lines: string, extra: Record<string, unknown> = {}) {
    const made = genNoteDrawingNode(lines, { ...FIXED, ...extra });
    if ('reason' in made) {
        throw new Error(made.reason);
    }
    return made.node;
}

function sceneOf(node: NodeType) {
    return JSON.parse(node.data);
}

function boxOf(node: NodeType, words: string) {
    const elements: NodeType[] = sceneOf(node).elements;
    const label = elements.find((element) => {
        return element.type === 'text' && element.text === words;
    });
    return elements.find((element) => element.id === label?.containerId)!;
}

/** A note of a line, a drawing of the three points, a line. */
function noteWithDrawing(node = drawingNode('Knows -> Leads -> Gives')) {
    return noteOf(
        paragraph([text('Main points')]),
        paragraph([node]),
        paragraph([text('Questions')]),
    );
}

function edit(content: string, changes: any[]) {
    const result = applyNoteEdit({ content, changes, ...FIXED });
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return {
        result,
        drawing: JSON.parse(result.content).root.children[1].children[0],
    };
}

describe('a drawing laid out', () => {
    test('down by default, across, round a ring, or round the first', () => {
        const down = drawingNode('A -> B -> C');
        expect(boxOf(down, 'A').y).toBeLessThan(boxOf(down, 'B').y);
        expect(boxOf(down, 'A').x).toBe(boxOf(down, 'B').x);
        // The scene says nothing of a layout drawn down: unchanged as before.
        expect(sceneOf(down).layout).toBeUndefined();

        const across = drawingNode('layout: across\nA -> B -> C');
        expect(boxOf(across, 'A').x).toBeLessThan(boxOf(across, 'B').x);
        expect(boxOf(across, 'B').x).toBeLessThan(boxOf(across, 'C').x);
        expect(boxOf(across, 'A').y).toBe(boxOf(across, 'B').y);
        expect(sceneOf(across).layout).toBe('across');
        // Wider than tall, where down is taller than wide.
        expect(across.width).toBeGreaterThan(across.height);
        expect(down.height).toBeGreaterThan(down.width);

        const ring = drawingNode(
            'layout: circle\nCreation -> Fall -> Redemption -> Creation',
        );
        const top = boxOf(ring, 'Creation');
        const others = [boxOf(ring, 'Fall'), boxOf(ring, 'Redemption')];
        // The first at the top, the others below it, no two overlapping.
        for (const box of others) {
            expect(box.y).toBeGreaterThan(top.y);
        }
        const boxes = [top, ...others];
        for (const one of boxes) {
            for (const other of boxes) {
                if (one === other) {
                    continue;
                }
                const isApart =
                    one.x + one.width <= other.x ||
                    other.x + other.width <= one.x ||
                    one.y + one.height <= other.y ||
                    other.y + other.height <= one.y;
                expect(isApart).toBe(true);
            }
        }

        const hub = drawingNode(
            'layout: center\nJesus -> Love\nJesus -> Faith\nJesus -> Hope\nJesus -> Peace',
        );
        const middle = boxOf(hub, 'Jesus');
        const middleX = middle.x + middle.width / 2;
        const middleY = middle.y + middle.height / 2;
        const spokes = ['Love', 'Faith', 'Hope', 'Peace'].map((words) => {
            return boxOf(hub, words);
        });
        // Round it: one above, one right, one below, one left.
        expect(spokes[0].y + spokes[0].height).toBeLessThan(middle.y);
        expect(spokes[1].x).toBeGreaterThan(middleX);
        expect(spokes[2].y).toBeGreaterThan(middleY);
        expect(spokes[3].x + spokes[3].width).toBeLessThan(middleX);
    });

    test('an arrow in another layout leaves one box and ends at the other', () => {
        const across = drawingNode('layout: across\nA -> B');
        const arrow = sceneOf(across).elements.find((element: NodeType) => {
            return element.type === 'arrow';
        });
        const from = boxOf(across, 'A');
        const to = boxOf(across, 'B');
        expect(arrow.x).toBeGreaterThanOrEqual(from.x + from.width);
        expect(arrow.x + arrow.points[1][0]).toBeLessThanOrEqual(to.x);
    });

    test('a layout line that names none is refused, saying which there are', () => {
        expect(readNoteDrawingLines('layout: zigzag\nA -> B').reason).toContain(
            '"across", "circle" or "center"',
        );
        expect(readNoteDrawingLines('Layout = left to right\nA').layout).toBe(
            'across',
        );
    });
});

describe('a drawing coloured', () => {
    test('its boxes filled, its lines coloured, the words readable', () => {
        const node = drawingNode('A -> B', {
            fill: 'darkgreen',
            stroke: 'orange',
        });
        const elements: NodeType[] = sceneOf(node).elements;
        const box = boxOf(node, 'A');
        expect(box.backgroundColor).toBe('darkgreen');
        expect(box.strokeColor).toBe('orange');
        const arrow = elements.find((element) => element.type === 'arrow')!;
        expect(arrow.strokeColor).toBe('orange');
        // White words on a dark fill.
        const label = elements.find((element) => element.text === 'A')!;
        expect(label.strokeColor).toBe('#ffffff');
        expect(checkIsDarkColor('#a5d8ff')).toBe(false);
        expect(checkIsDarkColor('#123')).toBe(true);
        expect(checkIsDarkColor('rgb(250, 240, 200)')).toBe(false);
    });
});

describe('a drawing read back', () => {
    test('as the lines that draw it, its layout first when not down', () => {
        expect(toNoteDrawingText(drawingNode('A -> B, B -> C\nLoose'))).toBe(
            'A -> B\nB -> C\nLoose',
        );
        expect(
            toNoteDrawingText(drawingNode('layout: circle\nA -> B -> A')),
        ).toBe('layout: circle\nA -> B\nB -> A');
        // Drawn again from what it reads, it reads the same.
        const node = drawingNode('God -> Man\nMan -> Sin\nGrace');
        expect(toNoteDrawingText(drawingNode(toNoteDrawingText(node)))).toBe(
            toNoteDrawingText(node),
        );
    });

    test('a drawing with a stroke drawn by hand is not its own lines', () => {
        const node = drawingNode('A -> B');
        const data = sceneOf(node);
        data.elements.push({
            id: 'pen',
            type: 'freedraw',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            isDeleted: false,
        });
        const handNode = { ...node, data: JSON.stringify(data) };
        expect(readNoteDrawingScene(handNode).isOwn).toBe(false);
        // Two boxes, the arrow and the pen stroke.
        expect(toNoteDrawingText(handNode)).toBe('4 shapes: A | B');
    });
});

describe('a drawing changed in the note', () => {
    test('larger and smaller: how large the board draws it', () => {
        const before = drawingNode('Knows -> Leads -> Gives');
        const { result, drawing } = edit(noteWithDrawing(before), [
            { block: 2, size: 'larger' },
        ]);
        expect(drawing.width).toBe(Math.round(before.width * 1.25));
        expect(drawing.height).toBe(
            Math.round(before.height * (drawing.width / before.width)),
        );
        // The drawing itself is untouched, and the paragraph got no size.
        expect(drawing.data).toBe(before.data);
        const block = JSON.parse(result.content).root.children[1];
        expect(block.textStyle).toBe('');
        expect(result.summary).toContain('block 2: drawing made larger');
        const smaller = edit(noteWithDrawing(before), [
            { block: 2, size: 'smaller' },
        ]).drawing;
        expect(smaller.width).toBe(Math.round(before.width / 1.25));
    });

    test('its boxes and lines coloured, words kept', () => {
        const { result, drawing } = edit(noteWithDrawing(), [
            { block: 2, background: 'light green', color: 'navy' },
        ]);
        const box = boxOf(drawing, 'Leads');
        expect(box.backgroundColor).not.toBe('#a5d8ff');
        expect(box.strokeColor).toBe('navy');
        expect(toNoteDrawingText(drawing)).toBe(
            'Knows -> Leads\nLeads -> Gives',
        );
        expect(result.summary).toMatch(/block 2: boxes \S+, lines navy/);
        const block = JSON.parse(result.content).root.children[1];
        // Nothing of the colour on the paragraph's typing style.
        expect(block.textStyle).toBe('');
    });

    test('drawn again from new lines, keeping its colours and its size', () => {
        const coloured = drawingNode('Knows -> Leads -> Gives', {
            fill: 'gold',
        });
        const larger = edit(noteWithDrawing(coloured), [
            { block: 2, size: 'larger' },
        ]).drawing;
        const content = noteWithDrawing(larger);
        const { result, drawing } = edit(content, [
            {
                block: 2,
                text: 'Knows -> Leads -> Gives -> Lives',
            },
        ]);
        expect(toNoteDrawingText(drawing)).toBe(
            'Knows -> Leads\nLeads -> Gives\nGives -> Lives',
        );
        expect(boxOf(drawing, 'Lives').backgroundColor).toBe('gold');
        const natural = drawingNode('Knows -> Leads -> Gives -> Lives');
        expect(drawing.width).toBe(
            Math.round(natural.width * (larger.width / coloured.width)),
        );
        expect(result.summary).toContain(
            'block 2: drawing drawn again from the new lines',
        );
        // Its own lines given back with a colour: coloured, not drawn again.
        const same = edit(content, [
            {
                block: 2,
                text: 'Knows -> Leads\nLeads -> Gives',
                background: 'pink',
            },
        ]);
        expect(same.result.summary).not.toContain('drawn again');
        expect(sceneOf(same.drawing).elements[0].id).toBe(
            sceneOf(larger).elements[0].id,
        );
    });

    test('a layout line lays the same boxes out again', () => {
        const { drawing } = edit(noteWithDrawing(), [
            {
                block: 2,
                text: 'layout: across\nKnows -> Leads -> Gives',
            },
        ]);
        expect(boxOf(drawing, 'Knows').x).toBeLessThan(
            boxOf(drawing, 'Leads').x,
        );
        // And keeps it when drawn again with no layout line.
        const again = edit(noteWithDrawing(drawing), [
            { block: 2, text: 'Knows -> Leads -> Gives -> Lives' },
        ]).drawing;
        expect(boxOf(again, 'Gives').x).toBeLessThan(boxOf(again, 'Lives').x);
    });

    test('centred like any block', () => {
        const { result } = edit(noteWithDrawing(), [
            { block: 2, align: 'center' },
        ]);
        expect(JSON.parse(result.content).root.children[1].format).toBe(
            'center',
        );
    });

    test('what a drawing cannot take is refused, saying what it can', () => {
        for (const change of [
            { block: 2, font: 'Georgia' },
            { block: 2, styles: ['bold'] },
            { block: 2, size: 30 },
            { block: 2, words: 'Leads', color: 'red' },
        ]) {
            const refused = applyNoteEdit({
                content: noteWithDrawing(),
                changes: [change],
            });
            expect('reason' in refused && refused.reason).toContain(
                '`background` (its boxes), `color` (its lines)',
            );
        }
        const kindRefused = applyNoteEdit({
            content: noteWithDrawing(),
            changes: [{ block: 2, kind: 'paragraph' }],
        });
        expect('reason' in kindRefused && kindRefused.reason).toContain(
            'never another kind',
        );
    });

    test('one drawn by hand is never drawn again from lines', () => {
        const node = drawingNode('Knows -> Leads');
        const data = sceneOf(node);
        data.elements.push({
            id: 'pen',
            type: 'freedraw',
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            isDeleted: false,
        });
        const content = noteWithDrawing({
            ...node,
            data: JSON.stringify(data),
        });
        const refused = applyNoteEdit({
            content,
            changes: [{ block: 2, text: 'Knows -> Leads -> Gives' }],
        });
        expect('reason' in refused && refused.reason).toContain(
            'drawn by hand',
        );
        // Coloured and sized it can be, its pen stroke kept.
        const { drawing } = edit(content, [
            { block: 2, background: 'pink', size: 'larger' },
        ]);
        expect(
            sceneOf(drawing).elements.some((element: NodeType) => {
                return element.type === 'freedraw';
            }),
        ).toBe(true);
        expect(drawing.width).toBeGreaterThan(node.width);
    });

    test('a new drawing takes its colours, its size and a layout', () => {
        const content = noteOf(paragraph([text('Main points')]));
        const result = applyNoteEdit({
            content,
            changes: [
                {
                    after: 1,
                    kind: 'drawing',
                    text: 'layout: across\nKnows -> Leads',
                    background: 'yellow',
                    color: 'brown',
                    size: 'larger',
                },
            ],
            ...FIXED,
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const block = JSON.parse(result.content).root.children[1];
        const drawing = block.children[0];
        expect(boxOf(drawing, 'Knows').backgroundColor).toBe('yellow');
        expect(boxOf(drawing, 'Knows').strokeColor).toBe('brown');
        const natural = drawingNode('layout: across\nKnows -> Leads');
        expect(drawing.width).toBe(Math.round(natural.width * 1.25));
        expect(block.textStyle).toBe('');
        expect(result.summary).toContain(
            'after block 1: added drawing, boxes yellow, lines brown, drawing made larger',
        );
        expect(readNoteBlocks(result.content)!.blocks[1].text).toBe(
            'layout: across\nKnows -> Leads',
        );
    });

    test('changed outside a note, a drawing keeps what it is not asked', () => {
        const node = drawingNode('A -> B');
        const changed = changeNoteDrawingNode(node, { size: 'smaller' });
        expect('node' in changed && changed.node.data).toBe(node.data);
    });
});

describe('a verse token in a box', () => {
    test('is its reference in words', () => {
        expect(
            readNoteDrawingLines(
                '[^Psalm 23:1] -> [Psalm 23:2]\n[^(KJV) John 10:11]',
            ).names,
        ).toEqual(['Psalm 23:1', 'Psalm 23:2', 'John 10:11']);
    });
});

// BN-56 (2026-11-09, the elder run): "tick the first question I already
// asked it last week" on a numbered list sent `checked` and changed nothing,
// and the answer said it was already ticked.
describe('a tick asked for on an item that has none', () => {
    test('makes the item a check item, ticked', () => {
        const list = {
            children: [
                {
                    children: [text('What does a shepherd do every day?')],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'listitem',
                    version: 1,
                    value: 1,
                },
                {
                    children: [text('How has God guided you this week?')],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'listitem',
                    version: 1,
                    value: 2,
                },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'list',
            version: 1,
            listType: 'number',
            start: 1,
            tag: 'ol',
            textFormat: 0,
            textStyle: '',
        };
        const result = applyNoteEdit({
            content: noteOf(paragraph([text('Questions')]), list),
            changes: [{ block: 2, checked: true }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(result.isChanged).toBe(true);
        const blocks = readNoteBlocks(result.content)!.blocks;
        expect(blocks[1]).toMatchObject({ kind: 'check', checked: true });
        expect(blocks[2]).toMatchObject({ kind: 'number' });
        expect(result.summary).toContain('ticked');
    });
});
