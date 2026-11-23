import { describe, expect, test } from 'vitest';

import { toAnswerShownInLanguage } from '../../../../chatbot/answerLanguageHelpers';
import { getAssistantLanguage } from '../../../../chatbot/chatLangHelpers';
import {
    listAssistantLangPackages,
    readLangPackageDictionary,
} from '../../../../test-setup/langPackageDirs';

// 2026-11-21: an answer in a language the app is shown in named the attached
// `Cross.png` with the dictionary's word for the label "Cross" -- the
// cleaner reads a capitalised English word as a button's name. A file's name
// before its extension, or after a folder's slash, is written as given.
const LABEL = 'Cross';

const LANGUAGE_LIST = listAssistantLangPackages()
    .map(({ langCode }) => {
        const dictionary = readLangPackageDictionary(langCode);
        const shown = dictionary[LABEL.toLowerCase()];
        return { langCode, shown };
    })
    .filter(({ langCode, shown }) => {
        return (
            typeof shown === 'string' &&
            shown !== LABEL &&
            getAssistantLanguage(langCode).code === langCode
        );
    });

describe('a file named in an answer keeps its name', () => {
    test.runIf(LANGUAGE_LIST.length > 0).each(LANGUAGE_LIST)(
        '$langCode',
        ({ langCode, shown }) => {
            const translateLabel = (label: string) => {
                return label === LABEL ? shown : label;
            };
            const answer = toAnswerShownInLanguage(
                '"Cross.png" -- /x/Cross -- **Cross**',
                langCode,
                translateLabel,
            );
            expect(answer).toContain('"Cross.png"');
            expect(answer).toContain('/x/Cross ');
            // the label alone, in bold, is still the button's
            expect(answer).toContain(`**${shown}**`);
        },
    );
});
