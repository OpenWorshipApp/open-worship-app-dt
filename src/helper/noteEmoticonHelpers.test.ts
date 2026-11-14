import { describe, expect, test } from 'vitest';

import { toEmoticonSafeText } from './noteEmoticonHelpers';

// BN-240 (2026-11-13, ab80, both readers): Luke 2:4 printed as
// "lineage of David🙂" -- the note editor's EmojisPlugin turns `:)` into a
// smiley in every plain text node.
describe('Bible words the note editor would turn into a smiley', () => {
    test("a word joiner parts each of the editor's four emoticons", () => {
        const safe = toEmoticonSafeText(
            '(because he was of the house and lineage of David:)',
        );
        expect(safe).toBe(
            '(because he was of the house and lineage of David:\u2060)',
        );
        expect(safe).not.toContain(':)');
        expect(toEmoticonSafeText('a:D b:( c<3')).toBe(
            'a:\u2060D b:\u2060( c<\u20603',
        );
    });

    test('everything else is left as it was', () => {
        for (const text of [
            'Fear not: for, behold, I bring you good tidings',
            'he said: Do this',
            'x<4 :3 <)',
            '',
        ]) {
            expect(toEmoticonSafeText(text)).toBe(text);
        }
    });
});
