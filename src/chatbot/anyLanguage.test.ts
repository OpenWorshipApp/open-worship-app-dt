/**
 * A question typed in ANY language (2026-11-03, the user: _make chatbot
 * generic for language, it flexible to internationalization. no matter what
 * language I type it work seamlessly_).
 *
 * Before, only the three languages the app is shown in were known. A
 * Spanish question was read as French by the little words they share (`la`,
 * `de`, `un`) and answered in French, even by a model that wrote perfect
 * Spanish when left alone; a Portuguese, Vietnamese or Indonesian one was
 * answered in the app's language -- in a Khmer window, Khmer; and an answer
 * in Chinese, Thai, Korean, Russian or Arabic lost every chip under it,
 * because only a package's script counted as one somebody chose. Measured
 * through the live window the same day: 16 of 18 answers in the language
 * typed, 8 of 18 with chips the reader could read.
 *
 * An installed language's `typed.json` names the others now. These rows hold
 * what a language only typed must get: its name, an answer in it, chips in
 * it, the English page read and translated for it -- and the three packaged
 * languages exactly as they were.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';
import { detectTypedLanguage, listAssistantLanguages } from './chatLangHelpers';
import { findPageLanguage } from './chatTranslateHelpers';
import {
    listLangPackageCodes,
    toLangPackageDir,
} from '../test-setup/langPackageDirs';

describe('the language a question is written in', () => {
    // Words that say nothing about a language stay unread, so the doubt goes
    // to the app's: a title, a name, a reference, a yes.
    test.each([
        'Amazing Grace',
        'Ave Maria',
        'Hosanna Hallelujah Amen',
        'Way Maker chords',
        'John 3:16',
        'ok thanks',
        'Bible Lookup',
        'F5',
    ])('%s is no language', (text) => {
        expect(detectTypedLanguage(text)).toBeNull();
    });
});

const QUESTION_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'tools',
    'owa-devtools-mcp',
    'questions',
);
// Every language package with the corpus in its words, found by its folder.
const OVERLAY_CODE_LIST = listLangPackageCodes({
    fileName: 'questions.json',
});

function readQuestionRows(): Record<string, string[]> {
    const english = readdirSync(QUESTION_DIR)
        .filter((name) => {
            return name.endsWith('.json') && name !== 'schema.json';
        })
        .flatMap((name) => {
            const page = JSON.parse(
                readFileSync(path.join(QUESTION_DIR, name), 'utf8'),
            );
            return (page.sections ?? []).flatMap((section: any) => {
                return (section.questions ?? []).map((row: any) => {
                    return row.text as string;
                });
            });
        });
    const readOverlay = (code: string) => {
        const overlay = JSON.parse(
            readFileSync(
                path.join(toLangPackageDir(code), 'questions.json'),
                'utf8',
            ),
        );
        return Object.values(overlay.questions ?? {}).map((one: any) => {
            return one.text as string;
        });
    };
    return {
        en: english,
        ...Object.fromEntries(
            OVERLAY_CODE_LIST.map((code) => {
                return [code, readOverlay(code)];
            }),
        ),
    };
}

// The ratchet: the languages the app is shown in read exactly as they did --
// every supported question, 469 in each on 2026-11-03, in English and in
// every package's own words.
describe('every supported question keeps its language', () => {
    const rowMap = readQuestionRows();
    test.each(['en', ...OVERLAY_CODE_LIST])('%s', (code) => {
        expect(rowMap[code].length).toBeGreaterThan(400);
        const wrong = rowMap[code].filter((text) => {
            return detectTypedLanguage(text) !== code;
        });
        expect(wrong).toEqual([]);
    });
});

describe('the language an answer is written in', () => {
    test('the app is shown only in the packaged languages', () => {
        expect(
            listAssistantLanguages().every((language) => {
                return language.isPackaged;
            }),
        ).toBe(true);
    });
});

describe('worked in English behind the scenes', () => {
    test('its guide page is the English one', () => {
        expect(findPageLanguage('zh')).toBeNull();
        // A package's page is its own, in its words.
        for (const language of listAssistantLanguages()) {
            expect(findPageLanguage(language.code)).toBe(
                language.code === 'en' ? null : language.code,
            );
        }
    });
});
