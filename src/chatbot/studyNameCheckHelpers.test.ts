import { describe, expect, it } from 'vitest';

import {
    applyStudyReplaceChecked,
    describeStudyReplaceRepair,
    listSavedStudyNameSlips,
    toStudyNameCheckText,
} from './studyNameCheckHelpers';
import {
    applyStudyReplace,
    toStudyReplaceList,
} from '../helper/agentStudyFileRules';

// A made-up language written in one Unicode block whose vowels are signs on
// its letters: its letters, vowel signs and digits made by code point, so no
// word of any language is written here.
function letter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const VOWEL_I = String.fromCodePoint(0x102d);
const VOWEL_II = String.fromCodePoint(0x102e);
const VOWEL_U = String.fromCodePoint(0x102f);

function toScriptDigits(text: string) {
    return text.replace(/\d/g, (digit) => {
        return String.fromCodePoint(0x1040 + Number(digit));
    });
}

// The made-up Bible's words for two places and a people, and a translation's
// slips of them: the vowel signs of one letter written otherwise.
const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
const ZENON_SLIP = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_U}`;
const QALIM = `${letter(3)}${VOWEL_U}${letter(4)}${letter(5)}${VOWEL_I}`;
const PHARISEES = `${letter(9)}${VOWEL_I}${letter(10)}${letter(11)}${VOWEL_I}`;
const PHARISEES_SLIP = `${letter(9)}${VOWEL_II}${letter(10)}${letter(11)}${VOWEL_I}`;
// Words that are no name; the first has no vowel sign at all.
const WORD_A = `${letter(12)}${letter(13)}`;
const WORD_B = `${letter(14)}${VOWEL_U}${letter(15)}${letter(16)}`;
const WORD_C = `${letter(17)}${letter(18)}${VOWEL_I}${letter(19)}`;
const TITLE = `${WORD_B} ${WORD_C}`;

const ENGLISH_HALF = [
    '# The New Birth',
    '',
    '> **John 3:22-23** (KJV)',
    '>',
    '> **22** After these things came Jesus and his disciples into the ' +
        'land of Judea; and the Pharisees saw him.',
    '>',
    '> **23** And John also was baptizing in Zenon near to Qalim, ' +
        'because there was much water there.',
    '',
    '## Places',
    '',
    'They baptized at Zenon near Qalim, and the Pharisees heard of it.',
    '',
    '```mermaid',
    'graph TD',
    '    A["Zenon"] --> B["Qalim"]',
    '```',
].join('\n');

function genQuotedPassage(bible = 'ZB') {
    return [
        `> **${WORD_A} ${toScriptDigits('3:22-23')}** (${bible})`,
        '>',
        `> **${toScriptDigits('22')}** ${WORD_A} ${WORD_B} ${PHARISEES} ${WORD_A}`,
        '>',
        `> **${toScriptDigits('23')}** ${WORD_A} ${ZENON} ${WORD_A} ${QALIM}.`,
    ].join('\n');
}

// A translation under the study, the window's way: a rule, its title, the
// passage quoted from the language's Bible, then its own words.
function genTranslation({
    zenon = ZENON_SLIP,
    pharisees = PHARISEES_SLIP,
    bible = 'ZB',
    title = TITLE,
} = {}) {
    return [
        '---',
        '',
        `# ${title}`,
        '',
        genQuotedPassage(bible),
        '',
        `## ${WORD_C}`,
        '',
        `${WORD_A} ${zenon} ${WORD_B} ${QALIM}, ${WORD_C} ${pharisees}.`,
        '',
        '```mermaid',
        'graph TD',
        `    A["${zenon}"] --> B["${QALIM}"]`,
        '```',
    ].join('\n');
}

function genStudy(...translations: string[]) {
    return [ENGLISH_HALF, '', ...translations].join('\n') + '\n';
}

describe('listSavedStudyNameSlips', () => {
    it('lists each word of a quoted verse the translation writes with another vowel sign, with how often', () => {
        expect(listSavedStudyNameSlips(genStudy(genTranslation()))).toEqual([
            {
                title: TITLE,
                passages: [`${WORD_A} ${toScriptDigits('3:22-23')} (ZB)`],
                slips: [
                    {
                        written: ZENON_SLIP,
                        spelling: ZENON,
                        key: '23',
                        count: 2,
                    },
                    {
                        written: PHARISEES_SLIP,
                        spelling: PHARISEES,
                        key: '22',
                        count: 1,
                    },
                ],
            },
        ]);
    });

    it('says nothing of a translation that writes every word as its verses do', () => {
        expect(
            listSavedStudyNameSlips(
                genStudy(
                    genTranslation({ zenon: ZENON, pharisees: PHARISEES }),
                ),
            ),
        ).toEqual([]);
    });

    it('has nothing to say of a study with no translation under it', () => {
        expect(listSavedStudyNameSlips(`${ENGLISH_HALF}\n`)).toEqual([]);
        expect(listSavedStudyNameSlips('')).toEqual([]);
    });

    it('reads no translation that quotes the English Bible again', () => {
        expect(
            listSavedStudyNameSlips(genStudy(genTranslation({ bible: 'KJV' }))),
        ).toEqual([]);
    });

    it('reads a slip in no quoted passage and no code block of the translation', () => {
        const translation = [
            '---',
            '',
            `# ${TITLE}`,
            '',
            genQuotedPassage(),
            '',
            `${WORD_A} ${ZENON} ${QALIM}.`,
            '',
            '```text',
            `${ZENON_SLIP} ${PHARISEES_SLIP}`,
            '```',
        ].join('\n');
        expect(listSavedStudyNameSlips(genStudy(translation))).toEqual([]);
    });

    it('reads each translation under the study on its own, by its own title', () => {
        const otherTitle = `${WORD_C} ${WORD_B}`;
        const checkList = listSavedStudyNameSlips(
            genStudy(
                genTranslation({ zenon: ZENON, pharisees: PHARISEES }),
                '',
                genTranslation({ title: otherTitle, pharisees: PHARISEES }),
            ),
        );
        expect(
            checkList.map((check) => {
                return [check.title, check.slips.length];
            }),
        ).toEqual([[otherTitle, 1]]);
        expect(checkList[0].slips[0].written).toBe(ZENON_SLIP);
    });

    it('pairs a passage by its verses when the halves quote different counts', () => {
        const englishTwice = ENGLISH_HALF.replace(
            '## Places',
            '> **John 1:1** (KJV)\n>\n> **1** In the beginning was the Word.' +
                '\n\n## Places',
        );
        const checkList = listSavedStudyNameSlips(
            `${englishTwice}\n\n${genTranslation()}\n`,
        );
        expect(checkList).toHaveLength(1);
        expect(
            checkList[0].slips.map((slip) => {
                return slip.written;
            }),
        ).toEqual([ZENON_SLIP, PHARISEES_SLIP]);
    });

    it('reads a file written with Windows line ends the same', () => {
        const study = genStudy(genTranslation());
        expect(listSavedStudyNameSlips(study.replace(/\n/g, '\r\n'))).toEqual(
            listSavedStudyNameSlips(study),
        );
    });
});

describe('toStudyNameCheckText', () => {
    it('is nothing when no translation writes such a word', () => {
        expect(toStudyNameCheckText([], 'JHN.3.Love.md')).toBeNull();
    });

    it('names the file, each translation and its passages, each word with how often and its verse', () => {
        const text =
            toStudyNameCheckText(
                listSavedStudyNameSlips(genStudy(genTranslation())),
                'JHN.3.Love.md',
            ) ?? '';
        expect(text.startsWith('(About the study file "JHN.3.Love.md".')).toBe(
            true,
        );
        expect(text).toContain('letter by letter');
        expect(text).toContain(
            `The translation "${TITLE}", quoting ${WORD_A} ` +
                `${toScriptDigits('3:22-23')} (ZB):`,
        );
        expect(text).toContain(
            `- "${ZENON_SLIP}", written 2 times: verse 23 writes "${ZENON}".`,
        );
        expect(text).toContain(
            `- "${PHARISEES_SLIP}", written once: verse 22 writes ` +
                `"${PHARISEES}".`,
        );
        // What to do with them, and only when asked.
        expect(text).toContain('change the file only when they ask');
        expect(text.endsWith('offering to show them.)')).toBe(true);
    });
});

// EC-541: a model told those words cannot see the vowel sign apart, so its
// `replace` writes the verse's spelling as `from`, turns the pair round, or
// gives a word its own spelling back -- each refused, the file unchanged.
describe('applyStudyReplaceChecked', () => {
    const study = genStudy(genTranslation());
    const RIGHT = { from: ZENON_SLIP, to: ZENON };

    function toWritten(
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

    function toRefusal(text: string, pairs: unknown, section = '') {
        const list = toStudyReplaceList(pairs);
        const result =
            'reason' in list
                ? list
                : applyStudyReplace(text, list.list, section);
        if (!('reason' in result)) {
            throw new Error('The pairs were written.');
        }
        return result;
    }

    it('writes a call that goes through as it is, with nothing put right', () => {
        expect(applyStudyReplaceChecked(study, [RIGHT])).toEqual({
            ...toWritten(study, [RIGHT]),
            repaired: [],
        });
    });

    it.each([
        ["`from` is the verse's spelling", { from: ZENON, to: ZENON }],
        ['the pair is turned round', { from: ZENON, to: ZENON_SLIP }],
        [
            '`from` and `to` are as the file writes it',
            { from: ZENON_SLIP, to: ZENON_SLIP },
        ],
    ])(
        'writes a word the check names as the right call does when %s',
        (_case, pair) => {
            expect(applyStudyReplaceChecked(study, [pair])).toEqual({
                ...toWritten(study, [RIGHT]),
                repaired: [{ pair: 1, asked: pair, written: RIGHT }],
            });
        },
    );

    it('puts right the word, never the words beside it', () => {
        const near = `${WORD_A} ${ZENON}`;
        const written = { from: `${WORD_A} ${ZENON_SLIP}`, to: near };
        const result = applyStudyReplaceChecked(study, [
            { from: near, to: near },
        ]);
        expect(result).toEqual({
            ...toWritten(study, [written]),
            repaired: [{ pair: 1, asked: { from: near, to: near }, written }],
        });
        // The diagram's place has no such word beside it, so it stays.
        expect('text' in result && result.text).toContain(`A["${ZENON_SLIP}"]`);
    });

    it('writes once a pair two pairs come to, naming both', () => {
        const pairs = [
            { from: ZENON, to: ZENON },
            { from: ZENON_SLIP, to: ZENON_SLIP },
        ];
        expect(applyStudyReplaceChecked(study, pairs)).toEqual({
            ...toWritten(study, [RIGHT]),
            repaired: [
                { pair: 1, asked: pairs[0], written: RIGHT },
                { pair: 2, asked: pairs[1], written: RIGHT },
            ],
        });
    });

    it('never changes a pair that goes through alone', () => {
        const pairs = [RIGHT, { from: PHARISEES, to: PHARISEES }];
        const written = { from: PHARISEES_SLIP, to: PHARISEES };
        expect(applyStudyReplaceChecked(study, pairs)).toEqual({
            ...toWritten(study, [RIGHT, written]),
            repaired: [{ pair: 2, asked: pairs[1], written }],
        });
    });

    it('keeps to the part named, and is refused as before where the word is not', () => {
        const pair = { from: ZENON, to: ZENON_SLIP };
        expect(applyStudyReplaceChecked(study, [pair], WORD_C)).toEqual({
            ...toWritten(study, [RIGHT], WORD_C),
            repaired: [{ pair: 1, asked: pair, written: RIGHT }],
        });
        expect(applyStudyReplaceChecked(study, [pair], 'Places')).toEqual(
            toRefusal(study, [pair], 'Places'),
        );
    });

    it('is refused as before for a pair naming no word of the check', () => {
        for (const pairs of [
            [{ from: WORD_C, to: WORD_C }],
            [{ from: `${WORD_C}${WORD_C}`, to: WORD_B }],
            'not a list',
            [],
        ]) {
            expect(applyStudyReplaceChecked(study, pairs)).toEqual(
                toRefusal(study, pairs),
            );
        }
    });

    it('has nothing to put right in a study that writes every word as its verses do', () => {
        const matching = genStudy(
            genTranslation({ zenon: ZENON, pharisees: PHARISEES }),
        );
        const pairs = [{ from: ZENON, to: ZENON }];
        expect(applyStudyReplaceChecked(matching, pairs)).toEqual(
            toRefusal(matching, pairs),
        );
    });

    it('leaves a word two verses spell otherwise as it was asked', () => {
        // A second translation whose Bible writes the place another way.
        const zenonOther = `${letter(0)}${VOWEL_U}${letter(1)}${letter(2)}${VOWEL_U}`;
        const other = genTranslation({ title: `${WORD_C} ${WORD_B}` }).replace(
            `${WORD_A} ${ZENON} ${WORD_A}`,
            `${WORD_A} ${zenonOther} ${WORD_A}`,
        );
        const twice = genStudy(genTranslation(), '', other);
        const pairs = [{ from: ZENON, to: ZENON }];
        expect(applyStudyReplaceChecked(twice, pairs)).toEqual(
            toRefusal(twice, pairs),
        );
        // A word both verses spell alike is still put right.
        const asked = { from: PHARISEES, to: PHARISEES };
        const written = { from: PHARISEES_SLIP, to: PHARISEES };
        expect(applyStudyReplaceChecked(twice, [asked])).toEqual({
            ...toWritten(twice, [written]),
            repaired: [{ pair: 1, asked, written }],
        });
    });
});

describe('describeStudyReplaceRepair', () => {
    const repair = (pair: number) => {
        return {
            pair,
            asked: { from: ZENON, to: ZENON },
            written: { from: ZENON_SLIP, to: ZENON },
        };
    };

    it('says nothing when no pair was put right', () => {
        expect(describeStudyReplaceRepair([])).toBe('');
    });

    it('names the pairs put right, for the model', () => {
        expect(describeStudyReplaceRepair([repair(2)])).toBe(
            'The app put pair 2 right: a word its check of this study ' +
                'found written otherwise than its verse, a vowel sign ' +
                "apart, is written from the file's spelling to the verse's.",
        );
        expect(
            describeStudyReplaceRepair([repair(1), repair(2), repair(3)]),
        ).toContain('The app put pairs 1, 2 and 3 right:');
    });
});
