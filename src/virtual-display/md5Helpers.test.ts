import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { md5Hex } from './md5Helpers';

function nodeMd5(text: string) {
    return createHash('md5').update(text).digest('hex');
}

// A browser screen page names its videos with this hash and the app's own
// screen windows with Node's: one byte apart and a synced video is never
// found.
describe('md5Hex', () => {
    test('the empty string and one letter match the RFC 1321 vectors', () => {
        expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
        expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
        expect(md5Hex('')).toBe(nodeMd5(''));
        expect(md5Hex('a')).toBe(nodeMd5('a'));
    });

    test('plain ASCII matches Node', () => {
        const text = 'The quick brown fox jumps over the lazy dog';
        expect(md5Hex(text)).toBe('9e107d9d372bb6826bd81d3542a419d6');
        expect(md5Hex('14_cv.mp4')).toBe(nodeMd5('14_cv.mp4'));
    });

    // 55 bytes is the most that pads into one block, 56 the first that needs
    // a second; 63/64/65 straddle the block itself.
    test.each([55, 56, 57, 63, 64, 65, 119, 120, 128])(
        'a %i-byte string matches Node',
        (length) => {
            const text = 'x'.repeat(length);
            expect(new TextEncoder().encode(text).length).toBe(length);
            expect(md5Hex(text)).toBe(nodeMd5(text));
        },
    );

    test('Khmer text is hashed as its UTF-8 bytes', () => {
        const text = 'ភ្លេង #1.mp4';
        expect(md5Hex(text)).toBe(nodeMd5(text));
        expect(md5Hex('សេចក្តីស្រឡាញ់')).toBe(nodeMd5('សេចក្តីស្រឡាញ់'));
    });

    test('emoji (astral code points) match Node', () => {
        const text = 'worship 🎵🙏🏽 night.mp4';
        expect(md5Hex(text)).toBe(nodeMd5(text));
    });

    test('a 10 KB string matches Node', () => {
        let text = '';
        for (let index = 0; text.length < 10 * 1024; index++) {
            text += `${index}:ភ${String.fromCharCode(65 + (index % 26))};`;
        }
        expect(md5Hex(text)).toBe(nodeMd5(text));
    });

    test('different text gives a different hash', () => {
        expect(md5Hex('14_cv.mp4')).not.toBe(md5Hex('15_cv.mp4'));
        expect(md5Hex('a')).toMatch(/^[0-9a-f]{32}$/);
    });
});
