import { describe, expect, it } from 'vitest';

import { applyStudyReplace, describeStudyReplace } from './agentStudyFileRules';

// Made-up words of a script written with no spaces, by code point: its
// consonants, and a vowel sign drawn on the letter before it -- a letter
// cluster of two code units that no cut may split.
const cp = (...codePoints: number[]) => {
    return String.fromCodePoint(...codePoints);
};
const [A, B, C] = [0x1000, 0x1001, 0x1002].map((code) => {
    return cp(code);
});
const SIGN = cp(0x102d);
const CLUSTER = `${A}${SIGN}`;

describe('words quoted back to the model, cut at a cluster’s edge (UT-102)', () => {
    it('cuts words past forty characters after the cluster the fortieth is in', () => {
        // The fortieth unit is a vowel sign: the cut waits for its cluster.
        const from = `${C}${CLUSTER.repeat(30)}`;
        expect(from.length).toBeGreaterThan(41);
        expect(describeStudyReplace([{ from, to: '', count: 1 }])).toContain(
            `takes out “${from.slice(0, 41)}…” (1 place)`,
        );
    });

    it('shows a glued place with the clusters round it whole', () => {
        // The letter asked for stands inside a longer run: twelve units each
        // way would cut a cluster on both sides, so each cut moves out to
        // the cluster's edge.
        const before = `${CLUSTER.repeat(8)}${C}`;
        const after = `${C}${CLUSTER.repeat(8)}`;
        const line = `${before}${B}${after}`;
        const at = before.length;
        expect(at % 2).toBe(1);
        const result = applyStudyReplace(`${line}\n`, [{ from: B, to: C }]);
        expect('reason' in result && result.reason).toContain(
            `is there only inside a longer word or letter cluster ` +
                `(“…${line.slice(at - 13, at + 1 + 13)}…”)`,
        );
    });
});
