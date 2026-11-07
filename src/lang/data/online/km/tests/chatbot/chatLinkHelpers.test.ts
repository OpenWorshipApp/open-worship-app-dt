import { describe, expect, it } from 'vitest';

import { toShownLinkText } from '../../../../../../chatbot/chatLinkHelpers';

// EC-297: a Google search for Khmer words was drawn as 300 characters of
// percent-escapes.
describe('toShownLinkText', () => {
    it('draws a search decoded, its + as spaces, and short', () => {
        const url =
            'https://www.google.com/search?q=bible+verse+' +
            encodeURIComponent('ព្រះស្រឡាញ់មនុស្សលោក');
        expect(toShownLinkText(url)).toBe(
            'google.com/search?q=bible verse ព្រះស្រឡាញ់មនុស្សលោក',
        );
    });
});
