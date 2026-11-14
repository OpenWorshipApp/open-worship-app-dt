import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import languageNameMap from '../lang/data/en/language-names.json';
import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';
import {
    detectTypedLanguage,
    listAssistantLanguages,
    toPackageLangCode,
} from './chatLangHelpers';
import { chunkStudyText } from '../helper/agentStudyFileRules';
import {
    STUDY_MEANING_RULE,
    type StudyTranslateLanguageType,
    type StudyTranslatePlanType,
    applyStudyHeadingTerms,
    assembleStudyTranslation,
    checkIsStudyDiagramInLanguage,
    checkIsStudyDiagramTranslated,
    checkIsStudyPassageInLanguage,
    checkIsStudyTermLanguage,
    checkIsStudyTextInLanguage,
    checkIsStudyTextTranslated,
    cleanStudyTranslation,
    describeStudyNothingTranslated,
    describeStudyTranslation,
    findStudyTranslationsInLanguage,
    genStudyAppendInLanguageRefusal,
    joinStudyTextPieces,
    listMissingStudyTerms,
    listStudyHeadingTermSlips,
    listStudyStrayLetters,
    listStudyStrayWords,
    listStudyTermPlaces,
    planStudyTranslateJobs,
    readStudyPartsLanguage,
    readStudyTranslatePlace,
    readStudyTranslatePlan,
    resolveStudyTranslateLanguage,
    splitEdgeLines,
    toStudyDiagramTranslationAsk,
    toStudyOriginalBody,
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

    it('takes a word written with a space, a hyphen or nothing between its words as written (EC-596)', () => {
        for (const translated of [
            'Moseso liftedo the brass snake.',
            'Moseso liftedo the brass-snake.',
            'Moseso liftedo the brass\nsnake.',
        ]) {
            expect(
                listMissingStudyTerms(
                    'Moses lifted the bronze serpent.',
                    translated,
                    TERMISH,
                ),
            ).toEqual([]);
        }
        // Its own two words apart are no gap between them.
        expect(
            listMissingStudyTerms(
                'Moses lifted the bronze serpent.',
                'Moseso liftedo the brass, the snake.',
                TERMISH,
            ),
        ).toEqual([['bronze serpent', 'brasssnake']]);
    });
});

describe('the church words a saved translation writes otherwise (EC-596)', () => {
    it('names a heading that is a church word and does not write it, with the words a replace takes', () => {
        expect(
            listStudyHeadingTermSlips(
                '## The Setting\n\n## **Cross References**:\n\nSee these.',
                '## Settingo\n\n## **Kross Refs**:\n\nSee theseo.',
                TERMISH,
            ),
        ).toEqual([
            {
                english: 'Cross References',
                word: 'Linked Verses',
                written: 'Kross Refs',
            },
        ]);
    });

    it('leaves a heading that writes the word, with more words or in another case', () => {
        expect(
            listStudyHeadingTermSlips(
                '## Cross references\n\n### The Holy Spirit',
                '## Some linked verses\n\n### The Breath Itself',
                TERMISH,
            ),
        ).toEqual([]);
    });

    it('pairs no headings when the counts differ, and has nothing with no church words', () => {
        expect(
            listStudyHeadingTermSlips(
                '## Cross references\n\n## The Setting',
                '## Krossos and the Settingo',
                TERMISH,
            ),
        ).toEqual([]);
        expect(
            listStudyHeadingTermSlips(
                '## Cross references',
                '## Krossos',
                CAPITALISH,
            ),
        ).toEqual([]);
        expect(
            listStudyHeadingTermSlips('No heading.', 'Noo.', TERMISH),
        ).toEqual([]);
    });

    it('reads a heading by its stems in a language whose words change form', () => {
        const shifting: StudyTranslateLanguageType = {
            ...TERMISH,
            terms: { 'Holy Spirit': 'Holdo Spirak' },
            isWordFormChanging: true,
        };
        expect(
            listStudyHeadingTermSlips(
                '## The Holy Spirit',
                '## Ka-Holdon Spiraken',
                shifting,
            ),
        ).toEqual([]);
        expect(
            listStudyHeadingTermSlips(
                '## The Holy Spirit',
                '## Sacra Ventos',
                shifting,
            ),
        ).toEqual([
            {
                english: 'The Holy Spirit',
                word: 'Holdo Spirak',
                written: 'Sacra Ventos',
            },
        ]);
    });

    it('finds each place some words use a church word, whole words in any case', () => {
        expect(
            listStudyTermPlaces(
                'The Bronze Serpent; bronze serpents; the bronze serpent.',
                'bronze serpent',
            ),
        ).toEqual([4, 41]);
        expect(listStudyTermPlaces('No such words.', 'bronze serpent')).toEqual(
            [],
        );
    });

    it('takes a translation for its language when it writes half the church words used, or more', () => {
        const source = 'By grace the Holy Spirit lifted the bronze serpent.';
        // Two of the three: grace and the Holy Spirit.
        expect(
            checkIsStudyTermLanguage(
                source,
                'By favour the Breath liftedo the shinysnake.',
                TERMISH,
            ),
        ).toBe(true);
        // One of the three: words of a near language, read as this one.
        expect(
            checkIsStudyTermLanguage(
                source,
                'By kindnesso the Wind liftedo the brasssnake.',
                TERMISH,
            ),
        ).toBe(false);
        // One used is too few to tell by.
        expect(
            checkIsStudyTermLanguage('By grace.', 'By favour.', TERMISH),
        ).toBe(false);
    });

    it("reads a translation's language off its own words, never its passages", () => {
        expect(
            readStudyPartsLanguage([
                {
                    kind: 'text',
                    text:
                        'And when they had heard it, they went away and ' +
                        'told the others what they had seen.',
                },
                { kind: 'diagram', text: 'graph TD\n    A --> B' },
            ]),
        ).toBe('en');
        expect(
            readStudyPartsLanguage([
                {
                    kind: 'passage',
                    text: '> **1** And when they had heard it, they went.',
                },
            ]),
        ).toBeNull();
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

describe('listStudyStrayWords', () => {
    // A language whose own script is one Unicode block, its words made by
    // code point: no word of any language is written here.
    const SCRIPTISH: StudyTranslateLanguageType = {
        ...TESTISH,
        name: 'Scriptish',
        scriptPattern: new RegExp(
            `[${String.fromCodePoint(0x1000)}-${String.fromCodePoint(0x109f)}]`,
            'u',
        ),
    };
    const ONE = String.fromCodePoint(0x1000, 0x1001, 0x1002);
    const TWO = String.fromCodePoint(0x1003, 0x1004);

    it('names an English word left between the script’s words', () => {
        // The user's John 3 study, its Khmer half: "and" after a bold
        // heading's colon, "between" and "and" inside a sentence.
        expect(
            listStudyStrayWords(`* **${ONE}**: and ${TWO}`, SCRIPTISH),
        ).toEqual(['and']);
        expect(
            listStudyStrayWords(
                `${ONE} between ${TWO}.\n${ONE}  and ${TWO}`,
                SCRIPTISH,
            ),
        ).toEqual(['between', 'and']);
        // Written into a word, and several words in a row.
        expect(listStudyStrayWords(`${ONE}le${TWO}`, SCRIPTISH)).toEqual([
            'le',
        ]);
        expect(listStudyStrayWords(`${ONE} in the ${TWO}`, SCRIPTISH)).toEqual([
            'in the',
        ]);
        expect(
            listStudyStrayWords(
                `${ONE} He must increase, but I must decrease ${TWO}`,
                SCRIPTISH,
            ),
        ).toEqual(['He must increase, but I must decrease']);
    });

    it('leaves a name, a key, a line’s end and what keeps its letters by right', () => {
        for (const line of [
            `${ONE} Nicodemus ${TWO}`,
            `${ONE} KJV ${TWO}`,
            `and ${ONE} ${TWO}`,
            `${ONE} ${TWO} and`,
            `${ONE} [^John 3:16] ${TWO}`,
            `${ONE} \`ol:Verse\` ${TWO}`,
            `[${ONE}](https://example.com/and/more) ${TWO}`,
            `${ONE} https://example.com/word ${TWO}`,
            `${ONE} *agape* ${TWO}`,
            `${ONE} "agape" ${TWO}`,
            `${ONE} 3:16 ${TWO}`,
        ]) {
            expect(listStudyStrayWords(line, SCRIPTISH)).toEqual([]);
        }
        // Into a language written in Latin letters, nothing can be told.
        expect(listStudyStrayWords('Wordo and wordo', TESTISH)).toEqual([]);
    });

    it('names each stretch once, eight at most, a long one cut', () => {
        const words = Array.from({ length: 10 }, (_, index) => {
            return `${ONE} word${'s'.repeat(index)} ${TWO}`;
        }).join('\n');
        expect(listStudyStrayWords(words, SCRIPTISH)).toHaveLength(8);
        expect(
            listStudyStrayWords(`${ONE} and ${TWO} and ${ONE}`, SCRIPTISH),
        ).toEqual(['and']);
        const long = 'and so on '.repeat(6).trim();
        expect(listStudyStrayWords(`${ONE} ${long} ${TWO}`, SCRIPTISH)).toEqual(
            [`${long.slice(0, 40).trim()}…`],
        );
    });

    it('is named in the ask for the part once more', () => {
        const ask = toStudyTextTranslationAsk(
            'Lifted up.',
            TESTISH,
            [],
            [],
            ['and', 'between'],
        );
        expect(ask).toContain(
            ' Your last translation left English words in it (and, ' +
                'between); translate them into Testish too.',
        );
        expect(ask.endsWith('nothing else.)')).toBe(true);
        expect(toStudyTextTranslationAsk('Lifted up.', TESTISH)).not.toContain(
            'left English words',
        );
    });
});

describe('a diagram’s ask', () => {
    it('names the words a reader sees for its kind', () => {
        // Told "the words after a colon", the translator had left a
        // timeline's periods and a mindmap's branches English (EC-533).
        const timeline = toStudyDiagramTranslationAsk(
            "timeline\n    title The Story\n    John's Ministry : Forerunner",
            TESTISH,
        );
        expect(timeline).toContain(
            'Translate every word a reader sees into Testish (Testo): the ' +
                'title, each section name, and every period and event: the ' +
                'words BEFORE each colon as well as after it. Keep',
        );
        expect(timeline).not.toContain('the words after a colon in a');
        expect(
            toStudyDiagramTranslationAsk(
                'mindmap\n  root((John 3))\n    Rebirth',
                TESTISH,
            ),
        ).toContain('every node: the words inside its brackets');
    });

    it('names the labels its last answer left, eight at most', () => {
        const left = Array.from({ length: 10 }, (_, index) => {
            return `Label ${index}`;
        });
        const ask = toStudyDiagramTranslationAsk(
            'graph TD\n    A["Love"] --> B["Gift"]',
            TESTISH,
            left,
        );
        expect(ask).toContain(
            ' Your last translation left these as they were; translate ' +
                'them too: "Label 0", "Label 1", "Label 2", "Label 3", ' +
                '"Label 4", "Label 5", "Label 6", "Label 7".',
        );
        expect(ask).not.toContain('"Label 8"');
        expect(
            ask.endsWith('Answer with the diagram alone, no ``` fence.)'),
        ).toBe(true);
        expect(
            toStudyDiagramTranslationAsk('graph TD\n    A["Love"]', TESTISH),
        ).not.toContain('Your last translation');
    });
});

describe('the books a part cites, in its ask (EC-534)', () => {
    // As `toStudyBookNamesText` writes it.
    const BOOK_TEXT =
        ' Write each book of the Bible as the Testish Bible names it: ' +
        'Numbers = Numbo.';

    it("is said after the church's words, in a part's ask and a diagram's", () => {
        const ask = toStudyTextTranslationAsk(
            'Lifted up: Numbers 21:9.',
            TESTISH,
            [],
            [],
            [],
            BOOK_TEXT,
        );
        expect(ask).toContain(`${BOOK_TEXT} Answer with the translation`);
        const diagramAsk = toStudyDiagramTranslationAsk(
            'graph TD\n    A["Numbers 21:9"]',
            TESTISH,
            [],
            BOOK_TEXT,
        );
        expect(diagramAsk).toContain(`${BOOK_TEXT} Answer with the diagram`);
    });

    it('is not said when there is none', () => {
        expect(
            toStudyTextTranslationAsk('Lifted up: Numbers 21:9.', TESTISH),
        ).not.toContain('Write each book');
        expect(
            toStudyDiagramTranslationAsk('graph TD\n    A["Love"]', TESTISH),
        ).not.toContain('Write each book');
    });
});

describe('the names a part uses, in its ask (EC-535)', () => {
    // As `toStudyNameVersesText` writes it.
    const NAME_TEXT =
        ' Write each name of a person or a place as the Testish Bible ' +
        'writes it in its verse: Zenon -- verse 23: "In Zenono."';

    it('is said after the books, in a part’s ask and a diagram’s', () => {
        const BOOK_TEXT = ' Write each book as named: Numbers = Numbo.';
        const ask = toStudyTextTranslationAsk(
            'Baptizing in Zenon: Numbers 21:9.',
            TESTISH,
            [],
            [],
            [],
            BOOK_TEXT,
            NAME_TEXT,
        );
        expect(ask).toContain(
            `${BOOK_TEXT}${NAME_TEXT} Answer with the translation`,
        );
        const diagramAsk = toStudyDiagramTranslationAsk(
            'graph TD\n    A["Zenon"]',
            TESTISH,
            [],
            '',
            NAME_TEXT,
        );
        expect(diagramAsk).toContain(`${NAME_TEXT} Answer with the diagram`);
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

    // EC-582: an arrow still naming the old id would draw a second box.
    it('refuses a sequence diagram whose participants changed their ids, and takes one with other names', () => {
        const dialogue =
            'sequenceDiagram\n    participant God as God\n    God->>Cain: Why?';
        expect(
            checkIsStudyDiagramTranslated(
                dialogue,
                'sequenceDiagram\n    participant God as Zarvenno\n    God->>Cain: Quellon?',
            ),
        ).toBe(true);
        expect(
            checkIsStudyDiagramTranslated(
                dialogue,
                'sequenceDiagram\n    participant Zarvenno as Zarvenno\n    God->>Cain: Quellon?',
            ),
        ).toBe(false);
        expect(
            checkIsStudyDiagramTranslated(
                dialogue,
                'sequenceDiagram\n    participant God as Zarvenno\n    God->>Tavu: Quellon?',
            ),
        ).toBe(false);
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

describe('a translation into a language the study already holds (EC-547)', () => {
    const OTHER = '---\n\n# Other Title\n\nOther words.\n';
    const SAME = '---\n\n# Same Title\n\nSame words.\n';
    const LAST = '***\n# Last Title\n\nLast words.';
    const ZZISH: StudyTranslateLanguageType = { ...TESTISH, code: 'zz' };
    // A made-up reader: a translation is in "zz" when its words say Same.
    const readMarked = (text: string) => {
        return text.includes('Same') ? 'zz' : null;
    };
    // The new translation, written much like SAME.
    const NEW_SAME = '# Same Title\n\nSame words, new.';

    it('finds the ones in the language, by their place', () => {
        const translations = `${OTHER}\n${SAME}\n${LAST}`;
        expect(
            findStudyTranslationsInLanguage(
                translations,
                ZZISH,
                NEW_SAME,
                readMarked,
            ),
        ).toEqual([1]);
        expect(
            findStudyTranslationsInLanguage(
                `${SAME}\n${OTHER}\n${SAME.trimEnd()}`,
                ZZISH,
                NEW_SAME,
                readMarked,
            ),
        ).toEqual([0, 2]);
        // No code to read it by, or nothing added after the study.
        expect(
            findStudyTranslationsInLanguage(
                translations,
                TESTISH,
                NEW_SAME,
                readMarked,
            ),
        ).toEqual([]);
        expect(
            findStudyTranslationsInLanguage('', ZZISH, NEW_SAME, readMarked),
        ).toEqual([]);
    });

    // The words of a language no package here names can read as one that
    // is -- the detector knows only the installed ones -- so a reader that
    // says every translation is in "zz".
    it('never takes one written unlike the new translation, whatever its words read as', () => {
        const readAll = () => {
            return 'zz';
        };
        const unlike =
            '---\n\n# Kavrut Nelvo\n\nDaskim mekrot tranvel privol.\n';
        expect(
            findStudyTranslationsInLanguage(
                `${unlike}\n${SAME}`,
                ZZISH,
                NEW_SAME,
                readAll,
            ),
        ).toEqual([1]);
        // Written alike, but for a letter it writes often that the new
        // translation never writes: one of another language's own.
        const otherLetter =
            '---\n\n# Same Title\n\nSame words, new. Jaj jaj.\n';
        expect(
            findStudyTranslationsInLanguage(
                otherLetter,
                ZZISH,
                NEW_SAME,
                readAll,
            ),
        ).toEqual([]);
        expect(
            findStudyTranslationsInLanguage(
                otherLetter,
                ZZISH,
                `${NEW_SAME} Jaj.`,
                readAll,
            ),
        ).toEqual([0]);
    });

    it('reads a translation by its own words, never a diagram or a passage', () => {
        const readList: string[] = [];
        const read = (text: string) => {
            readList.push(text);
            return readMarked(text);
        };
        const fence = '`'.repeat(3);
        const translation =
            '---\n\n# Other Title\n\n> **John 3:16** (XB)\n> **16** Same.\n\n' +
            `${fence}mermaid\ngraph TD\n    A["Same"]\n${fence}\n\nOther words.`;
        expect(
            findStudyTranslationsInLanguage(translation, ZZISH, NEW_SAME, read),
        ).toEqual([]);
        expect(readList).toHaveLength(1);
        expect(readList[0]).toContain('# Other Title');
        expect(readList[0]).toContain('Other words.');
        expect(readList[0]).not.toContain('Same');
    });

    // Every installed language, by its package: the words its `typed.json`
    // and `churchWords.json` hold, as a translation written in it would
    // hold them, a diagram in English beside them; the new translation the
    // same words in another order.
    const readPackageWords = (code: string) => {
        const dir = toLangPackageDir(code);
        const [typedCode, typed] = Object.entries(
            JSON.parse(readFileSync(path.join(dir, 'typed.json'), 'utf8')),
        )[0] as [string, { words?: string; nativeName?: string }];
        const churchPath = path.join(dir, 'churchWords.json');
        const church = existsSync(churchPath)
            ? Object.values(
                  JSON.parse(readFileSync(churchPath, 'utf8')).words ?? {},
              )
            : [];
        const words = `${typed.words ?? ''} ${church.join(' ')}`;
        const title = `# ${typed.nativeName ?? ''}`;
        return {
            typedCode,
            title,
            words,
            translated: `${title}\n\n${words.split(/\s+/).reverse().join(' ')}`,
        };
    };

    it('finds a translation in any installed language as that language', () => {
        const codeList = listLangPackageCodes({
            isEnglishIncluded: false,
            fileName: 'typed.json',
        });
        const fence = '`'.repeat(3);
        let checkedCount = 0;
        codeList.forEach((code, index) => {
            const { typedCode, title, words, translated } =
                readPackageWords(code);
            // Words too few to tell the language by are no test of this.
            if (
                toPackageLangCode(detectTypedLanguage(words, 'en') ?? '') !==
                code
            ) {
                return;
            }
            checkedCount += 1;
            const translation =
                `---\n\n${title}\n\n${words}\n\n` +
                `${fence}mermaid\n` +
                'flowchart TD\n    A["The words of a diagram"] --> ' +
                `B["are written in English"]\n${fence}\n`;
            const toLanguage = (one: string) => {
                return { ...TESTISH, code: one };
            };
            // By its folder's code and by the code its words go by.
            for (const one of [code, typedCode]) {
                expect(
                    findStudyTranslationsInLanguage(
                        `${translation}\n${OTHER}`,
                        toLanguage(one),
                        translated,
                    ),
                ).toEqual([0]);
            }
            const next = codeList[(index + 1) % codeList.length];
            if (next !== code) {
                const nextTranslated = readPackageWords(next).translated;
                expect(
                    findStudyTranslationsInLanguage(
                        translation,
                        toLanguage(next),
                        nextTranslated,
                    ),
                ).toEqual([]);
                // Read as the next language, as a window with only that
                // one installed may read it: written unlike its new
                // translation, it stays.
                expect(
                    findStudyTranslationsInLanguage(
                        translation,
                        toLanguage(next),
                        nextTranslated,
                        () => {
                            return toPackageLangCode(next);
                        },
                    ),
                ).toEqual([]);
            }
        });
        expect(checkedCount).toBeGreaterThanOrEqual(
            Math.floor(codeList.length / 2),
        );
    });

    const body = '# Newo Titleo\n\nNewo wordso.';
    const planWith = (translations: string) => {
        return { ...PLAN, bible: null, translations };
    };
    const original = PLAN.parts
        .map((part) => {
            return part.text;
        })
        .join('\n');

    it('added after the file: in the old one’s place, the others as they were', () => {
        expect(
            toStudyTranslateDraftArgs(
                planWith(`${OTHER}\n${SAME}\n${LAST}`),
                `\n${body}\n`,
                'append',
                ZZISH,
                [1],
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content:
                `${original}\n${OTHER}\n---\n\n${body}\n\n${LAST}\n` +
                PLAN.footer,
        });
        // Its own rule kept, last of all; a second copy taken out.
        expect(
            toStudyTranslateDraftArgs(
                planWith(`${SAME}\n${OTHER}\n${LAST}`),
                body,
                'append',
                ZZISH,
                [0, 2],
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content: `${original}\n---\n\n${body}\n\n${OTHER.trimEnd()}\n${PLAN.footer}`,
        });
        expect(
            toStudyTranslateDraftArgs(
                { ...planWith(LAST), bible: 'XB' },
                body,
                'append',
                ZZISH,
                [0],
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content: `${original}\n***\n${body}\n${PLAN.footer}`,
            bible: 'XB',
        });
    });

    it('in place of the study’s words: the ones in its language go', () => {
        expect(
            toStudyTranslateDraftArgs(
                planWith(`${OTHER}\n${SAME}`),
                body,
                'replace',
                ZZISH,
                [1],
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content: `${body}\n\n${OTHER.trim()}\n${PLAN.footer}`,
        });
        expect(
            toStudyTranslateDraftArgs(
                planWith(SAME),
                body,
                'replace',
                ZZISH,
                [0],
            ),
        ).toEqual({
            action: 'draft',
            file: PLAN.file,
            content: `${body}\n${PLAN.footer}`,
        });
    });

    it('tells the model which it takes the place of', () => {
        const counts = {
            body: '',
            diagramCount: 0,
            keptDiagramCount: 0,
            passageCount: 0,
            keptPassageCount: 0,
        };
        expect(
            describeStudyTranslation(
                planWith(SAME),
                counts,
                TESTISH,
                'append',
                'Gemma',
                1,
            ),
        ).toBe(
            `The window translated ${PLAN.name} into Testish part by part ` +
                'with Gemma, in place of its translation into Testish ' +
                'already added after it: never a second one. Only the study ' +
                'as it was written was translated.',
        );
        expect(
            describeStudyTranslation(
                planWith(`${SAME}\n${OTHER}\n${SAME.trimEnd()}`),
                counts,
                TESTISH,
                'append',
                'Gemma',
                2,
            ),
        ).toBe(
            `The window translated ${PLAN.name} into Testish part by part ` +
                'with Gemma, in place of its 2 translations into Testish ' +
                'already added after it: never a second one. Only the study ' +
                'as it was written was translated: the other translations ' +
                'added after it are kept as they are.',
        );
        expect(
            describeStudyTranslation(
                planWith(`${OTHER}\n${SAME}`),
                counts,
                TESTISH,
                'replace',
                'Gemma',
                1,
            ),
        ).toBe(
            `The window translated ${PLAN.name} into Testish part by part ` +
                'with Gemma, in place of its words. Those words being in ' +
                'Testish now, its translation into Testish already added ' +
                'after it is taken out. Only the study as it was written was ' +
                'translated: the other translations added after it are kept ' +
                'as they are.',
        );
    });
});

describe('a study in the language asked already (EC-589)', () => {
    // A language whose own script is one Unicode block, its words made by
    // code point: no word of any language is written here.
    const SCRIPTISH: StudyTranslateLanguageType = {
        ...TESTISH,
        name: 'Scriptish',
        scriptPattern: new RegExp(
            `[${String.fromCodePoint(0x1000)}-${String.fromCodePoint(0x109f)}]`,
            'u',
        ),
    };
    const ONE = String.fromCodePoint(0x1000, 0x1001, 0x1002);
    const TWO = String.fromCodePoint(0x1003, 0x1004);
    const THIRD = String.fromCodePoint(0x0e01);

    describe('checkIsStudyTextInLanguage', () => {
        it('keeps words whose every letter is the script’s, what is kept by right aside', () => {
            expect(
                checkIsStudyTextInLanguage(
                    `# ${ONE} ${TWO}\n\n${ONE}, ${TWO}.`,
                    SCRIPTISH,
                ),
            ).toBe(true);
            // Code, a link's address, a `[^…]` token, a tag, a web address.
            expect(
                checkIsStudyTextInLanguage(
                    `${ONE} \`code here\` [${TWO}](https://example.com/page) ` +
                        '[^John 3:16] <br> www.example.com',
                    SCRIPTISH,
                ),
            ).toBe(true);
            // A list's letter, and one word set apart as a term.
            expect(
                checkIsStudyTextInLanguage(
                    `a. ${ONE} _agape_ ${TWO} "logos" *word* 'kept'`,
                    SCRIPTISH,
                ),
            ).toBe(true);
        });

        it('asks words with English left in them, a name too, or a letter of a third script', () => {
            for (const words of [
                `${ONE} and ${TWO}`,
                `${ONE} Nicodemus ${TWO}`,
                `${ONE} (KJV)`,
                '## Cross References',
                // A phrase set apart is words left, not one term named.
                `${ONE} _born again_`,
                `${ONE}${THIRD}${TWO}`,
            ]) {
                expect(checkIsStudyTextInLanguage(words, SCRIPTISH)).toBe(
                    false,
                );
            }
        });

        it('keeps words with nothing to translate in any language, and asks any other into one written in Latin letters', () => {
            for (const language of [SCRIPTISH, TESTISH]) {
                expect(
                    checkIsStudyTextInLanguage('[^John 3:16]', language),
                ).toBe(true);
                expect(
                    checkIsStudyTextInLanguage('1. 2. 3. --', language),
                ).toBe(true);
            }
            expect(
                checkIsStudyTextInLanguage('Words of its own.', TESTISH),
            ).toBe(false);
            expect(checkIsStudyTextInLanguage(`${ONE} ${TWO}`, TESTISH)).toBe(
                false,
            );
        });
    });

    describe('checkIsStudyDiagramInLanguage', () => {
        const toBlock = (lines: string[]) => {
            return ['```mermaid', ...lines, '```'].join('\n');
        };

        it('keeps a diagram whose every label is in the script, a dialogue’s named boxes too', () => {
            expect(
                checkIsStudyDiagramInLanguage(
                    toBlock(['graph TD', `    A["${ONE}"] --> B["${TWO}"]`]),
                    SCRIPTISH,
                ),
            ).toBe(true);
            expect(
                checkIsStudyDiagramInLanguage(
                    toBlock([
                        'sequenceDiagram',
                        `    participant God as ${ONE}`,
                        `    participant Cain as ${TWO}`,
                        `    God->>Cain: "${ONE}?"`,
                    ]),
                    SCRIPTISH,
                ),
            ).toBe(true);
        });

        it('asks one with a label left, a box drawn by its id, a kind it cannot read, or any into Latin letters', () => {
            expect(
                checkIsStudyDiagramInLanguage(
                    toBlock(['graph TD', `    A["${ONE}"] --> B["Gift"]`]),
                    SCRIPTISH,
                ),
            ).toBe(false);
            // The user's Genesis 4 dialogue: its message in the script, its
            // boxes drawn by their English ids.
            expect(
                checkIsStudyDiagramInLanguage(
                    toBlock(['sequenceDiagram', `    God->>Cain: "${ONE}?"`]),
                    SCRIPTISH,
                ),
            ).toBe(false);
            expect(
                checkIsStudyDiagramInLanguage(
                    toBlock(['gantt', '    title Plan']),
                    SCRIPTISH,
                ),
            ).toBe(false);
            expect(
                checkIsStudyDiagramInLanguage(
                    toBlock(['graph TD', '    A["Love"] --> B["Gift"]']),
                    TESTISH,
                ),
            ).toBe(false);
        });
    });

    describe('checkIsStudyPassageInLanguage', () => {
        it('keeps a passage quoted in the script, its Bible’s key aside', () => {
            expect(
                checkIsStudyPassageInLanguage(
                    `> **${ONE} 3:16** (KJV)\n>\n> **16** ${TWO} ${ONE}.`,
                    SCRIPTISH,
                ),
            ).toBe(true);
        });

        it('quotes again one in English, and any into a language written in Latin letters', () => {
            expect(
                checkIsStudyPassageInLanguage(
                    '> **John 3:16** (KJV)\n>\n> **16** For God so loved.',
                    SCRIPTISH,
                ),
            ).toBe(false);
            expect(
                checkIsStudyPassageInLanguage(
                    `> **${ONE} 3:16** (KJV)\n>\n> **16** ${TWO}.`,
                    TESTISH,
                ),
            ).toBe(false);
        });
    });

    describe('words the translator gives back as they were', () => {
        it('are taken into a script when most of their letters are its own', () => {
            const words = `${ONE} ${TWO} (KJV) ${ONE} ${TWO} ${ONE}`;
            expect(
                checkIsStudyTextTranslated(words, `${words}\n`, SCRIPTISH),
            ).toBe(true);
            const english = 'For God so loved the world.';
            expect(
                checkIsStudyTextTranslated(english, english, SCRIPTISH),
            ).toBe(false);
        });

        it('are taken into a language written in Latin letters only when the reader names it too', () => {
            const LATINISH = { ...TESTISH, code: 'xq' };
            const words = 'Quellon prvquel zarvenno tavu.';
            expect(
                checkIsStudyTextTranslated(words, words, LATINISH, () => 'xq'),
            ).toBe(true);
            expect(
                checkIsStudyTextTranslated(words, words, LATINISH, () => 'en'),
            ).toBe(false);
            expect(
                checkIsStudyTextTranslated(words, words, LATINISH, () => null),
            ).toBe(false);
            // A language named with no code is never read so.
            expect(
                checkIsStudyTextTranslated(words, words, TESTISH, () => ''),
            ).toBe(false);
        });
    });

    describe('planStudyTranslateJobs', () => {
        it('asks only the paragraphs not in the language, the others kept in their places', () => {
            const words = [
                `# ${ONE}`,
                `${TWO} and ${ONE}.`,
                `${ONE} ${TWO}.`,
                'Left in English.',
                'Also in English.',
                '[^John 3:16]',
            ].join('\n\n');
            const { jobs, inLanguage } = planStudyTranslateJobs(
                {
                    parts: [
                        { kind: 'text', text: `\n${words}\n`, quoted: null },
                    ],
                },
                SCRIPTISH,
                1600,
            );
            expect(jobs).toEqual([
                {
                    index: 0,
                    kind: 'text',
                    chunks: [
                        `${TWO} and ${ONE}.`,
                        'Left in English.\n\nAlso in English.',
                    ],
                    pieces: [
                        { text: `# ${ONE}`, isKept: true },
                        { text: `${TWO} and ${ONE}.`, isKept: false },
                        { text: `${ONE} ${TWO}.`, isKept: true },
                        {
                            text: 'Left in English.\n\nAlso in English.',
                            isKept: false,
                        },
                        { text: '[^John 3:16]', isKept: true },
                    ],
                },
            ]);
            // The token's paragraph holds nothing to translate: kept, and
            // not counted as one in the language.
            expect(inLanguage.textCount).toBe(2);
            expect(joinStudyTextPieces(jobs[0].pieces, ['T1', 'T2'])).toBe(
                [`# ${ONE}`, 'T1', `${ONE} ${TWO}.`, 'T2', '[^John 3:16]'].join(
                    '\n\n',
                ),
            );
        });

        it('asks words with nothing in the language as before, cut as chunkStudyText cuts them', () => {
            const words = `One.\n\nTwo two.\n\n${'Three words here. '.repeat(120)}`;
            const { jobs, inLanguage } = planStudyTranslateJobs(
                { parts: [{ kind: 'text', text: words, quoted: null }] },
                SCRIPTISH,
                1600,
            );
            expect(jobs[0].chunks).toEqual(chunkStudyText(words, 1600));
            expect(jobs[0].chunks.length).toBeGreaterThan(1);
            expect(
                jobs[0].pieces.every((piece) => {
                    return !piece.isKept;
                }),
            ).toBe(true);
            expect(inLanguage.textCount).toBe(0);
        });

        it('keeps a part, a diagram and a passage in the language unasked, and gives a dialogue its names', () => {
            const plan = {
                parts: [
                    { kind: 'text' as const, text: `# ${ONE}\n`, quoted: null },
                    {
                        kind: 'passage' as const,
                        text: `> **${ONE} 4:8** (KJV)\n>\n> **8** ${TWO}.`,
                        quoted: '> quoted again',
                    },
                    {
                        kind: 'diagram' as const,
                        text: `\`\`\`mermaid\ngraph TD\n    A["${ONE}"] --> B["${TWO}"]\n\`\`\``,
                        quoted: null,
                    },
                    {
                        kind: 'diagram' as const,
                        text: `\`\`\`mermaid\nsequenceDiagram\n    God->>Cain: "${ONE}?"\n\`\`\``,
                        quoted: null,
                    },
                    {
                        kind: 'passage' as const,
                        text: '> **John 3:16** (KJV)\n>\n> **16** For God so loved.',
                        quoted: '> quoted again',
                    },
                    { kind: 'keep' as const, text: '---', quoted: null },
                ],
            };
            const { jobs, inLanguage } = planStudyTranslateJobs(
                plan,
                SCRIPTISH,
                1600,
            );
            expect(jobs).toEqual([
                {
                    index: 3,
                    kind: 'diagram',
                    chunks: [
                        [
                            'sequenceDiagram',
                            '    participant God as God',
                            '    participant Cain as Cain',
                            `    God->>Cain: "${ONE}?"`,
                        ].join('\n'),
                    ],
                    pieces: [],
                },
            ]);
            expect(inLanguage).toEqual({
                textCount: 1,
                diagramIndexes: [2],
                passageIndexes: [1],
            });
            // Into a language written in Latin letters, all of it is asked.
            const latin = planStudyTranslateJobs(plan, TESTISH, 1600);
            expect(
                latin.jobs.map((job) => {
                    return job.index;
                }),
            ).toEqual([0, 2, 3]);
            expect(latin.inLanguage).toEqual({
                textCount: 0,
                diagramIndexes: [],
                passageIndexes: [],
            });
        });
    });

    describe('assembleStudyTranslation', () => {
        it('puts a diagram and a passage in the language back as they were, counted apart', () => {
            const inLanguage = {
                textCount: 1,
                diagramIndexes: [3],
                passageIndexes: [1],
            };
            const result = assembleStudyTranslation(
                PLAN,
                new Map([[2, '## Le Cadre\nMots.']]),
                new Map(),
                inLanguage,
            );
            expect(result.body).toBe(
                [
                    '# The New Birth',
                    '',
                    '> **John 3:1** (KJV)',
                    '>',
                    '> **1** There was a man.',
                    '',
                    '## Le Cadre',
                    'Mots.',
                    '',
                    '```mermaid',
                    'graph TD',
                    '    A["Love"] --> B["Gift"]',
                    '```',
                    '',
                    '---',
                ].join('\n'),
            );
            expect(result).toMatchObject({
                diagramCount: 1,
                keptDiagramCount: 0,
                inLanguageDiagramCount: 1,
                passageCount: 1,
                keptPassageCount: 0,
                inLanguagePassageCount: 1,
                inLanguageTextCount: 1,
            });
            // Nothing asked: the study as it was written.
            expect(
                assembleStudyTranslation(PLAN, new Map(), new Map(), inLanguage)
                    .body,
            ).toBe(toStudyOriginalBody(PLAN));
        });
    });

    describe('what the model is told', () => {
        const counts = {
            body: '',
            diagramCount: 4,
            keptDiagramCount: 0,
            passageCount: 1,
            keptPassageCount: 0,
        };

        it('names what was in the language already, kept as it was', () => {
            expect(
                describeStudyTranslation(
                    PLAN,
                    {
                        ...counts,
                        inLanguageTextCount: 12,
                        inLanguageDiagramCount: 3,
                        inLanguagePassageCount: 1,
                    },
                    SCRIPTISH,
                    'replace',
                    'Gemma',
                ),
            ).toBe(
                `The window translated what of ${PLAN.name} was not in ` +
                    'Scriptish yet part by part with Gemma, in place of its ' +
                    'words. 12 paragraph(s) of its words, 3 diagram(s) and 1 ' +
                    'Bible passage(s) were in Scriptish already, so are kept ' +
                    'as they were. 1 of its 4 diagrams are translated.',
            );
            expect(
                describeStudyTranslation(
                    PLAN,
                    {
                        ...counts,
                        keptDiagramCount: 1,
                        passageCount: 2,
                        inLanguageTextCount: 2,
                        inLanguagePassageCount: 1,
                    },
                    SCRIPTISH,
                    'new',
                    'Gemma',
                ),
            ).toBe(
                `The window translated what of ${PLAN.name} was not in ` +
                    'Scriptish yet part by part with Gemma, as a copy of its ' +
                    'own. 2 paragraph(s) of its words and 1 Bible passage(s) ' +
                    'were in Scriptish already, so are kept as they were. 3 ' +
                    'of its 4 diagrams are translated; 1 kept as they were, ' +
                    'since their translation would not draw or left their ' +
                    'words untranslated. Its other Bible passages are quoted ' +
                    'from XB.',
            );
        });

        it('says nothing was drafted when it came out as it was', () => {
            expect(
                describeStudyNothingTranslated(
                    PLAN,
                    { ...counts, inLanguageDiagramCount: 4 },
                    SCRIPTISH,
                ),
            ).toBe(
                `Nothing was translated: every part of ${PLAN.name} is in ` +
                    'Scriptish already, so nothing was drafted. Tell them so ' +
                    'in a sentence -- never that it was translated or changed.',
            );
            expect(
                describeStudyNothingTranslated(
                    { ...PLAN, bible: null },
                    { ...counts, keptDiagramCount: 1, keptPassageCount: 1 },
                    SCRIPTISH,
                ),
            ).toBe(
                `Nothing was translated: of ${PLAN.name}, what is not in ` +
                    'Scriptish yet -- 1 diagram(s), whose translation would ' +
                    'not draw or left their words untranslated; 1 Bible ' +
                    'passage(s), with no Scriptish Bible installed to quote ' +
                    'them -- is kept as it was, and the rest is in Scriptish ' +
                    'already. Nothing was drafted. Tell them so in a sentence ' +
                    'and offer to try again -- never that it was translated ' +
                    'or changed.',
            );
        });

        it('refuses a translation added after words in the language already', () => {
            expect(genStudyAppendInLanguageRefusal(PLAN, SCRIPTISH)).toBe(
                `Tool refused: The words of ${PLAN.name} are in Scriptish ` +
                    'already, so a translation added after it would be the ' +
                    'study again. Nothing was drafted. Tell them so in a ' +
                    'sentence, and offer to put what is not in Scriptish yet ' +
                    'into it in its place (place "replace").',
            );
        });
    });
});
