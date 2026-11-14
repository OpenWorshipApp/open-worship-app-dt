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
    findNoteTranslateLeft,
    genNoteOpeningAnswer,
    genNoteTranslateLeftNote,
    pickTranslateBibleKey,
    resolveNoteEditTarget,
    restoreTypedWords,
    withNoteVersesInBible,
} from '../../../../../../chatbot/noteChatHelpers';
import { resolveStudyTranslateLanguage } from '../../../../../../chatbot/studyTranslateHelpers';

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

// BN-133 (2026-11-11, the user: _I asked to translate the whole content into
// Khmer then bible of translated should into khmer bible_): the note put
// into Khmer kept its KJV verses, chips and passages alike.
describe('a note put into Khmer reads the Khmer Bible', () => {
    test('the Khmer Bible installed, the Lookup on the KJV', () => {
        const bibles = [
            { key: 'KJV', locale: 'en' },
            { key: 'ពគប', locale: 'km-KH' },
        ];
        expect(pickTranslateBibleKey({ bible: 'KJV', bibles }, 'km')).toBe(
            'ពគប',
        );
    });

    test('its chips named the Khmer Bible, its passage read from it', () => {
        const result = withNoteVersesInBible(
            {
                action: 'edit',
                changes: [
                    { block: 2, text: 'សេចក្ដីស្រឡាញ់ [^(KJV) John 3:16] ។' },
                ],
            },
            [
                {
                    n: 1,
                    kind: 'passage',
                    text: '(KJV) John 3:16 — (16): For God',
                },
                { n: 2, kind: 'paragraph', text: 'Love [^(KJV) John 3:16].' },
            ],
            'ពគប',
        );
        expect(result.changes).toEqual([
            { block: 2, text: 'សេចក្ដីស្រឡាញ់ [^(ពគប) John 3:16] ។' },
            { block: 1, ref: '(ពគប) John 3:16' },
        ]);
    });
});

// BN-134 (2026-11-11, the BN-133 live run, gemma4:cloud): "Translate all of
// it into Khmer" left the "Big idea" heading in English, and a Khmer line
// carried the Thai ทรง.
describe('a note put into Khmer is held to Khmer', () => {
    const SCRIPT = resolveStudyTranslateLanguage('km')?.scriptPattern ?? null;
    const blocks = [
        { n: 1, kind: 'h1', text: 'The Good Shepherd' },
        { n: 2, kind: 'passage', text: '(KJV) Psalm 23:1-3 — (1): The LORD' },
        { n: 3, kind: 'h2', text: 'Big idea' },
        {
            n: 4,
            kind: 'paragraph',
            text: 'The Lord leads and feeds his sheep.',
        },
        { n: 5, kind: 'paragraph', text: 'He is [^(KJV) Psalm 23:1].' },
        { n: 6, kind: 'table', text: '2 rows x 2 columns: Name, Verse' },
    ];
    const SEEN_EDIT = {
        action: 'edit',
        changes: [
            { block: 1, text: 'អ្នកគង្វាលដ៏ល្អ' },
            { block: 4, text: 'ព្រះអម្ចាស់ทรงដឹកនាំ' },
            { block: 5, text: 'ទ្រង់ [^(KJV) Psalm 23:1] ។' },
        ],
    };
    const SEEN_LEFT = {
        english: [{ n: 3, text: 'Big idea' }],
        stray: [
            { n: 4, text: 'ព្រះអម្ចាស់ทรงដឹកនាំ', letters: ['ท', 'ร', 'ง'] },
        ],
    };

    test('the installed language says its script', () => {
        expect(SCRIPT?.test('ក')).toBe(true);
    });

    test('names a heading left in English and the Thai in a line', () => {
        const left = findNoteTranslateLeft(SEEN_EDIT, blocks, SCRIPT);
        expect(left).toEqual(SEEN_LEFT);
        const note = genNoteTranslateLeftNote(left!, 'Khmer');
        expect(note).toContain('block 3 ("Big idea") is still in English');
        expect(note).toContain(
            'block 4 ("ព្រះអម្ចាស់ทรงដឹកនាំ") (ท ร ง) has letters',
        );
    });

    test('with no Khmer installed, the script is read off the words', () => {
        expect(findNoteTranslateLeft(SEEN_EDIT, blocks, null)).toEqual(
            SEEN_LEFT,
        );
    });

    test('a whole translation goes in, a token and a table never counted', () => {
        expect(
            findNoteTranslateLeft(
                {
                    action: 'edit',
                    changes: [
                        { block: 1, text: 'អ្នកគង្វាលដ៏ល្អ' },
                        { block: 3, text: 'គំនិតសំខាន់' },
                        { block: 4, text: 'ព្រះអម្ចាស់ដឹកនាំ' },
                        // Only a token left: no words to put into Khmer.
                        { block: 5, text: '[^(KJV) Psalm 23:1]' },
                    ],
                },
                blocks,
                SCRIPT,
            ),
        ).toBe(null);
    });

    test('a block written in Thai, never a Greek word kept', () => {
        const left = findNoteTranslateLeft(
            {
                action: 'edit',
                changes: [
                    { block: 1, text: 'ผู้เลี้ยงที่ดี' },
                    { block: 3, text: 'គំនិត ἀγάπη' },
                    { block: 4, remove: true },
                    { after: 5, kind: 'paragraph', text: 'A new line here' },
                ],
            },
            [
                ...blocks.slice(0, 2),
                { n: 3, kind: 'h2', text: 'Big idea: ἀγάπη' },
                ...blocks.slice(3),
            ],
            SCRIPT,
        );
        expect(left?.english).toEqual([
            { n: 5, text: 'He is  .' },
            { n: 0, text: 'A new line here' },
        ]);
        // Thai's vowel signs are marks, never letters of their own.
        expect(left?.stray).toEqual([
            {
                n: 1,
                text: 'ผู้เลี้ยงที่ดี',
                letters: ['ผ', 'เ', 'ล', 'ย', 'ง', 'ท', 'ด'],
            },
        ]);
    });
});
