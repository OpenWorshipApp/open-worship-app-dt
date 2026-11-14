import { describe, expect, test } from 'vitest';

import { applyNoteEdit } from '../../../../../../helper/agentNoteBlockHelpers';
import { findWordRanges } from '../../../../../../helper/agentNoteStyleHelpers';

// A Bible note in Khmer, changed by the chatbot (BN-24, 2026-11-08). Khmer
// is written with no space between its words: split at the spaces, a line
// was one or two "words", so a word was painted inside every longer word
// holding it, a piece of a cluster could be cut off its letter, and a
// heading could take a paragraph's place unrefused.

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

function noteOf(words: string) {
    return JSON.stringify({
        root: {
            children: [
                {
                    children: [text(words)],
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'paragraph',
                    version: 1,
                    textFormat: 0,
                    textStyle: '',
                },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
        },
    });
}

describe('a word of a Khmer note', () => {
    test('is the word, not the start of a longer word', () => {
        const line = 'ព្រះជាម្ចាស់ស្រឡាញ់មនុស្សលោក សេចក្ដីស្រឡាញ់របស់ព្រះ';
        const at = line.lastIndexOf('ព្រះ');
        expect(findWordRanges(line, 'ព្រះ')).toEqual([
            [at, at + 'ព្រះ'.length],
        ]);
    });

    test('a word given without its last mark takes the mark with it', () => {
        const line = 'យើងស្រឡាញ់គ្នា';
        const at = line.indexOf('ស្រឡាញ់');
        expect(findWordRanges(line, 'ស្រឡាញ')).toEqual([
            [at, at + 'ស្រឡាញ់'.length],
        ]);
        const result = applyNoteEdit({
            content: noteOf(line),
            changes: [{ block: 1, words: 'ស្រឡាញ', color: 'red' }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const runs = JSON.parse(result.content).root.children[0].children;
        expect(
            runs.map((run: NodeType) => {
                return [run.text, run.style];
            }),
        ).toEqual([
            ['យើង', ''],
            ['ស្រឡាញ់', 'color: red;'],
            ['គ្នា', ''],
        ]);
    });

    test('a subscript sign keeps the letter set under it', () => {
        expect(findWordRanges('យើងស្រឡាញ់', 'យើងស្')).toEqual([
            [0, 'យើងស្រ'.length],
        ]);
    });
});

describe('a Khmer paragraph made a heading', () => {
    const paragraph =
        'ព្រះជាម្ចាស់ស្រឡាញ់មនុស្សលោក សេចក្ដីស្រឡាញ់របស់ព្រះ ' +
        'យើងអធិស្ឋានរាល់ថ្ងៃ';

    test('with other words is refused: it would lose its own', () => {
        const result = applyNoteEdit({
            content: noteOf(paragraph),
            changes: [{ block: 1, kind: 'h2', text: 'ព្រះគុណ' }],
        });
        expect('reason' in result && result.reason).toContain(
            'would lose its own words',
        );
    });

    test('with its own words, or its kind alone, is a change', () => {
        for (const change of [
            { block: 1, kind: 'h2' },
            { block: 1, kind: 'bullet', text: paragraph },
        ]) {
            expect(
                'content' in
                    applyNoteEdit({
                        content: noteOf(paragraph),
                        changes: [change],
                    }),
            ).toBe(true);
        }
    });
});
