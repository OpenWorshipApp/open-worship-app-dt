/**
 * A drawing in a note read and changed (`agentNoteDrawingHelpers.ts`) at the
 * edges the other suites leave: words or a box drawn by hand, lines that
 * draw nothing, saved data no board can read, and elements a recolouring
 * must step over.
 */
import { describe, expect, test } from 'vitest';

import {
    changeNoteDrawingNode,
    genNoteDrawingNode,
    readNoteDrawingScene,
} from './agentNoteDrawingHelpers';

type NodeType = Record<string, any>;

const NEEDS_LINES =
    'A drawing needs its boxes in `text`: a line a box, or "A -> B" for an ' +
    'arrow from box A to box B; 40 lines at most.';
const DRAWN_BY_HAND =
    'That drawing was drawn by hand: drawing it again from lines would ' +
    'lose what was drawn. Add a new drawing instead, colour it, or make it ' +
    'larger or smaller.';

function genCounter() {
    let count = 0;
    return () => {
        count++;
        return `id${count}`;
    };
}

function drawingOf(lines: string): NodeType {
    const made = genNoteDrawingNode(lines, {
        now: new Date(2026, 10, 9),
        genId: genCounter(),
        genSeed: () => 7,
    });
    if ('reason' in made) {
        throw new Error(made.reason);
    }
    return made.node;
}

/** The same drawing with its scene's elements as given. */
function withElements(node: NodeType, elements: unknown[]): NodeType {
    const data = JSON.parse(node.data);
    return { ...node, data: JSON.stringify({ ...data, elements }) };
}

function box(id: string, x: number) {
    return {
        id,
        type: 'rectangle',
        x,
        y: 0,
        width: 100,
        height: 40,
        backgroundColor: 'transparent',
        strokeColor: '#1e1e1e',
    };
}

function label(id: string, containerId: string | null, words: string) {
    return {
        id,
        type: 'text',
        x: 0,
        y: 0,
        width: 60,
        height: 20,
        containerId,
        text: words,
    };
}

describe('a drawing read for what draws it again', () => {
    test('words on the board in no box make it drawn by hand, and are no line', () => {
        const node = withElements(drawingOf('Grace'), [
            box('b1', 0),
            label('t1', 'b1', 'Grace'),
            label('t2', null, 'A note in the margin'),
        ]);
        const scene = readNoteDrawingScene(node);
        expect(scene.isOwn).toBe(false);
        expect(scene.lines).toEqual(['Grace']);
    });

    test('a box with no words is passed over, and the drawing is not its own', () => {
        const node = withElements(drawingOf('Grace'), [
            box('b1', 0),
            box('b2', 160),
            label('t2', 'b2', 'Peace'),
        ]);
        const scene = readNoteDrawingScene(node);
        expect(scene.isOwn).toBe(false);
        expect(scene.lines).toEqual(['Peace']);
    });
});

describe('a drawing changed', () => {
    test('one drawn by hand is never drawn again from lines', () => {
        const node = withElements(drawingOf('Grace'), [
            box('b1', 0),
            label('t1', 'b1', 'Grace'),
            label('t2', null, 'A note in the margin'),
        ]);
        expect(changeNoteDrawingNode(node, { text: 'Grace -> Peace' })).toEqual(
            { reason: DRAWN_BY_HAND },
        );
    });

    test('lines that name no box draw nothing', () => {
        expect(
            changeNoteDrawingNode(drawingOf('A -> B'), { text: ' ; ' }),
        ).toEqual({ reason: NEEDS_LINES });
    });

    test('a drawing whose saved data is broken cannot be coloured', () => {
        const node = { ...drawingOf('A -> B'), data: 'not a scene' };
        expect(changeNoteDrawingNode(node, { fill: 'red' })).toEqual({
            reason: 'That drawing could not be read.',
        });
        // Saved data with no element list is no scene either.
        const empty = { ...node, data: JSON.stringify({ type: 'excalidraw' }) };
        expect(changeNoteDrawingNode(empty, { stroke: 'blue' })).toEqual({
            reason: 'That drawing could not be read.',
        });
    });

    test('a recolouring steps over an empty slot and a deleted element', () => {
        const deleted = { ...box('gone', 300), isDeleted: true };
        const node = withElements(drawingOf('Grace'), [
            null,
            deleted,
            box('b1', 0),
            label('t1', 'b1', 'Grace'),
        ]);
        const changed = changeNoteDrawingNode(node, {
            fill: '#ffec99',
            stroke: 'blue',
        });
        if ('reason' in changed) {
            throw new Error(changed.reason);
        }
        const elements = JSON.parse(changed.node.data).elements;
        expect(elements[0]).toBeNull();
        // The deleted one is left exactly as it was.
        expect(elements[1]).toEqual(deleted);
        expect(elements[2]).toMatchObject({
            id: 'b1',
            backgroundColor: '#ffec99',
            strokeColor: 'blue',
        });
        // A light fill keeps the box's words dark; the line colour is the
        // box's, never its words'.
        expect(elements[3].strokeColor).toBe('#1e1e1e');
    });
});
