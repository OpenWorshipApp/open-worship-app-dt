// @vitest-environment jsdom
/**
 * French's own half of `src/chatbot/chatLanguageParity.test.ts` (2026-10-29):
 * the rows every language says are asked there, from
 * `chatLanguageParity.json` beside this file; what only French says is held
 * here. (jsdom: the verse finder's module brings the app's provider along.)
 */
import { describe, expect, test } from 'vitest';

import {
    readTypedVerseContentAsk,
    readTypedVerseFindAsk,
} from '../../../../../../chatbot/verseAskLanguageHelpers';

describe('a line typed in any tab', () => {
    test('the verse finder keeps the words as they were written', () => {
        expect(
            readTypedVerseFindAsk(
                'Aide-moi à trouver un verset biblique dans « KJV » : aimez vos ennemis',
            ),
        ).toEqual({ bibleKey: 'KJV', remembered: 'aimez vos ennemis' });
        expect(
            readTypedVerseContentAsk('Que dit la Bible sur le pardon ?'),
        ).toEqual({ kind: 'verse', words: 'le pardon' });
        expect(
            readTypedVerseContentAsk(
                "Où se trouve l'histoire du déluge dans la Bible ?",
            ),
        ).toEqual({ kind: 'verse', words: "l'histoire du déluge" });
    });
});
