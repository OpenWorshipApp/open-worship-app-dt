import { describe, expect, test } from 'vitest';

import {
    readLanguageNoteStyleAsk,
    readLanguageSizeAsk,
} from '../../../../../../chatbot/languageEditAskHelpers';

// BN-16 (2026-11-08): the text size and a whole-note style, typed in
// French, are done by the help window with no model.

describe('a text size typed in French', () => {
    test('larger, smaller, one size', () => {
        for (const asked of [
            'Agrandir les mots',
            'Agrandis le texte',
            'Mets le texte plus grand',
            'Augmente la taille du texte, s’il te plaît',
        ]) {
            expect(readLanguageSizeAsk(asked)).toEqual({ kind: 'larger' });
        }
        for (const asked of [
            'Rapetisse les mots',
            'Réduis la taille du texte',
            'Réduire les lettres',
            'Mets le texte plus petit',
        ]) {
            expect(readLanguageSizeAsk(asked)).toEqual({ kind: 'smaller' });
        }
        expect(readLanguageSizeAsk('Mets le texte en 20 px')).toEqual({
            kind: 'set',
            size: 20,
        });
    });

    test('a part is the assistant’s', () => {
        expect(readLanguageSizeAsk('Agrandis le titre')).toBeNull();
        expect(readLanguageSizeAsk('Agrandis le mot amour')).toBeNull();
    });

    // BN-40 (2026-11-09): "réduire le texte" is as often "shorten it" --
    // fewer words -- as smaller letters; the assistant reads which.
    test('fewer words is the assistant’s', () => {
        expect(readLanguageSizeAsk('Réduire les mots')).toBeNull();
        expect(readLanguageSizeAsk('Réduis le texte')).toBeNull();
    });
});

describe('a style for the whole note typed in French', () => {
    test('bold, centred, a colour, cleared, a font', () => {
        expect(readLanguageNoteStyleAsk('Mets tout le texte en gras')).toEqual({
            styles: ['bold'],
        });
        expect(readLanguageNoteStyleAsk('Centre toute la note')).toEqual({
            align: 'center',
        });
        expect(readLanguageNoteStyleAsk('Mets tout en rouge.')).toEqual({
            color: 'red',
        });
        expect(readLanguageNoteStyleAsk('Efface la mise en forme')).toEqual({
            clear: true,
        });
        expect(
            readLanguageNoteStyleAsk('Utilise Georgia pour toute la note'),
        ).toEqual({ font: 'Georgia' });
    });

    test('one word, or two styles at once, is the assistant’s', () => {
        expect(
            readLanguageNoteStyleAsk('Mets le mot amour en rouge'),
        ).toBeNull();
        expect(
            readLanguageNoteStyleAsk('Mets tout en gras et en rouge'),
        ).toBeNull();
    });
});
