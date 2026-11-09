/**
 * Link block text as the editor stores it (`agentNoteBlockLinkHelpers.ts`):
 * node paths and offsets from words of one block to words of another, and
 * every reason a link cannot be made.
 */
import { describe, expect, test } from 'vitest';

import {
    genNoteBlockLink,
    readNoteBlockLinks,
} from './agentNoteBlockLinkHelpers';

type NodeType = Record<string, any>;

function text(words: string): NodeType {
    return { type: 'text', text: words, format: 0 };
}

function paragraph(children: any[]): NodeType {
    return { type: 'paragraph', children };
}

function genNote() {
    // 0: "Grace " + a link holding "alone"; 1: two lines; 2: an empty line;
    // 3: a list whose item holds a nested list; 4: a broken piece first.
    const linked = paragraph([
        text('Grace '),
        { type: 'link', url: 'https://example.org', children: [text('alone')] },
    ]);
    const lines = paragraph([
        text('line one'),
        { type: 'linebreak', version: 1 },
        text('line two'),
    ]);
    const empty = paragraph([]);
    const listItem = {
        type: 'listitem',
        children: [
            text('top'),
            {
                type: 'list',
                children: [{ type: 'listitem', children: [text('inner')] }],
            },
        ],
    };
    const broken = paragraph([null, text('kept')]);
    const root = {
        type: 'root',
        children: [
            linked,
            lines,
            empty,
            { type: 'list', children: [listItem] },
            broken,
        ],
    };
    return { root, linked, lines, empty, listItem, broken };
}

describe('a link from words to words', () => {
    test('paths and offsets point into the text nodes holding the words', () => {
        const { root, linked, lines } = genNote();
        const made = genNoteBlockLink({
            root,
            fromBlock: linked,
            fromWords: 'alone',
            toBlock: lines,
            toWords: 'two',
            genId: () => 'x1',
        });
        expect(made).toEqual({
            link: {
                from: {
                    anchor: { offset: 0, path: [0, 1, 0] },
                    focus: { offset: 5, path: [0, 1, 0] },
                    blockPaths: [[0]],
                },
                id: 'block-text-link-x1',
                kind: 'direction-to',
                to: {
                    // "line two": "two" starts 5 letters in, past the break.
                    anchor: { offset: 5, path: [1, 2] },
                    focus: { offset: 8, path: [1, 2] },
                    blockPaths: [[1]],
                },
            },
        });
    });

    test("a list item's own words only, and a broken piece passed over", () => {
        const { root, listItem, broken } = genNote();
        const made = genNoteBlockLink({
            root,
            fromBlock: listItem,
            toBlock: broken,
            kind: 'weak-no-direction',
            genId: () => 'x2',
        });
        if (!('link' in made)) {
            throw new Error(made.reason);
        }
        // The whole item: "top", never the nested list's "inner".
        expect(made.link.from).toEqual({
            anchor: { offset: 0, path: [3, 0, 0] },
            focus: { offset: 3, path: [3, 0, 0] },
            blockPaths: [[3]],
        });
        expect(made.link.to).toEqual({
            anchor: { offset: 0, path: [4, 1] },
            focus: { offset: 4, path: [4, 1] },
            blockPaths: [[4]],
        });
        expect(made.link.kind).toBe('weak-no-direction');
    });
});

describe('a link that cannot be made', () => {
    test('an arrow of no kind the editor has', () => {
        const { root, linked, lines } = genNote();
        expect(
            genNoteBlockLink({
                root,
                fromBlock: linked,
                toBlock: lines,
                kind: 'sideways',
            }),
        ).toEqual({
            reason:
                '`linkKind` is one of direction-to, direction-from, ' +
                'no-direction, weak-direction-to, weak-direction-from, ' +
                'weak-no-direction.',
        });
    });

    test('a block to itself', () => {
        const { root, linked } = genNote();
        expect(
            genNoteBlockLink({ root, fromBlock: linked, toBlock: linked }),
        ).toEqual({ reason: 'A block link joins two different blocks.' });
    });

    test('from an empty line, or from a block no longer in the note', () => {
        const { root, empty, lines } = genNote();
        expect(
            genNoteBlockLink({ root, fromBlock: empty, toBlock: lines }),
        ).toEqual({
            reason:
                'The block has no words to link: a link joins words of two ' +
                'blocks -- choose blocks that have words.',
        });
        expect(
            genNoteBlockLink({
                root,
                fromBlock: paragraph([text('gone')]),
                toBlock: lines,
            }),
        ).toEqual({ reason: 'That block is not in the note any more.' });
    });

    test('words the block does not have, at either end', () => {
        const { root, linked, lines, empty } = genNote();
        expect(
            genNoteBlockLink({
                root,
                fromBlock: linked,
                fromWords: 'mercy',
                toBlock: lines,
            }),
        ).toEqual({ reason: 'The block does not have the words "mercy".' });
        expect(
            genNoteBlockLink({
                root,
                fromBlock: linked,
                toBlock: lines,
                toWords: 'three',
            }),
        ).toEqual({
            reason: 'The block linked to does not have the words "three".',
        });
        expect(
            genNoteBlockLink({ root, fromBlock: linked, toBlock: empty }),
        ).toEqual({
            reason:
                'The block linked to has no words to link: a link joins ' +
                'words of two blocks -- choose blocks that have words.',
        });
    });
});

describe("the editor's stored links, read back", () => {
    test('nothing stored, a broken value or not a list is no links', () => {
        expect(readNoteBlockLinks(null)).toEqual([]);
        expect(readNoteBlockLinks('{not json')).toEqual([]);
        expect(readNoteBlockLinks('{"id":"x"}')).toEqual([]);
        expect(readNoteBlockLinks('[{"id":"x"}]')).toEqual([{ id: 'x' }]);
    });
});
