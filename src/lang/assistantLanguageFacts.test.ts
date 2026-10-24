import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { extractLangMeta } from '../../tools/owa-devtools-mcp/tran.mjs';

// Every interface language carries `assistant.json`: what the help window
// needs to know to be asked and to answer in it (`src/chatbot/
// chatLangHelpers.ts`, `tools/owa-devtools-mcp/tran.mjs`). A language is
// added by adding its folder, so the folder has to be complete.

const DATA_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'data',
);

const LANG_CODE_LIST = readdirSync(DATA_DIR).filter((name) => {
    const dirPath = path.join(DATA_DIR, name);
    return (
        statSync(dirPath).isDirectory() &&
        existsSync(path.join(dirPath, 'index.ts'))
    );
});

function readFacts(langCode: string) {
    const text = readFileSync(
        path.join(DATA_DIR, langCode, 'assistant.json'),
        'utf-8',
    );
    return { text, facts: JSON.parse(text) };
}

describe('assistant.json beside every language package', () => {
    test('the packages are found, so a green run means something', () => {
        expect(LANG_CODE_LIST).toEqual(
            expect.arrayContaining(['en', 'km', 'fr']),
        );
    });

    test.each(LANG_CODE_LIST)('%s carries one', (langCode) => {
        expect(
            existsSync(path.join(DATA_DIR, langCode, 'assistant.json')),
        ).toBe(true);
    });

    test.each(LANG_CODE_LIST)(
        '%s names itself as its package does',
        (langCode) => {
            const meta = extractLangMeta(
                readFileSync(
                    path.join(DATA_DIR, langCode, 'index.ts'),
                    'utf-8',
                ),
            );
            const { facts } = readFacts(langCode);
            expect(facts.name).toBe(meta.name);
            expect(facts.nativeName).toBe(meta.nativeName);
        },
    );

    test.each(LANG_CODE_LIST)('%s is well formed', (langCode) => {
        const { text, facts } = readFacts(langCode);
        expect(() => new RegExp(facts.scriptPattern, 'u')).not.toThrow();
        for (const field of [
            'functionWords',
            'yesWords',
            'noWords',
            'yesNoQuestionLeads',
            'yesNoQuestionEndings',
            'walkthroughEchoWords',
        ]) {
            if (facts[field] !== undefined) {
                expect(Array.isArray(facts[field]), field).toBe(true);
            }
        }
        if (facts.nativeDigits !== undefined) {
            expect([...facts.nativeDigits]).toHaveLength(10);
        }
        // A pattern that does not compile is dropped in silence by the
        // window (`toPatternList`): held here instead. Each must say where
        // the remembered words are.
        for (const field of ['verseFindAsks', 'verseAsks']) {
            for (const source of facts[field] ?? []) {
                expect(() => new RegExp(source, 'u'), source).not.toThrow();
                expect(source, field).toContain('(?<words>');
            }
        }
        for (const word of facts.verseAskExcludeWords ?? []) {
            expect(typeof word === 'string' && word.length > 0).toBe(true);
        }
        // What a word means is ENGLISH search words (or nothing, for a word
        // that only holds a question together).
        for (const [word, meaning] of Object.entries(facts.glossary ?? {})) {
            expect(meaning, word).toMatch(/^[a-z ]*$/);
        }
        // A church word by its ENGLISH, said in the language: never empty,
        // and never the English handed back.
        for (const [english, word] of Object.entries(
            facts.translationTerms ?? {},
        )) {
            expect(english).toMatch(/^[A-Za-z][A-Za-z ]*$/);
            expect(typeof word === 'string' && word.trim().length > 0).toBe(
                true,
            );
        }
        // JSON.parse keeps the LAST of two equal keys without a word, so a
        // word written twice is found in the text.
        const keyList = [...text.matchAll(/^\s+"([^"]+)":/gm)].map((match) => {
            return match[1];
        });
        const glossaryStart = text.indexOf('"glossary"');
        const glossaryKeyList = [
            ...text.slice(glossaryStart).matchAll(/^\s+"([^"]+)":/gm),
        ]
            .map((match) => {
                return match[1];
            })
            .slice(1);
        expect(keyList.length).toBeGreaterThan(0);
        expect(new Set(glossaryKeyList).size).toBe(glossaryKeyList.length);
    });

    // The package's own test of a Khmer word is the one the app trusts
    // everywhere else; the help window must agree with it.
    test('Khmer reads its script as the package does', () => {
        const { facts } = readFacts('km');
        const packText = readFileSync(
            path.join(DATA_DIR, 'km', 'index.ts'),
            'utf-8',
        );
        expect(packText).toContain('/[\\u1780-\\u17FF]/u.test(text)');
        const pattern = new RegExp(facts.scriptPattern, 'u');
        for (const sample of ['ក', 'ព្រះគម្ពីរ', '៣', '៿']) {
            expect(pattern.test(sample), sample).toBe(true);
        }
        expect(pattern.test('Bible')).toBe(false);
    });
});
