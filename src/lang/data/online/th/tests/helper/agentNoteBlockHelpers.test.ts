import { describe, expect, test } from 'vitest';

import { findWordRanges } from '../../../../../../helper/agentNoteStyleHelpers';

// A Bible note in Thai, changed by the chatbot (BN-24, 2026-11-08). Thai is
// written with no space between its words, so a word was painted inside
// every longer word holding it.

describe('a word of a Thai note', () => {
    test('is the word, not the start of a longer word', () => {
        const line = 'ความรักของพระเจ้า พระเยซูทรงรักเรา';
        const at = line.indexOf('พระเยซู');
        expect(findWordRanges(line, 'พระ')).toEqual([[at, at + 'พระ'.length]]);
    });
});
