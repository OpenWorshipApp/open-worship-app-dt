import { describe, expect, it, vi } from 'vitest';

import {
    genAskTranslation,
    listUsedTerms,
    readAnswerTranslation,
    readQuestionTranslation,
    toAnswerTranslationAsk,
    toBoldLabelsShown,
    toQuestionTranslationAsk,
    type TranslatorType,
} from '../../../../../../chatbot/chatTranslateHelpers';
import { getAssistantLanguage } from '../../../../../../chatbot/chatLangHelpers';

const KHMER = getAssistantLanguage('km');
const GEMMA: TranslatorType = {
    provider: 'custom',
    model: 'mac-super/gemma-4-12b',
    label: 'mac-super · gemma-4-12b',
};

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
        // BN-23 (2026-11-08): a line to add to a note came to the model as
        // its English, and was written into the Khmer note in English.
        expect(ask).toContain(
            'words they want WRITTEN somewhere (a line to add, a title to ' +
                'give) exactly as written, in their language',
        );
        const answerAsk = toAnswerTranslationAsk('Press **Show**.', KHMER);
        expect(answerAsk).toContain('into Khmer (ខ្មែរ)');
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
                kind: 'question' | 'answer' | 'replies',
            ) => {
                return kind === 'replies' ? '' : map[kind];
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

describe('readAnswerTranslation', () => {
    it('refuses an answer with no letter of the script', () => {
        expect(
            readAnswerTranslation('Press Show now.', 'Press **Show**.', KHMER),
        ).toBeNull();
    });
});
