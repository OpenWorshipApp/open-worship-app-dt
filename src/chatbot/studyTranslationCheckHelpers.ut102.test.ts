import { describe, expect, it, vi } from 'vitest';

import {
    listSavedStudyTranslationChecks,
    readSavedStudyTranslationChecks,
    toStudyCheckLanguage,
} from './studyTranslationCheckHelpers';
import type { StudyTranslateLanguageType } from './studyTranslateHelpers';

// A made-up language written in one Unicode block, its letters and vowel
// signs made by code point (the fixtures of the module's own test).
function letter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const VOWEL_I = String.fromCodePoint(0x102d);
const VOWEL_U = String.fromCodePoint(0x102f);
const OTHER_LETTER = String.fromCodePoint(0x4e01);

const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
const QALIM = `${letter(3)}${VOWEL_U}${letter(4)}${letter(5)}${VOWEL_I}`;
const WORD_A = `${letter(12)}${letter(13)}`;
const WORD_B = `${letter(14)}${VOWEL_U}${letter(15)}${letter(16)}`;
const WORD_C = `${letter(17)}${letter(18)}${VOWEL_I}${letter(19)}`;
const TITLE = `${WORD_B} ${WORD_C}`;

const ENGLISH_HALF = [
    '# The New Birth',
    '',
    '> **John 3:23** (KJV)',
    '>',
    '> **23** And John also was baptizing in Zenon near to Qalim, ' +
        'because there was much water there.',
    '',
    '## Places',
    '',
    'They baptized at Zenon near Qalim, between the hills and the river.',
    '',
    '```mermaid',
    'graph TD',
    '    A["Living Water"] --> B["Qalim"]',
    '```',
].join('\n');

function genTranslation({
    words = `${WORD_A} ${ZENON} ${WORD_B} ${QALIM}.`,
    label = WORD_C,
    after = '',
} = {}) {
    return [
        '---',
        '',
        `# ${TITLE}`,
        '',
        `> **${WORD_A}** (ZB)`,
        '>',
        `> **23** ${WORD_A} ${ZENON} ${WORD_A} ${QALIM}.`,
        '',
        `## ${WORD_C}`,
        '',
        words,
        '',
        '```mermaid',
        'graph TD',
        `    A["${label}"] --> B["${QALIM}"]`,
        '```',
        ...(after === '' ? [] : ['', after]),
    ].join('\n');
}

function genStudy(translation: string, english = ENGLISH_HALF) {
    return `${english}\n\n${translation}\n`;
}

const SPIRIT = `${letter(30)}${letter(31)}`;
const LIFE = `${letter(32)}${VOWEL_I}${letter(33)}`;
const SERPENT = `${letter(34)}${letter(35)}${VOWEL_U}`;
const SERPENT_OTHER = `${letter(40)}${letter(41)}`;
const SON = `${letter(36)}${letter(37)}`;
const CROSS = `${letter(38)}${letter(39)}${VOWEL_I}`;
const CROSS_OTHER = `${letter(6)}${letter(7)}${letter(8)}`;

const TERMISH: StudyTranslateLanguageType = {
    code: '',
    name: 'Termish',
    nativeName: 'Termo',
    scriptPattern: null,
    terms: {
        'Cross references': CROSS,
        'bronze serpent': SERPENT,
        'Holy Spirit': SPIRIT,
        'eternal life': LIFE,
        'Son of Man': SON,
    },
};
function loadTermish() {
    return Promise.resolve(TERMISH);
}
function readTermish() {
    return 'tt';
}
const MARK_AT_START = /^\p{M}/u;

// A letter and its vowel sign: one cluster of two characters.
const CLUSTER = `${letter(1)}${VOWEL_I}`;

const DOT_BELOW = String.fromCodePoint(0x1037);
const RIVER =
    `${letter(20)}${DOT_BELOW}${letter(21)}` +
    `${letter(22)}${VOWEL_U}${letter(23)}`;
const RIVER_SLIP = `${letter(20)}${VOWEL_I}${letter(22)}${VOWEL_U}${letter(23)}`;
const NAMED_ENGLISH_HALF = [
    '# The New Birth',
    '',
    '> **John 3:23-26** (KJV)',
    '>',
    '> **23** And John also was baptizing in Zenon near to Qalim, ' +
        'because there was much water there.',
    '>',
    '> **26** And they came unto John, and said unto him, he that was ' +
        'with thee beyond Jordan.',
    '',
    '## Places',
    '',
    '* **Zenon**: where John baptized.',
    '* **Jordan**: the river.',
].join('\n');

function genNamedTranslation(lines: string[], isQuoting = true) {
    return [
        '---',
        '',
        `# ${TITLE}`,
        '',
        ...(isQuoting
            ? [
                  `> **${WORD_A}** (ZB)`,
                  '>',
                  `> **23** ${WORD_A} ${ZENON} ${WORD_A} ${QALIM}.`,
                  '>',
                  `> **26** ${WORD_A} ${WORD_B} ${RIVER}.`,
                  '',
              ]
            : [
                  // The English half's own passage, in its own Bible.
                  ...NAMED_ENGLISH_HALF.split('\n').slice(2, 7),
                  '',
              ]),
        `## ${WORD_C}`,
        '',
        ...lines,
        '',
    ].join('\n');
}

function genTermStudy(english: string, lines: string[]) {
    return [english, '', '---', '', `# ${TITLE}`, '', ...lines, ''].join('\n');
}

describe('listSavedStudyTranslationChecks: letters of another script', () => {
    it('reads a letter of another script that ends the words', () => {
        const [check] = listSavedStudyTranslationChecks(
            genStudy(
                // The words run into the diagram's fence: nothing after
                // the letter in its part.
                genTranslation({
                    words: `${WORD_A} ${WORD_B}${OTHER_LETTER}`,
                }).replace(`${OTHER_LETTER}\n\n`, `${OTHER_LETTER}\n`),
            ),
        );
        expect(check.otherScriptWords).toEqual([
            {
                written: OTHER_LETTER,
                count: 1,
                section: WORD_C,
                context: `${WORD_A} ${WORD_B}${OTHER_LETTER}`,
            },
        ]);
    });

    it('cuts the letters round it where a cluster ends, never before a vowel sign', () => {
        const [check] = listSavedStudyTranslationChecks(
            genStudy(
                genTranslation({
                    words:
                        `${CLUSTER.repeat(6)}${letter(2)}${OTHER_LETTER}` +
                        `${letter(2)}${CLUSTER.repeat(6)}`,
                }),
            ),
        );
        const [found] = check.otherScriptWords ?? [];
        expect(found.written).toBe(OTHER_LETTER);
        // Eight characters each way end on a vowel sign: one more is taken.
        expect(found.context).toBe(
            `…${CLUSTER.repeat(4)}${letter(2)}${OTHER_LETTER}` +
                `${letter(2)}${CLUSTER.repeat(4)}…`,
        );
    });
});

describe('listSavedStudyTranslationChecks: English left', () => {
    it('names a diagram label left in English in two diagrams once, with how often', () => {
        const [check] = listSavedStudyTranslationChecks(
            genStudy(
                genTranslation({
                    label: 'Living Water',
                    after: [
                        '```mermaid',
                        'graph TD',
                        `    C["Living Water"] --> D["${QALIM}"]`,
                        '```',
                    ].join('\n'),
                }),
            ),
        );
        expect(check.englishLabels).toEqual([
            { written: 'Living Water', count: 2, section: WORD_C },
        ]);
    });

    it('names a short English word left beside a long stretch of English', () => {
        // Enough of its own words that its own script is the most written.
        const own = `${WORD_A} ${WORD_B} ${QALIM} `.repeat(8);
        const [check] = listSavedStudyTranslationChecks(
            genStudy(
                genTranslation({
                    words:
                        `${own}${WORD_A} and the many waters of the river ` +
                        `beyond the hills ${WORD_B} and ${QALIM}.`,
                }),
            ),
        );
        expect(check.otherScriptWords).toEqual([]);
        // "and" is written twice: once alone, once opening the stretch.
        expect(check.englishWords).toContainEqual({
            written: 'and',
            count: 2,
            section: WORD_C,
        });
    });
});

describe('listSavedStudyTranslationChecks: names written with other letters', () => {
    it('names none when the translation quotes its passage in no Bible of its own to spell them by', () => {
        const [check] = listSavedStudyTranslationChecks(
            `${NAMED_ENGLISH_HALF}\n\n${genNamedTranslation(
                [
                    `* **${ZENON}**: ${WORD_A} and ${WORD_B}.`,
                    `* **${RIVER_SLIP}**: ${WORD_A}${RIVER_SLIP}.`,
                ],
                false,
            )}`,
        );
        expect(check.passages).toEqual([]);
        expect(check.otherLetterNames).toEqual([]);
        expect(check.englishWords).toEqual([
            { written: 'and', count: 1, section: WORD_C },
        ]);
    });

    it('names a name bolded twice with other letters once, with every place it is written', () => {
        const [check] = listSavedStudyTranslationChecks(
            `${NAMED_ENGLISH_HALF}\n* **Jordan**: again.\n\n${genNamedTranslation(
                [
                    `* **${ZENON}**: ${WORD_A} ${WORD_B}.`,
                    `* **${RIVER_SLIP}**: ${WORD_A}${RIVER_SLIP}.`,
                    `* **${RIVER_SLIP}**: ${WORD_B}.`,
                ],
            )}`,
        );
        expect(check.otherLetterNames).toEqual([
            {
                written: RIVER_SLIP,
                count: 3,
                section: WORD_C,
                name: 'Jordan',
                spelling: RIVER,
                key: '26',
            },
        ]);
    });
});

const TERM_ENGLISH_HALF = [
    '# The New Birth',
    '',
    '## Places',
    '',
    'The Holy Spirit gives eternal life.',
    'Moses lifted the bronze serpent.',
    'A bronze serpent on a pole.',
    'The bronze serpent healed.',
    'Look at the bronze serpent.',
].join('\n');

const TERM_LINES = [
    `## ${WORD_C}`,
    '',
    `${SPIRIT} ${LIFE} ${WORD_A}.`,
    `${WORD_B} ${SERPENT_OTHER}.`,
    `${WORD_A} ${SERPENT_OTHER}.`,
    `${WORD_B} ${WORD_A}.`,
    `${QALIM} ${SERPENT_OTHER}.`,
];

describe('readSavedStudyTranslationChecks: lines of a church word it never writes', () => {
    it('shows three lines at most', async () => {
        const [check] = await readSavedStudyTranslationChecks(
            genTermStudy(TERM_ENGLISH_HALF, TERM_LINES),
            loadTermish,
            readTermish,
        );
        expect(check.missingTerms).toEqual([
            {
                english: 'bronze serpent',
                word: SERPENT,
                count: 4,
                section: WORD_C,
                lines: TERM_LINES.slice(3, 6),
            },
        ]);
    });

    it('shows a line once when its English line uses the word twice', async () => {
        const english = [
            '# The New Birth',
            '',
            '## Places',
            '',
            'The Holy Spirit gives eternal life. Moses lifted the bronze ' +
                'serpent, the bronze serpent of old.',
            '',
            '## Cross References',
            '',
            '- Numbers 21:9: the Son of Man lifted up as the bronze serpent was.',
        ].join('\n');
        const lines = [
            `## ${WORD_C}`,
            '',
            `${SPIRIT} ${LIFE} ${WORD_A}. ${WORD_B} ${SERPENT_OTHER}.`,
            '',
            `## ${CROSS}`,
            '',
            `- ${WORD_A} 21:9: ${SON} ${SERPENT_OTHER} ${WORD_B}.`,
        ];
        const [check] = await readSavedStudyTranslationChecks(
            genTermStudy(english, lines),
            loadTermish,
            readTermish,
        );
        expect(check.missingTerms).toEqual([
            {
                english: 'bronze serpent',
                word: SERPENT,
                count: 3,
                section: WORD_C,
                lines: [lines[2], lines[6]],
            },
        ]);
    });

    it('shows no line when its lines cannot be paired with the English half', async () => {
        // A line more than the English half writes.
        const [moreLines] = await readSavedStudyTranslationChecks(
            genTermStudy(TERM_ENGLISH_HALF, [...TERM_LINES, `${QALIM}.`]),
            loadTermish,
            readTermish,
        );
        // A diagram parting its words in two.
        const [moreParts] = await readSavedStudyTranslationChecks(
            genTermStudy(TERM_ENGLISH_HALF, [
                ...TERM_LINES.slice(0, 4),
                '',
                '```mermaid',
                'graph TD',
                `    A["${QALIM}"] --> B["${WORD_A}"]`,
                '```',
                '',
                ...TERM_LINES.slice(4),
            ]),
            loadTermish,
            readTermish,
        );
        for (const check of [moreLines, moreParts]) {
            expect(check.missingTerms).toEqual([
                {
                    english: 'bronze serpent',
                    word: SERPENT,
                    count: 4,
                    section: '',
                },
            ]);
        }
    });

    it('cuts a long line where a cluster ends, wherever the cut falls', async () => {
        const english =
            '# The New Birth\n\n## Places\n\nThe Holy Spirit ' +
            'came, '.repeat(40) +
            'and Moses lifted the bronze serpent and more words after it ' +
            'went on, '.repeat(30);
        // One letter more or less in front moves the cut by one character.
        for (const front of ['', letter(2), `${letter(2)}${letter(3)}`]) {
            const line =
                `${SPIRIT} ${front}${CLUSTER.repeat(150)} ` +
                `${SERPENT_OTHER} ${CLUSTER.repeat(150)}.`;
            const [check] = await readSavedStudyTranslationChecks(
                genTermStudy(english, [`## ${WORD_C}`, '', line]),
                loadTermish,
                readTermish,
            );
            const [piece] = check.missingTerms?.[0]?.lines ?? [''];
            expect(piece.startsWith('…'), front).toBe(true);
            expect(piece.endsWith('…'), front).toBe(true);
            const words = piece.slice(1, -1);
            expect(words).toContain(SERPENT_OTHER);
            expect(MARK_AT_START.test(words), front).toBe(false);
            const at = line.indexOf(words);
            expect(at, front).toBeGreaterThan(0);
            // What follows the piece in the line starts a cluster of its own.
            expect(
                MARK_AT_START.test(line.slice(at + words.length)),
                front,
            ).toBe(false);
            expect(words.length).toBeLessThanOrEqual(162);
        }
    });
});

describe('readSavedStudyTranslationChecks: headings written otherwise', () => {
    it('names two headings written the same way otherwise once, with how often', async () => {
        const english = [
            '# The New Birth',
            '',
            '## Places',
            '',
            'The Holy Spirit gives eternal life. Moses lifted the bronze serpent.',
            '',
            '## Cross References',
            '',
            '- Numbers 21:9: the Son of Man.',
            '',
            '## Cross References',
            '',
            '- John 3:14: the bronze serpent.',
        ].join('\n');
        const [check] = await readSavedStudyTranslationChecks(
            genTermStudy(english, [
                `## ${WORD_C}`,
                '',
                `${SPIRIT} ${LIFE} ${WORD_A}. ${WORD_B} ${SERPENT}.`,
                '',
                `## ${CROSS_OTHER}`,
                '',
                `- ${WORD_A} 21:9: ${SON}.`,
                '',
                `## ${CROSS_OTHER}`,
                '',
                `- ${WORD_B} 3:14: ${SERPENT}.`,
            ]),
            loadTermish,
            readTermish,
        );
        expect(check.termHeadings).toEqual([
            {
                written: CROSS_OTHER,
                count: 2,
                section: CROSS_OTHER,
                english: 'Cross References',
                word: CROSS,
            },
        ]);
        expect(check.missingTerms).toEqual([]);
    });
});

describe('readSavedStudyTranslationChecks: its language read off its words', () => {
    it('reads each translation as the plain check when no language loads for it', async () => {
        const study = genStudy(
            genTranslation({
                words: `${WORD_A} and ${WORD_B}${OTHER_LETTER} ${QALIM}.`,
            }),
        );
        const load = vi.fn(async (_code: string) => {
            return null;
        });
        const checks = await readSavedStudyTranslationChecks(study, load);
        expect(checks).toEqual(listSavedStudyTranslationChecks(study));
        expect(checks[0].englishWords?.length).toBe(1);
        expect(checks[0].otherScriptWords?.length).toBe(1);
    });

    it('reads nothing, and loads no language, for a study with no translation under it', async () => {
        const load = vi.fn(async (_code: string) => {
            return null;
        });
        expect(
            await readSavedStudyTranslationChecks(`${ENGLISH_HALF}\n`, load),
        ).toEqual([]);
        expect(load).not.toHaveBeenCalled();
    });
});

describe('toStudyCheckLanguage', () => {
    it('is no language for a code that names none, whatever words it is handed', () => {
        const file = { words: { 'bronze serpent': SERPENT } };
        expect(toStudyCheckLanguage('qq', file, null)?.terms).toEqual({
            'bronze serpent': SERPENT,
        });
        expect(toStudyCheckLanguage('9', file, null)).toBeNull();
        expect(toStudyCheckLanguage('x'.repeat(61), file, null)).toBeNull();
    });
});
