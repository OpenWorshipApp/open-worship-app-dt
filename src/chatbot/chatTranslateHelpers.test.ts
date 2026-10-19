import { describe, expect, it, vi } from 'vitest';

import {
    checkIsLanguageNativeModel,
    findPageLanguage,
    findTranslatedLanguage,
    genAskTranslation,
    listUsedTerms,
    readAnswerTranslation,
    readQuestionTranslation,
    toAnswerTranslationAsk,
    toBoldLabelsShown,
    toQuestionTranslationAsk,
    type TranslatorType,
} from './chatTranslateHelpers';
import { getAssistantLanguage } from './chatLangHelpers';

const KHMER = getAssistantLanguage('km');
const FRENCH = getAssistantLanguage('fr');
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
        expect(findTranslatedLanguage('km', 'nemotron-super')?.code).toBe('km');
        expect(findTranslatedLanguage('fr', 'claude-sonnet-5')?.code).toBe(
            'fr',
        );
    });

    it('leaves English, an unknown script and a Gemma 4 model alone', () => {
        expect(findTranslatedLanguage('en', 'nemotron-super')).toBeNull();
        expect(findTranslatedLanguage('other', 'nemotron-super')).toBeNull();
        expect(findTranslatedLanguage('km', 'gemma-4-e4b')).toBeNull();
        expect(findTranslatedLanguage('xx', 'nemotron-super')).toBeNull();
    });
});

describe('findPageLanguage', () => {
    it('reads the guide in a language with data, English for the rest', () => {
        expect(findPageLanguage('km')).toBe('km');
        expect(findPageLanguage('fr')).toBe('fr');
        expect(findPageLanguage('en')).toBeNull();
        expect(findPageLanguage('other')).toBeNull();
        expect(findPageLanguage('xx')).toBeNull();
        expect(findPageLanguage(undefined)).toBeNull();
    });
});

describe('the translator asks', () => {
    it('put the words first and say which way, in no language but data', () => {
        const ask = toQuestionTranslationAsk(
            ' តើខ្ញុំបង្ហាញខគម្ពីរយ៉ាងដូចម្តេច? ',
            KHMER,
        );
        expect(ask.startsWith('តើខ្ញុំបង្ហាញខគម្ពីរយ៉ាងដូចម្តេច?\n\n')).toBe(
            true,
        );
        expect(ask).toContain('from Khmer into English');
        const answerAsk = toAnswerTranslationAsk('Press **Show**.', FRENCH);
        expect(answerAsk).toContain('into French (Français)');
        expect(answerAsk).toContain('keep OPTIONS:');
    });
});

describe("the church's own words", () => {
    it('are named only when the text uses them, from the language data', () => {
        expect(
            listUsedTerms('The Old Testament has 39 books.', KHMER, 'english'),
        ).toEqual(['Old Testament = គម្ពីរសញ្ញាចាស់']);
        expect(listUsedTerms('Press **Show**.', KHMER, 'english')).toEqual([]);
        expect(
            toAnswerTranslationAsk('Read the New Testament.', KHMER),
        ).toContain('New Testament = គម្ពីរសញ្ញាថ្មី');
    });

    it('reads a short word of a spaceless script only where it stands alone', () => {
        // "ព្រះ" (God) is inside "ព្រះគម្ពីរ" (Bible): not a second word.
        expect(
            listUsedTerms('តើព្រះគម្ពីរមានប៉ុន្មាន?', KHMER, 'language'),
        ).toEqual(['ព្រះគម្ពីរ = Bible']);
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

    it('is no translation when nothing English came back', () => {
        expect(readQuestionTranslation('')).toBeNull();
        expect(readQuestionTranslation('តើខ្ញុំបង្ហាញខគម្ពីរ')).toBeNull();
    });
});

describe('readAnswerTranslation', () => {
    it('keeps an answer in the language', () => {
        expect(
            readAnswerTranslation('ចុច **បង្ហាញ**។', 'Press **Show**.', KHMER),
        ).toBe('ចុច **បង្ហាញ**។');
    });

    it("takes out a model's control token, seen inside a Khmer word", () => {
        expect(
            readAnswerTranslation(
                'មានតែ ៦៦ គ<audio|>ម្ពីរ<|im_end|>',
                'Only 66 books.',
                KHMER,
            ),
        ).toBe('មានតែ ៦៦ គម្ពីរ');
    });

    it('refuses the English handed back, or no letter of the script', () => {
        expect(
            readAnswerTranslation('Press **Show**.', 'Press **Show**.', KHMER),
        ).toBeNull();
        expect(
            readAnswerTranslation('Press Show now.', 'Press **Show**.', KHMER),
        ).toBeNull();
        expect(
            readAnswerTranslation('  ', 'Press **Show**.', FRENCH),
        ).toBeNull();
        expect(
            readAnswerTranslation(
                'Appuyez sur **Afficher**.',
                'Press **Show**.',
                FRENCH,
            ),
        ).toBe('Appuyez sur **Afficher**.');
    });
});

describe('toBoldLabelsShown', () => {
    it('writes an English button name in the words the screen shows', () => {
        const translateLabel = (label: string) => {
            return label === 'Clear All' ? 'សម្អាតទាំងអស់' : label;
        };
        expect(
            toBoldLabelsShown(
                'Press **Clear All**, then **Done**. **បង្ហាញ** stays.',
                translateLabel,
            ),
        ).toBe('Press **សម្អាតទាំងអស់**, then **Done**. **បង្ហាញ** stays.');
    });
});

describe('genAskTranslation', () => {
    function genTranslate(map: Record<'question' | 'answer', string>) {
        return vi.fn(
            async (
                _ask: string,
                _translator: TranslatorType,
                kind: 'question' | 'answer',
            ) => {
                return map[kind];
            },
        );
    }

    it('asks a Gemma 4 model directly, with no translator looked for', async () => {
        const findTranslator = vi.fn(async () => GEMMA);
        const translate = genTranslate({ question: 'x', answer: 'y' });
        const asking = genAskTranslation({
            replyLang: 'km',
            words: 'តើខ្ញុំបង្ហាញខគម្ពីរ',
            findTranslator,
            translate,
        });
        expect(await asking.planFor('gemma-4-12b')).toBeNull();
        expect(findTranslator).not.toHaveBeenCalled();
        expect(translate).not.toHaveBeenCalled();
    });

    it('translates their words ONCE for every assistant tried', async () => {
        const translate = genTranslate({
            question: 'How do I show a verse?',
            answer: 'ចុច **បង្ហាញ**។',
        });
        const findTranslator = vi.fn(async () => GEMMA);
        const asking = genAskTranslation({
            replyLang: 'km',
            words: 'តើខ្ញុំបង្ហាញខគម្ពីរយ៉ាងដូចម្តេច',
            findTranslator,
            translate,
        });
        const first = await asking.planFor('nemotron-super');
        const second = await asking.planFor('qwen3.5-9b');
        expect(first?.english).toBe('How do I show a verse?');
        expect(second?.english).toBe('How do I show a verse?');
        expect(first?.translator).toBe(GEMMA);
        expect(findTranslator).toHaveBeenCalledTimes(1);
        expect(translate).toHaveBeenCalledTimes(1);
        const shown = await asking.translateAnswer(
            'Press **Show**.',
            KHMER,
            GEMMA,
            (label) => label,
        );
        expect(shown).toBe('ចុច **បង្ហាញ**។');
    });

    it('sends words that are English already as they are', async () => {
        const translate = genTranslate({ question: 'x', answer: 'y' });
        const asking = genAskTranslation({
            replyLang: 'km',
            words: 'How do I show a verse?',
            findTranslator: async () => GEMMA,
            translate,
        });
        expect((await asking.planFor('nemotron-super'))?.english).toBe(
            'How do I show a verse?',
        );
        expect(translate).not.toHaveBeenCalled();
    });

    it('asks directly with no translator, or when translating fails', async () => {
        const withNone = genAskTranslation({
            replyLang: 'km',
            words: 'តើខ្ញុំបង្ហាញខគម្ពីរ',
            findTranslator: async () => null,
            translate: genTranslate({ question: 'x', answer: 'y' }),
        });
        expect(await withNone.planFor('nemotron-super')).toBeNull();
        const withThrow = genAskTranslation({
            replyLang: 'km',
            words: 'តើខ្ញុំបង្ហាញខគម្ពីរ',
            findTranslator: async () => {
                throw new Error('no server');
            },
            translate: genTranslate({ question: 'x', answer: 'y' }),
        });
        expect(await withThrow.planFor('nemotron-super')).toBeNull();
        const withNothing = genAskTranslation({
            replyLang: 'km',
            words: 'តើខ្ញុំបង្ហាញខគម្ពីរ',
            findTranslator: async () => GEMMA,
            translate: genTranslate({ question: '', answer: '' }),
        });
        expect(await withNothing.planFor('nemotron-super')).toBeNull();
    });

    it('leaves an answer already in their language as it is', async () => {
        const translate = genTranslate({ question: 'x', answer: 'y' });
        const asking = genAskTranslation({
            replyLang: 'km',
            words: 'x',
            findTranslator: async () => GEMMA,
            translate,
        });
        expect(
            await asking.translateAnswer(
                'ចុចប៊ូតុងបង្ហាញនៅខាងលើ។',
                KHMER,
                GEMMA,
                (label) => label,
            ),
        ).toBe('ចុចប៊ូតុងបង្ហាញនៅខាងលើ។');
        expect(translate).not.toHaveBeenCalled();
    });
});
