import { describe, expect, it } from 'vitest';

import {
    STUDY_MAX_REPLACES,
    STUDY_REPLACE_MAX_CHARS,
    applyStudyReplace,
    checkIsStudyReplaceWords,
    describeStudyReplace,
    listChangedStudyDiagrams,
    toStudyReplaceList,
} from './agentStudyFileRules';

const FOOTER = '\n---\n\n*Drafted by the app’s assistant Aenon.*\n';

const STUDY = [
    '# The New Birth',
    '',
    '> **John 3:23** (KJV)',
    '>',
    '> **23** And John also was baptizing in Aenon near to Salim.',
    '',
    '## Setting',
    'John baptized in Aenon near Salim. See [the map](https://example.com/Aenon).',
    'More at https://example.com/Salim and [^John 3:23] there.',
    'The Aenonites were few.',
    '',
    '## Diagrams',
    '',
    '```mermaid',
    'graph TD',
    '    A["Aenon"] --> B["Salim"]',
    '```',
    '',
    '```text',
    'Aenon in a code block',
    '```',
    '',
    '---',
    '',
    '## Questions',
    '1. Where is Aenon?',
].join('\n');

const FILE = `${STUDY}\n${FOOTER}`;

function toReplaced(
    text: string,
    pairs: { from: string; to: string }[],
    section = '',
) {
    const result = applyStudyReplace(text, pairs, section);
    if ('reason' in result) {
        throw new Error(result.reason);
    }
    return result;
}

function toRefusal(
    text: string,
    pairs: { from: string; to: string }[],
    section = '',
) {
    const result = applyStudyReplace(text, pairs, section);
    if (!('reason' in result)) {
        throw new Error('expected a refusal');
    }
    return result.reason;
}

describe('toStudyReplaceList', () => {
    it('takes a list of pairs as they are', () => {
        expect(
            toStudyReplaceList([
                { from: 'Aenon', to: 'Enon' },
                { from: 'Salim', to: '' },
            ]),
        ).toEqual({
            list: [
                { from: 'Aenon', to: 'Enon' },
                { from: 'Salim', to: '' },
            ],
        });
    });

    it('refuses what is no list of pairs', () => {
        for (const value of [undefined, 'Aenon', {}, []]) {
            expect(toStudyReplaceList(value)).toEqual({
                reason: expect.stringContaining(
                    'Give `replace` as a list of {"from", "to"}',
                ),
            });
        }
        const many = Array.from({ length: STUDY_MAX_REPLACES + 1 }, (_, i) => {
            return { from: `w${i}`, to: `v${i}` };
        });
        expect(toStudyReplaceList(many)).toEqual({
            reason: expect.stringContaining('21 pairs is more than 20 a call'),
        });
    });

    it('names the pair it refuses, and why', () => {
        const reasonOf = (pair: unknown) => {
            const result = toStudyReplaceList([{ from: 'a', to: 'b' }, pair]);
            return 'reason' in result ? result.reason : '';
        };
        expect(reasonOf({ from: 'x' })).toBe(
            'Pair 2 needs `from` and `to`, both words.',
        );
        expect(reasonOf({ from: '  ', to: 'x' })).toContain(
            "Pair 2's `from` is empty",
        );
        expect(reasonOf({ from: 'one\ntwo', to: 'x' })).toContain(
            'Pair 2 holds a line break',
        );
        expect(reasonOf({ from: 'x', to: 'y\r\nz' })).toContain(
            'holds a line break',
        );
        expect(
            reasonOf({
                from: 'x'.repeat(STUDY_REPLACE_MAX_CHARS + 1),
                to: 'y',
            }),
        ).toContain('longer than 400 characters a side');
        expect(reasonOf({ from: 'same', to: 'same' })).toBe(
            'Pair 2 writes “same” for itself: leave it out.',
        );
        expect(reasonOf({ from: 'a', to: 'c' })).toBe(
            'Pair 2 replaces “a” again, as pair 1 does: give each `from` once.',
        );
    });
});

describe('applyStudyReplace', () => {
    it('writes a whole word anew in the words and the diagrams alone', () => {
        const { text, replaced } = toReplaced(FILE, [
            { from: 'Aenon', to: 'Enon' },
        ]);
        expect(replaced).toEqual([{ from: 'Aenon', to: 'Enon', count: 3 }]);
        expect(text).toContain('John baptized in Enon near Salim.');
        expect(text).toContain('    A["Enon"] --> B["Salim"]');
        expect(text).toContain('1. Where is Enon?');
        // The passage the app quoted, a link's address, a longer word, a
        // code block and the app's own last lines are as they were.
        expect(text).toContain('baptizing in Aenon near to Salim.');
        expect(text).toContain('(https://example.com/Aenon)');
        expect(text).toContain('The Aenonites were few.');
        expect(text).toContain('Aenon in a code block');
        expect(text.endsWith(FOOTER)).toBe(true);
        // Nothing else moved.
        expect(text.replaceAll('Enon', 'Aenon')).toBe(FILE);
    });

    it('leaves a web address and a verse token as they are', () => {
        const { text, replaced } = toReplaced(FILE, [
            { from: 'Salim', to: 'Shalem' },
        ]);
        expect(replaced[0].count).toBe(2);
        expect(text).toContain('https://example.com/Salim and');
        expect(text).toContain('in Aenon near Shalem.');
        expect(text).toContain('B["Shalem"]');
        // A passage's head and a verse token are the app's to write.
        expect(
            toRefusal(FILE, [{ from: 'John 3:23', to: 'John 3:22' }]),
        ).toContain('is there only where a replace leaves the words');
    });

    it('takes the words out with an empty `to`', () => {
        const { text } = toReplaced(FILE, [{ from: ' near Salim', to: '' }]);
        expect(text).toContain('John baptized in Aenon. See');
    });

    it('keeps to the section named', () => {
        const { text, replaced } = toReplaced(
            FILE,
            [{ from: 'Aenon', to: 'Enon' }],
            'questions',
        );
        expect(replaced[0].count).toBe(1);
        expect(text).toContain('1. Where is Enon?');
        expect(text).toContain('John baptized in Aenon near Salim.');
        expect(listChangedStudyDiagrams(FILE, text)).toEqual([]);
    });

    it('names the diagrams it changed', () => {
        const { text } = toReplaced(FILE, [{ from: 'Salim', to: 'Shalem' }]);
        expect(listChangedStudyDiagrams(FILE, text)).toEqual([0]);
    });

    it('makes the pairs in the order given', () => {
        const { text, replaced } = toReplaced(FILE, [
            { from: 'Aenon', to: 'Enon' },
            { from: 'Enon near', to: 'Enon by' },
        ]);
        expect(replaced.map(({ count }) => count)).toEqual([3, 1]);
        expect(text).toContain('John baptized in Enon by Salim.');
    });

    it('writes line ends as LF', () => {
        const { text } = toReplaced(FILE.replace(/\n/g, '\r\n'), [
            { from: 'Aenon', to: 'Enon' },
        ]);
        expect(text).not.toContain('\r');
        expect(text).toBe(
            toReplaced(FILE, [{ from: 'Aenon', to: 'Enon' }]).text,
        );
    });
});

describe('applyStudyReplace refusals', () => {
    it('says the file does not have the words', () => {
        const reason = toRefusal(FILE, [{ from: 'Bethany', to: 'Bethel' }]);
        expect(reason).toBe(
            'Pair 1: “Bethany” is not in the file: copy each `from` letter ' +
                'for letter from a `read` of it (`file` and `section`). ' +
                'Nothing is changed: draft again with every `from` as the ' +
                'file writes it, or without the pairs it cannot find.',
        );
    });

    it('shows how the file writes words given in another case or spacing', () => {
        expect(toRefusal(FILE, [{ from: 'aenon', to: 'Enon' }])).toContain(
            '“aenon” is not in the file, which writes “Aenon”: copy `from` ' +
                'letter for letter as the file writes it.',
        );
        expect(toRefusal(FILE, [{ from: 'Salim  ', to: 'x' }])).toContain(
            'which writes “Salim”',
        );
    });

    it('refuses a piece of a longer word', () => {
        expect(toRefusal(FILE, [{ from: 'Aenonite', to: 'x' }])).toContain(
            '“Aenonite” is there only inside a longer word or letter ' +
                'cluster (“The Aenonites were few.”): give the whole word ' +
                'as `from`.',
        );
    });

    it('says where a replace leaves the words', () => {
        for (const from of ['baptizing', 'code block', 'example.com']) {
            expect(toRefusal(FILE, [{ from, to: 'x' }])).toContain(
                'is there only where a replace leaves the words as they are',
            );
        }
        expect(toRefusal(FILE, [{ from: 'assistant', to: 'x' }])).toContain(
            "“assistant” is only in the app's own last lines",
        );
    });

    it('says the words are in another part than the one named', () => {
        expect(
            toRefusal(FILE, [{ from: 'Salim', to: 'x' }], 'Questions'),
        ).toContain(
            '“Salim” is not in “Questions”, though the file has it ' +
                'elsewhere: leave `section` out, or name the part holding it.',
        );
        expect(
            toRefusal(FILE, [{ from: 'Salim', to: 'x' }], 'Nowhere'),
        ).toContain('The file has no section “Nowhere”.');
    });

    it('says when the pairs before it took the words away', () => {
        expect(
            toRefusal(FILE, [
                { from: 'Salim', to: 'Shalem' },
                { from: 'near Salim', to: 'by Salim' },
            ]),
        ).toContain(
            'Pair 2: the pairs before it leave no “near Salim” to replace',
        );
    });

    it('changes nothing when any pair fails, and names five', () => {
        const pairs = [
            { from: 'Aenon', to: 'Enon' },
            ...['one', 'two', 'three', 'four', 'five', 'six', 'seven'].map(
                (word) => {
                    return { from: `no ${word}`, to: word };
                },
            ),
        ];
        const reason = toRefusal(FILE, pairs);
        expect(reason).toContain('Pair 2: “no one”');
        expect(reason).toContain('Pair 6: “no five”');
        expect(reason).not.toContain('Pair 7');
        expect(reason).toContain(' And 2 more. Nothing is changed');
    });
});

describe('a script written with no spaces', () => {
    const cp = (...codePoints: number[]) => {
        return String.fromCodePoint(...codePoints);
    };
    // Made-up words of such a script: consonants, a vowel sign drawn on
    // the one before it, and the sign setting the next under the one before.
    const [A, B, C, D] = [0x1000, 0x1001, 0x1002, 0x1003].map((code) => {
        return cp(code);
    });
    const SIGN = cp(0x102d);
    const STACKER = cp(0x1039);

    it('finds a word glued to the words beside it', () => {
        const text = `# ${A}${D}\n\n${A}${B}${C}${D} ${B}${C}\n`;
        const { text: written, replaced } = toReplaced(text, [
            { from: `${B}${C}`, to: `${D}${D}` },
        ]);
        expect(replaced[0].count).toBe(2);
        expect(written).toBe(`# ${A}${D}\n\n${A}${D}${D}${D} ${D}${D}\n`);
    });

    it('never splits a letter cluster', () => {
        const signed = `${A}${B}${SIGN}${C}\n`;
        expect(toRefusal(signed, [{ from: `${A}${B}`, to: 'x' }])).toContain(
            'is there only inside a longer word or letter cluster',
        );
        const stacked = `${A}${STACKER}${B}${C}\n`;
        expect(toRefusal(stacked, [{ from: `${B}${C}`, to: 'x' }])).toContain(
            'is there only inside a longer word or letter cluster',
        );
        // Whole clusters are a word.
        expect(
            toReplaced(signed, [{ from: `${B}${SIGN}${C}`, to: D }]).text,
        ).toBe(`${A}${D}\n`);
    });

    it('wants two letters of its own to be glued', () => {
        expect(toRefusal(`${A}${B}${C}\n`, [{ from: B, to: D }])).toContain(
            'only inside a longer word',
        );
        expect(toReplaced(`${A} ${B} ${C}\n`, [{ from: B, to: D }]).text).toBe(
            `${A} ${D} ${C}\n`,
        );
    });

    it('never glues to letters of a script written with spaces', () => {
        expect(
            toRefusal(`Q${A}${B} x\n`, [{ from: `${A}${B}`, to: 'x' }]),
        ).toContain('only inside a longer word');
    });

    // EC-559: a letter of ANOTHER such script slipped between two of its
    // words is a word of its own, one letter or more.
    it('takes one letter of another script written with no spaces glued between its words', () => {
        const OTHER = cp(0x4e01);
        const text = `${A}${B}${OTHER}${C}${D}\n`;
        expect(checkIsStudyReplaceWords(text, 2, 3)).toBe(true);
        expect(toReplaced(text, [{ from: OTHER, to: B }])).toEqual({
            text: `${A}${B}${B}${C}${D}\n`,
            replaced: [{ from: OTHER, to: B, count: 1 }],
        });
        // One of its own letters alone is still a piece of its words.
        expect(checkIsStudyReplaceWords(text, 1, 2)).toBe(false);
        expect(toRefusal(text, [{ from: B, to: D }])).toContain(
            'only inside a longer word',
        );
    });

    // EC-541: the same edges, asked of some words wherever they stand.
    it('says which words a replace could write over', () => {
        const signed = `${A}${B}${SIGN}${C}${D}`;
        // Two glued letters, whole clusters: a word.
        expect(checkIsStudyReplaceWords(signed, 1, 4)).toBe(true);
        // A cluster split, or one letter alone glued.
        expect(checkIsStudyReplaceWords(signed, 0, 2)).toBe(false);
        expect(checkIsStudyReplaceWords(`${A}${B}${C}`, 1, 2)).toBe(false);
        // Glued to a script written with spaces.
        expect(checkIsStudyReplaceWords(`Q${A}${B} x`, 1, 3)).toBe(false);
    });
});

describe('checkIsStudyReplaceWords', () => {
    it('takes whole words of a script written with spaces, never a piece of one', () => {
        const text = 'John baptized in Aenon near Salim.';
        const at = text.indexOf('Aenon');
        expect(checkIsStudyReplaceWords(text, at, at + 5)).toBe(true);
        expect(checkIsStudyReplaceWords(text, at, at + 10)).toBe(true);
        expect(checkIsStudyReplaceWords(text, at, at + 3)).toBe(false);
        expect(checkIsStudyReplaceWords(text, at + 1, at + 5)).toBe(false);
    });
});

describe('describeStudyReplace', () => {
    it('says what each pair writes and how often, for the model', () => {
        expect(
            describeStudyReplace([
                { from: 'Aenon', to: 'Enon', count: 3 },
                { from: ' near Salim', to: '', count: 1 },
            ]),
        ).toBe(
            'It writes “Enon” for “Aenon” (3 places); takes out ' +
                '“ near Salim” (1 place); nothing else changes.',
        );
        const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((from) => {
            return { from, to: `${from}${from}`, count: 1 };
        });
        expect(describeStudyReplace(many)).toContain(
            '“ee” for “e” (1 place); and 2 more; nothing else changes.',
        );
    });
});
