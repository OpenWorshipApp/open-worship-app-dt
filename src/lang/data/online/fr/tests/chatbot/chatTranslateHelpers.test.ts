import { describe, expect, it } from 'vitest';

import {
    readAnswerTranslation,
    toAnswerTranslationAsk,
} from '../../../../../../chatbot/chatTranslateHelpers';
import { getAssistantLanguage } from '../../../../../../chatbot/chatLangHelpers';

const FRENCH = getAssistantLanguage('fr');

describe('readAnswerTranslation', () => {
    it('takes an answer put into French', () => {
        expect(
            readAnswerTranslation(
                'Appuyez sur **Afficher**.',
                'Press **Show**.',
                FRENCH,
            ),
        ).toBe('Appuyez sur **Afficher**.');
    });
});

describe('the translator asks', () => {
    it('names the language an answer is put into, by both its names', () => {
        const answerAsk = toAnswerTranslationAsk('Press **Show**.', FRENCH);
        expect(answerAsk).toContain('into French (Français)');
        expect(answerAsk).toContain('keep OPTIONS:');
    });
});
