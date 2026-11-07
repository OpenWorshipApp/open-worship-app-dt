import { describe, expect, test } from 'vitest';
import {
    toAnswerShownInLanguage,
    toRepliesShownInLanguage,
} from '../../../../../../chatbot/answerLanguageHelpers';

// What the French dictionary says for a label a model wrote in English.
const LABEL_MAP: Record<string, string> = {
    'Mini Screen': 'Petit écran',
};
const translateLabel = (label: string) => {
    return LABEL_MAP[label] ?? label;
};

function show(text: string) {
    return toAnswerShownInLanguage(text, 'fr', translateLabel);
}

describe('toAnswerShownInLanguage in French', () => {
    test('a chip in French is kept', () => {
        expect(
            toRepliesShownInLanguage(['Montrez-moi'], 'fr', translateLabel),
        ).toEqual(['Montrez-moi']);
    });

    test('a Latin-script language keeps its brackets, gets its labels', () => {
        expect(show('Cliquez sur Mini Screen (à droite).')).toBe(
            'Cliquez sur Petit écran (à droite).',
        );
    });

    test('a third script and a lowercase word are left to it', () => {
        expect(show('Cliquez 预览')).toBe('Cliquez 预览');
        expect(show('Vous avez souligné ces mots')).toBe(
            'Vous avez souligné ces mots',
        );
    });

    // A French answer in a window shown in ANOTHER language (2026-11-04, the
    // robot run): _la Bible_ is French, spelt as the English key of a tab,
    // and came out with the other window's word for that tab inside the
    // French. A label in bold or in quotes is still the window's.
    test('in a window of another language, its own words stay French', () => {
        const otherWindowLabel = (label: string) => {
            return (
                (
                    {
                        Bible: '[xx] Bible tab',
                        'Font Size': '[xx] Font Size',
                    } as Record<string, string>
                )[label] ?? label
            );
        };
        expect(
            toAnswerShownInLanguage(
                'Pour agrandir le texte de la Bible, utilisez **Font Size**.',
                'fr',
                otherWindowLabel,
                undefined,
                'en',
            ),
        ).toBe(
            'Pour agrandir le texte de la Bible, utilisez **[xx] Font Size**.',
        );
    });
});
