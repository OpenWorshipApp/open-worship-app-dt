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
    readStudyTranslatePlace,
    readStudyTranslatePlan,
    resolveStudyTranslateLanguage,
    splitEdgeLines,
    toStudyDiagramTranslationAsk,
    toStudyTermsText,
    toStudyTextTranslationAsk,
    toStudyTranslateDraftArgs,
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
            footer: PLAN.footer,
        });
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
        ).toBe('## Linked Verses\nSee theseo.\n\n### the Breath\nHe giveso.');
    });

    it('reads a heading through bold, closing marks and any case', () => {
        expect(
            applyStudyHeadingTerms(
                '# **CROSS REFERENCES** #\n\n## Grace.',
                '# **Krossos** #\n\n## Graceo.',
                TERMISH,
            ),
        ).toBe('# Linked Verses\n\n## favour');
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
});
