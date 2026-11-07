import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

// `assistant.json` is what the help window needs to know to be asked and to
// answer in a language (`src/chatbot/chatLangHelpers.ts`,
// `tools/owa-devtools-mcp/tran.mjs`): English always carries one, and every
// language that does is held to the same shape. A language without one is
// answered through English's words (`chatLangHelpers.ts`).

const LANG_CODE_LIST = listLangPackageCodes({ fileName: 'assistant.json' });

function readFacts(langCode: string) {
    const text = readFileSync(
        path.join(toLangPackageDir(langCode), 'assistant.json'),
        'utf-8',
    );
    return { text, facts: JSON.parse(text) };
}

describe('assistant.json beside every language package', () => {
    test('the packages are found, so a green run means something', () => {
        // English is the one package that is always there.
        expect(LANG_CODE_LIST).toContain('en');
        expect(
            existsSync(path.join(toLangPackageDir('en'), 'assistant.json')),
        ).toBe(true);
    });

    test.each(LANG_CODE_LIST)(
        '%s names itself as its manifest does',
        (langCode) => {
            const meta = JSON.parse(
                readFileSync(
                    path.join(toLangPackageDir(langCode), 'meta.json'),
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
        // A how-do-I pattern is read case as written (`toPatternList`).
        for (const source of facts.bibleReaderWords?.howToAsks ?? []) {
            expect(() => new RegExp(source, 'u'), source).not.toThrow();
        }
        // An app word the language's Bibles use too counts in a how-do-I
        // only, one their Bibles do not use counts anywhere: never both, or
        // the word counts anywhere after all (2026-10-29).
        const excludeList: string[] = facts.bibleReaderWords?.exclude ?? [];
        for (const word of facts.bibleReaderWords?.excludeInHowTo ?? []) {
            expect(excludeList, word).not.toContain(word);
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
});
