import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    detectTypedLanguage,
    findYesNoReplies,
    checkIsLanguageWord,
} from '../../../../../../chatbot/chatLangHelpers';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('detectTypedLanguage', () => {
    test('English and French are told apart by their little words', () => {
        expect(detectTypedLanguage('How do I show a song on the screen?')).toBe(
            'en',
        );
        expect(
            detectTypedLanguage('Comment afficher un chant sur l’écran ?'),
        ).toBe('fr');
    });
});

describe('findYesNoReplies', () => {
    test('a French one by how it starts', () => {
        expect(findYesNoReplies('Voulez-vous que je vous montre ?')).toEqual([
            'Oui',
            'Non merci',
        ]);
    });
});

describe('the words for yes and no', () => {
    test('a whole reply in French', () => {
        expect(checkIsLanguageWord('Oui', 'yes')).toBe(true);
        expect(checkIsLanguageWord('non merci', 'no')).toBe(true);
    });
});

// An English question naming a French song: the song's little words do not
// make the question French.
describe('the language a question was typed in', () => {
    test('a French song named in an English question is not French', () => {
        // "how", "do", "I" against "dans", "la": a little word several
        // languages share says less (`WORD_WEIGHT_MAP` -- `la` is French,
        // Spanish, Italian and Catalan), so English's settle it.
        expect(detectTypedLanguage('How do I show Dans la lumière?')).toBe(
            'en',
        );
        expect(
            detectTypedLanguage('How do I show the song Dans la lumière?'),
        ).toBe('en');
        expect(detectTypedLanguage('Comment afficher Dans la lumière ?')).toBe(
            'fr',
        );
    });
});
