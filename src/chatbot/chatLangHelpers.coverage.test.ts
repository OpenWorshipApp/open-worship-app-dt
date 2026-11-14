import { describe, expect, test } from 'vitest';

import { findYesNoReplies } from './chatLangHelpers';

// A "question" that is only its question marks. (A line whose little words
// cannot settle its language is in that language's package tests.)

describe('the yes and no buttons of a question', () => {
    test('a line that is only question marks or spaces has none', () => {
        expect(findYesNoReplies('??')).toBeNull();
        expect(findYesNoReplies('   ')).toBeNull();
    });
});
