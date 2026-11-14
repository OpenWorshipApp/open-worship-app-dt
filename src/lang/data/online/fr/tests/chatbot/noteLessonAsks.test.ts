import { describe, expect, test } from 'vitest';

import {
    NOTE_BLANK_LESSON_HINT,
    checkIsLanguageLessonAsk,
    checkIsNoteVerseCheckAsk,
    genNoteLessonHint,
} from '../../../../../../chatbot/noteChatHelpers';

// BN-65 (2026-11-10): a preaching lesson asked for in French, and the
// verses of a note asked to be checked, read from `lessonAsks` and
// `verseCheckAsks` in this package's `assistant.json`.

describe('a preaching lesson asked for in French', () => {
    test('writing a sermon or a lesson, or preaching on a passage', () => {
        for (const asked of [
            'aide-moi à préparer un sermon sur Jean 10:11-18',
            'écris une leçon sur le pardon',
            'je vais prêcher sur le Psaume 23 dimanche',
            'fais-moi une prédication sur le fils prodigue',
        ]) {
            expect(checkIsLanguageLessonAsk(asked), asked).toBe(true);
            expect(genNoteLessonHint(asked, true), asked).toBe(
                NOTE_BLANK_LESSON_HINT,
            );
        }
    });

    test('a how-to, or this lesson made shorter, is not', () => {
        for (const asked of [
            'comment écrire un sermon dans une note ?',
            'fais ma leçon plus courte',
            'ajoute une prière',
        ]) {
            expect(checkIsLanguageLessonAsk(asked), asked).toBe(false);
        }
    });
});

describe('the verses of a note asked to be checked in French', () => {
    test('a checking word and verses, or my verses said right or wrong', () => {
        for (const asked of [
            'vérifie mes versets',
            'pouvez-vous contrôler les références ?',
            'est-ce que mes versets sont justes ?',
        ]) {
            expect(checkIsNoteVerseCheckAsk(asked), asked).toBe(true);
        }
        for (const asked of [
            'ajoute des versets sur la paix',
            'vérifie l’orthographe',
        ]) {
            expect(checkIsNoteVerseCheckAsk(asked), asked).toBe(false);
        }
    });
});
