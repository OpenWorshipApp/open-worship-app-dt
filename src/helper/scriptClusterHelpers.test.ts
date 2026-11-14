import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    checkEndsWithInvisibleStacker,
    checkIsClusterEdge,
    trimTrailingInvisibleStackers,
} from './scriptClusterHelpers';

const cp = (...codePoints: number[]) => {
    return String.fromCodePoint(...codePoints);
};

// Letters of a script written with no spaces, made up into words no
// language has: three consonants, a vowel sign drawn on the one before it,
// and the sign that sets the next consonant under the one before.
const FIRST = cp(0x1000);
const SECOND = cp(0x1001);
const THIRD = cp(0x1002);
const VOWEL_SIGN = cp(0x102d);
const STACKER = cp(0x1039);
// A combining acute accent, and two people joined into one picture.
const ACUTE = cp(0x301);
const SMILE = cp(0x1f600);
const FAMILY = cp(0x1f468, 0x200d, 0x1f469);

describe('checkIsClusterEdge', () => {
    it('is an edge at both ends of the text and round a line break', () => {
        expect(checkIsClusterEdge('ab', 0)).toBe(true);
        expect(checkIsClusterEdge('ab', 2)).toBe(true);
        expect(checkIsClusterEdge('ab\ncd', 2)).toBe(true);
        expect(checkIsClusterEdge('ab\ncd', 3)).toBe(true);
    });

    it('is an edge between two plain letters', () => {
        expect(checkIsClusterEdge('ab', 1)).toBe(true);
        expect(checkIsClusterEdge('a b', 2)).toBe(true);
    });

    it('keeps a letter with the mark drawn on it', () => {
        const text = `cafe${ACUTE} menu`;
        expect(checkIsClusterEdge(text, 4)).toBe(false);
        expect(checkIsClusterEdge(text, 5)).toBe(true);
        expect(checkIsClusterEdge(text, 3)).toBe(true);
    });

    it('keeps a consonant with its vowel sign, and edges the next', () => {
        const text = `${FIRST}${VOWEL_SIGN}${SECOND}`;
        expect(checkIsClusterEdge(text, 1)).toBe(false);
        expect(checkIsClusterEdge(text, 2)).toBe(true);
    });

    it('keeps a consonant set under the one before it in one cluster', () => {
        const text = `${FIRST}${STACKER}${SECOND}${THIRD}`;
        expect(checkIsClusterEdge(text, 1)).toBe(false);
        expect(checkIsClusterEdge(text, 2)).toBe(false);
        expect(checkIsClusterEdge(text, 3)).toBe(true);
    });

    it('never cuts a surrogate pair or a joined picture', () => {
        const text = `a${SMILE}b`;
        expect(checkIsClusterEdge(text, 1)).toBe(true);
        expect(checkIsClusterEdge(text, 2)).toBe(false);
        expect(checkIsClusterEdge(text, 3)).toBe(true);
        const joined = `x${FAMILY}y`;
        // After the joiner: inside the one picture.
        expect(checkIsClusterEdge(joined, 4)).toBe(false);
        expect(checkIsClusterEdge(joined, 1 + FAMILY.length)).toBe(true);
    });

    it('segments the line holding the place, whatever is before it', () => {
        const text = `${'a'.repeat(50)}\n${FIRST}${VOWEL_SIGN}`;
        expect(checkIsClusterEdge(text, 52)).toBe(false);
        expect(checkIsClusterEdge(text, 51)).toBe(true);
    });
});

describe('checkIsClusterEdge with no segmenter', () => {
    const segmenter = Intl.Segmenter;

    afterEach(() => {
        (Intl as any).Segmenter = segmenter;
        vi.resetModules();
    });

    it('is an edge anywhere but before a mark, inside a pair or after a stacker', async () => {
        (Intl as any).Segmenter = undefined;
        vi.resetModules();
        const helpers = await import('./scriptClusterHelpers');
        expect(helpers.checkIsClusterEdge(`cafe${ACUTE}`, 4)).toBe(false);
        expect(helpers.checkIsClusterEdge(`cafe${ACUTE} x`, 5)).toBe(true);
        expect(helpers.checkIsClusterEdge(`a${SMILE}b`, 2)).toBe(false);
        expect(helpers.checkIsClusterEdge(`a${SMILE}b`, 3)).toBe(true);
        expect(
            helpers.checkIsClusterEdge(`${FIRST}${STACKER}${SECOND}`, 2),
        ).toBe(false);
        expect(helpers.checkIsClusterEdge('ab', 1)).toBe(true);
    });
});

describe('the invisible stackers', () => {
    it('reads a stacker at the end, and takes it off', () => {
        expect(checkEndsWithInvisibleStacker(`${FIRST}${STACKER}`)).toBe(true);
        expect(checkEndsWithInvisibleStacker(`${FIRST}${VOWEL_SIGN}`)).toBe(
            false,
        );
        expect(trimTrailingInvisibleStackers(`${FIRST}${STACKER}`)).toBe(FIRST);
    });
});
