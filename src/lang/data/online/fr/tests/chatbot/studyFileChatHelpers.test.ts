import { describe, expect, test } from 'vitest';

import { readStudyFileAsk } from '../../../../../../chatbot/studyFileChatHelpers';

// EC-464 (2026-11-09): a study file asked for in French goes to the study
// ask, as the English lines do -- from `studyFileAsks` in this package's
// `assistant.json`. A how-to and a Bible note stay their own.

describe('a study file asked for in French', () => {
    test('a making word and a study file, a study or Resources', () => {
        for (const asked of [
            "Crée un fichier d'étude pour Matthieu 3:3-7",
            'fais une étude biblique sur Jean 3:16',
            'enregistre dans le fichier de ressources',
        ]) {
            expect(readStudyFileAsk(asked)).toBe(true);
        }
    });

    test('a how-to, a note and a plain question are not', () => {
        for (const asked of [
            "Comment créer un fichier d'étude ?",
            'crée une note pour Jean 3:16',
            'Que veut dire Jean 3:16 ?',
            'où sont les ressources ?',
        ]) {
            expect(readStudyFileAsk(asked)).toBe(false);
        }
    });
});
