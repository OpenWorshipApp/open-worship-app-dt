/**
 * A changed block written as the editor writes it
 * (`agentNoteNormalizeHelpers.ts`), on pieces that are not what it expects:
 * a broken node, something that is no list item inside a list, content that
 * is not JSON.
 */
import { describe, expect, test } from 'vitest';

import {
    normalizeNoteNode,
    toNoteCanonicalText,
} from './agentNoteNormalizeHelpers';

type NodeType = Record<string, any>;

function item(words: string): NodeType {
    return {
        type: 'listitem',
        children: [{ type: 'text', text: words, format: 0, style: '' }],
    };
}

describe('a list with pieces that are no items', () => {
    test('only its items are numbered, from its start; the rest is left as it was', () => {
        const stray = { type: 'paragraph', children: [] };
        const list: NodeType = {
            type: 'list',
            listType: 'number',
            start: 3,
            children: [item('a'), null, stray, item('b')],
        };
        normalizeNoteNode(list);
        expect(list.children[0].value).toBe(3);
        expect(list.children[1]).toBeNull();
        expect(list.children[2].value).toBeUndefined();
        expect(list.children[3].value).toBe(4);
        // A number list's items carry no tick.
        expect('checked' in list.children[0]).toBe(false);
    });

    test('a list with no start counts from 1, and its next-words style is its first text', () => {
        const list: NodeType = {
            type: 'list',
            listType: 'check',
            children: [
                {
                    type: 'listitem',
                    children: [
                        { type: 'text', text: 'x', format: 1, style: 'a: b;' },
                    ],
                },
                item('y'),
            ],
        };
        normalizeNoteNode(list);
        expect(
            list.children.map((one: NodeType) => [one.value, one.checked]),
        ).toEqual([
            [1, false],
            [2, false],
        ]);
        expect(list.textFormat).toBe(1);
        expect(list.textStyle).toBe('a: b;');
    });
});

describe('what is not a node at all', () => {
    test('is passed over', () => {
        expect(() => normalizeNoteNode(null as any)).not.toThrow();
        expect(() => normalizeNoteNode('text' as any)).not.toThrow();
    });
});

describe('the canonical reading of a note', () => {
    test('content that is not JSON is compared as it is', () => {
        expect(toNoteCanonicalText('<p>old note</p>')).toBe('<p>old note</p>');
    });
});
