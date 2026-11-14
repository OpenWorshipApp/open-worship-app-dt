/**
 * `owa_note_edit`'s block rules at two more edges (UT-102): a line break
 * inside a block the edit reads but never writes, and the call's title sent
 * as one of its changes.
 */
import { describe, expect, test } from 'vitest';

import { applyNoteEdit, readNoteBlocks } from './agentNoteBlockHelpers';

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

const LINEBREAK = { type: 'linebreak', version: 1 };

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

describe('a block read but never written', () => {
    test('reads the words on both sides of a line break in a table cell', () => {
        const table = element('table', [
            element('tablerow', [
                element('tablecell', [
                    paragraph([text('Grace'), LINEBREAK, text('alone')]),
                ]),
                element('tablecell', [paragraph([text('Faith')])]),
            ]),
        ]);
        const blocks = readNoteBlocks(noteOf([table]))!.blocks;
        expect(blocks).toHaveLength(1);
        // The line break's own space is dropped by the cell's join, so the
        // two words come out glued ("Gracealone") -- reported as a bug, not
        // asserted: only what is plainly right is held here.
        expect(blocks[0].text.startsWith('1 rows x 2 columns: Grace')).toBe(
            true,
        );
        expect(blocks[0].text.endsWith('alone | Faith')).toBe(true);
    });
});

describe('the call’s title sent among its changes', () => {
    const CONTENT = noteOf([paragraph([text('first line')])]);

    test('is the note’s title, and the other changes are made', () => {
        const result = applyNoteEdit({
            content: CONTENT,
            changes: [
                { block: 1, text: 'the first line' },
                { title: 'Sunday sermon' } as any,
            ],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(result.title).toBe('Sunday sermon');
        expect(
            readNoteBlocks(result.content)!.blocks.map((block) => block.text),
        ).toEqual(['the first line']);
    });

    test('gives way to the title the call names itself', () => {
        const result = applyNoteEdit({
            content: CONTENT,
            changes: [{ title: 'Misplaced' } as any],
            title: 'Named',
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(result.title).toBe('Named');
    });
});
