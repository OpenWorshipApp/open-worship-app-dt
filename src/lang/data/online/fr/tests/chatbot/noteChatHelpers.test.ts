import { describe, expect, test } from 'vitest';

import {
    getAssistantLanguage,
    listAssistantLanguages,
    listTypedLanguages,
} from '../../../../../../chatbot/chatLangHelpers';
import { genNoteOpeningAnswer } from '../../../../../../chatbot/noteChatHelpers';

// BN-25 (2026-11-08): a note named in French, in a French window, was
// offered to be put into French.

const FRENCH = getAssistantLanguage('fr');
const LANGUAGES = [...listAssistantLanguages(), ...listTypedLanguages()];

describe('the language a French note card offers to translate into', () => {
    test('a note named in French, in a French window: English', () => {
        expect(
            genNoteOpeningAnswer("L'amour de Dieu", FRENCH, LANGUAGES)
                .translateLanguage?.code,
        ).toBe('en');
    });

    test('a one-word name tells nothing: the window’s language, as before', () => {
        expect(
            genNoteOpeningAnswer('Amour', FRENCH, LANGUAGES).translateLanguage
                ?.code,
        ).toBe('fr');
    });
});
