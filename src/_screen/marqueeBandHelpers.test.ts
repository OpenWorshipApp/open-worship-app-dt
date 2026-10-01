import { describe, expect, it } from 'vitest';

import { genMarqueeFontSize, getMarqueeBandHeight } from './marqueeBandHelpers';

describe('marquee band', () => {
    it('scales the font with the screen height', () => {
        expect(genMarqueeFontSize(768)).toBe(75);
        expect(genMarqueeFontSize(1536)).toBe(150);
    });

    it('is taller than the text it holds, so a verse header clears it', () => {
        const band = getMarqueeBandHeight({ text: 'x' }, 1440);
        expect(band).toBeGreaterThan(genMarqueeFontSize(1440) * 1.2);
    });

    it("follows the operator's own px font size", () => {
        expect(
            getMarqueeBandHeight(
                { text: 'x', extraStyle: { fontSize: '40px' } },
                1440,
            ),
        ).toBe(Math.ceil(40 * 1.25) + 10);
        // A relative size cannot be turned into pixels here: the default wins.
        expect(
            getMarqueeBandHeight(
                { text: 'x', extraStyle: { fontSize: '2em' } },
                1440,
            ),
        ).toBe(getMarqueeBandHeight({ text: 'x' }, 1440));
    });
});
