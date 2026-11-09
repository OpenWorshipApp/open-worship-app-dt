import { describe, expect, test } from 'vitest';

import { applyNoteEdit } from '../../../../../../helper/agentNoteBlockHelpers';
import { findWordRanges } from '../../../../../../helper/agentNoteStyleHelpers';

// A Bible note in Turkish, changed by the chatbot (BN-24, 2026-11-08). The
// dotted capital I is two letters in lower case, so words found in the
// lower-case line after one pointed a letter off: "sevgidir" asked in
// capitals coloured "evgidir" and the letter after it.

describe('a word asked in another case, after a dotted capital I', () => {
    const line = 'İsa Mesih sevgidir';

    test('is found where it is', () => {
        const at = line.indexOf('sevgidir');
        expect(findWordRanges(line, 'Sevgidir')).toEqual([
            [at, at + 'sevgidir'.length],
        ]);
    });

    test('is the run that takes the colour', () => {
        const result = applyNoteEdit({
            content: JSON.stringify({
                root: {
                    children: [
                        {
                            children: [
                                {
                                    detail: 0,
                                    format: 0,
                                    mode: 'normal',
                                    style: '',
                                    text: line,
                                    type: 'text',
                                    version: 1,
                                },
                            ],
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
            }),
            changes: [{ block: 1, words: 'Sevgidir', color: 'red' }],
        });
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const runs = JSON.parse(result.content).root.children[0].children;
        expect(
            runs.map((run: Record<string, any>) => {
                return [run.text, run.style];
            }),
        ).toEqual([
            ['İsa Mesih ', ''],
            ['sevgidir', 'color: red;'],
        ]);
    });
});
