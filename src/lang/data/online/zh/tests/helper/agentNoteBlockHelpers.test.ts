import { describe, expect, test } from 'vitest';

import { applyNoteEdit } from '../../../../../../helper/agentNoteBlockHelpers';
import { findWordRanges } from '../../../../../../helper/agentNoteStyleHelpers';

// A Bible note in Chinese, changed by the chatbot (BN-24, 2026-11-08).
// Chinese is written with no space between its words: split at the spaces
// and the punctuation, a sentence was one "word".

function noteOf(words: string) {
    return JSON.stringify({
        root: {
            children: [
                {
                    children: [
                        {
                            detail: 0,
                            format: 0,
                            mode: 'normal',
                            style: '',
                            text: words,
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
    });
}

describe('a word of a Chinese note', () => {
    test('is the word, not a character of longer words', () => {
        const line = '神爱世人 我们爱神 爱心';
        const at = line.indexOf('我们爱神') + '我们'.length;
        expect(findWordRanges(line, '爱')).toEqual([[at, at + 1]]);
    });
});

describe('a Chinese paragraph made a heading', () => {
    const paragraph = '神爱世人，甚至将他的独生子赐给他们';

    test('with other words is refused: it would lose its own', () => {
        const result = applyNoteEdit({
            content: noteOf(paragraph),
            changes: [{ block: 1, kind: 'h2', text: '恩典' }],
        });
        expect('reason' in result && result.reason).toContain(
            'would lose its own words',
        );
    });

    test('its kind alone is a change', () => {
        expect(
            'content' in
                applyNoteEdit({
                    content: noteOf(paragraph),
                    changes: [{ block: 1, kind: 'h2' }],
                }),
        ).toBe(true);
    });
});
