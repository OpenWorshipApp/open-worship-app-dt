import { describe, expect, it, vi } from 'vitest';

import {
    checkIsEnglishAnswer,
    checkIsEnglishEcho,
    checkIsLanguageNativeModel,
    findPageLanguage,
    findTranslatedLanguage,
    genAskTranslation,
    readAnswerTranslation,
    readQuestionTranslation,
    type TranslatorType,
} from './chatTranslateHelpers';
import { listAssistantLanguages } from './chatLangHelpers';

// Every language package but English: a language with data, whichever are
// installed (each one's own words are its package's tests).
const OTHER_LANGUAGE_LIST = listAssistantLanguages().filter((language) => {
    return language.code !== 'en';
});
const GEMMA: TranslatorType = {
    provider: 'custom',
    model: 'mac-super/gemma-4-12b',
    label: 'mac-super · gemma-4-12b',
};

describe('which models are handed the language itself', () => {
    it('is the Gemma 4 family, however its name is written', () => {
        for (const name of [
            'gemma-4-12b',
            'google/gemma-4-e4b',
            'gemma4:e4b',
            'mac-super/gemma-4-12b Gemma 4 12B',
        ]) {
            expect(checkIsLanguageNativeModel(name), name).toBe(true);
        }
        for (const name of [
            'gemma-3-27b',
            'nvidia/nemotron-3.5-super-vl:free',
            'claude-sonnet-5',
            'qwen3.5-9b',
        ]) {
            expect(checkIsLanguageNativeModel(name), name).toBe(false);
        }
    });
});

describe('findTranslatedLanguage', () => {
    it('works a language with data in English for any other model', () => {
        for (const { code } of OTHER_LANGUAGE_LIST) {
            expect(findTranslatedLanguage(code, 'nemotron-super')?.code).toBe(
                code,
            );
            expect(findTranslatedLanguage(code, 'claude-sonnet-5')?.code).toBe(
                code,
            );
        }
    });

    it('leaves English, an unknown script and a Gemma 4 model alone', () => {
        expect(findTranslatedLanguage('en', 'nemotron-super')).toBeNull();
        expect(findTranslatedLanguage('other', 'nemotron-super')).toBeNull();
        for (const { code } of OTHER_LANGUAGE_LIST) {
            expect(findTranslatedLanguage(code, 'gemma-4-e4b')).toBeNull();
        }
        expect(findTranslatedLanguage('xx', 'nemotron-super')).toBeNull();
    });
});

describe('findPageLanguage', () => {
    it('reads the guide in a language with data, English for the rest', () => {
        for (const { code } of OTHER_LANGUAGE_LIST) {
            expect(findPageLanguage(code)).toBe(code);
        }
        expect(findPageLanguage('en')).toBeNull();
        expect(findPageLanguage('other')).toBeNull();
        expect(findPageLanguage('xx')).toBeNull();
        expect(findPageLanguage(undefined)).toBeNull();
    });
});

describe('readQuestionTranslation', () => {
    it('takes the English off a label, a fence or quotes', () => {
        expect(readQuestionTranslation('English: How do I show a verse?')).toBe(
            'How do I show a verse?',
        );
        expect(readQuestionTranslation('"How do I show a verse?"')).toBe(
            'How do I show a verse?',
        );
        expect(
            readQuestionTranslation('```\nHow do I show a verse?\n```'),
        ).toBe('How do I show a verse?');
    });
});

describe('readAnswerTranslation', () => {
    it('refuses the English handed back, or nothing at all', () => {
        for (const language of OTHER_LANGUAGE_LIST) {
            expect(
                readAnswerTranslation(
                    'Press **Show**.',
                    'Press **Show**.',
                    language,
                ),
            ).toBeNull();
            expect(
                readAnswerTranslation('  ', 'Press **Show**.', language),
            ).toBeNull();
        }
    });
});

// BN-48 (2026-11-09): the English handed back with a word changed is no
// translation, and an answer that came back in English when another
// language was asked for is put into it after the fact.
describe('an answer still in English', () => {
    const ENGLISH =
        'Done: block 1 is now bold. It is not saved yet, and **Undo this ' +
        'change** puts it back.';

    it('a translation that is the English near enough is none', () => {
        expect(
            checkIsEnglishEcho(
                'Done: block 1 is bold now. It is not saved yet, and ' +
                    '**Undo this change** puts it back.',
                ENGLISH,
            ),
        ).toBe(true);
        // Words of another language with the button name kept: a translation.
        expect(
            checkIsEnglishEcho(
                'Zork blip 1 wug fep. Nib wug zap blorp, **Undo this ' +
                    'change** zeb dax.',
                ENGLISH,
            ),
        ).toBe(false);
        for (const language of OTHER_LANGUAGE_LIST) {
            expect(
                readAnswerTranslation(
                    'Done: block 1 is bold now. It is not saved yet, and ' +
                        '**Undo this change** puts it back.',
                    ENGLISH,
                    language,
                ),
            ).toBeNull();
        }
    });

    it('is an English answer to another language, given enough words', () => {
        expect(checkIsEnglishAnswer(ENGLISH, 'xx')).toBe(true);
        expect(checkIsEnglishAnswer(ENGLISH, 'en')).toBe(false);
        expect(checkIsEnglishAnswer(ENGLISH, 'other')).toBe(false);
        expect(checkIsEnglishAnswer('Done.', 'xx')).toBe(false);
    });

    it('a language with data and a translator gets a late plan', async () => {
        for (const { code } of OTHER_LANGUAGE_LIST) {
            const asking = genAskTranslation({
                replyLang: code,
                words: 'x',
                findTranslator: async () => GEMMA,
                translate: vi.fn(),
            });
            const late = await asking.planForEnglishAnswer();
            expect(late?.language.code).toBe(code);
            expect(late?.translator).toBe(GEMMA);
        }
        for (const replyLang of ['en', 'other']) {
            const asking = genAskTranslation({
                replyLang,
                words: 'x',
                findTranslator: async () => GEMMA,
                translate: vi.fn(),
            });
            expect(await asking.planForEnglishAnswer()).toBeNull();
        }
        const noTranslator = genAskTranslation({
            replyLang: OTHER_LANGUAGE_LIST[0]?.code ?? 'xx',
            words: 'x',
            findTranslator: async () => null,
            translate: vi.fn(),
        });
        expect(await noTranslator.planForEnglishAnswer()).toBeNull();
    });
});

describe('genAskTranslation', () => {
    function genTranslate(map: Record<'question' | 'answer', string>) {
        return vi.fn(
            async (
                _ask: string,
                _translator: TranslatorType,
                kind: 'question' | 'answer' | 'replies',
            ) => {
                return kind === 'replies' ? '' : map[kind];
            },
        );
    }

    it('sends words that are English already as they are', async () => {
        for (const { code } of OTHER_LANGUAGE_LIST) {
            const translate = genTranslate({ question: 'x', answer: 'y' });
            const asking = genAskTranslation({
                replyLang: code,
                words: 'How do I show a verse?',
                findTranslator: async () => GEMMA,
                translate,
            });
            expect((await asking.planFor('nemotron-super'))?.english).toBe(
                'How do I show a verse?',
            );
            expect(translate).not.toHaveBeenCalled();
        }
    });
});
