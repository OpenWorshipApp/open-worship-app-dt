import { describe, expect, test } from 'vitest';

import {
    getAssistantLanguage,
    listAssistantLanguages,
    listLookAlikePairs,
    listTypedLanguages,
} from '../../../../../../chatbot/chatLangHelpers';
import { genLyricOpeningAnswer } from '../../../../../../chatbot/lyricChatHelpers';
import {
    findNoteAskFiles,
    genNoteOpeningAnswer,
    resolveNoteEditTarget,
    restoreTypedWords,
} from '../../../../../../chatbot/noteChatHelpers';

// BN-25 (2026-11-08, seen live in a Khmer window): the card of a note named
// in Khmer offered "Replace the words with Khmer" -- its words put into the
// language they are written in.

const KHMER = getAssistantLanguage('km');
const ENGLISH = getAssistantLanguage('en');
const LANGUAGES = [...listAssistantLanguages(), ...listTypedLanguages()];

describe('the language a note card offers to translate into', () => {
    test('a note named in Khmer, in a Khmer window: English', () => {
        const opening = genNoteOpeningAnswer(
            'សេចក្ដីស្រឡាញ់របស់ព្រះ',
            KHMER,
            LANGUAGES,
        );
        expect(opening.translateLanguage?.code).toBe('en');
        expect(opening.replies.slice(0, 2)).toEqual([
            'Replace the words with English',
            'Add English under each line',
        ]);
    });

    test('a note named in Khmer, in an English window: English', () => {
        expect(
            genNoteOpeningAnswer('សេចក្ដីស្រឡាញ់របស់ព្រះ', ENGLISH, LANGUAGES)
                .translateLanguage?.code,
        ).toBe('en');
    });

    test('a note named in English, in a Khmer window: Khmer, as before', () => {
        expect(
            genNoteOpeningAnswer('Sermon notes', KHMER, LANGUAGES)
                .translateLanguage?.code,
        ).toBe('km');
    });

    // BN-30 (2026-11-08, seen live on Free's Nemotron): the note named with
    // the other of two look-alike subscript letters was refused, and the
    // answer gave up after 75k tokens.
    test('a note named with a look-alike subscript is the attached note', () => {
        const files = findNoteAskFiles([
            {
                id: 'n2',
                kind: 'text',
                name: 'សេចក្ដីស្រឡាញ់របស់ព្រះ',
                mimeType: 'text/plain',
                byteSize: 10,
                filePath: 'C:\\data\\bible-notes\\Default.own',
                noteId: 2,
            },
        ]);
        expect(
            resolveNoteEditTarget({ note: 'សេចក្តីស្រឡាញ់របស់ព្រះ' }, files),
        ).toMatchObject({ id: 2, note: 'សេចក្ដីស្រឡាញ់របស់ព្រះ' });
    });

    test('a song named in Khmer, in a Khmer window: English too', () => {
        expect(
            genLyricOpeningAnswer('ព្រះគុណដ៏អស្ចារ្យ.owl', KHMER, LANGUAGES)
                .translateLanguage?.code,
        ).toBe('en');
    });
});

// BN-37 (2026-11-08, Free's Nemotron): the typed line went into the note
// with the subscript of TA where the person had typed that of DA -- drawn
// the same, not the same to a search. Khmer names the pair in its
// `assistant.json`, and the words go in as typed.
describe('a typed Khmer line written with a look-alike subscript', () => {
    const TYPED = 'បន្ថែមបន្ទាត់មួយនៅខាងចុងថា ព្រះជាសេចក្ដីស្រឡាញ់';
    const WRITTEN = 'ព្រះជាសេចក្តីស្រឡាញ់';

    test('the pair is Khmer data', () => {
        expect(listLookAlikePairs()).toContainEqual([
            '\u17D2\u178A',
            '\u17D2\u178F',
        ]);
    });

    test('goes in with the letters typed', () => {
        expect(WRITTEN).not.toBe('ព្រះជាសេចក្ដីស្រឡាញ់');
        expect(restoreTypedWords(WRITTEN, TYPED, listLookAlikePairs())).toBe(
            'ព្រះជាសេចក្ដីស្រឡាញ់',
        );
    });
});
