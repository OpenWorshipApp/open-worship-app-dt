import { beforeEach, describe, expect, test, vi } from 'vitest';

// The corpus is a lazy chunk of JSON the real window imports; the layers above
// it are what is under test here, so it is stubbed and asserted on separately.
const genFollowUpQuestions = vi.fn(async (): Promise<string[]> => {
    return [];
});
vi.mock('../../../../../../chatbot/questionHelpers', () => ({
    genFollowUpQuestions: (...args: any[]) => {
        return genFollowUpQuestions(...(args as []));
    },
}));

import {
    genMessageReplies,
    genQuickReplies,
    parseAnswerOptions,
} from '../../../../../../chatbot/quickReplyHelpers';

beforeEach(() => {
    genFollowUpQuestions.mockReset();
    genFollowUpQuestions.mockResolvedValue([]);
});

// The keyless provider is nothing but weaker models, and they honour "answer in
// English" in the prose and then change language in the frame. Both of these
// were measured against the live free tier before the guard was written.
describe('parseAnswerOptions, a model that changed language', () => {
    test('keeps an English option carrying a translated button name', () => {
        // The one thing that is deliberately NOT in English. Button names come
        // back in the language the app is displaying, so an option that names
        // one is correct and must survive.
        const { options } = parseAnswerOptions(
            [
                'Use the clear button.',
                'OPTIONS: Show me លុបព្រះគម្ពីរ | No thanks',
            ].join('\n'),
        );
        expect(options).toEqual(['Show me លុបព្រះគម្ពីរ', 'No thanks']);
    });
});

// A Khmer answer's options are Khmer, and they are what an older volunteer in
// a Khmer app can read: keeping only options with a Latin letter dropped every
// one of them, and a key of `[a-z0-9]` then dropped what was left as a
// duplicate of nothing.
describe('options in the language of the answer', () => {
    const khmerAnswer = 'ចុចប៊ូតុង **ស្វែងរកព្រះគម្ពីរ** នៅខាងលើ។';

    test('keeps Khmer options under a Khmer answer', () => {
        const { text, options } = parseAnswerOptions(
            `${khmerAnswer}\nOPTIONS: បង្ហាញខ្ញុំ | ខ្ញុំនៅតែមិនឃើញ`,
        );
        expect(text).toBe(khmerAnswer);
        expect(options).toEqual(['បង្ហាញខ្ញុំ', 'ខ្ញុំនៅតែមិនឃើញ']);
    });

    test('still drops a script nobody chose', () => {
        const { options } = parseAnswerOptions(
            `${khmerAnswer}\nOPTIONS: ខ្ញុំនៅតែមិនឃើញ | 请确认显示这个按钮`,
        );
        expect(options).toEqual(['ខ្ញុំនៅតែមិនឃើញ']);
    });

    // Told to keep the marker in English, a small model translates it.
    test('reads the marker a model translated, and its colon', () => {
        for (const marker of ['ជម្រើស:', 'ជម្រើស៖']) {
            const { text, options } = parseAnswerOptions(
                `${khmerAnswer}\n${marker} បាទ/ចាស | ទេ អរគុណ`,
            );
            expect(text).toBe(khmerAnswer);
            expect(options).toEqual(['បាទ/ចាស', 'ទេ អរគុណ']);
        }
    });

    test('measures an option as it is seen, not by its marks', () => {
        // Forty letters with their vowel signs is more than forty code units.
        const option = 'សូមបង្ហាញខ្ញុំពីរបៀបដាក់ចម្រៀងនៅលើអេក្រង់';
        expect(option.length).toBeGreaterThan(40);
        expect(option.replace(/\p{M}/gu, '').length).toBeLessThanOrEqual(40);
        expect(
            parseAnswerOptions(`${khmerAnswer}\nOPTIONS: ${option}`).options,
        ).toEqual([option]);
    });

    test('a Khmer yes-or-no question gets the Khmer buttons', () => {
        expect(
            genQuickReplies('ចុចប៊ូតុងនោះ។ តើអ្នកចង់ឲ្យខ្ញុំបង្ហាញទេ?'),
        ).toEqual(['បាទ/ចាស', 'ទេ អរគុណ']);
    });

    test('a Khmer yes beside the walkthrough buttons is an echo', async () => {
        const replies = await genMessageReplies({
            modelOptions: ['បាទ', 'បង្ហាញខ្ញុំម្តងមួយៗ', 'ប្តូរពណ៌អក្សរ'],
            answerText: khmerAnswer,
            askedText: 'x',
            actionLabels: ['Show me step by step', 'Do it for me'],
            focus: 'presenter',
        });
        expect(replies).toEqual(['ប្តូរពណ៌អក្សរ']);
    });
});

// A chip is a one-press yes; a removal is asked for in words (2026-10-17, the
// elder-persona run: "delete everything" answered with one-press chips to
// delete every document, the settings and the installed Bibles).
describe('a removal is never a chip', () => {
    test.each([
        [
            'តើអ្នកចង់លុបអ្វី?',
            'OPTIONS: លុបឯកសារទាំងអស់ | លុបការកំណត់កម្មវិធី | តើត្រូវចុចត្រង់ណា?',
        ],
    ])('%s', (answer, frame) => {
        const { options } = parseAnswerOptions(`${answer}\n\n${frame}`);
        expect(options).toHaveLength(1);
    });
});
