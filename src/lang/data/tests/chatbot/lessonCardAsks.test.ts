import { afterEach, describe, expect, test } from 'vitest';

import { setChatTranslator } from '../../../../chatbot/chatTranHelpers';
import {
    NOTE_BLANK_LESSON_HINT,
    checkIsLessonCardAsk,
    genNoteLessonHint,
    genNoteOpeningAnswer,
} from '../../../../chatbot/noteChatHelpers';
import {
    listLangPackageCodes,
    readLangPackageDictionary,
} from '../../../../test-setup/langPackageDirs';

// BN-64 (2026-11-10): an EMPTY note's card offers a lesson, in the window's
// language, and a press of its buttons is read as a lesson asked for in
// every language -- a Gemma 4 is asked in the person's own words, where no
// English reader sees them.

const LANGUAGE = { code: 'xx', name: 'Test', nativeName: 'Test' } as any;
const CODE_LIST = listLangPackageCodes({ isEnglishIncluded: false });

afterEach(() => {
    setChatTranslator(
        (text) => text,
        (text) => text,
    );
});

describe.runIf(CODE_LIST.length > 0)(
    'the empty note card in every installed language',
    () => {
        test.each(CODE_LIST)('%s', (code) => {
            const dictionary = readLangPackageDictionary(code);
            const read = (text: string) => {
                return dictionary[text.trim().toLowerCase()];
            };
            setChatTranslator(
                (text) => {
                    const value = read(text);
                    if (value === undefined) {
                        throw new Error(`no "${text}" in ${code}`);
                    }
                    return value;
                },
                (text) => read(text) ?? text,
            );
            const card = genNoteOpeningAnswer('Sunday', LANGUAGE, [], true);
            expect(card.text).toContain('Sunday');
            expect(card.replies).toHaveLength(3);
            for (const reply of card.replies) {
                // The button as the window shows it is a lesson asked for...
                expect(checkIsLessonCardAsk(reply), `${code}: ${reply}`).toBe(
                    true,
                );
                // ...and, pressed in an empty note, carries the lesson hint.
                expect(genNoteLessonHint(reply, true, true)).toBe(
                    NOTE_BLANK_LESSON_HINT,
                );
            }
            expect(checkIsLessonCardAsk(card.text)).toBe(false);
        });
    },
);
