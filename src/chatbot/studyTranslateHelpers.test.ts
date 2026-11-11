import { describe, expect, it } from 'vitest';

import languageNameMap from '../lang/data/en/language-names.json';
import { listAssistantLanguages } from './chatLangHelpers';
import {
    STUDY_MEANING_RULE,
    type StudyTranslateLanguageType,
    type StudyTranslatePlanType,
    applyStudyHeadingTerms,
    assembleStudyTranslation,
    checkIsStudyDiagramTranslated,
    checkIsStudyTextTranslated,
    cleanStudyTranslation,
    describeStudyTranslation,
    listMissingStudyTerms,
    listStudyStrayLetters,
    readStudyTranslatePlace,
    readStudyTranslatePlan,
    resolveStudyTranslateLanguage,
    splitEdgeLines,
    toStudyDiagramTranslationAsk,
    toStudyTermsText,
    toStudyTextTranslationAsk,
    toStudyTranslateDraftArgs,
    withStudyChurchWords,
    withStudyLabelTerms,
} from './studyTranslateHelpers';

// A made-up language: no test here names a real one but English.
const TESTISH: StudyTranslateLanguageType = {
    code: '',
    name: 'Testish',
    nativeName: 'Testo',
    scriptPattern: null,
    terms: { 'Holy Spirit': 'the Breath', grace: 'favour' },
};

// "Its own script" played by capital letters, which a test can write.
const CAPITALISH: StudyTranslateLanguageType = {
    ...TESTISH,
    name: 'Capitalish',
    nativeName: 'Capitalish',
    scriptPattern: /[A-Z]/u,
    terms: {},
};

const PLAN: StudyTranslatePlanType = {
    file: 'Default/JHN.3.The New Birth.md',
    name: 'JHN.3.The New Birth.md',
    hash: 'abc123',
    title: 'The New Birth',
    ref: 'JHN 3',
    bible: 'XB',
    parts: [
        { kind: 'text', text: '# The New Birth\n', quoted: null },
        {
            kind: 'passage',
            text: '> **John 3:1** (KJV)\n>\n> **1** There was a man.',
            quoted: '> **Jn 3:1** (XB)\n>\n> **1** A man was there.',
        },
        { kind: 'text', text: '\n## The Setting\nWords.\n', quoted: null },
        {
            kind: 'diagram',
            text: '```mermaid\ngraph TD\n    A["Love"] --> B["Gift"]\n```',
            quoted: null,
        },
        { kind: 'text', text: '', quoted: null },
        { kind: 'keep', text: '---', quoted: null },
    ],
    translations: '',
    footer: '\n---\n\n*Drafted by the app’s assistant.*\n',
};

describe('the place and the language a call names', () => {
    it('takes the three places, in any case, and nothing else', () => {
        expect(readStudyTranslatePlace('append')).toBe('append');
        expect(readStudyTranslatePlace(' Replace ')).toBe('replace');
        expect(readStudyTranslatePlace('NEW')).toBe('new');
        expect(readStudyTranslatePlace('after')).toBeNull();
        expect(readStudyTranslatePlace('')).toBeNull();
        expect(readStudyTranslatePlace(undefined)).toBeNull();
    });

    it('refuses what no language could be', () => {
        expect(resolveStudyTranslateLanguage('')).toBeNull();
        expect(resolveStudyTranslateLanguage('   ')).toBeNull();
        expect(resolveStudyTranslateLanguage('x'.repeat(61))).toBeNull();
        expect(resolveStudyTranslateLanguage('12345')).toBeNull();
        expect(resolveStudyTranslateLanguage(undefined)).toBeNull();
    });

    it('finds a language in English’s table of names by name or code', () => {
        const installedSet = new Set(
            listAssistantLanguages().map((language) => {
                return language.code.toLowerCase().split('-')[0];
            }),
        );
        const entry = Object.entries(
            languageNameMap as Record<string, string>,
        ).find(([code, name]) => {
            return (
                code !== 'en' &&
                !installedSet.has(code.toLowerCase().split('-')[0]) &&
                /^[A-Za-z ]+$/.test(name)
            );
        });
        expect(entry).toBeDefined();
        const [code, name] = entry as [string, string];
        const byName = resolveStudyTranslateLanguage(name.toLowerCase());
        expect(byName).toMatchObject({ code, name, scriptPattern: null });
        expect(resolveStudyTranslateLanguage(code)?.code).toBe(code);
    });

    it('prefers a language this computer knows, with its own script', () => {
        const known = listAssistantLanguages().find((language) => {
            return !language.isLatinScript;
        });
        if (known === undefined) {
            // No package in this checkout: the table alone answers.
            expect(listAssistantLanguages().length).toBeGreaterThanOrEqual(0);
            return;
        }
        const resolved = resolveStudyTranslateLanguage(known.name);
        expect(resolved?.code).toBe(known.code);
        expect(resolved?.scriptPattern).toBe(known.scriptPattern);
        expect(resolveStudyTranslateLanguage(known.nativeName)?.code).toBe(
            known.code,
        );
    });

    it('asks for a name the table lacks as it was said', () => {
        expect(resolveStudyTranslateLanguage('Zorbish')).toEqual({
            code: '',
            name: 'Zorbish',
            nativeName: 'Zorbish',
            scriptPattern: null,
            terms: {},
        });
    });
});

describe('readStudyTranslatePlan', () => {
    it('reads the app’s plan, dropping a part of no known kind', () => {
        const plan = readStudyTranslatePlan(
            JSON.stringify({
                translating: true,
                file: PLAN.file,
                name: PLAN.name,
                hash: PLAN.hash,
                title: '',
                ref: 'JHN 3',
                parts: [
                    { kind: 'text', text: 'Words.' },
                    { kind: 'passage', text: '> x', quoted: '> y' },
                    { kind: 'image', text: 'no' },
                    { kind: 'text' },
                ],
                footer: PLAN.footer,
            }),
        );
        expect(plan).toEqual({
            file: PLAN.file,
            name: PLAN.name,
            hash: PLAN.hash,
            title: null,
            ref: 'JHN 3',
            bible: null,
            parts: [
                { kind: 'text', text: 'Words.', quoted: null },
                { kind: 'passage', text: '> x', quoted: '> y' },
            ],
            translations: '',
            footer: PLAN.footer,
        });
        // The translations already added after the study come along.
        expect(
            readStudyTranslatePlan(
                JSON.stringify({
                    translating: true,
                    file: PLAN.file,
                    name: PLAN.name,
                    hash: PLAN.hash,
                    parts: [],
                    translations: '---\n\n# Again',
                }),
            )?.translations,
        ).toBe('---\n\n# Again');
    });

    it('is null for a refusal or anything that is not a plan', () => {
        expect(readStudyTranslatePlan('Tool refused: no such file')).toBeNull();
        expect(
            readStudyTranslatePlan(JSON.stringify({ file: 'a', name: 'a' })),
        ).toBeNull();
        expect(
            readStudyTranslatePlan(
                JSON.stringify({ translating: true, file: 'a', name: 'a' }),
            ),
        ).toBeNull();
    });
});

describe('what the translator is handed and gives back', () => {
    it('keeps a part’s blank lines round its words', () => {
        expect(splitEdgeLines('\n\nWords here.\n')).toEqual({
            lead: '\n\n',
            words: 'Words here.',
            trail: '\n',
        });
        expect(splitEdgeLines('\n\n')).toEqual({
            lead: '\n\n',
            words: '',
            trail: '',
        });
    });

    it('names only the church words the part uses, as whole words', () => {
        expect(toStudyTermsText('The Holy Spirit gives life.', TESTISH)).toBe(
            " Use the church's own words in Testish: Holy Spirit = the Breath.",
        );
        expect(toStudyTermsText('Gracefully said.', TESTISH)).toBe('');
        expect(toStudyTermsText('Nothing.', CAPITALISH)).toBe('');
    });

    it('asks for the words in the language, marks and tokens kept', () => {
        const ask = toStudyTextTranslationAsk(
            '  ## Grace\nBy grace [^Ephesians 2:8].  ',
            TESTISH,
        );
        expect(
            ask.startsWith('## Grace\nBy grace [^Ephesians 2:8].\n\n('),
        ).toBe(true);
        expect(ask).toContain('into Testish (Testo)');
        expect(ask).toContain('every [^…] token');
        expect(ask).toContain('grace = favour');
        expect(ask.endsWith('nothing else.)')).toBe(true);
        expect(toStudyTextTranslationAsk('Words.', CAPITALISH)).toContain(
            'into Capitalish,',
        );
    });

    it('asks every language for what a word means, never its sound', () => {
        // EC-486: "Cross references" had come back as "Cross" in the
        // language's letters.
        for (const language of [TESTISH, CAPITALISH]) {
            expect(toStudyTextTranslationAsk('Words.', language)).toContain(
                STUDY_MEANING_RULE,
            );
        }
        expect(STUDY_MEANING_RULE).toContain('never how it sounds');
        expect(STUDY_MEANING_RULE).toContain('Cross references are other');
    });

    it('names the church words the last translation wrote another way', () => {
        const ask = toStudyTextTranslationAsk(
            'The Holy Spirit and grace.',
            TESTISH,
            [['Holy Spirit', 'the Breath']],
        );
        expect(ask).toContain(
            ' Your last translation wrote these another way; write them so: ' +
                'Holy Spirit = the Breath.',
        );
        // Said after the list, and the frame still ends as it did.
        expect(ask.indexOf('Your last translation')).toBeGreaterThan(
            ask.indexOf('grace = favour'),
        );
        expect(ask.endsWith('nothing else.)')).toBe(true);
        expect(
            toStudyTextTranslationAsk('The Holy Spirit.', TESTISH),
        ).not.toContain('Your last translation');
    });

    it('asks for a diagram’s labels with its syntax kept', () => {
        const ask = toStudyDiagramTranslationAsk(
            'graph TD\n  A --> B',
            TESTISH,
        );
        expect(
            ask.startsWith('graph TD\n  A --> B\n\n(This is a mermaid'),
        ).toBe(true);
        expect(ask).toContain('every node id');
        expect(ask).toContain('no ``` fence');
        expect(ask).not.toContain("church's own words");
    });

    it('gives a diagram the church words its labels use', () => {
        const ask = toStudyDiagramTranslationAsk(
            'graph TD\n  A["Holy Spirit"] --> B["Life"]',
            TESTISH,
        );
        expect(ask).toContain(
            "Use the church's own words in Testish: Holy Spirit = the Breath.",
        );
        expect(
            ask.endsWith('Answer with the diagram alone, no ``` fence.)'),
        ).toBe(true);
    });

    it('takes a fence off the answer, and only a whole one', () => {
        expect(cleanStudyTranslation('```markdown\n## A\nB\n```')).toBe(
            '## A\nB',
        );
        expect(cleanStudyTranslation('\r\n  plain words \r\n')).toBe(
            'plain words',
        );
        expect(cleanStudyTranslation('```mermaid\ngraph TD\n```\nafter')).toBe(
            '```mermaid\ngraph TD\n```\nafter',
        );
        expect(cleanStudyTranslation(undefined as unknown as string)).toBe('');
    });
});

describe('checkIsStudyTextTranslated', () => {
    const source =
        'The Setting\n\nJohn 3 takes place in Jerusalem [^John 3:1].';

    it('takes words that came back changed, tokens and tables kept', () => {
        expect(
            checkIsStudyTextTranslated(
                source,
                'Le cadre\n\nJean 3 se passe a Jerusalem [^John 3:1].',
                TESTISH,
            ),
        ).toBe(true);
    });

    it('refuses the words handed back, nothing, a stub or a run-on', () => {
        expect(checkIsStudyTextTranslated(source, source, TESTISH)).toBe(false);
        expect(checkIsStudyTextTranslated(source, '  ', TESTISH)).toBe(false);
        expect(checkIsStudyTextTranslated(source, 'Ok.', TESTISH)).toBe(false);
        expect(
            checkIsStudyTextTranslated(source, 'x'.repeat(1000), TESTISH),
        ).toBe(false);
    });

    it('refuses a translation that lost a verse token or a table row', () => {
        expect(
            checkIsStudyTextTranslated(
                source,
                'Le cadre\n\nJean 3 se passe a Jerusalem, verset un.',
                TESTISH,
            ),
        ).toBe(false);
        const table = '| Name | Role |\n| - | - |\n| Jesus | Teacher |';
        expect(
            checkIsStudyTextTranslated(
                table,
                '| Nom | Role |\n| Jesus | Maitre |',
                TESTISH,
            ),
        ).toBe(false);
    });

    it('wants the language’s own letters when it has a script', () => {
        const words = 'jesus answered him with a question at night';
        expect(
            checkIsStudyTextTranslated(
                words,
                'JESUS ANSWERED HIM WITH A QUESTION AT NIGHT',
                CAPITALISH,
            ),
        ).toBe(true);
        expect(
            checkIsStudyTextTranslated(
                words,
                'jesus answered him, with a question, at night!',
                CAPITALISH,
            ),
        ).toBe(false);
        // A few letters are too few to judge by their script.
        expect(checkIsStudyTextTranslated('a b c', 'x y z', CAPITALISH)).toBe(
            true,
        );
    });
});

// A made-up language with the church words a study's headings and names
// use, the way a language's `translationTerms` carries them (EC-486).
const TERMISH: StudyTranslateLanguageType = {
    ...TESTISH,
    name: 'Termish',
    nativeName: 'Termo',
    terms: {
        'Cross references': 'Linked Verses',
        'Holy Spirit': 'the Breath',
        'bronze serpent': 'brasssnake',
        'bronze snake': 'brasssnake',
        'golden calf': "calf o'gold",
        grace: 'favour',
    },
};

describe('applyStudyHeadingTerms', () => {
    it('writes a heading that is a church word as that word', () => {
        expect(
            applyStudyHeadingTerms(
                '## Cross References\nSee these.\n\n### The Holy Spirit:\nHe gives.',
                '## Kross Refs\nSee theseo.\n\n### Spirito thing\nHe giveso.',
                TERMISH,
            ),
        ).toBe('## Linked Verses\nSee theseo.\n\n### The Breath\nHe giveso.');
    });

    it('reads a heading through bold, closing marks and any case', () => {
        expect(
            applyStudyHeadingTerms(
                '# **CROSS REFERENCES** #\n\n## Grace.',
                '# **Krossos** #\n\n## Graceo.',
                TERMISH,
            ),
        ).toBe('# Linked Verses\n\n## Favour');
    });

    it('leaves a heading that is no church word as translated', () => {
        expect(
            applyStudyHeadingTerms(
                '## The Setting\n\n## Cross references',
                '## The Settingo\n\n## Krossos',
                TERMISH,
            ),
        ).toBe('## The Settingo\n\n## Linked Verses');
    });

    it('changes nothing when the headings cannot be paired, or no word is known', () => {
        const source = '## Cross references\n\n## The Setting';
        const merged = '## Krossos and the Settingo';
        expect(applyStudyHeadingTerms(source, merged, TERMISH)).toBe(merged);
        const translated = '## Krossos\n\n## Settingo';
        expect(applyStudyHeadingTerms(source, translated, CAPITALISH)).toBe(
            translated,
        );
        expect(applyStudyHeadingTerms('No heading.', 'Noo.', TERMISH)).toBe(
            'Noo.',
        );
    });
});

describe('listMissingStudyTerms', () => {
    const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
    const CURLY_APOSTROPHE = String.fromCharCode(0x2019);

    it('names a name of more than one word the translation says another way', () => {
        expect(
            listMissingStudyTerms(
                'Moses lifted the bronze serpent. By grace.',
                'Moseso liftedo the shiny snakeo. By favouro.',
                TERMISH,
            ),
        ).toEqual([['bronze serpent', 'brasssnake']]);
    });

    it('leaves out one word, and a word the English does not use', () => {
        // "grace" is one word: a translation may fairly say it its own way.
        expect(
            listMissingStudyTerms(
                'By grace alone.',
                'By kindnesso aloneo.',
                TERMISH,
            ),
        ).toEqual([]);
        expect(
            listMissingStudyTerms(
                'Bronze serpents are many.',
                'Many.',
                TERMISH,
            ),
        ).toEqual([]);
    });

    it('finds the word through a Bible’s invisible gaps, curly quotes and case', () => {
        expect(
            listMissingStudyTerms(
                'The BRONZE SNAKE and the golden calf.',
                `The Brass${ZERO_WIDTH_SPACE}Snake and the calf ` +
                    `o${CURLY_APOSTROPHE}gold.`,
                TERMISH,
            ),
        ).toEqual([]);
    });
});

describe('withStudyLabelTerms', () => {
    it("adds the app's labels a dictionary words its own way", () => {
        expect(
            withStudyLabelTerms(CAPITALISH, {
                'Cross References': ' Joined Verses ',
                'Old Testament': 'Elder Book',
                Cancel: 'Stop',
            }).terms,
        ).toEqual({
            'Cross References': 'Joined Verses',
            'Old Testament': 'Elder Book',
        });
    });

    it("keeps the language's own words first, each English word once", () => {
        const language = withStudyLabelTerms(TERMISH, {
            'Cross References': 'Joined Verses',
            'New Testament': 'Young Book',
        });
        expect(language.terms['Cross references']).toBe('Linked Verses');
        expect(language.terms['New Testament']).toBe('Young Book');
        expect(
            Object.keys(language.terms).filter((english) => {
                return english.toLowerCase() === 'cross references';
            }),
        ).toHaveLength(1);
    });

    it("reads an installed plugin's labels, every key in lower case", () => {
        expect(
            withStudyLabelTerms(CAPITALISH, {
                'cross references': 'Joined Verses',
                'new testament': 'Young Book',
            }).terms,
        ).toEqual({
            'Cross References': 'Joined Verses',
            'New Testament': 'Young Book',
        });
    });

    it('adds nothing for a label left in English, empty or not words', () => {
        for (const dictionary of [
            null,
            undefined,
            'Cross References',
            {
                'Cross References': 'cross references',
                'Old Testament': '  ',
                'New Testament': 7,
            },
        ]) {
            expect(withStudyLabelTerms(CAPITALISH, dictionary)).toBe(
                CAPITALISH,
            );
        }
    });
});

describe('withStudyChurchWords', () => {
    it("adds its Bible's words under the language's own, and how its words change", () => {
        const language = withStudyChurchWords(TERMISH, {
            source: 'A made-up Bible',
            wordsChangeForm: true,
            words: {
                'Son of Man': ' the Man Born ',
                'Holy Spirit': 'the Wind',
                Pharisees: 'the strict ones',
            },
        });
        expect(language.terms['Son of Man']).toBe('the Man Born');
        expect(language.terms.Pharisees).toBe('the strict ones');
        // The language's own `translationTerms` win.
        expect(language.terms['Holy Spirit']).toBe('the Breath');
        expect(language.isWordFormChanging).toBe(true);
        // ... in any case: one word, never two the translator is told.
        expect(
            withStudyChurchWords(TERMISH, {
                words: { 'holy spirit': 'the Wind', Grace: 'the gift' },
            }),
        ).toBe(TERMISH);
        expect(
            withStudyChurchWords(TERMISH, { words: { Moses: 'Mosa' } })
                .isWordFormChanging,
        ).toBe(false);
    });

    it('then takes the labels under both', () => {
        const language = withStudyLabelTerms(
            withStudyChurchWords(CAPITALISH, {
                words: { 'Old Testament': 'Elder Covenant' },
            }),
            { 'old testament': 'Elder Book', 'new testament': 'Young Book' },
        );
        expect(language.terms).toEqual({
            'Old Testament': 'Elder Covenant',
            'New Testament': 'Young Book',
        });
    });

    it('adds nothing for a word left as its English, empty, or no file', () => {
        for (const file of [
            null,
            undefined,
            'words',
            { words: null },
            {
                wordsChangeForm: true,
                words: { David: 'david', Paul: ' ', Peter: 3 },
            },
        ]) {
            expect(withStudyChurchWords(CAPITALISH, file)).toBe(CAPITALISH);
        }
    });

    // Letters of scripts that are not Latin, by their code points.
    const lettersFrom = (start: number, count: number) => {
        return String.fromCodePoint(
            ...Array.from({ length: count }, (_, index) => {
                return start + index;
            }),
        );
    };

    it('writes in the one script its words are written in, and is held to it', () => {
        const word = lettersFrom(0x03b1, 6);
        const language = withStudyChurchWords(TESTISH, {
            words: { 'Son of Man': `${word} ${word}`, Moses: word },
        });
        expect(language.scriptName).toBe('Greek');
        expect(language.scriptPattern?.test(word[0])).toBe(true);
        expect(language.scriptPattern?.test('a')).toBe(false);
        expect(
            toStudyTextTranslationAsk('The Son of Man came.', language),
        ).toContain('into Testish (Testo), written in Greek letters, in');
        expect(
            toStudyDiagramTranslationAsk('graph TD\n    A["Love"]', language),
        ).toContain('into Testish (Testo), written in Greek letters:');
        // The other script came back: not a translation.
        const from = 'The Son of Man came to seek and to save the lost.';
        expect(
            checkIsStudyTextTranslated(
                from,
                'The Son of Man came to seek and save the lost ones.',
                language,
            ),
        ).toBe(false);
        expect(
            checkIsStudyTextTranslated(
                from,
                `${word} ${word} ${word} ${word} ${word}.`,
                language,
            ),
        ).toBe(true);
        // A script of its own already known is kept.
        expect(
            withStudyChurchWords(CAPITALISH, { words: { Moses: word } })
                .scriptPattern,
        ).toBe(CAPITALISH.scriptPattern);
    });

    it('holds words in several scripts at once to all of them, naming none', () => {
        const syllables = lettersFrom(0x3042, 3);
        const angular = lettersFrom(0x30a2, 3);
        const ideographs = lettersFrom(0x4e00, 3);
        const language = withStudyChurchWords(TESTISH, {
            words: { 'Son of Man': syllables + ideographs, Moses: angular },
        });
        expect(language.scriptName).toBeUndefined();
        for (const letter of [syllables[0], angular[0], ideographs[0]]) {
            expect(language.scriptPattern?.test(letter)).toBe(true);
        }
        expect(language.scriptPattern?.test('a')).toBe(false);
        expect(toStudyTextTranslationAsk('Words.', language)).not.toContain(
            'written in',
        );
    });

    it('names no script for words mostly in Latin letters', () => {
        for (const words of [
            { 'Son of Man': 'the Man Born', Moses: 'Mosa' },
            { 'Son of Man': 'the Man Born', Moses: lettersFrom(0x03b1, 2) },
        ]) {
            const language = withStudyChurchWords(TESTISH, { words });
            expect(language.scriptPattern).toBeNull();
            expect(language.scriptName).toBeUndefined();
            expect(toStudyTextTranslationAsk('Words.', language)).toContain(
                'into Testish (Testo), in plain words',
            );
        }
    });
});

describe('a language whose words change form in a sentence', () => {
    const SHIFTISH: StudyTranslateLanguageType = {
        ...TESTISH,
        name: 'Shiftish',
        terms: { 'Holy Spirit': 'Holdo Spirak', 'Son of Man': 'Sono di Manno' },
        isWordFormChanging: true,
    };

    it('finds a church word with an ending or a prefix put on it', () => {
        expect(
            listMissingStudyTerms(
                'The gift of the Holy Spirit and the Son of Man.',
                'Il donno ka-Holdon Spiraken e la Sonon di Mannos.',
                SHIFTISH,
            ),
        ).toEqual([]);
    });

    it('still names a church word written as another word', () => {
        expect(
            listMissingStudyTerms(
                'The gift of the Holy Spirit.',
                'Il donno ka-Sacra Ventos.',
                SHIFTISH,
            ),
        ).toEqual([['Holy Spirit', 'Holdo Spirak']]);
    });

    it('finds it whatever marks one writer puts on its letters and another leaves off', () => {
        // Built from code points: a combining acute (U+0301) and a combining
        // dot below (U+0323) on Latin letters, and a precomposed letter
        // (U+00ED) whose taken-apart form is the plain one plus a mark.
        const ACUTE = String.fromCodePoint(0x0301);
        const DOT = String.fromCodePoint(0x0323);
        const MARKED: StudyTranslateLanguageType = {
            ...SHIFTISH,
            terms: {
                'Holy Spirit': `Ho${ACUTE}ldo Spi${DOT}rak`,
                'Son of Man': `Sono d${String.fromCodePoint(0xed)} Manno`,
            },
        };
        for (const isWordFormChanging of [true, false]) {
            expect(
                listMissingStudyTerms(
                    'The Holy Spirit and the Son of Man.',
                    `Il Holdo Spirak e${ACUTE} la Sono di Man${DOT}no.`,
                    { ...MARKED, isWordFormChanging },
                ),
            ).toEqual([]);
        }
    });

    it('reads a turned comma written as a letter as an apostrophe', () => {
        expect(
            listMissingStudyTerms(
                'The Son of Man.',
                `La Sono ${String.fromCodePoint(0x2018)}e Manno.`,
                {
                    ...SHIFTISH,
                    terms: {
                        'Son of Man': `Sono ${String.fromCodePoint(0x02bb)}e Manno`,
                    },
                    isWordFormChanging: false,
                },
            ),
        ).toEqual([]);
    });

    it('looks for it letter for letter in a language whose words do not change', () => {
        expect(
            listMissingStudyTerms(
                'The gift of the Holy Spirit.',
                'Il donno ka-Holdon Spiraken.',
                { ...SHIFTISH, isWordFormChanging: false },
            ),
        ).toEqual([['Holy Spirit', 'Holdo Spirak']]);
    });

    it('writes a church word as a heading with a capital first letter', () => {
        expect(
            applyStudyHeadingTerms(
                '## Pharisees',
                '## Farizo',
                withStudyChurchWords(TESTISH, {
                    words: { Pharisees: 'the strict ones' },
                }),
            ),
        ).toBe('## The strict ones');
    });
});

describe('listStudyStrayLetters', () => {
    // Letters by code point, each of one Unicode script: no word of any
    // language is written here.
    const MAIN = String.fromCodePoint(0x1000, 0x1001, 0x1002, 0x1003);
    const THIRD = String.fromCodePoint(0x0d94);
    const OTHER_THIRD = String.fromCodePoint(0x0e01);
    const GREEK = String.fromCodePoint(0x03b1, 0x03b3);
    const HAN = String.fromCodePoint(0x4e00, 0x4e01, 0x4e03);
    const HIRAGANA = String.fromCodePoint(0x3042);
    const KATAKANA = String.fromCodePoint(0x30a2);

    it('names a letter of a third script slipped into a word', () => {
        expect(
            listStudyStrayLetters(
                'The Son of Man is lifted up.',
                `${MAIN} ${MAIN}${THIRD}${MAIN} ${MAIN}.`,
            ),
        ).toEqual([THIRD]);
        expect(
            listStudyStrayLetters(
                'Lifted up.',
                `${MAIN}${THIRD} ${OTHER_THIRD}${MAIN}${THIRD}`,
            ),
        ).toEqual([THIRD, OTHER_THIRD]);
    });

    it('leaves Latin, the main script and the words handed in alone', () => {
        // A name in Latin letters, and a Greek word the study itself uses.
        expect(
            listStudyStrayLetters(
                `The word ${GREEK} means love.`,
                `${MAIN} Moses ${GREEK} ${MAIN}.`,
            ),
        ).toEqual([]);
        expect(listStudyStrayLetters('Plain words.', 'Mots simples.')).toEqual(
            [],
        );
        expect(listStudyStrayLetters('Words.', '1 2 3.')).toEqual([]);
    });

    it('takes scripts one language writes together as its own', () => {
        expect(
            listStudyStrayLetters(
                'Love.',
                `${HAN}${HIRAGANA}${KATAKANA}${HAN}`,
            ),
        ).toEqual([]);
    });

    it('names each letter once, eight at most', () => {
        const many = Array.from({ length: 12 }, (_, index) => {
            return String.fromCodePoint(0x0d85 + index);
        }).join('');
        const stray = listStudyStrayLetters(
            'Words.',
            `${MAIN.repeat(10)}${many}${many}`,
        );
        expect(stray).toHaveLength(8);
        expect(new Set(stray).size).toBe(8);
    });

    it('is named in the ask for the part once more', () => {
        const ask = toStudyTextTranslationAsk(
            'Lifted up.',
            TESTISH,
            [],
            [THIRD],
        );
        expect(ask).toContain(
            `Your last translation had letters of another language in it ` +
                `(${THIRD}); write every word in Testish letters.`,
        );
        expect(toStudyTextTranslationAsk('Lifted up.', TESTISH)).not.toContain(
            'letters of another language',
        );
    });
});

describe('checkIsStudyDiagramTranslated', () => {
    const source =
        'graph TD\n    A["Love"] --> B["Gift"]\n    B --> C{"Choice"}';

    it('takes the same diagram with other labels', () => {
        expect(
            checkIsStudyDiagramTranslated(
                source,
                'graph TD\n    A["Amour"] --> B["Don"]\n    B --> C{"Choix"}',
            ),
        ).toBe(true);
        // One line more or fewer is a translator's blank line, not a change.
        expect(
            checkIsStudyDiagramTranslated(
                source,
                'graph TD\n    A["Amour"] --> B["Don"]\n    B --> C{"Choix"}\n',
            ),
        ).toBe(true);
    });

    it('refuses another kind, lost arrows or lines, HTML and nothing', () => {
        expect(
            checkIsStudyDiagramTranslated(
                source,
                'flowchart TD\n    A["Amour"] --> B["Don"]\n    B --> C{"Choix"}',
            ),
        ).toBe(false);
        expect(
            checkIsStudyDiagramTranslated(
                source,
                'graph TD\n    A["Amour"] B["Don"]\n    B --> C{"Choix"}',
            ),
        ).toBe(false);
        expect(checkIsStudyDiagramTranslated(source, 'graph TD')).toBe(false);
        expect(
            checkIsStudyDiagramTranslated(
                source,
                'graph TD\n    A["<b>Amour</b>"] --> B["Don"]\n    B --> C{"Choix"}',
            ),
        ).toBe(false);
        expect(checkIsStudyDiagramTranslated(source, '  ')).toBe(false);
    });
});

describe('assembleStudyTranslation', () => {
    it('puts each part back in its place, translated or kept', () => {
        const result = assembleStudyTranslation(
            PLAN,
            new Map([
                [0, '# La Naissance'],
                [2, '## Le Cadre\nMots.'],
            ]),
            new Map([
                [3, '```mermaid\ngraph TD\n    A["Amour"] --> B["Don"]\n```'],
            ]),
        );
        expect(result.body).toBe(
            [
                '# La Naissance',
                '',
                '> **Jn 3:1** (XB)',
                '>',
                '> **1** A man was there.',
                '',
                '## Le Cadre',
                'Mots.',
                '',
                '```mermaid',
                'graph TD',
                '    A["Amour"] --> B["Don"]',
                '```',
                '',
                '---',
            ].join('\n'),
        );
        expect(result).toMatchObject({
            diagramCount: 1,
            keptDiagramCount: 0,
            passageCount: 1,
            keptPassageCount: 0,
        });
    });

    it('keeps a diagram that would not draw and a passage not quoted', () => {
        const plan = {
            ...PLAN,
            parts: PLAN.parts.map((part) => {
                return part.kind === 'passage'
                    ? { ...part, quoted: null }
                    : part;
            }),
        };
        const result = assembleStudyTranslation(
            plan,
            new Map(),
            new Map([[3, null]]),
        );
        expect(result.body).toBe(
            plan.parts
                .map((part) => {
                    return part.text;
                })
                .join('\n'),
        );
        expect(result).toMatchObject({
            keptDiagramCount: 1,
            keptPassageCount: 1,
        });
    });
});

describe('toStudyTranslateDraftArgs', () => {
    const body =
        '# La Naissance\n\n> **Jn 3:1** (XB)\n> **1** A man.\n\n## Le Cadre\nMots.';

    it('adds the translation after the file, under a rule', () => {
        expect(
            toStudyTranslateDraftArgs(PLAN, `\n${body}\n`, 'append', TESTISH),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            append: `---\n\n${body}`,
            bible: 'XB',
        });
    });

    it('puts it in place of the words, the app’s last lines kept', () => {
        expect(
            toStudyTranslateDraftArgs(
                { ...PLAN, bible: null },
                body,
                'replace',
                TESTISH,
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content: `${body}\n${PLAN.footer}`,
        });
        // The translations added after the study stay where they were.
        const translations = '---\n\n# Again\n\nWords again.';
        expect(
            toStudyTranslateDraftArgs(
                { ...PLAN, bible: null, translations: `${translations}\n\n` },
                body,
                'replace',
                TESTISH,
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content: `${body}\n\n${translations}\n${PLAN.footer}`,
        });
        // ... and are no part of what goes after them, or of a copy.
        for (const place of ['append', 'new'] as const) {
            expect(
                JSON.stringify(
                    toStudyTranslateDraftArgs(
                        { ...PLAN, translations },
                        body,
                        place,
                        TESTISH,
                    ),
                ),
            ).not.toContain('Again');
        }
    });

    it('drafts a copy under its translated title, its passage quoted anew', () => {
        expect(toStudyTranslateDraftArgs(PLAN, body, 'new', TESTISH)).toEqual({
            action: 'draft',
            ref: 'JHN 3',
            title: 'La Naissance',
            content: '## Le Cadre\nMots.',
            bible: 'XB',
        });
        const untitled = toStudyTranslateDraftArgs(
            { ...PLAN, title: null },
            'Mots.',
            'new',
            TESTISH,
        );
        expect(untitled).toMatchObject({
            title: 'JHN.3.The New Birth.md (Testish)',
            content: 'Mots.',
        });
    });

    it('refuses a copy of a file named for no passage', () => {
        const refused = toStudyTranslateDraftArgs(
            { ...PLAN, ref: null },
            body,
            'new',
            TESTISH,
        );
        expect('reason' in refused && refused.reason).toContain(
            'place "append"',
        );
    });
});

describe('describeStudyTranslation', () => {
    const counts = {
        body: '',
        diagramCount: 4,
        keptDiagramCount: 0,
        passageCount: 2,
        keptPassageCount: 0,
    };

    it('says what the window did, for the model to tell', () => {
        expect(
            describeStudyTranslation(PLAN, counts, TESTISH, 'append', 'Gemma'),
        ).toBe(
            `The window translated ${PLAN.name} into Testish part by part ` +
                'with Gemma, to be added after the file as it is. Its 4 ' +
                'diagram(s) are translated. Its Bible passages are quoted ' +
                'from XB.',
        );
    });

    it('says what was kept as it was, and why', () => {
        const text = describeStudyTranslation(
            { ...PLAN, bible: null },
            { ...counts, keptDiagramCount: 1, keptPassageCount: 2 },
            TESTISH,
            'replace',
            'Gemma',
        );
        expect(text).toContain(', in place of its words.');
        expect(text).toContain('3 of its 4 diagrams are translated; 1 kept');
        expect(text).toContain('No Testish Bible is installed');
        expect(
            describeStudyTranslation(
                PLAN,
                { ...counts, diagramCount: 0, keptPassageCount: 1 },
                TESTISH,
                'new',
                'Gemma',
            ),
        ).toBe(
            `The window translated ${PLAN.name} into Testish part by part ` +
                'with Gemma, as a copy of its own. 1 Bible passage(s) could ' +
                'not be read in XB and are quoted as they were.',
        );
    });

    it('says the translations already added were left as they are', () => {
        expect(
            describeStudyTranslation(
                { ...PLAN, translations: '---\n\n# Again' },
                { ...counts, diagramCount: 0, passageCount: 0 },
                TESTISH,
                'append',
                'Gemma',
            ),
        ).toBe(
            `The window translated ${PLAN.name} into Testish part by part ` +
                'with Gemma, to be added after the file as it is. Only the ' +
                'study as it was written was translated: the translations ' +
                'already added after it are kept as they are.',
        );
    });
});
