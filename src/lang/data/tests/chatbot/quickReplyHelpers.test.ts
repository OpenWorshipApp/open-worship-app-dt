import { beforeEach, describe, expect, test, vi } from 'vitest';

// The corpus is a lazy chunk of JSON the real window imports; the layers above
// it are what is under test here, so it is stubbed and asserted on separately.
const genFollowUpQuestions = vi.fn(async (): Promise<string[]> => {
    return [];
});
vi.mock('../../../../chatbot/questionHelpers', () => ({
    genFollowUpQuestions: (...args: any[]) => {
        return genFollowUpQuestions(...(args as []));
    },
}));

import { parseAnswerOptions } from '../../../../chatbot/quickReplyHelpers';

beforeEach(() => {
    genFollowUpQuestions.mockReset();
    genFollowUpQuestions.mockResolvedValue([]);
});

describe('parseAnswerOptions', () => {
    // 2026-11-03: every answer in Chinese, Thai, Korean, Russian and Arabic
    // came back with no chips -- only a package's script counted as chosen.
    test('keeps the options in the script of the answer, any script', () => {
        const parsed = parseAnswerOptions(
            'คลิกปุ่ม ⋯ เล็กๆ ที่มุมล่างซ้าย\nOPTIONS: ยังเล็กอยู่ | ทำให้เล็กลงอย่างไร | 请确认',
        );
        expect(parsed.options).toEqual(['ยังเล็กอยู่', 'ทำให้เล็กลงอย่างไร']);
    });
});

// The keyless provider is nothing but weaker models, and they honour "answer in
// English" in the prose and then change language in the frame. Both of these
// were measured against the live free tier before the guard was written.
describe('parseAnswerOptions, a model that changed language', () => {
    test('drops an option with no Latin letter in it at all', () => {
        const { text, options } = parseAnswerOptions(
            [
                'Press **Ctrl+B** to open the lookup.',
                'OPTIONS: Yes, walk me through it | 请确认显示这个按钮 |' +
                    ' No thanks',
            ].join('\n'),
        );
        expect(text).toBe('Press **Ctrl+B** to open the lookup.');
        expect(options).toEqual(['Yes, walk me through it', 'No thanks']);
    });
});

// BN-47 (2026-11-09, the 87-language run): the marker put into the person's
// language -- by the model or by the translator -- is read by the options'
// shape, whatever the word.
describe("options under a marker in the answer's own language", () => {
    test.each([
        [
            'Pierwszy wiersz jest pogrubiony.\nOpcje: cofnij tę zmianę | pogrub drugi wiersz',
            'Pierwszy wiersz jest pogrubiony.',
            ['cofnij tę zmianę', 'pogrub drugi wiersz'],
        ],
        [
            'La primera línea está en negrita. Opciones: deshacer | otra línea',
            'La primera línea está en negrita.',
            ['deshacer', 'otra línea'],
        ],
        [
            'Первая строка выделена.\nВарианты: отменить | выделить вторую строку',
            'Первая строка выделена.',
            ['отменить', 'выделить вторую строку'],
        ],
        [
            'Dòng đầu đã được in đậm.\nCác lựa chọn: hoàn tác | in đậm dòng hai',
            'Dòng đầu đã được in đậm.',
            ['hoàn tác', 'in đậm dòng hai'],
        ],
        [
            'บรรทัดแรกเป็นตัวหนาแล้ว\nตัวเลือก: เลิกทำ | ทำบรรทัดที่สองให้หนา',
            'บรรทัดแรกเป็นตัวหนาแล้ว',
            ['เลิกทำ', 'ทำบรรทัดที่สองให้หนา'],
        ],
    ])('%s', (answer, text, options) => {
        const parsed = parseAnswerOptions(answer);
        expect(parsed.text).toBe(text);
        expect(parsed.options).toEqual(options);
    });
});
