import { describe, expect, test } from 'vitest';

import {
    NOTE_BLANK_LESSON_HINT,
    checkIsLanguageLessonAsk,
    checkIsNoteVerseCheckAsk,
    genNoteLessonHint,
} from '../../../../../../chatbot/noteChatHelpers';
import { readStudyFileAsk } from '../../../../../../chatbot/studyFileChatHelpers';

// BN-65 (2026-11-10): a preaching lesson asked for in Khmer, and the
// verses of a note asked to be checked, read from `lessonAsks` and
// `verseCheckAsks` in this package's `assistant.json` -- a Gemma 4 is
// asked in Khmer, untranslated, where the English readers see nothing.

describe('a preaching lesson asked for in Khmer', () => {
    test('writing a sermon or a lesson, or preaching on a passage', () => {
        for (const asked of [
            'ជួយខ្ញុំរៀបចំសេចក្ដីអធិប្បាយលើ យ៉ូហាន ១០:១១-១៨',
            'សរសេរមេរៀនមួយអំពីការអភ័យទោស',
            'ខ្ញុំនឹងអធិប្បាយលើ ទំនុកដំកើង ២៣ នៅថ្ងៃអាទិត្យនេះ',
            'សូមធ្វើសេចក្តីអធិប្បាយអំពីកូនដែលវង្វេង',
        ]) {
            expect(checkIsLanguageLessonAsk(asked), asked).toBe(true);
            // In an empty note it goes INTO the note.
            expect(genNoteLessonHint(asked, true), asked).toBe(
                NOTE_BLANK_LESSON_HINT,
            );
        }
    });

    test('a how-to, this lesson, or a study file is not', () => {
        for (const asked of [
            'តើខ្ញុំសរសេរសេចក្ដីអធិប្បាយដោយរបៀបណា?',
            'ធ្វើមេរៀននេះឱ្យខ្លីជាងមុន',
            'សរសេរមេរៀនសិក្សាអំពី យ៉ូហាន ៣',
        ]) {
            expect(checkIsLanguageLessonAsk(asked), asked).toBe(false);
        }
        // The study file stays the study file's.
        expect(readStudyFileAsk('សរសេរមេរៀនសិក្សាអំពី យ៉ូហាន ៣')).toBe(true);
        // Beside a lesson, a lesson asked in Khmer is left to the prompt.
        expect(genNoteLessonHint('សរសេរមេរៀនមួយអំពីការអភ័យទោស', false)).toBe(
            null,
        );
    });
});

describe('the verses of a note asked to be checked in Khmer', () => {
    test('a checking word and verses, or my verses said right or wrong', () => {
        for (const asked of [
            'ពិនិត្យមើលខគម្ពីររបស់ខ្ញុំ',
            'សូមផ្ទៀងផ្ទាត់ឯកសារយោងទាំងអស់',
            'ខគម្ពីររបស់ខ្ញុំត្រឹមត្រូវទេ?',
        ]) {
            expect(checkIsNoteVerseCheckAsk(asked), asked).toBe(true);
        }
        for (const asked of [
            'បន្ថែមខគម្ពីរ យ៉ូហាន ៣:១៦',
            'ពិនិត្យអក្ខរាវិរុទ្ធ',
        ]) {
            expect(checkIsNoteVerseCheckAsk(asked), asked).toBe(false);
        }
    });
});
