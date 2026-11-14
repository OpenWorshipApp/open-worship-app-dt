import { describe, expect, it, vi } from 'vitest';

import { applyStudyReplace } from '../helper/agentStudyFileRules';
import {
    toStudyNameCheckText,
    toStudyTranslationLeftText,
} from './studyNameCheckHelpers';
import {
    listSavedStudyTranslationChecks,
    readSavedStudyTranslationChecks,
    toStudyCheckLanguage,
    toStudyTranslationLeftNote,
} from './studyTranslationCheckHelpers';
import type { StudyTranslateLanguageType } from './studyTranslateHelpers';

// A made-up language written in one Unicode block with no spaces needed
// between its words, its letters and vowel signs made by code point, so no
// word of any language is written here; and letters of two other scripts.
function letter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const VOWEL_I = String.fromCodePoint(0x102d);
const VOWEL_II = String.fromCodePoint(0x102e);
const VOWEL_U = String.fromCodePoint(0x102f);
const OTHER_LETTER = String.fromCodePoint(0x4e01);
const OTHER_WORD = [0x0e01, 0x0e02, 0x0e04]
    .map((code) => {
        return String.fromCodePoint(code);
    })
    .join('');

const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
const ZENON_SLIP = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_U}`;
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

// A translation under the study, the window's way: a rule, its title, the
// passage quoted from the language's Bible, then its own words.
function genTranslation({
    words = `${WORD_A} ${ZENON} ${WORD_B} ${QALIM}.`,
    label = WORD_C,
    bible = 'ZB',
} = {}) {
    return [
        '---',
        '',
        `# ${TITLE}`,
        '',
        `> **${WORD_A}** (${bible})`,
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
    ].join('\n');
}

function genStudy(translation: string) {
    return `${ENGLISH_HALF}\n\n${translation}\n`;
}

describe('listSavedStudyTranslationChecks', () => {
    it('says nothing of a translation written all in its own letters', () => {
        expect(
            listSavedStudyTranslationChecks(genStudy(genTranslation())),
        ).toEqual([]);
        expect(listSavedStudyTranslationChecks(`${ENGLISH_HALF}\n`)).toEqual(
            [],
        );
        expect(listSavedStudyTranslationChecks('')).toEqual([]);
    });

    it('lists a letter of another script glued into a word as a word of its own, with its part and the letters round it', () => {
        const study = genStudy(
            genTranslation({
                words: `${WORD_A}${OTHER_LETTER}${WORD_B} ${QALIM}.`,
            }),
        );
        const [check] = listSavedStudyTranslationChecks(study);
        expect(check.title).toBe(TITLE);
        expect(check.slips).toEqual([]);
        expect(check.otherScriptWords).toEqual([
            {
                written: OTHER_LETTER,
                count: 1,
                section: WORD_C,
                // Eight characters past it, cut where a cluster ends.
                context:
                    `${WORD_A}${OTHER_LETTER}${WORD_B} ` +
                    `${letter(3)}${VOWEL_U}${letter(4)}…`,
            },
        ]);
        // A replace takes it as it is listed.
        const written = applyStudyReplace(
            study,
            [{ from: OTHER_LETTER, to: WORD_C }],
            TITLE,
        );
        expect(written).toEqual({
            text: study.replace(OTHER_LETTER, WORD_C),
            replaced: [{ from: OTHER_LETTER, to: WORD_C, count: 1 }],
        });
    });

    it('lists a word of a third script between two of its own, once with how often', () => {
        const study = genStudy(
            genTranslation({
                words:
                    `${WORD_A}${OTHER_WORD}${WORD_B}, ` +
                    `${QALIM} ${OTHER_WORD}${WORD_A}.`,
            }),
        );
        const [check] = listSavedStudyTranslationChecks(study);
        expect(
            check.otherScriptWords?.map(({ written, count }) => {
                return [written, count];
            }),
        ).toEqual([[OTHER_WORD, 2]]);
    });

    it("lists English words left between its own and its diagrams' labels left in English", () => {
        const study = genStudy(
            genTranslation({
                words: `${WORD_A} and ${WORD_B} between ${QALIM}.`,
                label: 'Living Water',
            }),
        );
        const [check] = listSavedStudyTranslationChecks(study);
        expect(check.englishWords).toEqual([
            { written: 'and', count: 1, section: WORD_C },
            { written: 'between', count: 1, section: WORD_C },
        ]);
        expect(check.englishLabels).toEqual([
            { written: 'Living Water', count: 1, section: WORD_C },
        ]);
    });

    it('keeps the English half as it is when every word listed is written over in the part the title names', () => {
        const study = genStudy(
            genTranslation({
                words: `${WORD_A} and ${WORD_B}.`,
                label: 'Living Water',
            }),
        );
        const [check] = listSavedStudyTranslationChecks(study);
        const pairs = [
            ...(check.englishWords ?? []),
            ...(check.englishLabels ?? []),
        ].map(({ written }) => {
            return { from: written, to: WORD_C };
        });
        const result = applyStudyReplace(study, pairs, check.title);
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const [english, translated] = result.text.split('\n---\n');
        expect(english).toBe(`${ENGLISH_HALF}\n`);
        expect(translated).not.toContain('and');
        expect(translated).not.toContain('Living Water');
    });

    // EC-582: the user's Genesis 4 study, its dialogue's boxes drawn by
    // their English ids under messages in the language.
    it('lists a dialogue’s participants drawn by their ids, and a replace writes each wherever the translation names it', () => {
        const dialogue = [
            '```mermaid',
            'sequenceDiagram',
            `    God->>Cain: ${WORD_A}?`,
            `    Cain->>God: ${WORD_B}`,
            '```',
        ].join('\n');
        const study = genStudy(`${genTranslation()}\n\n${dialogue}`);
        const [check] = listSavedStudyTranslationChecks(study);
        expect(
            check.englishLabels?.map(({ written }) => {
                return written;
            }),
        ).toEqual(['God', 'Cain']);
        const result = applyStudyReplace(
            study,
            [
                { from: 'God', to: WORD_C },
                { from: 'Cain', to: QALIM },
            ],
            check.title,
        );
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        const [english, translated] = result.text.split('\n---\n');
        expect(english).toBe(`${ENGLISH_HALF}\n`);
        // Every arrow names the same box: none drawn twice.
        expect(translated).toContain(`    ${WORD_C}->>${QALIM}: ${WORD_A}?`);
        expect(translated).toContain(`    ${QALIM}->>${WORD_C}: ${WORD_B}`);
    });

    it('reads the words a vowel sign apart beside the rest', () => {
        const study = genStudy(
            genTranslation({
                words: `${WORD_A} ${ZENON_SLIP} and ${WORD_B}.`,
            }),
        );
        const [check] = listSavedStudyTranslationChecks(study);
        expect(check.passages).toEqual([`${WORD_A} (ZB)`]);
        expect(
            check.slips.map(({ written, spelling }) => {
                return [written, spelling];
            }),
        ).toEqual([[ZENON_SLIP, ZENON]]);
        expect(check.englishWords?.length).toBe(1);
    });

    it('reads a translation that quotes no passage in its language too', () => {
        const [check] = listSavedStudyTranslationChecks(
            genStudy(
                genTranslation({
                    words: `${WORD_A}${OTHER_LETTER}${WORD_B}.`,
                    bible: 'KJV',
                }),
            ),
        );
        expect(check.passages).toEqual([]);
        expect(check.slips).toEqual([]);
        expect(check.otherScriptWords?.length).toBe(1);
    });

    it('tells a label left in a translation written in Latin letters by the English diagram at its place', () => {
        const translation = [
            '---',
            '',
            '# Zib Zab',
            '',
            '## Zorp',
            '',
            'Blee and blorp, the zib of the zab.',
            '',
            '```mermaid',
            'graph TD',
            '    A["Living Water"] --> B["Qorp"]',
            '```',
        ].join('\n');
        const [check] = listSavedStudyTranslationChecks(genStudy(translation));
        // Its words cannot be told from English, so none is named.
        expect(check.englishWords).toEqual([]);
        expect(check.englishLabels).toEqual([
            { written: 'Living Water', count: 1, section: 'Zorp' },
        ]);
    });

    it('reads its own script off its words, never off the Latin of diagrams left in English', () => {
        const diagram = [
            '```mermaid',
            'graph TD',
            '    A["Living Water"] --> B["Spiritual Rebirth"]',
            '    B --> C["Light versus Darkness"]',
            '```',
        ].join('\n');
        const study = genStudy(
            `${genTranslation({ label: 'Divine Love' })}\n\n${diagram}`,
        ).replace('```\n\n---', `\`\`\`\n\n${diagram}\n\n---`);
        const [check] = listSavedStudyTranslationChecks(study);
        expect(check.otherScriptWords).toEqual([]);
        expect(
            check.englishLabels?.map(({ written }) => {
                return written;
            }),
        ).toEqual([
            'Divine Love',
            'Living Water',
            'Spiritual Rebirth',
            'Light versus Darkness',
        ]);
    });

    it('names eight of each kind at most', () => {
        const words = Array.from({ length: 12 }, (_, index) => {
            return `${WORD_A}${String.fromCodePoint(0x4e10 + index)}${WORD_B}`;
        }).join(' ');
        const [check] = listSavedStudyTranslationChecks(
            genStudy(genTranslation({ words })),
        );
        expect(check.otherScriptWords?.length).toBe(8);
    });

    it('reads a file written with Windows line ends the same', () => {
        const study = genStudy(
            genTranslation({ words: `${WORD_A} and ${WORD_B}.` }),
        );
        expect(
            listSavedStudyTranslationChecks(study.replace(/\n/g, '\r\n')),
        ).toEqual(listSavedStudyTranslationChecks(study));
    });
});

// EC-560: a river the passage names in verse 26, as the Bible quoted writes
// it -- four letters, a sign on the first -- and as the translation's own
// words write it with a letter fewer and a vowel in place of the sign, in
// the bold words standing where the English half bolds its name.
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

function genNamedStudy({
    english = NAMED_ENGLISH_HALF,
    zenon = ZENON,
    river = RIVER_SLIP,
    zenonLine = true,
} = {}) {
    return [
        english,
        '',
        '---',
        '',
        `# ${TITLE}`,
        '',
        `> **${WORD_A}** (ZB)`,
        '>',
        `> **23** ${WORD_A} ${ZENON} ${WORD_A} ${QALIM}.`,
        '>',
        `> **26** ${WORD_A} ${WORD_B} ${RIVER}.`,
        '',
        `## ${WORD_C}`,
        '',
        ...(zenonLine ? [`* **${zenon}**: ${WORD_A} ${WORD_B}.`] : []),
        `* **${river}**: ${WORD_A}${river}.`,
        '',
    ].join('\n');
}

const RIVER_NAMED = {
    written: RIVER_SLIP,
    count: 2,
    section: WORD_C,
    name: 'Jordan',
    spelling: RIVER,
    key: '26',
};

describe('listSavedStudyTranslationChecks on a name written with other letters', () => {
    it('names it beside the word of its verse, read off the bold words in the place of the English name, with how often', () => {
        const study = genNamedStudy();
        const [check] = listSavedStudyTranslationChecks(study);
        expect(check.otherLetterNames).toEqual([RIVER_NAMED]);
        // The other name is written as its verse writes it.
        expect(check.slips).toEqual([]);
        // A replace takes it as named, in the translation alone.
        const result = applyStudyReplace(
            study,
            [{ from: RIVER_SLIP, to: RIVER }],
            check.title,
        );
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(result.replaced).toEqual([
            { from: RIVER_SLIP, to: RIVER, count: 2 },
        ]);
        expect(result.text.startsWith(`${NAMED_ENGLISH_HALF}\n`)).toBe(true);
        expect(listSavedStudyTranslationChecks(result.text)).toEqual([]);
    });

    it('says nothing of names written as their verse writes them, and leaves one a vowel sign apart to the vowel check', () => {
        expect(
            listSavedStudyTranslationChecks(genNamedStudy({ river: RIVER })),
        ).toEqual([]);
        const [check] = listSavedStudyTranslationChecks(
            genNamedStudy({ river: RIVER, zenon: ZENON_SLIP }),
        );
        expect(
            check.slips.map(({ written }) => {
                return written;
            }),
        ).toEqual([ZENON_SLIP]);
        expect(check.otherLetterNames).toEqual([]);
    });

    it('pairs the bold words line by line when the parts bold as many in no other way', () => {
        const [check] = listSavedStudyTranslationChecks(
            genNamedStudy({
                english: NAMED_ENGLISH_HALF.replace(
                    'where John baptized',
                    'where **John** baptized',
                ),
            }),
        );
        expect(check.otherLetterNames).toEqual([RIVER_NAMED]);
    });

    it('names nothing when the bold words cannot be paired', () => {
        expect(
            listSavedStudyTranslationChecks(
                genNamedStudy({ zenonLine: false }),
            ),
        ).toEqual([]);
    });
});

describe('toStudyNameCheckText with what a translation left', () => {
    it('gives a name written with other letters under its own lead, with its verse', () => {
        const text =
            toStudyNameCheckText(
                listSavedStudyTranslationChecks(genNamedStudy()),
                'JHN.3.Love.md',
            ) ?? '';
        expect(text).toContain(
            'Names the passages give, which its own words write with other ' +
                'letters than the verse giving them, each beside the word ' +
                'of that verse its letters come closest to -- if that word ' +
                'is not the name, say so and leave it:\n' +
                `- Jordan: "${RIVER_SLIP}", written 2 times in “${WORD_C}”; ` +
                `verse 26 writes "${RIVER}".`,
        );
    });

    it('gives each kind under its own lead, and a translation quoting no passage by its title alone', () => {
        const text =
            toStudyNameCheckText(
                listSavedStudyTranslationChecks(
                    genStudy(
                        genTranslation({
                            words: `${WORD_A}${OTHER_LETTER}${WORD_B} and ${QALIM}.`,
                            label: 'Living Water',
                            bible: 'KJV',
                        }),
                    ),
                ),
                'JHN.3.Love.md',
            ) ?? '';
        expect(text).toContain(`The translation "${TITLE}":`);
        expect(text).toContain(
            'Letters of another script than its own, which no reader of ' +
                'its language reads:\n' +
                `- "${OTHER_LETTER}", written once in “${WORD_C}”, as in ` +
                `“${WORD_A}${OTHER_LETTER}${WORD_B} and…”.`,
        );
        expect(text).toContain(
            'English words left between its own:\n' +
                `- "and", written once in “${WORD_C}”.`,
        );
        expect(text).toContain(
            "Its diagrams' labels left in English:\n" +
                `- "Living Water", written once in “${WORD_C}”.`,
        );
        // Written over in the translation alone, and the whole of it again
        // offered when there are many.
        expect(text).toContain("`section` naming the translation's title");
        expect(text).toContain('`translate` with `place` `append`');
        expect(text.endsWith('offering to show them.)')).toBe(true);
    });
});

// EC-596: the church words of the translation's language, handed in as the
// window loads them -- here a made-up language's, written in the same
// made-up letters.
const SPIRIT = `${letter(30)}${letter(31)}`;
const LIFE = `${letter(32)}${VOWEL_I}${letter(33)}`;
const SERPENT = `${letter(34)}${letter(35)}${VOWEL_U}`;
const SERPENT_OTHER = `${letter(40)}${letter(41)}`;
const SON = `${letter(36)}${letter(37)}`;
const CROSS = `${letter(38)}${letter(39)}${VOWEL_I}`;
const CROSS_OTHER = `${letter(6)}${letter(7)}${letter(8)}`;
const WORD_D = `${letter(9)}${letter(10)}`;

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

const TERM_ENGLISH_HALF = [
    '# The New Birth',
    '',
    '## Places',
    '',
    'The Holy Spirit gives eternal life. Moses lifted the bronze serpent.',
    '',
    '## Cross References',
    '',
    '- Numbers 21:9: the Son of Man lifted up as the bronze serpent was.',
].join('\n');

function genTermLines({ serpent = SERPENT, spirit = SPIRIT } = {}) {
    return [
        `${spirit} ${LIFE} ${WORD_A}. ${WORD_B} ${serpent}.`,
        `- ${WORD_A} 21:9: ${SON} ${serpent} ${WORD_B}.`,
    ];
}

function genTermStudy({
    heading = CROSS,
    serpent = SERPENT,
    spirit = SPIRIT,
    words = '',
} = {}) {
    const [placeLine, crossLine] = genTermLines({ serpent, spirit });
    return [
        TERM_ENGLISH_HALF,
        '',
        '---',
        '',
        `# ${TITLE}`,
        '',
        `## ${WORD_C}`,
        '',
        `${placeLine}${words}`,
        '',
        `## ${heading}`,
        '',
        crossLine,
        '',
    ].join('\n');
}

function loadTermish() {
    return Promise.resolve(TERMISH);
}

function readTermish() {
    return 'tt';
}

describe('readSavedStudyTranslationChecks: the church words its language writes (EC-596)', () => {
    it('names a heading that is a church word written otherwise, and a church word it never writes with its lines', async () => {
        const [check] = await readSavedStudyTranslationChecks(
            genTermStudy({ heading: CROSS_OTHER, serpent: SERPENT_OTHER }),
            loadTermish,
            readTermish,
        );
        expect(check.title).toBe(TITLE);
        expect(check.termHeadings).toEqual([
            {
                written: CROSS_OTHER,
                count: 1,
                section: CROSS_OTHER,
                english: 'Cross References',
                word: CROSS,
            },
        ]);
        // The heading's own word is not named twice.
        expect(check.missingTerms).toEqual([
            {
                english: 'bronze serpent',
                word: SERPENT,
                count: 2,
                section: WORD_C,
                lines: genTermLines({ serpent: SERPENT_OTHER }),
            },
        ]);
    });

    it('puts a heading right by a replace of it as listed, the English half kept', async () => {
        const study = genTermStudy({ heading: CROSS_OTHER });
        const [check] = await readSavedStudyTranslationChecks(
            study,
            loadTermish,
            readTermish,
        );
        const result = applyStudyReplace(
            study,
            (check.termHeadings ?? []).map(({ written, word }) => {
                return { from: written, to: word };
            }),
            check.title,
        );
        if ('reason' in result) {
            throw new Error(result.reason);
        }
        expect(result.text).toBe(study.replace(CROSS_OTHER, CROSS));
        expect(
            await readSavedStudyTranslationChecks(
                result.text,
                loadTermish,
                readTermish,
            ),
        ).toEqual([]);
    });

    it('says nothing of a translation writing its church words, one written with a space between its letters too', async () => {
        expect(
            await readSavedStudyTranslationChecks(
                genTermStudy(),
                loadTermish,
                readTermish,
            ),
        ).toEqual([]);
        expect(
            await readSavedStudyTranslationChecks(
                genTermStudy({
                    serpent: `${letter(34)} ${letter(35)}${VOWEL_U}`,
                }),
                loadTermish,
                readTermish,
            ),
        ).toEqual([]);
    });

    it('judges no church word of a translation writing fewer than half of those the English half uses', async () => {
        // Two of five: words of another language read as this one.
        expect(
            await readSavedStudyTranslationChecks(
                genTermStudy({
                    heading: CROSS_OTHER,
                    serpent: SERPENT_OTHER,
                    spirit: WORD_D,
                }),
                loadTermish,
                readTermish,
            ),
        ).toEqual([]);
    });

    it('shows a long line about the place its English line uses the word', async () => {
        const english =
            '# The New Birth\n\n## Places\n\nThe Holy Spirit ' +
            'came, '.repeat(40) +
            'and Moses lifted the bronze serpent.';
        const line = `${SPIRIT} ${`${WORD_A} `.repeat(100)}${SERPENT_OTHER}.`;
        const [check] = await readSavedStudyTranslationChecks(
            `${english}\n\n---\n\n# ${TITLE}\n\n## ${WORD_C}\n\n${line}\n`,
            loadTermish,
            readTermish,
        );
        const [piece] = check.missingTerms?.[0]?.lines ?? [''];
        expect(piece.startsWith('…')).toBe(true);
        expect(piece.endsWith(`${SERPENT_OTHER}.`)).toBe(true);
        expect(piece.length).toBeLessThanOrEqual(162);
    });

    it('loads each language once, none for a translation it cannot read, and reads the rest when one fails', async () => {
        const study = genTermStudy({ heading: CROSS_OTHER });
        const twice = `${study}\n---\n\n${study.split('\n---\n')[1]}`;
        const load = vi.fn(loadTermish);
        const checks = await readSavedStudyTranslationChecks(
            twice,
            load,
            readTermish,
        );
        expect(checks).toHaveLength(2);
        expect(load).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledWith('tt');
        const unread = vi.fn(loadTermish);
        expect(
            await readSavedStudyTranslationChecks(study, unread, () => {
                return null;
            }),
        ).toEqual([]);
        expect(unread).not.toHaveBeenCalled();
        // A language that fails to load: the words it left are still named.
        const [check] = await readSavedStudyTranslationChecks(
            genTermStudy({ heading: CROSS_OTHER, words: ` and ${WORD_B}.` }),
            () => {
                return Promise.reject(new Error('The file went away'));
            },
            readTermish,
        );
        expect(check.englishWords?.length).toBe(1);
        expect(check.termHeadings).toBeUndefined();
        expect(check.missingTerms).toBeUndefined();
    });

    it('reads no church words without a language: listSavedStudyTranslationChecks', () => {
        expect(
            listSavedStudyTranslationChecks(
                genTermStudy({ heading: CROSS_OTHER, serpent: SERPENT_OTHER }),
            ),
        ).toEqual([]);
    });
});

describe('toStudyCheckLanguage', () => {
    it('is no language for English, for no code, and with no church words', () => {
        const file = { words: { 'bronze serpent': SERPENT } };
        expect(toStudyCheckLanguage('en', file, null)).toBeNull();
        expect(toStudyCheckLanguage('', file, null)).toBeNull();
        expect(toStudyCheckLanguage('qq', null, null)).toBeNull();
    });

    it("holds its Bible's words and the app's labels it is handed", () => {
        expect(
            toStudyCheckLanguage(
                'qq',
                { words: { 'bronze serpent': SERPENT } },
                { 'Cross References': CROSS },
            )?.terms,
        ).toEqual({ 'Cross References': CROSS, 'bronze serpent': SERPENT });
    });
});

describe('toStudyNameCheckText with the church words a translation writes otherwise', () => {
    it('gives each heading and church word under its own lead, with its word and lines', async () => {
        const text =
            toStudyNameCheckText(
                await readSavedStudyTranslationChecks(
                    genTermStudy({
                        heading: CROSS_OTHER,
                        serpent: SERPENT_OTHER,
                    }),
                    loadTermish,
                    readTermish,
                ),
                'JHN.3.Love.md',
            ) ?? '';
        const [placeLine, crossLine] = genTermLines({
            serpent: SERPENT_OTHER,
        });
        expect(text).toContain(
            'Headings that are a church word of its language, which it ' +
                "heads otherwise -- each with the English half's heading " +
                'in its place and the word its language writes for it:\n' +
                `- "${CROSS_OTHER}", written once: the heading of “Cross ` +
                `References”, which its language writes "${CROSS}".`,
        );
        expect(text).toContain(
            'Church words the English half uses, which it never writes as ' +
                "its language's Bible does -- each with the Bible's word " +
                'and its lines where the English half uses it, to see how ' +
                'it says it there:\n' +
                `- bronze serpent: its Bible writes "${SERPENT}"; the ` +
                `English half uses it 2 times, first in “${WORD_C}”, in: ` +
                `“${placeLine}”; “${crossLine}”.`,
        );
        expect(text).toContain('a heading or a church word as the word given');
        expect(text.endsWith('offering to show them.)')).toBe(true);
    });
});

// A translation the window has just drafted (EC-600): its body from its
// title on, as the translate job puts it together, with no rule above it.
function toNewTranslation(options: Parameters<typeof genTranslation>[0] = {}) {
    return genTranslation(options).replace(/^---\n\n/, '');
}

// What the card holds: a change of the open study, or a copy of its own.
const HELD_TARGET = { file: 'Default/JHN.3.Study.md', isNew: false };
const NEW_TARGET = { file: 'JHN.3.Study Termish.md', isNew: true };

describe('toStudyTranslationLeftNote: what a translation just drafted still leaves (EC-600)', () => {
    it('names the English words and labels it left, to be put right in ONE call on the change the card holds', () => {
        const translated = toNewTranslation({
            words: `${WORD_A} and ${WORD_B} between ${QALIM}.`,
            label: 'Living Water',
        });
        const text =
            toStudyTranslationLeftNote(
                ENGLISH_HALF,
                translated,
                TERMISH,
                HELD_TARGET,
            ) ?? '';
        expect(
            text.startsWith(
                '(What it still leaves -- the app read the new translation ' +
                    'as it reads a saved one, after the translator was asked ' +
                    'about each part twice:\n\nThe translation ' +
                    `"${TITLE}"`,
            ),
        ).toBe(true);
        expect(text).toContain(
            'English words left between its own:\n' +
                `- "and", written once in “${WORD_C}”.\n` +
                `- "between", written once in “${WORD_C}”.\n` +
                "Its diagrams' labels left in English:\n" +
                `- "Living Water", written once in “${WORD_C}”.`,
        );
        expect(text).toContain(
            'Put right now, in ONE call before you answer, the English ' +
                "words, the diagrams' labels, the letters of another script " +
                'and the headings listed: owa_resource_file `draft` with ' +
                '`file` "Default/JHN.3.Study.md", `section` naming the ' +
                "translation's title -- never left out: it keeps the rest " +
                'of the file as it is -- and `replace`, each as written ' +
                'here `from`, and `to` in Termish',
        );
        expect(text).toContain('never that every word is in Termish');
        expect(text).not.toContain('Once they press Create');
        expect(
            text.endsWith('can be put right by asking once it is saved.)'),
        ).toBe(true);
        // The call it asks for, on the change the card holds -- the study
        // and the translation after it -- keeps the English half as it is.
        const held = `${ENGLISH_HALF}\n\n---\n\n${translated}\n`;
        const written = applyStudyReplace(
            held,
            [
                { from: 'and', to: WORD_A },
                { from: 'between', to: WORD_B },
                { from: 'Living Water', to: WORD_C },
            ],
            TITLE,
        );
        if ('reason' in written) {
            throw new Error(written.reason);
        }
        expect(written.text.startsWith(`${ENGLISH_HALF}\n\n---\n\n`)).toBe(
            true,
        );
        expect(
            toStudyTranslationLeftNote(
                ENGLISH_HALF,
                written.text.split('\n---\n\n')[1],
                TERMISH,
                HELD_TARGET,
            ),
        ).toBeNull();
    });

    it('names a heading and a church word its language writes otherwise', () => {
        const [original, translated] = genTermStudy({
            heading: CROSS_OTHER,
            serpent: SERPENT_OTHER,
        }).split('\n---\n\n');
        const text =
            toStudyTranslationLeftNote(
                original,
                translated,
                TERMISH,
                HELD_TARGET,
            ) ?? '';
        expect(text).toContain(
            `- "${CROSS_OTHER}", written once: the heading of “Cross ` +
                `References”, which its language writes "${CROSS}".`,
        );
        expect(text).toContain(
            `- bronze serpent: its Bible writes "${SERPENT}"; the English ` +
                'half uses it 2 times',
        );
        // What may be right as written is only said.
        expect(text).toContain(
            'Leave the rest as written -- a word a vowel sign from its ' +
                'verse, a name or a church word said another way may be ' +
                'right -- and say each',
        );
        // English has no church words of its own to hold a translation to.
        expect(
            toStudyTranslationLeftNote(
                original,
                translated,
                { ...TERMISH, code: 'en' },
                HELD_TARGET,
            ),
        ).toBeNull();
    });

    it('puts a new copy right in the same card: the new study it holds, by its name (EC-604)', () => {
        const text =
            toStudyTranslationLeftNote(
                ENGLISH_HALF,
                toNewTranslation({ words: `${WORD_A} and ${WORD_B}.` }),
                TERMISH,
                NEW_TARGET,
            ) ?? '';
        expect(text).toContain(
            'Put right now, in ONE call before you answer, the English ' +
                "words, the diagrams' labels, the letters of another script " +
                'and the headings listed: owa_resource_file `draft` with ' +
                '`file` "JHN.3.Study Termish.md" -- the new study the card ' +
                'holds -- and `replace`, each as written here `from`, and ' +
                '`to` in Termish, a heading as the word given. The card then ' +
                'holds the new study with them put right',
        );
        // The copy is all translation: no part to keep the call to.
        expect(text).not.toContain('`section`');
        expect(text).not.toContain('Once they press Create');
        expect(text).toContain('never that every word is in Termish');
    });

    it('is null for a translation that leaves nothing and for words with no title of their own', () => {
        expect(
            toStudyTranslationLeftNote(
                ENGLISH_HALF,
                toNewTranslation(),
                TERMISH,
                HELD_TARGET,
            ),
        ).toBeNull();
        // No `#` title: no translation of the study to read.
        expect(
            toStudyTranslationLeftNote(
                ENGLISH_HALF,
                `${WORD_A} and ${WORD_B}.`,
                TERMISH,
                HELD_TARGET,
            ),
        ).toBeNull();
        expect(
            toStudyTranslationLeftText([], 'Termish', HELD_TARGET),
        ).toBeNull();
    });
});
