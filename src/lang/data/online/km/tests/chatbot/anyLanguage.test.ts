import { describe, expect, test } from 'vitest';
import { toAnswerShownInLanguage } from '../../../../../../chatbot/answerLanguageHelpers';
import { checkIsChosenScript } from '../../../../../../chatbot/chatLangHelpers';

describe('chips in the script of the answer', () => {
    test('the app’s own script is chosen in any answer', () => {
        expect(checkIsChosenScript('กด ការកំណត់', 'กดปุ่ม', 'km')).toBe(true);
    });
});

// What the answer is cleaned by depends on the SCREEN: an English one shows
// English names, a Khmer one Khmer.
describe('an answer shown on a screen in another language', () => {
    const asIs = (label: string) => {
        return label;
    };

    // A screen in a script of its own takes an English gloss off: the
    // reader finds the button by the words the screen draws.
    test('an English gloss goes from a Khmer screen', () => {
        expect(
            toAnswerShownInLanguage(
                '点击 设置 (Settings) 按钮。',
                'zh',
                asIs,
                undefined,
                'km',
            ),
        ).toBe('点击 设置 按钮。');
    });

    test('a Thai answer keeps the Khmer screen’s button names', () => {
        const answer = 'กดปุ่ม ការកំណត់ ที่มุมขวาบน';
        expect(
            toAnswerShownInLanguage(answer, 'th', asIs, undefined, 'km'),
        ).toBe(answer);
        // With nobody saying the screen is Khmer, a Khmer word in a Thai
        // answer is a third script, as it always was.
        expect(toAnswerShownInLanguage(answer, 'th', asIs)).toBe(
            'กดปุ่ม  ที่มุมขวาบน',
        );
    });
});
