/**
 * A drawing from words (`agentNoteDrawingHelpers.ts`): its refusals, a box
 * that points at itself, and a drawing whose saved data is broken.
 */
import { describe, expect, test } from 'vitest';

import {
    genNoteDrawingNode,
    readNoteDrawingLines,
    toNoteDrawingText,
} from './agentNoteDrawingHelpers';

const NEEDS_LINES =
    'A drawing needs its boxes in `text`: a line a box, or "A -> B" for an ' +
    'arrow from box A to box B; 40 lines at most.';

function genCounter() {
    let count = 0;
    return () => {
        count++;
        return `id${count}`;
    };
}

describe('what a drawing may be', () => {
    test('no lines, or more than 40, is no drawing', () => {
        expect(readNoteDrawingLines(' ;\n - \n')).toEqual({
            reason: NEEDS_LINES,
        });
        const tooMany = Array.from({ length: 41 }, (_, index) => {
            return `box ${index}`;
        }).join('\n');
        expect(genNoteDrawingNode(tooMany)).toEqual({ reason: NEEDS_LINES });
        expect(genNoteDrawingNode('')).toEqual({ reason: NEEDS_LINES });
    });

    test('more than 30 boxes is too many, in 40 lines or fewer', () => {
        const boxes = Array.from({ length: 31 }, (_, index) => {
            return `box ${index}`;
        }).join('\n');
        expect(genNoteDrawingNode(boxes)).toEqual({
            reason: 'A drawing is 30 boxes at most.',
        });
        // 30 boxes is a drawing.
        const thirty = boxes.split('\n').slice(0, 30).join('\n');
        expect('node' in genNoteDrawingNode(thirty)).toBe(true);
    });
});

describe('a box that points at itself', () => {
    test('is a box with no arrow', () => {
        const result = genNoteDrawingNode('Grace -> Grace\nPeace', {
            now: new Date(2026, 10, 8),
            genId: genCounter(),
            genSeed: () => 7,
        });
        if (!('node' in result)) {
            throw new Error(result.reason);
        }
        const data = JSON.parse(result.node.data);
        expect(data.elements.map((element: any) => element.type)).toEqual([
            'rectangle',
            'text',
            'rectangle',
            'text',
        ]);
        // No box is bound to an arrow.
        for (const element of data.elements) {
            if (element.type === 'rectangle') {
                expect(element.boundElements).toEqual([
                    { type: 'text', id: expect.any(String) },
                ]);
            }
        }
        expect(toNoteDrawingText(result.node)).toBe('2 shapes: Grace | Peace');
    });
});

describe('a drawing read back', () => {
    test('saved data that is not JSON reads as nothing', () => {
        expect(toNoteDrawingText({ type: 'excalidraw', data: '{broken' })).toBe(
            '',
        );
        expect(toNoteDrawingText({ type: 'excalidraw' })).toBe('');
    });
});
