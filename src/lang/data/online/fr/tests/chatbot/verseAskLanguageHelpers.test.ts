import { describe, expect, test } from 'vitest';

import { checkIsClosingLine } from '../../../../../../chatbot/verseAskLanguageHelpers';

describe('checkIsClosingLine', () => {
    test('a thank-you in French', () => {
        expect(checkIsClosingLine('Merci beaucoup')).toBe(true);
    });
});
