import { describe, expect, it } from 'vitest';

import type { ChatAttachmentType } from './attachmentHelpers';
import { genTextAttachment } from './attachmentHelpers';
import { toNoteItemFromFileText } from './noteFileTextHelpers';
import {
    NOTE_BLANK_LESSON_HINT,
    NOTE_EDIT_TOOL_NAME,
    NOTE_FORMAT_HINT,
    NOTE_LESSON_CHANGE_HINT,
    NOTE_LESSON_FINISH_HINT,
    NOTE_LESSON_REWRITE_HINT,
    NOTE_LESSON_REVIEW_HINT,
    NOTE_LESSON_SHORTEN_HINT,
    NOTE_NEW_LESSON_HINT,
    NOTE_QUESTION_HINT,
    NOTE_SYSTEM_PROMPT,
    NOTE_WORDLESS_HINT,
    checkAddsNoteVerse,
    checkIsBlankNoteText,
    checkIsEmptyNoteAttachment,
    checkIsLessonCardAsk,
    checkIsLessonNoteText,
    checkIsNoteVerseCheckAsk,
    collectNoteVerseRefs,
    checkIsNewLessonAsk,
    checkIsNoteFormatAsk,
    checkIsNoteQuestionOnly,
    checkIsNoteAttachment,
    checkIsNoteOpenedLast,
    findNoteAskFiles,
    findOpenNoteAttachments,
    findSessionHoldingNote,
    findSessionNoteTarget,
    findTabNoteTarget,
    findLostNoteLines,
    genLostNoteLinesRefusal,
    findLessonChangeSurgery,
    findHearerAnswerLeft,
    findHearerQuestionTurned,
    withBlankFillInOrder,
    withLessonLabelsBold,
    withLessonLabelsKept,
    readNoteReadBlocks,
    findFinishOwnWordsLoss,
    findRewriteLineLoss,
    readFinishOwnBlocks,
    findLessonPointsProblem,
    findLessonPointRepeat,
    withLongPointPassagesNamed,
    findMissingLessonParts,
    genMissingLessonPartsNote,
    findCitedMisquotes,
    findCitedQuotes,
    findTestamentSlips,
    findTokenAsWords,
    findMemoryVerseRef,
    countVerseWords,
    dropRepeatedLessonPassages,
    pickCitedQuotesToRead,
    MAX_CITED_REFS_READ,
    checkIsNoteReplaceChoice,
    findNoteTranslateLeft,
    genNoteTranslateLeftNote,
    genNoteTranslateNoBibleNote,
    pickTranslateBibleKey,
    readNoteTranslateLanguageName,
    toVerseTokensInBible,
    withNoteVersesInBible,
    MAX_CHILD_MEMORY_VERSE_WORDS,
    genChildMemoryVerseNote,
    findSwappedVerseRef,
    listShortReadVerses,
    readPassageVerseWords,
    findMemoryVerseBlock,
    withMemoryVerseBlock,
    readLessonBigIdea,
    checkIsLeftToYouAsk,
    NOTE_LESSON_YOU_CHOOSE_HINT,
    genTestamentSlipRefusal,
    genTokenAsWordsRefusal,
    toLessonVerseLines,
    findNoteMisquotes,
    genCitedMisquoteRefusal,
    genLessonPointsRefusal,
    toLessonChangeText,
    genLessonFormLine,
    genLessonFormWriteLine,
    genNoteMisquoteRefusal,
    readLessonFormAsked,
    genLessonGapsText,
    genNoteLessonHint,
    readBlankNoteBlockCount,
    readNoteRewrite,
    toBlankNoteFillArgs,
    findCitedMisattributions,
    genCitedMisattributionNote,
    pickMisattributionCandidates,
    toCitedVerseKey,
    toNoteVerseReadText,
    withRewrittenLinesRemoved,
    genNoteStyleChanges,
    genNoteStyleDoneText,
    readCreatedNote,
    readNoteStyleAsk,
    genNoteOpeningAnswer,
    genNoteSizeChanges,
    genNoteSizeDoneText,
    resolveNoteEditTarget,
    restoreNoteTypedWords,
    restoreTypedWords,
    toNoteAsk,
    toNoteDocumentText,
    toNoteOwnWordsHint,
} from './noteChatHelpers';
import { readSlideSizeAsk } from './slideChatHelpers';

const NOTE_PATH = 'C:\\data\\bible-notes\\Default.own';

const ENGLISH = {
    code: 'en',
    name: 'English',
    nativeName: 'English',
} as any;
const SECOND = {
    code: 'xx',
    name: 'Testish',
    nativeName: 'Testish',
} as any;

function noteAttachment(
    name: string,
    noteId: number | undefined,
    filePath = NOTE_PATH,
): ChatAttachmentType {
    return {
        id: `${name}-${noteId}`,
        kind: 'text',
        name,
        mimeType: 'text/plain',
        byteSize: 10,
        filePath,
        ...(noteId === undefined ? {} : { noteId }),
    };
}

const SUNDAY = noteAttachment('Sunday', 3);
const MERCY = noteAttachment('Mercy', 4);

describe('which attachment is a note', () => {
    it('is one note of a notes file, never the whole file or another file', () => {
        expect(checkIsNoteAttachment(SUNDAY)).toBe(true);
        expect(
            checkIsNoteAttachment(noteAttachment('Default.own', undefined)),
        ).toBe(false);
        expect(
            checkIsNoteAttachment(noteAttachment('x', 1, 'C:\\x\\a.ows')),
        ).toBe(false);
    });

    it('the notes of the box, each once, the first two', () => {
        expect(
            findNoteAskFiles([
                SUNDAY,
                { ...SUNDAY, id: 'again' },
                MERCY,
                noteAttachment('Third', 5),
            ]),
        ).toEqual([
            { name: 'Sunday', filePath: NOTE_PATH, noteId: 3 },
            { name: 'Mercy', filePath: NOTE_PATH, noteId: 4 },
        ]);
    });

    it('stays open past a later question, until the tab closes its files', () => {
        const messages = [
            { id: 1, author: 'you', attachments: [SUNDAY] },
            { id: 2, author: 'bot' },
            { id: 3, author: 'you' },
        ];
        expect(findOpenNoteAttachments(messages)).toEqual([SUNDAY]);
        expect(findOpenNoteAttachments(messages, 2)).toEqual([]);
        // The window the tab works in, read off the note it keeps.
        expect(findSessionNoteTarget(messages)).toEqual({
            fileFullName: 'Default.own',
            noteId: 3,
        });
        expect(findSessionNoteTarget(messages, 2)).toBeNull();
        expect(checkIsNoteOpenedLast(messages)).toBe(true);
        // A slide document opened after it is the one asked about.
        const later = [
            ...messages,
            {
                id: 4,
                author: 'you',
                attachments: [
                    noteAttachment(
                        'Preaching.ows',
                        undefined,
                        'C:\\d\\Preaching.ows',
                    ),
                ],
            },
        ];
        expect(checkIsNoteOpenedLast(later)).toBe(false);
        expect(checkIsNoteOpenedLast(messages, 3)).toBe(false);
    });

    // EC-498, BN-19: a note handed over waits in the box until a question
    // carries it, and the box is kept through a reload now -- so is the
    // window the tab works in.
    it('the window a tab works in: the note waiting in its box, else the one it keeps', () => {
        const messages = [{ id: 1, author: 'you', attachments: [SUNDAY] }];
        expect(findTabNoteTarget(messages, undefined, [MERCY])).toEqual({
            fileFullName: 'Default.own',
            noteId: 4,
        });
        // Nothing in the box, or no note there: the note the tab keeps.
        expect(findTabNoteTarget(messages, undefined, undefined)).toEqual({
            fileFullName: 'Default.own',
            noteId: 3,
        });
        const study = noteAttachment('JHN.3.md', undefined, 'C:\\r\\JHN.3.md');
        expect(findTabNoteTarget(messages, undefined, [study])).toEqual({
            fileFullName: 'Default.own',
            noteId: 3,
        });
        // A note in the box of a tab that closed its files.
        expect(findTabNoteTarget(messages, 1, [])).toBeNull();
        expect(findTabNoteTarget(messages, 1, [study, MERCY])).toEqual({
            fileFullName: 'Default.own',
            noteId: 4,
        });
    });
});

describe('the note a call names', () => {
    const files = findNoteAskFiles([SUNDAY]);

    it('is the attached note, by its name or by none at all', () => {
        expect(resolveNoteEditTarget({ note: 'sunday' }, files)).toEqual({
            file: NOTE_PATH,
            id: 3,
            note: 'Sunday',
        });
        expect(resolveNoteEditTarget({}, files)).toEqual({
            file: NOTE_PATH,
            id: 3,
            note: 'Sunday',
        });
    });

    it('never a file, an id or a note that is not attached', () => {
        expect(
            'reason' in resolveNoteEditTarget({ file: NOTE_PATH }, files),
        ).toBe(true);
        expect('reason' in resolveNoteEditTarget({ id: 3 }, files)).toBe(true);
        expect(
            'reason' in resolveNoteEditTarget({ note: 'C:/x/a.own' }, files),
        ).toBe(true);
        expect(
            (resolveNoteEditTarget({ note: 'Other' }, files) as any).reason,
        ).toContain('"Sunday"');
        expect(
            (
                resolveNoteEditTarget(
                    {},
                    findNoteAskFiles([SUNDAY, MERCY]),
                ) as any
            ).reason,
        ).toContain('"Sunday", "Mercy"');
    });

    // BN-30 (2026-11-08, seen live): a model named a note in a language
    // with a script of its own with one of two look-alike letters in place
    // of the other, and the edit was refused for good.
    it('a name a letter out is the ONE note attached, never one of two', () => {
        const longFiles = findNoteAskFiles([
            noteAttachment('Sunday sermon on grace', 4),
        ]);
        expect(
            resolveNoteEditTarget(
                { note: 'Sunday sermon on grase' },
                longFiles,
            ),
        ).toMatchObject({ id: 4, note: 'Sunday sermon on grace' });
        expect(resolveNoteEditTarget({ note: 'Sundae' }, files)).toMatchObject({
            id: 3,
            note: 'Sunday',
        });
        // Further off is another note.
        expect(
            'reason' in
                resolveNoteEditTarget({ note: 'Monday notes' }, longFiles),
        ).toBe(true);
        // With two attached, a near name is a guess: refused.
        expect(
            'reason' in
                resolveNoteEditTarget(
                    { note: 'Sundae' },
                    findNoteAskFiles([SUNDAY, MERCY]),
                ),
        ).toBe(true);
    });

    // 2026-11-08: notes are titled by the day, and the model names a note --
    // two attached of one name, the first had been the one changed.
    it('two attached notes of one name are told apart, never guessed between', () => {
        const otherFile = noteAttachment(
            'Sunday',
            3,
            'C:\\data\\bible-notes\\Youth.own',
        );
        const sameFile = noteAttachment('Sunday', 7);
        const files = findNoteAskFiles([SUNDAY, otherFile]);
        expect(files.map((one) => one.name)).toEqual([
            'Sunday (Default)',
            'Sunday (Youth)',
        ]);
        expect(
            resolveNoteEditTarget({ note: 'Sunday (Youth)' }, files),
        ).toEqual({
            file: 'C:\\data\\bible-notes\\Youth.own',
            id: 3,
            note: 'Sunday (Youth)',
        });
        // The bare title names neither.
        expect(
            (resolveNoteEditTarget({ note: 'Sunday' }, files) as any).reason,
        ).toContain('"Sunday (Default)", "Sunday (Youth)"');
        // Two of one file: their numbers in it.
        expect(
            findNoteAskFiles([SUNDAY, sameFile]).map((one) => one.name),
        ).toEqual(['Sunday (Default) #3', 'Sunday (Default) #7']);
        // One alone keeps its own name.
        expect(
            findNoteAskFiles([SUNDAY, MERCY]).map((one) => one.name),
        ).toEqual(['Sunday', 'Mercy']);
    });
});

describe('the note as the model reads it', () => {
    it('a line a block, its kind and its words, the hash to give back', () => {
        const text = toNoteDocumentText({
            name: 'Sunday',
            file: 'Default',
            hash: 'ab12',
            blockCount: 4,
            blocks: [
                { n: 1, kind: 'h1', text: 'Grace' },
                { n: 2, kind: 'check', text: 'call Tom', checked: true },
                { n: 3, kind: 'bullet', text: 'deeper', level: 1 },
                { n: 4, kind: 'picture', text: '', isFixed: true },
            ],
            nextFrom: 5,
        })!;
        expect(text.split('\n')).toEqual([
            'Blocks: 4 · in the notes file "Default" · hash "ab12"',
            '1. h1: "Grace"',
            '2. check [x]: "call Tom"',
            '  3. bullet: "deeper"',
            '4. picture (fixed)',
            `[... blocks from 5 on were not included; ${NOTE_EDIT_TOOL_NAME} "read" with \`from\` 5 reads on]`,
        ]);
        expect(toNoteDocumentText({ blocks: [] })).toContain('empty');
        expect(toNoteDocumentText(null)).toBeNull();
    });

    it('the ask: their words, the way they chose, then the note', () => {
        const ask = toNoteAsk(
            'Add Testish under each line',
            [{ name: 'Sunday', text: 'Blocks: 1' }],
            'under',
        );
        expect(ask).toContain('Add Testish under each line');
        expect(ask).toContain('KEEP the words');
        expect(ask).toContain('The language is Testish');
        expect(ask).toContain(
            `(The Bible note "Sunday" is attached. Change it with ${NOTE_EDIT_TOOL_NAME}`,
        );
        expect(ask).toContain('Blocks: 1');
        expect(
            toNoteAsk('', [{ name: 'x', text: null }], null, true),
        ).toContain(NOTE_WORDLESS_HINT);
        expect(toNoteAsk('fix it', [{ name: 'x', text: null }])).toContain(
            'could not be read just now',
        );
    });

    it('an edit that puts a new verse in with no Bible named', () => {
        const edit = (changes: unknown[]) => {
            return { action: 'edit', changes };
        };
        expect(
            checkAddsNoteVerse(
                edit([{ after: 1, kind: 'passage', ref: 'John 1:1' }]),
            ),
        ).toBe(true);
        expect(
            checkAddsNoteVerse(
                edit([{ block: 2, text: 'As [^John 3:16] says' }]),
            ),
        ).toBe(true);
        // A token that names its Bible is read from that one.
        expect(
            checkAddsNoteVerse(
                edit([{ block: 2, text: 'As [^(KJV) John 3:16] says' }]),
            ),
        ).toBe(false);
        expect(
            checkAddsNoteVerse(
                edit([{ block: 2, words: 'love', color: 'red' }]),
            ),
        ).toBe(false);
        expect(
            checkAddsNoteVerse({
                action: 'read',
                changes: [{ ref: 'John 1:1' }],
            }),
        ).toBe(false);
        expect(checkAddsNoteVerse(null)).toBe(false);
        expect(checkAddsNoteVerse(edit([null, 'x']))).toBe(false);
    });

    // BN-23 (2026-11-08): a model working in English is handed the English
    // of what was typed, and a word of the note it named was gone with it.
    it('the English of what they typed carries their own words beside it', () => {
        const ownWords = { language: 'Testish', text: 'make "zorb" red' };
        const ask = toNoteAsk(
            'Make the word grace red',
            [{ name: 'Sunday', text: 'Blocks: 1' }],
            null,
            false,
            ownWords,
        );
        expect(ask).toContain(toNoteOwnWordsHint(ownWords));
        expect(ask).toContain('They wrote it in Testish');
        // Quoted as JSON, so their own quote marks cannot end it.
        expect(ask).toContain(JSON.stringify(ownWords.text));
        expect(ask).toContain('never the English of it');
        // The words put into the note are theirs; the answer stays English
        // for the window to put into their language (BN-29).
        expect(ask).toContain('INTO THE NOTE for them are in Testish');
        expect(ask).toContain('Your answer to them stays in English');
        // Under their question, above the note.
        expect(ask.indexOf('Make the word grace red')).toBeLessThan(
            ask.indexOf('They wrote it in'),
        );
        expect(ask.indexOf('They wrote it in')).toBeLessThan(
            ask.indexOf('Blocks: 1'),
        );
        expect(
            toNoteAsk('Make the word grace red', [
                { name: 'Sunday', text: 'Blocks: 1' },
            ]),
        ).not.toContain('They wrote it in');
        // A translate button pressed in the window's words: its English no
        // longer reads as the button, its own words still do.
        expect(
            toNoteAsk(
                'Put it under every line',
                [{ name: 'Sunday', text: 'Blocks: 1' }],
                'under',
                false,
                { language: 'Xx', text: 'Add Testish under each line' },
            ),
        ).toContain('The language is Testish');
    });

    it('the prompt keeps verse words the Bible\u2019s and points at the guide', () => {
        expect(NOTE_SYSTEM_PROMPT).toContain(NOTE_EDIT_TOOL_NAME);
        expect(NOTE_SYSTEM_PROMPT).toContain('Never type a verse out');
        expect(NOTE_SYSTEM_PROMPT).toContain('owa_help_search');
        expect(NOTE_SYSTEM_PROMPT).toContain('NOT saved yet');
    });
});

describe('the card a note opens with', () => {
    it('says what can be done and offers the commonest changes', () => {
        const opening = genNoteOpeningAnswer('Sunday', ENGLISH, [
            ENGLISH,
            SECOND,
        ]);
        expect(opening.text).toContain('“Sunday” is attached below.');
        expect(opening.replies).toEqual([
            'Replace the words with another language',
            'Add another language under each line',
            'Check the spelling',
            'Summarize this note',
            // BN-58: formatting a messy note, the job asked for most.
            'Format it so it is neat and easy to read',
        ]);
    });

    it('offers the language the note is named for', () => {
        const opening = genNoteOpeningAnswer('Testish sermon', ENGLISH, [
            ENGLISH,
            SECOND,
        ]);
        expect(opening.replies[0]).toBe('Replace the words with Testish');
        expect(opening.translateLanguage).toBe(SECOND);
    });
});

// 2026-11-08, the user: "check why chatbot can't help increase text size".

describe('a note made larger by the window', () => {
    const read = {
        hash: 'ab12',
        blockCount: 4,
        blocks: [
            { n: 1, kind: 'h1', text: 'Grace' },
            { n: 2, kind: 'picture', text: '', isFixed: true },
            { n: 3, kind: 'paragraph', text: '' },
            { n: 4, kind: 'bullet', text: 'free' },
        ],
    };

    it('the words they typed are a size ask', () => {
        expect(readSlideSizeAsk('make text bigger')).toEqual({
            kind: 'scale',
            factor: 1.25,
        });
    });

    it('every block with words, one size change each', () => {
        expect(
            genNoteSizeChanges(read, { kind: 'scale', factor: 1.25 }),
        ).toEqual([
            { block: 1, size: 'larger' },
            { block: 4, size: 'larger' },
        ]);
        expect(
            genNoteSizeChanges(read, { kind: 'scale', factor: 0.8 }),
        ).toEqual([
            { block: 1, size: 'smaller' },
            { block: 4, size: 'smaller' },
        ]);
        expect(genNoteSizeChanges(read, { kind: 'set', size: 30 })).toEqual([
            { block: 1, size: 30 },
            { block: 4, size: 30 },
        ]);
    });

    it('a note read in parts, a size the editor lacks: the assistant', () => {
        expect(
            genNoteSizeChanges(
                { ...read, nextFrom: 5 },
                { kind: 'scale', factor: 1.25 },
            ),
        ).toBeNull();
        expect(genNoteSizeChanges(read, { kind: 'set', size: 110 })).toBeNull();
        expect(
            genNoteSizeChanges(
                { blocks: [{ n: 1, kind: 'rule', text: '', isFixed: true }] },
                { kind: 'scale', factor: 1.25 },
            ),
        ).toBeNull();
        expect(genNoteSizeChanges(null, { kind: 'set', size: 20 })).toBeNull();
    });

    it('says what it did and that it is not saved', () => {
        const text = genNoteSizeDoneText('Sunday', 2);
        expect(text).toContain('2 blocks of “Sunday”');
        expect(text).toContain('not saved yet');
    });
});

// BN-08, 2026-11-08: a style for the whole note, done by the window.
describe('a whole-note style in a short English line', () => {
    it('reads the styles, a colour, an alignment, a font and a clear', () => {
        expect(readNoteStyleAsk('Make all the text bold')).toEqual({
            styles: ['bold'],
        });
        expect(readNoteStyleAsk('make the words italic.')).toEqual({
            styles: ['italic'],
        });
        expect(readNoteStyleAsk('Make everything dark blue')).toEqual({
            color: 'dark blue',
        });
        expect(readNoteStyleAsk('Centre everything')).toEqual({
            align: 'center',
        });
        expect(readNoteStyleAsk('Use Georgia for the whole note')).toEqual({
            font: 'georgia',
        });
        expect(readNoteStyleAsk('Clear the formatting')).toEqual({
            clear: true,
        });
        // One part, or anything longer, is the assistant's.
        expect(readNoteStyleAsk('Make the heading bold')).toBeNull();
        expect(readNoteStyleAsk('What is this note about?')).toBeNull();
    });

    it('is one change a block with words, a font only as the box lists it', () => {
        const read = {
            fonts: ['Arial', 'Georgia'],
            blocks: [
                { n: 1, kind: 'h1', text: 'Grace' },
                { n: 2, kind: 'picture', text: '', isFixed: true },
                { n: 3, kind: 'paragraph', text: 'Love is patient' },
                { n: 4, kind: 'paragraph', text: '' },
            ],
        };
        expect(genNoteStyleChanges(read, { styles: ['bold'] })).toEqual([
            { block: 1, styles: ['bold'] },
            { block: 3, styles: ['bold'] },
        ]);
        expect(genNoteStyleChanges(read, { font: 'georgia' })).toEqual([
            { block: 1, font: 'Georgia' },
            { block: 3, font: 'Georgia' },
        ]);
        expect(genNoteStyleChanges(read, { font: 'Comic Sans' })).toBeNull();
        expect(
            genNoteStyleChanges({ ...read, nextFrom: 5 }, { clear: true }),
        ).toBeNull();
        expect(genNoteStyleDoneText('Sunday', 2)).toContain('2 blocks');
    });
});

// A note the assistant MADE (`owa_bible_note add`, 2026-11-08): the window
// opens and attaches it by what the APP answered, never the model's words.
describe('readCreatedNote', () => {
    it('reads the note an add made, off its result', () => {
        expect(
            readCreatedNote(
                JSON.stringify({
                    file: 'Default',
                    added: 'Creation',
                    id: 8,
                    filePath: NOTE_PATH,
                    undoId: 'u-8',
                }),
            ),
        ).toEqual({
            name: 'Creation',
            filePath: NOTE_PATH,
            noteId: 8,
            undoId: 'u-8',
        });
        expect(
            readCreatedNote(
                JSON.stringify({ added: 'A', id: 0, filePath: NOTE_PATH }),
            ),
        ).toMatchObject({ noteId: 0, undoId: null });
    });

    it('a refusal, another file kind or a broken id made no note', () => {
        for (const text of [
            'A new note needs a `title`.',
            JSON.stringify({ added: 'A', id: 2 }),
            JSON.stringify({ added: 'A', id: 2, filePath: 'C:\\x\\Song.owl' }),
            JSON.stringify({ added: 'A', id: -1, filePath: NOTE_PATH }),
            JSON.stringify({ added: 'A', id: 1.5, filePath: NOTE_PATH }),
            JSON.stringify({ id: 2, filePath: NOTE_PATH }),
        ]) {
            expect(readCreatedNote(text), text).toBeNull();
        }
    });
});

// 2026-11-08: words selected in a note go to the tab already on it.
describe('the tab already on a note', () => {
    const asked = (attachments: ChatAttachmentType[]) => {
        return [{ id: 1, author: 'you', attachments }];
    };
    const sessions = [
        { id: 'box', messages: [] },
        { id: 'asked', messages: asked([SUNDAY]) },
        { id: 'closed', messages: asked([MERCY]), fileClosedAt: 1 },
        { id: 'other', messages: asked([MERCY]) },
    ];

    it('holds it in its box or in what it asked, the one in front first', () => {
        const draftMap = { box: [SUNDAY] };
        expect(
            findSessionHoldingNote(sessions, draftMap, 'box', NOTE_PATH, 3)
                ?.sessionId,
        ).toBe('box');
        // Else the newest; either kind of slash is the same file.
        expect(
            findSessionHoldingNote(
                sessions,
                {},
                'box',
                NOTE_PATH.replace(/\\/g, '/'),
                3,
            ),
        ).toEqual({ sessionId: 'asked', attachment: SUNDAY });
    });

    it('is not a tab that closed it, another note or another file', () => {
        expect(
            findSessionHoldingNote(sessions, {}, 'closed', NOTE_PATH, 4)
                ?.sessionId,
        ).toBe('other');
        expect(
            findSessionHoldingNote(sessions, {}, 'box', NOTE_PATH, 9),
        ).toBeNull();
        expect(
            findSessionHoldingNote(sessions, {}, 'box', 'C:\\other.own', 3),
        ).toBeNull();
    });
});

// BN-37 (2026-11-08): a model wrote a typed line into a note with one
// letter swapped for its look-alike. Here "1" stands for a look-alike of
// "l" -- a language's own pairs are in its package.
describe('words a model wrote, put back to the typed ones', () => {
    const PAIRS: [string, string][] = [['l', '1']];
    const TYPED = 'add a line at the end saying all is well';

    it('takes the typed letters where only a look-alike differs', () => {
        expect(restoreTypedWords('a11 is we11', TYPED, PAIRS)).toBe(
            'all is well',
        );
        expect(restoreTypedWords('**a11** is we11', TYPED, PAIRS)).toBe(
            '**all** is well',
        );
    });

    it('keeps the person’s own letters, whichever of the two they typed', () => {
        expect(
            restoreTypedWords('all is well', 'saying a11 is we11', PAIRS),
        ).toBe('a11 is we11');
    });

    it('leaves words they did not type, and words already as typed', () => {
        expect(restoreTypedWords('a11 is good', TYPED, PAIRS)).toBe(
            'all is good',
        );
        expect(restoreTypedWords('goo1', TYPED, PAIRS)).toBe('goo1');
        expect(restoreTypedWords('all is well', TYPED, PAIRS)).toBe(
            'all is well',
        );
        expect(restoreTypedWords('a11', TYPED, [])).toBe('a11');
    });

    it('puts back each change’s words and a new title, nothing else', () => {
        const args = {
            action: 'edit',
            file: 'C:\\notes\\Default.own',
            changes: [
                { after: 2, text: 'a11 is we11' },
                { block: 1, color: 'red', words: 'we11' },
            ],
            title: 'A11 is we11',
        };
        expect(restoreNoteTypedWords(args, TYPED, PAIRS)).toEqual({
            ...args,
            changes: [
                { after: 2, text: 'all is well' },
                { block: 1, color: 'red', words: 'we11' },
            ],
            title: 'A11 is well',
        });
        expect(restoreNoteTypedWords(args, '', PAIRS)).toBe(args);
    });
});

// BN-55 (2026-11-09, the elder run): a lesson on another subject asked for
// in the conversation about one lesson had been written over that lesson.
describe('a lesson of its own', () => {
    it('is read off what they asked for, in the words an older person types', () => {
        for (const text of [
            'Can you make me a whole lesson about forgiveness. Same like this one',
            'write a lesson about Joseph forgiving his brothers',
            'a short devotion about Psalm 121 please, I will read it at choir',
            'I need lesson about David and Goliath for the kids',
            'Make lesson for me about love one another. My english not so good',
            'i need an outline for next week, Luke 15 the lost sheep',
            'make a version of this lesson for children 5 to 8 years old',
            'Lesson for Fathers Day please. About Joseph the husband of Mary',
            'please start a new lesson called The Lost Sheep',
        ]) {
            expect(checkIsNewLessonAsk(text)).toBe(true);
        }
    });

    it('is no new lesson when the words are about this one', () => {
        for (const text of [
            'Is this a good lesson?',
            'can you help me with my sunday school lesson',
            'I need chatbot help me prepare lesson',
            'write a short prayer for my lesson about the shepherd',
            'make the lesson for sunday school line smaller, it is not important',
            'make the outline of my lesson clearer',
            'can I make a folder for children lessons and one for adult lessons',
            'I want to put a picture of a shepherd in my lesson',
            'Can you write a lesson plan with times?',
            'lesson for sunday school adult class, change it to Lesson for the Golden Years class',
        ]) {
            expect(checkIsNewLessonAsk(text)).toBe(false);
        }
    });

    it('rides on the ask, under their words', () => {
        const asked = toNoteAsk('write a lesson about Joseph', [
            { name: 'The Good Shepherd', text: '1 h1: The Good Shepherd' },
        ]);
        expect(asked.split('\n\n')[1]).toBe(NOTE_NEW_LESSON_HINT);
        expect(
            toNoteAsk('make the title red', [
                { name: 'The Good Shepherd', text: '1 h1: The Good Shepherd' },
            ]),
        ).not.toContain(NOTE_NEW_LESSON_HINT);
    });
});

// 2026-11-10, the goal _chatbot completely smart enough to help prepare a
// best preaching lesson_: what a lesson holds rides on every lesson ask in
// a note conversation, and an EMPTY note is where the lesson goes.
describe('a lesson to preach, in a note conversation', () => {
    const BLANK_READ = toNoteDocumentText({
        blockCount: 1,
        file: 'Default',
        hash: 'h1',
        blocks: [{ n: 1, kind: 'paragraph', text: '' }],
    });
    const EMPTY_READ = toNoteDocumentText({
        blockCount: 0,
        file: 'Default',
        hash: 'h0',
        blocks: [],
    });
    const LESSON_READ = toNoteDocumentText({
        blockCount: 2,
        file: 'Default',
        hash: 'h2',
        blocks: [
            { n: 1, kind: 'h1', text: 'The Good Shepherd' },
            { n: 2, kind: 'passage', isFixed: true, text: '' },
        ],
    });

    it('a note read is blank only when it says it holds nothing', () => {
        expect(checkIsBlankNoteText(BLANK_READ)).toBe(true);
        expect(checkIsBlankNoteText(EMPTY_READ)).toBe(true);
        expect(checkIsBlankNoteText(LESSON_READ)).toBe(false);
        // A passage alone is something: it is fixed, not empty.
        expect(
            checkIsBlankNoteText(
                toNoteDocumentText({
                    blocks: [{ n: 1, kind: 'passage', isFixed: true }],
                }),
            ),
        ).toBe(false);
        expect(checkIsBlankNoteText(null)).toBe(false);
        expect(checkIsBlankNoteText('1 h1: Not the read format')).toBe(false);
    });

    it('a lesson asked for in an empty note goes INTO it', () => {
        for (const text of [
            'help me prepare a sermon on John 10',
            'make a best preaching lesson about the prodigal son',
            "I'm preaching on Psalm 23 this Sunday",
            'write the sermon about grace',
        ]) {
            expect(genNoteLessonHint(text, true), text).toBe(
                NOTE_BLANK_LESSON_HINT,
            );
        }
        const asked = toNoteAsk('help me prepare a sermon on John 10', [
            { name: 'Sunday', text: BLANK_READ },
        ]);
        expect(asked).toContain(NOTE_BLANK_LESSON_HINT);
        expect(asked).not.toContain(NOTE_NEW_LESSON_HINT);
        // Into THIS note: the window writes the add into it.
        expect(NOTE_BLANK_LESSON_HINT).toContain('INTO it');
        expect(NOTE_BLANK_LESSON_HINT).toContain('not a new one');
        // An empty note and a question: still a question.
        expect(genNoteLessonHint('how do I write a sermon here?', true)).toBe(
            null,
        );
    });

    it('a new lesson beside a lesson is still a NEW note, with its shape', () => {
        expect(
            genNoteLessonHint('make a lesson about forgiveness', false),
        ).toBe(NOTE_NEW_LESSON_HINT);
        expect(NOTE_NEW_LESSON_HINT).toContain('WHAT A LESSON HOLDS');
        expect(NOTE_NEW_LESSON_HINT).toContain('[^John 10:11-18]');
    });

    it('their own lesson made whole, or judged, in THIS note', () => {
        for (const text of [
            'finish my sermon please',
            'can you complete this lesson, I only have the points',
            'flesh out the outline into something I can preach',
            'make it a full sermon',
            'improve my sermon',
        ]) {
            expect(genNoteLessonHint(text, false), text).toBe(
                NOTE_LESSON_FINISH_HINT,
            );
        }
        for (const text of [
            'review my sermon',
            'is this a good lesson?',
            'what do you think of my sermon',
            'is it ready to preach?',
            'any suggestions for my lesson',
        ]) {
            expect(genNoteLessonHint(text, false), text).toBe(
                NOTE_LESSON_REVIEW_HINT,
            );
        }
        const asked = toNoteAsk('is this a good lesson?', [
            { name: 'The Good Shepherd', text: LESSON_READ },
        ]);
        expect(asked).toContain(NOTE_LESSON_REVIEW_HINT);
        // BN-66: judged as the blind readers judged, truth weighed first,
        // the fixes offered as buttons.
        const truthAt = NOTE_LESSON_REVIEW_HINT.indexOf('true to it');
        expect(truthAt).toBeGreaterThan(0);
        expect(truthAt).toBeLessThan(
            NOTE_LESSON_REVIEW_HINT.indexOf('a concrete example'),
        );
        expect(NOTE_LESSON_REVIEW_HINT).toContain('END with them as OPTIONS');
        // It says to change nothing itself: not twice.
        expect(asked).not.toContain(NOTE_QUESTION_HINT);
        expect(NOTE_LESSON_FINISH_HINT).toContain('nothing removed');
    });

    // BN-67 (2026-11-10): six loose lines finished as a lesson -- the one
    // long edit dropped by the shared server, the retries in parts naming
    // blocks their own first part had moved.
    it('loose lines are written over by one flat add, every line kept', () => {
        const loose = toNoteDocumentText({
            blockCount: 3,
            file: 'Default',
            hash: 'h4',
            blocks: [
                { n: 1, kind: 'paragraph', text: 'mark 4 storm' },
                { n: 2, kind: 'paragraph', text: 'jesus asleep in the boat' },
                { n: 3, kind: 'paragraph', text: 'peace be still' },
            ],
        });
        const notes = [{ name: 'Storm', text: loose }];
        const rewrite = readNoteRewrite('finish my sermon', notes)!;
        expect(rewrite).toEqual({
            lines: [
                'mark 4 storm',
                'jesus asleep in the boat',
                'peace be still',
            ],
            lineBlocks: [1, 2, 3],
            blockCount: 3,
        });
        // An EDIT that weaves their lines into a lesson takes out each line
        // its new words hold -- seen live, all six left at the note's end --
        // and keeps one it does not hold.
        expect(
            withRewrittenLinesRemoved(
                {
                    action: 'edit',
                    changes: [
                        {
                            after: 1,
                            kind: 'section',
                            text: '## 1. **jesus asleep in the boat**\nThe storm of Mark 4.',
                        },
                    ],
                },
                rewrite,
            ).changes,
        ).toEqual([
            expect.objectContaining({ after: 1, kind: 'section' }),
            { block: 1, remove: true },
            { block: 2, remove: true },
        ]);
        // BN-223: the edit itself taking out or writing over a line of
        // theirs that its new words do not hold is refused; one they hold,
        // or one left alone, is not.
        expect(
            findRewriteLineLoss(
                {
                    action: 'edit',
                    changes: [
                        { block: 3, remove: true },
                        { block: 2, text: '## 1. Jesus asleep in the boat' },
                        { after: 3, kind: 'section', text: 'The storm.' },
                    ],
                },
                rewrite,
            ),
        ).toContain('"peace be still"');
        expect(
            findRewriteLineLoss(
                {
                    action: 'edit',
                    changes: [
                        { block: 3, remove: true },
                        { after: 3, kind: 'section', text: 'Peace, be still.' },
                    ],
                },
                rewrite,
            ),
        ).toBeNull();
        const asIs = { action: 'edit', changes: [{ block: 3, text: 'x' }] };
        expect(withRewrittenLinesRemoved(asIs, rewrite)).toBe(asIs);
        const asked = toNoteAsk(
            'finish my sermon',
            notes,
            null,
            false,
            null,
            null,
            false,
            rewrite,
        );
        expect(asked).toContain(NOTE_LESSON_REWRITE_HINT);
        expect(asked).not.toContain(NOTE_LESSON_FINISH_HINT);
        expect(asked).not.toContain('Where each missing part goes');
        // Not for another ask, a heading, a part of it read, or two notes.
        expect(readNoteRewrite('make the title red', notes)).toBeNull();
        expect(
            readNoteRewrite('finish my sermon', [notes[0], notes[0]]),
        ).toBeNull();
        const headed = toNoteDocumentText({
            blockCount: 2,
            blocks: [
                { n: 1, kind: 'h2', text: 'Big idea' },
                { n: 2, kind: 'paragraph', text: 'He calms it.' },
            ],
        });
        expect(
            readNoteRewrite('finish my sermon', [{ name: 'x', text: headed }]),
        ).toBeNull();
        const partRead = toNoteDocumentText({
            blockCount: 30,
            blocks: [
                { n: 1, kind: 'paragraph', text: 'storm' },
                { n: 2, kind: 'paragraph', text: 'boat' },
            ],
        });
        expect(
            readNoteRewrite('finish my sermon', [
                { name: 'x', text: partRead },
            ]),
        ).toBeNull();
        // A line is lost when fewer than four in five of its words are in
        // the lesson; a verse token's words count.
        expect(
            findLostNoteLines(
                rewrite.lines,
                '[^Mark 4:35-41]\n## 1. Jesus asleep in the boat\nThe storm.',
            ),
        ).toEqual(['peace be still']);
        // BN-223 (F-04): a line marking their own story keeps every word
        // that carries it -- with no hospital in the lesson it is lost --
        // while another line is kept on four words in five, a word's plural
        // or past counting as the word, and the KJV's "ship" for "boat".
        const storyLesson =
            'In the night a parent sits in a waiting room. My story is ' +
            'told. Even the wind and the sea obey him: who is this? Jesus ' +
            'was asleep in the ship.';
        expect(
            findLostNoteLines(
                [
                    'my story: the night at the hospital',
                    'who is this? even the wind obeys him',
                    'jesus asleep in the boat',
                ],
                storyLesson,
            ),
        ).toEqual(['my story: the night at the hospital']);
        expect(
            findLostNoteLines(
                ['Testimony - the night at the hospital'],
                `${storyLesson} **For example:** The night at the hospital.`,
            ),
        ).toEqual([]);
        expect(
            genLostNoteLinesRefusal(['my story: the night at the hospital']),
        ).toContain('A story of theirs is the example');
        expect(genLostNoteLinesRefusal(['peace be still'])).not.toContain(
            'story',
        );
    });

    // BN-67 (2026-11-10): told only to add "the parts it lacks", a model
    // added the closing parts to a sermon whose points were a line each.
    it('finishing, the window names what the lesson lacks', () => {
        const sermon = toNoteDocumentText({
            blockCount: 11,
            file: 'Default',
            hash: 'h3',
            blocks: [
                {
                    n: 1,
                    kind: 'passage',
                    isFixed: true,
                    text: '(KJV) Mark 10:46-52 — (46): And they came',
                },
                { n: 2, kind: 'h2', text: 'Big idea' },
                { n: 3, kind: 'paragraph', text: 'Jesus stops for the one.' },
                { n: 4, kind: 'h2', text: 'Introduction' },
                { n: 5, kind: 'paragraph', text: 'Told to stop asking?' },
                { n: 6, kind: 'h2', text: '1. He cries out [^Mark 10:47]' },
                { n: 7, kind: 'paragraph', text: 'He cried the more.' },
                { n: 8, kind: 'h2', text: '2. Jesus stops [^Mark 10:49]' },
                { n: 9, kind: 'paragraph', text: 'He stood still.' },
                { n: 10, kind: 'paragraph', text: 'He called him.' },
                { n: 11, kind: 'h2', text: '3. He follows [^Mark 10:52]' },
            ],
        });
        const gaps = genLessonGapsText(sermon)!;
        // Each part where it goes, by the note as read: the background
        // after the big idea, a point's words after its own line, the
        // closing parts after the last point -- point 2 has two lines.
        const pointWords =
            'verse token if it has none, what it means, an example from ' +
            'life and how to live it this week';
        expect(gaps).toBe(
            '(Where each missing part goes, by the note as read -- one add ' +
                'a place: after block 3: Background; after block 7: point ' +
                `1's ${pointWords}; after block 11: point 3's ${pointWords}, ` +
                'then Pointing to Jesus, then Response, then Closing prayer, ' +
                'then Questions for discussion, then Memory verse.)',
        );
        const asked = toNoteAsk('finish my sermon', [
            { name: 'Bartimaeus', text: sermon },
        ]);
        expect(asked).toContain(NOTE_LESSON_FINISH_HINT);
        expect(asked).toContain(gaps);
        // BN-223 (F-03, finished in place): their own words are written
        // over or taken out only by a refused edit; a heading of theirs
        // given its number and its verse token moved keeps its words.
        const own = readFinishOwnBlocks(asked)!;
        expect(own.map((block) => block.n)).toEqual([
            2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
        ]);
        expect(own.find((block) => block.n === 6)?.words).toBe(
            '1. He cries out',
        );
        expect(readFinishOwnBlocks('finish my sermon')).toBeNull();
        expect(
            findFinishOwnWordsLoss(
                {
                    action: 'edit',
                    changes: [
                        { after: 3, kind: 'section', text: '## Background' },
                        { block: 6, kind: 'h2', text: '1. He cries out' },
                        { block: 7, text: 'He cried the more, a great deal.' },
                    ],
                },
                own,
            ),
        ).toBeNull();
        const loss = findFinishOwnWordsLoss(
            {
                action: 'edit',
                changes: [
                    { block: 5, text: 'A man sits in the dust by the road.' },
                    { block: 10, remove: true },
                ],
            },
            own,
        );
        expect(loss).toContain('block 5, "Told to stop asking?"');
        expect(loss).toContain('block 10, "He called him."');
        // An outline of lines, no heading: every part, the passage first.
        expect(
            genLessonGapsText(
                toNoteDocumentText({
                    blocks: [
                        { n: 1, kind: 'paragraph', text: 'mark 4 storm' },
                        { n: 2, kind: 'paragraph', text: 'peace be still' },
                    ],
                }),
            ),
        ).toContain('it lacks: the main passage printed first; Big idea;');
        // Its points a list under a title line: each item its point, made a
        // heading where it stands, the frame round them.
        const listed = genLessonGapsText(
            toNoteDocumentText({
                blocks: [
                    { n: 1, kind: 'paragraph', text: 'Sermon on worry' },
                    { n: 2, kind: 'bullet', text: 'Do not worry' },
                    { n: 3, kind: 'bullet', text: 'Seek first' },
                ],
            }),
        )!;
        expect(listed).toContain(
            'after block 1: the main passage, its token alone on its line, ' +
                'then Big idea, then Background, then Introduction; after ' +
                'block 2: point 1 -- block 2 itself made {kind: "h2", text: ' +
                '"1. " and its own words}',
        );
        expect(listed).toContain(
            'how to live it this week, then Pointing to Jesus, then ' +
                'Response, then Closing prayer, then Questions for ' +
                'discussion, then Memory verse.)',
        );
        expect(listed.indexOf('after block 3: point 2')).toBeGreaterThan(0);
        // Headings in words no English part name reads: never told it
        // lacks them all.
        const ownWords = genLessonGapsText(
            toNoteDocumentText({
                blocks: [
                    { n: 1, kind: 'passage', isFixed: true, text: 'x' },
                    { n: 2, kind: 'h2', text: 'Grand plan' },
                    { n: 3, kind: 'paragraph', text: 'Words of theirs.' },
                    { n: 4, kind: 'h2', text: 'Opening words' },
                ],
            }),
        );
        expect(ownWords).toBeNull();
        expect(
            toNoteAsk('is this a good lesson?', [
                { name: 'Bartimaeus', text: sermon },
            ]),
        ).not.toContain('to work down');
        // "finish it please" -- seen live, no hint at all -- names the
        // lesson beside one, and nothing beside a note of reminders.
        expect(checkIsLessonNoteText(sermon)).toBe(true);
        for (const text of [
            'finish it please',
            'can you complete this?',
            'please finish the rest for me',
        ]) {
            expect(
                toNoteAsk(text, [{ name: 'Bartimaeus', text: sermon }]),
                text,
            ).toContain(NOTE_LESSON_FINISH_HINT);
        }
        const reminders = toNoteDocumentText({
            blocks: [
                { n: 1, kind: 'h2', text: 'Prayer requests' },
                { n: 2, kind: 'bullet', text: 'call Tom' },
            ],
        });
        expect(checkIsLessonNoteText(reminders)).toBe(false);
        expect(
            toNoteAsk('finish it please', [{ name: 'Week', text: reminders }]),
        ).not.toContain(NOTE_LESSON_FINISH_HINT);
    });

    it('no lesson hint for a change that only names a part of it', () => {
        for (const text of [
            'make the title red',
            'improve the drawing, make it bigger',
            'what do you think of the colour?',
            'is it ok to bold the title?',
            'add a prayer at the end',
            'Can you write a lesson plan with times?',
        ]) {
            expect(genNoteLessonHint(text, false), text).toBe(null);
        }
    });
});

// BN-55: a hello had the note's misspelt line corrected, unasked.
describe('a greeting or a question, nothing to change', () => {
    it('is a line that greets or asks with no word asking for a change', () => {
        for (const text of [
            'HELLO CAN YOU HELP ME',
            'are you a real person or a computer',
            'How I start? I am new for this program',
            'can you see what i wrote in my lesson',
            'is this going to cost me money',
            'thank you dear, God bless',
        ]) {
            expect(checkIsNoteQuestionOnly(text)).toBe(true);
        }
    });

    it('is no such line when it asks for something done to the note', () => {
        for (const text of [
            'can you make the title bigger?',
            'Can you check all lesson for grammar mistake? my english not perfect',
            'could you put the hymn at the top?',
            'what about adding a prayer at the end?',
            'the letters are too small',
            'make the leters bigger please i cant see them good',
            'how do I save this',
        ]) {
            expect(checkIsNoteQuestionOnly(text)).toBe(false);
        }
    });

    it('rides on the ask', () => {
        expect(
            toNoteAsk('are you a real person or a computer', [
                { name: 'The Good Shepherd', text: '1 h1: The Good Shepherd' },
            ]).split('\n\n')[1],
        ).toBe(NOTE_QUESTION_HINT);
    });
});

// BN-58: a messy note formatted, the card's Format button first.
describe('a format ask', () => {
    it('is the button and the words a person uses for the job', () => {
        for (const text of [
            'Format it so it is neat and easy to read',
            'my note is messy can you tidy it up',
            'please make it look nice',
            'can you clean it up and organise it',
        ]) {
            expect(checkIsNoteFormatAsk(text)).toBe(true);
        }
        for (const text of [
            'I am so sorry I think I made a mess of it',
            'i just want it easy to read, the letters are small',
            'make the title red',
        ]) {
            expect(checkIsNoteFormatAsk(text)).toBe(false);
        }
    });

    it('rides on the ask', () => {
        expect(
            toNoteAsk('my note is messy can you tidy it up', [
                { name: 'lost sheep', text: '1 paragraph: points' },
            ]),
        ).toContain(NOTE_FORMAT_HINT);
    });
});

// 2026-11-10: a whole lesson nested in owa_note_edit's `changes` came back
// from the shared gemma4:cloud as no reply 7 times of 8, as one flat
// `owa_bible_note add` text 5 of 5 -- so an add in a conversation about an
// EMPTY note is written into that note by the window.
describe('a lesson made for an empty note goes into it', () => {
    it('reads how many empty blocks a blank note has, or null', () => {
        const blank = toNoteDocumentText({
            blockCount: 1,
            hash: 'h',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        expect(readBlankNoteBlockCount(blank)).toBe(1);
        expect(
            readBlankNoteBlockCount(toNoteDocumentText({ blocks: [] })),
        ).toBe(0);
        expect(
            readBlankNoteBlockCount(
                toNoteDocumentText({
                    blocks: [{ n: 1, kind: 'paragraph', text: 'Grace' }],
                }),
            ),
        ).toBe(null);
        expect(readBlankNoteBlockCount(null)).toBe(null);
    });

    it('turns the add into ONE edit of that note, its empty blocks out', () => {
        expect(
            toBlankNoteFillArgs(
                {
                    action: 'add',
                    title: 'The Good Shepherd',
                    text: '# The Good Shepherd\n[^John 10:11-18]\n## Big idea\nHe gives.',
                },
                'Sermon Prep',
                1,
            ),
        ).toEqual({
            action: 'edit',
            note: 'Sermon Prep',
            title: 'The Good Shepherd',
            changes: [
                { block: 1, remove: true },
                {
                    after: 0,
                    kind: 'section',
                    // The title line again is the note's name already.
                    text: '[^John 10:11-18]\n## Big idea\nHe gives.',
                },
            ],
        });
        expect(
            toBlankNoteFillArgs({ action: 'add', text: 'Grace' }, 'N', 0),
        ).toEqual({
            action: 'edit',
            note: 'N',
            changes: [{ after: 0, kind: 'section', text: 'Grace' }],
        });
    });

    it('leaves every other call to the tool', () => {
        expect(toBlankNoteFillArgs({ action: 'list' }, 'N', 1)).toBe(null);
        expect(
            toBlankNoteFillArgs(
                { action: 'add', title: 'X', text: ' ' },
                'N',
                1,
            ),
        ).toBe(null);
        expect(toBlankNoteFillArgs(null, 'N', 1)).toBe(null);
    });

    it('the empty note hint asks for that add', () => {
        expect(NOTE_BLANK_LESSON_HINT).toContain('owa_bible_note action "add"');
        expect(NOTE_BLANK_LESSON_HINT).toContain('into this empty');
    });
});

// 2026-11-10: "check that my verses are right" was answered as checked with
// no verse read, over a point that gave Isaiah 53:5's words to 53:6.
describe('checking the verses a lesson cites', () => {
    it('is read off a checking word, or their verses called right or wrong', () => {
        for (const text of [
            'check that my verses are right',
            'can you verify the references',
            'please double-check the scriptures I used',
            'are my verses correct?',
            'make sure the bible quotes are accurate',
            // EC-497: a study's cross references are its verses too.
            'Are the cross references in this study file right?',
            'are its cross-references correct?',
            'check each crossref it cites',
        ]) {
            expect(checkIsNoteVerseCheckAsk(text), text).toBe(true);
        }
        for (const text of [
            'add verses that fit point 2',
            'are there verses about love?',
            'check the spelling',
            'add John 3:16',
            'add cross references under each point',
        ]) {
            expect(checkIsNoteVerseCheckAsk(text), text).toBe(false);
        }
    });

    it('collects each verse once, by the Bible its token names', () => {
        expect(
            collectNoteVerseRefs([
                '9. bullet: "See [^(KJV) Isaiah 53:6] and [^(KJV) Romans 5:8]"\n' +
                    '10. paragraph: "[^(KJV) Isaiah 53:6] again, [^John 3:16]"',
                null,
                '1. h2: "[^(NIV) Psalm 23:1]"',
            ]),
        ).toEqual([
            { bible: 'KJV', refs: ['Isaiah 53:6', 'Romans 5:8'] },
            { bible: null, refs: ['John 3:16'] },
            { bible: 'NIV', refs: ['Psalm 23:1'] },
        ]);
        expect(collectNoteVerseRefs(['no verses'])).toEqual([]);
    });

    it('puts the verses as read beside the note, and changes nothing', () => {
        const text = toNoteVerseReadText([
            {
                bible: 'KJV',
                verses: [
                    {
                        ref: 'Isaiah 53:6',
                        text: 'All we like sheep have gone astray',
                    },
                ],
            },
        ]);
        expect(text).toContain('- (KJV) Isaiah 53:6');
        expect(text).toContain(
            'the Bible says: "All we like sheep have gone astray"',
        );
        expect(text).toContain('Change nothing unasked');
        expect(toNoteVerseReadText([{ verses: [] }])).toBe(null);
        const asked = toNoteAsk(
            'check that my verses are right',
            [{ name: 'Sermon', text: '1. paragraph: "x"' }],
            null,
            false,
            null,
            text,
        );
        expect(asked).toContain(text!);
        expect(asked).not.toContain(NOTE_QUESTION_HINT);
    });
});

// 2026-11-10: "it is too long, make it fit 15 minutes" took out every
// example and application of the lesson.
describe('a lesson made shorter', () => {
    it('is read off time and length, never a line made shorter', () => {
        for (const text of [
            'it is too long, make it fit 15 minutes',
            'my sermon is way too long',
            'can you shorten my lesson',
            'cut it down to twenty minutes',
            'make the sermon shorter please',
        ]) {
            expect(genNoteLessonHint(text, false), text).toBe(
                NOTE_LESSON_SHORTEN_HINT,
            );
        }
        for (const text of [
            'make the title shorter',
            'shorten the third question',
            'how long will this take to preach?',
        ]) {
            expect(genNoteLessonHint(text, false), text).not.toBe(
                NOTE_LESSON_SHORTEN_HINT,
            );
        }
        expect(NOTE_LESSON_SHORTEN_HINT).toContain('ONE example');
    });
});

describe('the verse check sets each verse beside the note', () => {
    it('quotes what the note says next to what the Bible says', () => {
        const note = toNoteDocumentText({
            blocks: [
                {
                    n: 14,
                    kind: 'bullet',
                    text: 'Cross-reference: [^(KJV) Isaiah 53:6] -- wounded for our transgressions.',
                },
            ],
        });
        const text = toNoteVerseReadText(
            [
                {
                    bible: 'KJV',
                    verses: [
                        {
                            ref: 'Isaiah 53:6',
                            text: 'All we like sheep have gone astray',
                        },
                    ],
                },
            ],
            [note],
        )!;
        expect(text).toContain(
            'the note says: "Cross-reference: Isaiah 53:6 -- wounded for our transgressions."',
        );
        expect(text).toContain(
            'the Bible says: "All we like sheep have gone astray"',
        );
        expect(text).toContain('is WRONG');
    });
});

// 2026-11-10: "help me prepare a sermon" asked which passage; the passage
// pressed under it was written as a fifteen-line outline, its words no
// lesson ask of their own.
describe('the answer to "which passage?" under a lesson asked for', () => {
    it('carries the empty note lesson hint while the note is still empty', () => {
        expect(
            genNoteLessonHint('The Prodigal Son (Luke 15:11-32)', true, true),
        ).toBe(NOTE_BLANK_LESSON_HINT);
        // Nothing asked for before it: a passage named alone is no lesson.
        expect(
            genNoteLessonHint('The Prodigal Son (Luke 15:11-32)', true),
        ).toBe(null);
        // A lesson already written, the note no longer empty: no hint.
        expect(
            genNoteLessonHint('The Prodigal Son (Luke 15:11-32)', false, true),
        ).toBe(null);
        // A question asked next is answered, not written.
        expect(genNoteLessonHint('what is a sermon?', true, true)).toBe(null);
        const blank = toNoteDocumentText({ blocks: [] });
        expect(
            toNoteAsk(
                'Faith over Fear (Psalm 23)',
                [{ name: 'Sermon Prep', text: blank }],
                null,
                false,
                null,
                null,
                true,
            ),
        ).toContain(NOTE_BLANK_LESSON_HINT);
    });
});

// BN-64 (2026-11-10): an empty note's card offers a lesson.
describe('the card of an empty note', () => {
    const LANGUAGE = { code: 'en', name: 'English', nativeName: 'English' };

    it('offers a lesson in place of the jobs an empty note cannot use', () => {
        const card = genNoteOpeningAnswer('Sunday', LANGUAGE as any, [], true);
        expect(card.text).toContain('“Sunday” is still empty');
        expect(card.replies).toEqual([
            'Help me prepare a preaching lesson',
            "Help me prepare a children's lesson",
            'Help me prepare a short devotion',
        ]);
        expect(card.translateLanguage).toBe(null);
        for (const reply of card.replies) {
            expect(checkIsLessonCardAsk(reply)).toBe(true);
        }
        expect(checkIsLessonCardAsk('Check the spelling')).toBe(false);
        expect(checkIsLessonCardAsk('')).toBe(false);
        // A note with words keeps its own card.
        expect(
            genNoteOpeningAnswer('Sunday', LANGUAGE as any, []).replies,
        ).toContain('Format it so it is neat and easy to read');
    });

    it('tells an empty note by the text its attachment read off the file', () => {
        const toAttachment = (summary: string) => {
            return {
                id: 1,
                kind: 'text',
                name: 'Sunday',
                filePath: 'C:\notes\Default.own',
                noteId: 3,
                summary,
            } as any;
        };
        expect(
            checkIsEmptyNoteAttachment(
                toAttachment('Attached text Sunday:\nNote: Sunday\n'),
            ),
        ).toBe(true);
        expect(
            checkIsEmptyNoteAttachment(
                toAttachment('Attached text Sunday:\nNote: Sunday\nGrace'),
            ),
        ).toBe(false);
        expect(
            checkIsEmptyNoteAttachment({
                ...toAttachment('Note: Sunday'),
                noteId: undefined,
            }),
        ).toBe(false);
    });

    // Seen live 2026-11-10: the card read an empty note as one with words,
    // because the file's reader writes its body as a marker. Built the way
    // the window builds it (`genNoteAttachment`), off a note file's text.
    it('tells an empty note as the window reads it off the file', () => {
        const paragraph = (text: string) => {
            return {
                type: 'paragraph',
                children:
                    text === '' ? [] : [{ type: 'text', text, format: 0 }],
            };
        };
        const toFileAttachment = (text: string) => {
            const fileText = JSON.stringify({
                items: [
                    {
                        metadata: { id: 2 },
                        title: 'Sunday',
                        content: JSON.stringify({
                            root: { type: 'root', children: [paragraph(text)] },
                        }),
                    },
                ],
            });
            const note = toNoteItemFromFileText(fileText, 2)!;
            return {
                ...genTextAttachment(
                    note.title,
                    `Note: ${note.title}\n${note.text}`,
                    'C:/notes/Default.own',
                ),
                noteId: 2,
            };
        };
        expect(checkIsEmptyNoteAttachment(toFileAttachment(''))).toBe(true);
        expect(checkIsEmptyNoteAttachment(toFileAttachment('Grace'))).toBe(
            false,
        );
    });

    it('every lesson anywhere follows the outline; a point expands in place', () => {
        expect(NOTE_SYSTEM_PROMPT).toContain(
            'A lesson or sermon you write runs',
        );
        expect(NOTE_SYSTEM_PROMPT).toContain(
            'the window puts it into the empty note',
        );
        // BN-67: numbers as read, one add a place, a point grows where it is.
        expect(NOTE_LESSON_FINISH_HINT).toContain('AS YOU READ IT');
        expect(NOTE_LESSON_FINISH_HINT).toContain('give each place ONE add');
        expect(NOTE_LESSON_FINISH_HINT).toContain('stays where it is');
        expect(NOTE_LESSON_FINISH_HINT).toContain(
            'even when it has a sentence',
        );
    });
});

// BN-76 (2026-11-10, the blind readers of BN-74): the commonest error in the
// lessons was a phrase in quotation marks the passage just read does not say.
describe('a quote of the passage is its words', () => {
    const PSALM_51_13 =
        '(KJV) Psalm 51:13 — (13): Then will I teach transgressors thy ' +
        'ways; and sinners shall be converted unto thee.';

    it('names a quote near the passage that is not word for word', () => {
        expect(
            findNoteMisquotes(
                'David vows: "sinners shall return unto thee" (v. 13).',
                [PSALM_51_13],
            ),
        ).toEqual(['sinners shall return unto thee']);
        expect(
            genNoteMisquoteRefusal(['sinners shall return unto thee']),
        ).toContain('does not say “sinners shall return unto thee”');
    });

    // BN-274: the model read no passage, so "as it was read" pointed at
    // words it never saw -- the window's read is given with the refusal.
    it('gives the passage the window read, cut where it is long', () => {
        const refusal = genNoteMisquoteRefusal(['he broke it'], {
            ref: '1 Corinthians 11:24',
            text: ' (24): And when he had given thanks, he brake it ',
        });
        expect(refusal).toContain('does not say “he broke it”');
        expect(refusal).toMatch(
            /the window read it -- 1 Corinthians 11:24: \(24\): And when he had given thanks, he brake it$/,
        );
        const long = genNoteMisquoteRefusal(['x y z'], {
            ref: 'Psalm 119:1-176',
            text: 'word '.repeat(1000),
        });
        expect(long.endsWith('…')).toBe(true);
        expect(long.length).toBeLessThan(3500);
    });

    it('lets the passage, a cut quote and the lesson’s own words through', () => {
        expect(
            findNoteMisquotes('“sinners shall be converted unto thee”', [
                PSALM_51_13,
            ]),
        ).toEqual([]);
        expect(
            findNoteMisquotes(
                '"Then will I teach transgressors … sinners shall be converted"',
                [PSALM_51_13],
            ),
        ).toEqual([]);
        // A hearer's question shares next to nothing with the passage.
        expect(
            findNoteMisquotes(
                'Someone may ask, "Can God really forgive what I did?"',
                [PSALM_51_13],
            ),
        ).toEqual([]);
        // Nothing read: nothing to hold a quote to.
        expect(
            findNoteMisquotes('"sinners shall return unto thee"', []),
        ).toEqual([]);
    });
});

// BN-114 (2026-11-11, the BN-108..112 read): "The New Testament tells us
// that 'But he was wounded for our transgressions' [Isaiah 53:5]".
describe('a verse is in the Testament its book is in', () => {
    it('names a sentence that puts a verse in the other Testament', () => {
        const slips = findTestamentSlips(
            'The New Testament tells us that "But he was wounded for our ' +
                'transgressions" [^(KJV) Isaiah 53:5]. The Old Testament ' +
                'says "God so loved the world" (John 3:16).',
        );
        expect(slips).toEqual([
            { testament: 'New', refs: ['Isaiah 53:5'] },
            { testament: 'Old', refs: ['John 3:16'] },
        ]);
        expect(genTestamentSlipRefusal(slips)).toContain(
            'Isaiah 53:5 is in the Old Testament, and the sentence says the ' +
                'New Testament',
        );
        // BN-115's live run: an Old Testament verse first, a New one after.
        expect(
            findTestamentSlips(
                'The New Testament tells us that "with his stripes we are ' +
                    'healed" [^(KJV) Isaiah 53:5], and that Jesus "spoiled ' +
                    'principalities and powers" [^(KJV) Colossians 2:15].',
            ),
        ).toEqual([{ testament: 'New', refs: ['Isaiah 53:5'] }]);
    });

    it('lets a right Testament, both named, or an unknown book be', () => {
        for (const text of [
            'Isaiah foresaw it, and the New Testament applies it to Jesus ' +
                '(1 Peter 2:24).',
            'In the Old Testament, David says it plainly (Psalm 23:1).',
            'The Old Testament promise (Isaiah 53:5) is fulfilled in the New ' +
                'Testament (1 Peter 2:24).',
            'The New Testament quotes Hezekiah 3:1 here.',
            'The New Testament tells us so.',
            'Isaiah 53:5 is quoted in the New Testament.',
        ]) {
            expect(findTestamentSlips(text), text).toEqual([]);
        }
    });
});

// BN-133 (2026-11-11, the user: _I asked to translate the whole content into
// Khmer then bible of translated should into khmer bible_): a note put into
// another language kept its KJV verses, chips and passages alike. Made-up
// codes here; the language's own cases are in its package's tests.
describe("a translated note's verses from its language's Bible", () => {
    it('reads the language a note is put into, never one added beside', () => {
        expect(
            readNoteTranslateLanguageName(
                'translate the whole content into Xish',
            ),
        ).toBe('Xish');
        expect(
            readNoteTranslateLanguageName(
                'Please translate this note to Xish please',
            ),
        ).toBe('Xish');
        expect(
            readNoteTranslateLanguageName('translate it into Simplified Yish'),
        ).toBe('Simplified Yish');
        expect(
            readNoteTranslateLanguageName('Replace the words with Xish'),
        ).toBe('Xish');
        for (const text of [
            'Add Xish under each line',
            'translate it and keep the English, Xish under each line',
            'make the heading bigger',
        ]) {
            expect(readNoteTranslateLanguageName(text), text).toBe(null);
        }
        expect(checkIsNoteReplaceChoice('Replace the words')).toBe(true);
        expect(checkIsNoteReplaceChoice('Add it under each line')).toBe(false);
    });

    it('leaves the verses alone for a part put into the language', () => {
        for (const text of [
            'translate the title into Xish',
            'translate the prayer into Xish',
            'translate point 2 to Xish',
            'translate the first heading into Xish',
            'translate the verses into Xish',
        ]) {
            expect(readNoteTranslateLanguageName(text), text).toBe(null);
        }
        expect(
            readNoteTranslateLanguageName('translate this lesson to Xish'),
        ).toBe('Xish');
        expect(
            readNoteTranslateLanguageName(
                'Translate all of it into Xish, replace the English words',
            ),
        ).toBe('Xish');
    });

    it("takes the Lookup's Bible in the language, else a whole one in it", () => {
        const bibles = [
            { key: 'KJV', locale: 'en' },
            { key: 'XNT', locale: 'xx', books: 27 },
            { key: 'XXB', locale: 'xx-YY' },
        ];
        expect(pickTranslateBibleKey({ bible: 'KJV', bibles }, 'xx')).toBe(
            'XXB',
        );
        expect(pickTranslateBibleKey({ bible: 'XNT', bibles }, 'xx')).toBe(
            'XNT',
        );
        expect(pickTranslateBibleKey({ bible: 'KJV', bibles }, 'yy')).toBe(
            null,
        );
        // Put into English, an English Bible.
        expect(
            pickTranslateBibleKey(
                {
                    bible: 'XXB',
                    bibles: [...bibles, { key: 'ESV', locale: 'en-US' }],
                },
                'en',
            ),
        ).toBe('KJV');
    });

    it('names every verse in the Bible and reads each passage from it', () => {
        const blocks = [
            {
                n: 1,
                kind: 'passage',
                text: '(KJV) John 3:16-17 — (16): For God',
            },
            { n: 2, kind: 'h2', text: 'Big idea' },
            { n: 3, kind: 'paragraph', text: 'Love [^(KJV) John 3:16] given.' },
            { n: 4, kind: 'paragraph', text: 'Unasked [^John 3:17] too.' },
            {
                n: 5,
                kind: 'table',
                text: '2 rows x 2 columns: [^(KJV) John 3:16]',
            },
            { n: 6, kind: 'passage', text: '(XXB) John 3:18 — (18): ...' },
        ];
        const result = withNoteVersesInBible(
            {
                action: 'edit',
                changes: [
                    // The model writing a passage's words: read again instead.
                    { block: 1, text: 'Xish passage words...' },
                    { block: 2, text: 'Xish heading' },
                    { block: 3, text: 'Xish love [^(KJV) John 3:16] .' },
                ],
            },
            blocks,
            'XXB',
        );
        expect(result.bible).toBe('XXB');
        expect(result.changes).toEqual([
            { block: 1, ref: '(XXB) John 3:16-17' },
            { block: 2, text: 'Xish heading' },
            { block: 3, text: 'Xish love [^(XXB) John 3:16] .' },
            // A block of words the edit left: its own words, its chip named so.
            { block: 4, text: 'Unasked [^(XXB) John 3:17] too.' },
        ]);
        expect(toVerseTokensInBible('a [^John 1:1] b', 'K')).toBe(
            'a [^(K) John 1:1] b',
        );
        expect(withNoteVersesInBible({ action: 'read' }, blocks, 'K')).toEqual({
            action: 'read',
        });
        expect(genNoteTranslateNoBibleNote('Xish')).toContain(
            'No Xish Bible is installed here',
        );
    });
});

// BN-134: a translation is held to its language. Its cases need a script of
// a language's own, so they are in that language's package tests; in Latin
// letters nothing can be told from English, and nothing is refused.
describe('a translated note is held to its language', () => {
    const blocks = [
        { n: 1, kind: 'h1', text: 'The Good Shepherd' },
        { n: 2, kind: 'h2', text: 'Big idea' },
    ];

    it('reads no English left in a language written in Latin letters', () => {
        expect(
            findNoteTranslateLeft(
                { action: 'edit', changes: [{ block: 1, text: 'Le berger' }] },
                blocks,
                null,
            ),
        ).toBe(null);
        expect(findNoteTranslateLeft({ action: 'read' }, blocks, null)).toBe(
            null,
        );
    });

    it('names each block left, and every block it adds, under the change', () => {
        const note = genNoteTranslateLeftNote(
            {
                english: [
                    { n: 2, text: 'Big idea' },
                    { n: 0, text: 'A new line here' },
                ],
                stray: [{ n: 1, text: 'Xish words', letters: ['+', '*'] }],
            },
            'Xish',
        );
        expect(note).toContain('The change is made');
        expect(note).toContain(
            'block 2 ("Big idea"), the block you add ("A new line here") are ' +
                'still in English',
        );
        expect(note).toContain('block 1 ("Xish words") (+ *) has letters');
        expect(note).toContain('ONE more edit -- Xish letters only');
    });
});

// BN-130 (2026-11-11, the BN-125..127 read): the whole passage printed
// again after the memory verse, and a devotion's psalm again under its one
// point -- the window takes out the repeat, and nothing else.
describe("a new lesson's passage printed once", () => {
    const top = { after: 0, kind: 'passage', ref: 'Luke 10:25-37' };
    it('takes out the passage printed again after the memory verse', () => {
        const section = {
            after: 1,
            kind: 'section',
            text:
                '## Big idea\nMercy to anyone.\n## 1. Who is my neighbour\n' +
                '[^Luke 10:25-32]\n**What it means:** words.\n' +
                '## Memory verse\n[^Luke 10:37]\n[^Luke 10:25-37]',
        };
        const result = dropRepeatedLessonPassages({
            action: 'edit',
            changes: [{ block: 1, remove: true }, top, section],
        });
        expect(result.changes[1]).toBe(top);
        expect(result.changes[2].text).toBe(
            '## Big idea\nMercy to anyone.\n## 1. Who is my neighbour\n' +
                '[^Luke 10:25-32]\n**What it means:** words.\n' +
                '## Memory verse\n[^Luke 10:37]',
        );
    });

    it("takes out a devotion's psalm under a point of movement lines", () => {
        const result = dropRepeatedLessonPassages({
            action: 'edit',
            changes: [
                { after: 0, kind: 'passage', ref: 'Psalm 23:1-6' },
                {
                    after: 1,
                    kind: 'section',
                    text:
                        '## 1. The care of the Shepherd\n[^(KJV) Psalm 23:1-6]\n' +
                        '**What it means:**\n[^Psalm 23:1-3] The pasture.\n' +
                        '[^Psalm 23:4] The valley.\n## Pointing to Jesus\nHim.',
                },
            ],
        });
        expect(result.changes[1].text).not.toContain('[^(KJV) Psalm 23:1-6]');
        expect(result.changes[1].text).toContain('[^Psalm 23:4] The valley.');
    });

    it('keeps a repeat that is all a point has, and a memory verse', () => {
        const args = {
            action: 'edit',
            changes: [
                { after: 0, kind: 'passage', ref: 'John 3:16' },
                {
                    after: 1,
                    kind: 'section',
                    text:
                        '## 1. God so loved\n[^John 3:16]\n**What it means:** ' +
                        'love.\n## Memory verse\n[^John 3:16]',
                },
            ],
        };
        expect(dropRepeatedLessonPassages(args)).toBe(args);
        expect(dropRepeatedLessonPassages({ action: 'edit' })).toEqual({
            action: 'edit',
        });
    });
});

// BN-129 (2026-11-11): Luke 15:7, 28 words, as a children's memory verse.
describe("a child's memory verse a child can say", () => {
    it('finds the Memory verse part and counts its words', () => {
        expect(
            findMemoryVerseRef(
                '[^Luke 15:4-7]\n## 1. God looks\n[^Luke 15:4]\n' +
                    '## Memory verse\n[^(KJV) Luke 15:7]',
            ),
        ).toBe('Luke 15:7');
        expect(findMemoryVerseRef('## Memory verse\nLearn it well.')).toBe(
            null,
        );
        expect(findMemoryVerseRef('[^Luke 15:4]')).toBe(null);
        expect(
            countVerseWords(
                '(7): I say unto you, that likewise joy shall be in heaven ' +
                    'over one sinner that repenteth, more than over ninety ' +
                    'and nine just persons, which need no repentance.',
            ),
        ).toBe(28);
        expect(
            countVerseWords(
                '(8): The LORD is merciful and gracious, slow to anger, and ' +
                    'plenteous in mercy.',
            ),
        ).toBeLessThanOrEqual(MAX_CHILD_MEMORY_VERSE_WORDS);
        expect(
            genChildMemoryVerseNote('Luke 15:7', 28, [
                { ref: 'Luke 15:6', wordCount: 12 },
            ]),
        ).toContain(
            'its memory verse, Luke 15:7, runs 28 words: a child cannot say ' +
                'it. Choose ANOTHER verse -- not Luke 15:7 -- of 20 words at ' +
                'most that says the big idea -- for instance Luke 15:6 (12 ' +
                'words), read already. With ONE more edit, give the memory ' +
                "verse's passage block that verse as its ref",
        );
    });

    // BN-143 (shape29): the short verses of the passage read, offered in a
    // long one's place, so no search is needed for one.
    it('offers the short verses of the passage read', () => {
        const read = JSON.stringify({
            bible: 'KJV',
            verses: [
                {
                    ref: 'Luke 15:4-7',
                    text:
                        '(4): What man of you, having an hundred sheep, if he ' +
                        'lose one of them, doth not leave the ninety and ' +
                        'nine in the wilderness, and go after that which is ' +
                        'lost, until he find it? (5): And when he hath found ' +
                        'it, he layeth it on his shoulders, rejoicing. (6): ' +
                        'And when he cometh home, he calleth together his ' +
                        'friends and neighbours, saying unto them, Rejoice ' +
                        'with me; for I have found my sheep which was lost.',
                },
                {
                    ref: 'Psalm 23:1',
                    text: 'The LORD is my shepherd; I shall not want.',
                },
            ],
        });
        // Only a verse that shares a word with the big idea: Psalm 23:1 is
        // short and says nothing of it (seen live: Luke 15:1, "Then drew
        // near unto him all the publicans", first in read order, was taken).
        const bigIdea = readLessonBigIdea(
            '[^Luke 15:4-7]\n## Big idea\nGod searches for the lost and ' +
                'rejoices when he finds them.\n## 1. God looks',
        );
        expect(bigIdea).toBe(
            'God searches for the lost and rejoices when he finds them.',
        );
        expect(listShortReadVerses(['the ask', read], bigIdea)).toEqual([
            { ref: 'Luke 15:5', wordCount: 13 },
        ]);
        expect(
            listShortReadVerses(['the ask', read], 'Trust the Lord.'),
        ).toEqual([{ ref: 'Psalm 23:1', wordCount: 9 }]);
        expect(listShortReadVerses(['not json'], bigIdea)).toEqual([]);
    });

    // BN-155 (2026-11-11, ab32, Sonnet: a memory verse scored 0): the verses
    // read just before Luke 15 for its background offered Luke 14:34 --
    // "lost his savour" shares "lost" -- and a lost sheep lesson took it.
    it("offers only the lesson's own passage, never the verses before it", () => {
        const read = JSON.stringify({
            bible: 'KJV',
            verses: [
                {
                    ref: 'Luke 15:4-5',
                    text:
                        '(4): What man of you, having an hundred sheep, if he ' +
                        'lose one of them, doth not leave the ninety and ' +
                        'nine in the wilderness, and go after that which is ' +
                        'lost, until he find it? (5): And when he hath found ' +
                        'it, he layeth it on his shoulders, rejoicing.',
                },
                {
                    ref: 'Luke 14:34',
                    text:
                        'Salt is good: but if the salt have lost his savour, ' +
                        'wherewith shall it be seasoned?',
                },
            ],
        });
        const bigIdea =
            'God searches for the lost and rejoices when he finds them.';
        expect(
            listShortReadVerses([read], bigIdea).map((offer) => {
                return offer.ref;
            }),
        ).toContain('Luke 14:34');
        expect(listShortReadVerses([read], bigIdea, 'Luke 15:1-7')).toEqual([
            { ref: 'Luke 15:5', wordCount: 13 },
        ]);
        // A whole chapter, chapters, and a span over chapters.
        expect(listShortReadVerses([read], bigIdea, 'Luke 15')).toHaveLength(1);
        expect(listShortReadVerses([read], bigIdea, 'Luke 14-15')).toHaveLength(
            2,
        );
        expect(
            listShortReadVerses([read], bigIdea, 'Luke 14:25-15:7'),
        ).toHaveLength(2);
        // A passage of a book the KJV does not name: no limit is drawn.
        expect(
            listShortReadVerses([read], bigIdea, 'Hezekiah 1:1'),
        ).toHaveLength(2);
    });
});

// BN-144 (2026-11-11, shape29): "Choose one of these", pressed under its
// own "which passage?", was answered with three passages again.
describe('a passage left to the assistant', () => {
    it('reads the ways a person leaves the choice', () => {
        for (const text of [
            'Choose one of these',
            'you choose',
            'pick one for me',
            'Any',
            'whichever',
            "it doesn't matter",
            'up to you',
        ]) {
            expect(checkIsLeftToYouAsk(text), text).toBe(true);
        }
        for (const text of [
            'Psalm 23',
            'choose Psalm 23',
            'The Prodigal Son (Luke 15:11-32)',
        ]) {
            expect(checkIsLeftToYouAsk(text), text).toBe(false);
        }
    });

    it('says to choose one and write, under the lesson it continues', () => {
        const blank = toNoteDocumentText({
            blockCount: 1,
            hash: 'h',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        const ask = (asked: string) => {
            return toNoteAsk(
                asked,
                [{ name: 'Lesson', text: blank }],
                null,
                false,
                null,
                null,
                true,
            );
        };
        expect(ask('Choose one of these')).toContain(
            NOTE_LESSON_YOU_CHOOSE_HINT,
        );
        expect(ask('Psalm 23')).not.toContain(NOTE_LESSON_YOU_CHOOSE_HINT);
    });
});

// BN-120 (2026-11-11, the BN-116/117 read): "finds its fulfillment in
// Jesus, who [^(KJV) John 1:14]." -- a token shows as its reference alone.
describe("a verse token is never a sentence's words", () => {
    it('names a sentence a token was left to finish', () => {
        const found = findTokenAsWords(
            'The promise that "the tabernacle of God is with men" finds its ' +
                'fulfillment in Jesus, who [^(KJV) John 1:14]. He entered ' +
                'our world.\n**What it means:** In the New Testament, Jesus ' +
                'says, [^Matthew 11:28]\n- Paul wrote: [^Romans 8:28].',
        );
        expect(found).toEqual([
            {
                sentence:
                    'The promise that "the tabernacle of God is with men" ' +
                    'finds its fulfillment in Jesus, who [^(KJV) John 1:14].',
                token: '[^(KJV) John 1:14]',
            },
            {
                sentence: 'In the New Testament, Jesus says, [^Matthew 11:28]',
                token: '[^Matthew 11:28]',
            },
            {
                sentence: 'Paul wrote: [^Romans 8:28].',
                token: '[^Romans 8:28]',
            },
        ]);
        const refusal = genTokenAsWordsRefusal(found.slice(0, 1));
        expect(refusal).toContain('a token shows only as its reference');
        expect(refusal).toContain(
            'Jesus, who “<its words, as read>” [^(KJV) John 1:14].',
        );
        expect(refusal).toContain('that sentence is left without them');
    });

    it('lets a token that cites or sits inside a sentence be', () => {
        for (const text of [
            'We are loved, as Jesus said [^John 3:16].',
            'Jesus says, "Come unto me" [^Matthew 11:28].',
            'The God who [^Psalm 23:1] calls himself a shepherd keeps us.',
            'The Word was made flesh [^John 1:14].',
            '[^(KJV) Psalm 23:1-3] In the pasture, he gives rest.',
            'He promised it in [^Isaiah 41:10].',
        ]) {
            expect(findTokenAsWords(text), text).toEqual([]);
        }
    });
});

// BN-112 (2026-11-11): a children's lesson's memory verse, given as a change
// of its own, stayed a chip -- "a bare reference with no words" to both
// blind readers, in both runs.
describe("a new lesson's line of one verse token is that verse", () => {
    it('prints a line that is one token, and leaves the rest', () => {
        const args = toLessonVerseLines({
            action: 'edit',
            note: 'Lesson',
            changes: [
                { block: 1, remove: true },
                { after: 0, kind: 'h2', text: 'Memory verse' },
                { after: 1, text: '[^(KJV) Jonah 2:9]' },
                { after: 2, kind: 'paragraph', text: '**[^John 3:16]**' },
                { after: 3, text: 'Jesus says, [^Matthew 11:28].' },
                // A block it rewrites keeps its kind.
                { block: 4, text: '[^Luke 15:4]' },
            ],
        });
        expect(args.changes).toEqual([
            { block: 1, remove: true },
            { after: 0, kind: 'h2', text: 'Memory verse' },
            { after: 1, kind: 'passage', ref: '(KJV) Jonah 2:9' },
            { after: 2, kind: 'passage', ref: 'John 3:16' },
            { after: 3, text: 'Jesus says, [^Matthew 11:28].' },
            { block: 4, text: '[^Luke 15:4]' },
        ]);
        expect(toLessonVerseLines({ action: 'read' })).toEqual({
            action: 'read',
        });
    });
});

// BN-132 (2026-11-11): a funeral lesson's Christ section quoted John 1:14
// as "became flesh and dwelt among us", its ninth cited quote -- and the
// check read the first eight, all copied from the passage read.
describe('the quotes written from memory are the ones read', () => {
    const PASSAGE_READ = JSON.stringify({
        bible: 'KJV',
        verses: [
            {
                key: 'REV 21:1-7',
                ref: 'Revelation 21:1-7',
                text:
                    '(3): And I heard a great voice out of heaven saying, ' +
                    'Behold, the tabernacle of God is with men, and he will ' +
                    'dwell with them, (4): And God shall wipe away all tears ' +
                    'from their eyes; and there shall be no more death',
            },
        ],
    });
    const PSALM_READ = JSON.stringify({
        bible: 'KJV',
        verses: [
            {
                key: 'PSA 23:1',
                ref: 'Psalm 23:1',
                text: '(1): The LORD is my shepherd; I shall not want.',
            },
        ],
    });

    it('finds every cited quote, the ninth too', () => {
        const lesson = Array.from({ length: 9 }, (_, index) => {
            return `He said "the tabernacle of God is with men" (Revelation 21:${index + 1}).`;
        }).join(' ');
        expect(findCitedQuotes(lesson)).toHaveLength(9);
    });

    it('puts a quote from memory before one copied from a read', () => {
        const cited = [
            ...Array.from({ length: 8 }, (_, index) => ({
                quote: 'the tabernacle of God is with men',
                ref: `Revelation 21:${index + 1}`,
            })),
            { quote: 'became flesh and dwelt among us', ref: 'John 1:14' },
            // Read in ANOTHER book: let be, never read.
            { quote: 'The LORD is my shepherd', ref: 'John 10:11' },
        ];
        const picked = pickCitedQuotesToRead(cited, [PASSAGE_READ, PSALM_READ]);
        expect(picked[0]).toEqual({
            quote: 'became flesh and dwelt among us',
            ref: 'John 1:14',
        });
        expect(picked.map((item) => item.ref)).not.toContain('John 10:11');
        // At most eight references are read.
        expect(new Set(picked.map((item) => item.ref)).size).toBe(
            MAX_CITED_REFS_READ,
        );
        expect(pickCitedQuotesToRead([], [PASSAGE_READ])).toEqual([]);
    });
});

// BN-110 (2026-11-11): the errors the blind readers found after BN-104 were
// quotes tied to a verse the ask never read -- Matthew 11:28 as "weary and
// heavy laden", John 5:30's words as 6:38, words 1 Samuel 17:52 never says.
describe('a quote given its chapter and verse is that verse', () => {
    const MATTHEW_11_28 =
        '(28): Come unto me, all ye that labour and are heavy laden, and I ' +
        'will give you rest.';
    const JOHN_4_6 =
        '(6): Now Jacob’s well was there. Jesus therefore, being wearied ' +
        'with his journey, sat thus on the well: and it was about the sixth ' +
        'hour.';

    it('reads the reference in the quote’s own sentence', () => {
        expect(
            findCitedQuotes(
                'Jesus invites all who are "weary and heavy laden" to come ' +
                    'to Him for rest (Matthew 11:28). He was "wearied with ' +
                    'his journey" (John 4:6) and calls "all ye that labour".',
            ),
        ).toEqual([
            { quote: 'weary and heavy laden', ref: 'Matthew 11:28' },
            { quote: 'wearied with his journey', ref: 'John 4:6' },
        ]);
        expect(
            findCitedQuotes(
                'In 1 Samuel 17:52 the men said, "He hath spoken well".',
            ),
        ).toEqual([{ quote: 'He hath spoken well', ref: '1 Samuel 17:52' }]);
        // A sentence before is not this one, nor a hearer's own question.
        expect(
            findCitedQuotes(
                'He found it (Luke 15:4). "Rejoice with me," he said. A ' +
                    'hearer asks: "Why did they pass by?"',
            ),
        ).toEqual([]);
    });

    // BN-160 (2026-11-12, ab34, Opus: an error): "the water of life freely
    // [John 4:14]" in a Revelation 21 funeral message -- the passage's own
    // words given another verse's name, which BN-113 let be.
    it("names the verse a passage's own words come from", () => {
        const read = JSON.stringify({
            bible: 'KJV',
            verses: [
                {
                    key: 'REV 21:1-7',
                    ref: 'Revelation 21:1-7',
                    text:
                        '(5): And he that sat upon the throne said, Behold, I ' +
                        'make all things new. (6): And he said unto me, It is ' +
                        'done. I will give unto him that is athirst of the ' +
                        'fountain of the water of life freely. (7): He that ' +
                        'overcometh shall inherit all things.',
                },
            ],
        });
        const cited = { quote: 'the water of life freely', ref: 'John 4:14' };
        expect(pickMisattributionCandidates([cited], [read])).toEqual([cited]);
        // A quote the ask read nowhere is BN-110's, never a candidate.
        expect(
            pickMisattributionCandidates(
                [{ quote: 'a well of water springing up', ref: 'John 4:14' }],
                [read],
            ),
        ).toEqual([]);
        const john =
            '(14): But whosoever drinketh of the water that I shall give him ' +
            'shall never thirst; but the water that I shall give him shall be ' +
            'in him a well of water springing up into everlasting life.';
        const found = findCitedMisattributions(
            [cited],
            new Map([['John 4:14', john]]),
            [read],
        );
        expect(found).toEqual([
            {
                quote: 'the water of life freely',
                ref: 'John 4:14',
                source: 'Revelation 21:6',
            },
        ]);
        // The named verse holds the words too (a verse quoted in another
        // book): left.
        expect(
            findCitedMisattributions(
                [cited],
                new Map([['John 4:14', `${john} the water of life freely`]]),
                [read],
            ),
        ).toEqual([]);
        const note = genCitedMisattributionNote(
            [{ ...found[0], sentence: 'He gives the water of life freely.' }],
            [21],
        );
        expect(note).toContain(
            'block 21: "He gives the water of life freely." -- "the water of ' +
                "life freely\" is Revelation 21:6's words, not John 4:14's",
        );
        expect(note).toContain('{block: 21, text:');
        expect(genCitedMisattributionNote([])).toBe(null);
    });

    // BN-148: several cited verses are read in one call, each matched back
    // by the key the read answers it with.
    it('keys a single cited verse, never a range', () => {
        expect(toCitedVerseKey('Matthew 11:28')).toBe('MAT 11:28');
        expect(toCitedVerseKey('1 John 4:16')).toBe('1JN 4:16');
        expect(toCitedVerseKey('Psalm 23:01')).toBe('PSA 23:1');
        expect(toCitedVerseKey('Song of Solomon 2:4')).toBe('SNG 2:4');
        // A range, a chapter or a book the KJV does not name: read alone.
        expect(toCitedVerseKey('John 3:16-17')).toBe(null);
        expect(toCitedVerseKey('John 3:16, 17')).toBe(null);
        expect(toCitedVerseKey('John 3')).toBe(null);
        expect(toCitedVerseKey('Hezekiah 1:1')).toBe(null);
    });

    it('names a quote its verse does not have, with the verse', () => {
        const misquotes = findCitedMisquotes(
            [
                { quote: 'weary and heavy laden', ref: 'Matthew 11:28' },
                { quote: 'wearied with his journey', ref: 'John 4:6' },
            ],
            new Map([
                ['Matthew 11:28', MATTHEW_11_28],
                ['John 4:6', JOHN_4_6],
            ]),
        );
        expect(misquotes.map((item) => item.quote)).toEqual([
            'weary and heavy laden',
        ]);
        const refusal = genCitedMisquoteRefusal(misquotes);
        expect(refusal).toContain(
            'Matthew 11:28 reads: “Come unto me, all ye that labour and are ' +
                'heavy laden, and I will give you rest.” -- not “weary and ' +
                'heavy laden”',
        );
        expect(refusal).toContain('[^Matthew 11:28]');
    });

    // BN-224 (held-out H-13): a short phrase named for its verse is held to
    // it, and read -- "under the sun" is the book's refrain, not 3:1.
    it('holds a short phrase named for its verse to it', () => {
        const verse =
            'To every thing there is a season, and a time to every ' +
            'purpose under the heaven:';
        const cited = findCitedQuotes(
            'Life "under the sun" [^(KJV) Ecclesiastes 3:1] has its ' +
                'times; "a time to every purpose" (Ecclesiastes 3:1).',
        );
        expect(cited.map((item) => item.quote)).toEqual([
            'under the sun',
            'a time to every purpose',
        ]);
        const read = [
            JSON.stringify({
                verses: [
                    {
                        key: 'ECC 2:18-21',
                        text: '(18): Yea, I hated all my labour which I had taken under the sun',
                    },
                ],
            }),
        ];
        expect(pickCitedQuotesToRead(cited, read)).toHaveLength(2);
        expect(
            findCitedMisquotes(
                cited,
                new Map([['Ecclesiastes 3:1', verse]]),
                read,
            ).map((item) => item.quote),
        ).toEqual(['under the sun']);
        // A short phrase whose sentence names another thing's verse after
        // it is not that verse's quote (three good lessons of the bar's
        // reads: the wages' verse, the beast's sea, the law's fifth part).
        expect(
            findCitedQuotes(
                'He paid "two pence"—two days\' wages [^(KJV) Matthew ' +
                    '20:2]—to ensure his care.',
            ),
        ).toEqual([]);
        // A phrase under eight letters is let be.
        expect(
            findCitedMisquotes(
                [{ quote: 'the Son', ref: 'Ecclesiastes 3:1' }],
                new Map([['Ecclesiastes 3:1', verse]]),
            ),
        ).toEqual([]);
    });

    // BN-113: the first live run sent back a lesson whose "Purge me with
    // hyssop" (its own Psalm 51:7) stood beside Exodus 12:22, named for
    // what hyssop was.
    it('lets a quote of what was read be, whatever it names beside it', () => {
        const cited = [{ quote: 'Purge me with hyssop', ref: 'Exodus 12:22' }];
        const verses = new Map([
            [
                'Exodus 12:22',
                'And ye shall take a bunch of hyssop, and dip it in the blood',
            ],
        ]);
        // Read against Exodus 12:22 alone, it is not that verse...
        expect(findCitedMisquotes(cited, verses)).toHaveLength(1);
        // ...but it is the passage this ask read.
        expect(
            findCitedMisquotes(cited, verses, [
                '(7): Purge me with hyssop, and I shall be clean',
            ]),
        ).toEqual([]);
    });

    // BN-117 (2026-11-11, the BN-113..115 read): "written in the book of
    // life" given Revelation 20:12 -- 20:15's words, in the funeral
    // lesson's own read of the chapter before -- was let by as a quote of
    // what was read.
    it("names a quote read in its reference's own book, another verse", () => {
        const readOf = (key: string, ref: string, text: string) => {
            return JSON.stringify({
                bible: 'KJV',
                verses: [{ key, ref, text }],
            });
        };
        expect(
            findCitedMisquotes(
                [
                    {
                        quote: 'written in the book of life',
                        ref: 'Revelation 20:12',
                    },
                ],
                new Map([
                    [
                        'Revelation 20:12',
                        'And I saw the dead, small and great, stand before ' +
                            'God; and the books were opened: and another ' +
                            'book was opened, which is the book of life: and ' +
                            'the dead were judged out of those things which ' +
                            'were written in the books, according to their ' +
                            'works.',
                    ],
                ]),
                [
                    readOf(
                        'REV 20:6-15',
                        'Revelation 20:6-15',
                        '(15): And whosoever was not found written in the ' +
                            'book of life was cast into the lake of fire.',
                    ),
                ],
            ).map((item) => item.ref),
        ).toEqual(['Revelation 20:12']);
        // Read in another book, it is that book's own words (BN-113).
        expect(
            findCitedMisquotes(
                [{ quote: 'Purge me with hyssop', ref: 'Exodus 12:22' }],
                new Map([
                    [
                        'Exodus 12:22',
                        'And ye shall take a bunch of hyssop, and dip it in ' +
                            'the blood',
                    ],
                ]),
                [
                    readOf(
                        'PSA 51:1-19',
                        'Psalm 51:1-19',
                        '(7): Purge me with hyssop, and I shall be clean',
                    ),
                ],
            ),
        ).toEqual([]);
    });

    it('lets a cut quote, an unread or cut verse and another script be', () => {
        const check = (quote: string, verse: string | undefined) => {
            return findCitedMisquotes(
                [{ quote, ref: 'Matthew 11:28' }],
                new Map(verse === undefined ? [] : [['Matthew 11:28', verse]]),
            );
        };
        expect(
            check('Come unto me … I will give you rest', MATTHEW_11_28),
        ).toEqual([]);
        expect(check('weary and heavy laden', undefined)).toEqual([]);
        expect(
            check('weary and heavy laden', '(28): Come unto me, all…'),
        ).toEqual([]);
        // A verse in a script of no a-z letters: the quote is not compared.
        expect(check('weary and heavy laden', '(28): ✝✝✝ ✝✝✝ ✝✝✝')).toEqual([]);
    });
});

// BN-83 (2026-11-11): five lessons of thirteen stopped before their passage
// did -- the sower at the thorns, the Psalm 46 devotion at verse 3 -- and a
// David sermon put the armour after the speech.
describe("a new lesson's points follow and cover its passage", () => {
    const toLesson = (top: string, points: string[]) => {
        return [
            '# The lesson',
            top,
            '## Big idea',
            'One sentence.',
            ...points.map((point, index) => {
                return `## ${index + 1}. A point\n${point}\n**What it means:** words.`;
            }),
            '## Pointing to Jesus',
            'He is the sower [^Matthew 13:37].',
            '## Memory verse',
            '[^Matthew 13:23]',
        ].join('\n');
    };

    it('names where the points stop and where the passage ends', () => {
        const problem = findLessonPointsProblem(
            toLesson('[^(KJV) Matthew 13:1-23]', [
                '[^Matthew 13:3-9, 19]',
                '[^Matthew 13:5-6] and [^Matthew 13:20-21]',
                '[^Matthew 13:7, 22]',
            ]),
        );
        expect(problem).toEqual({
            passage: 'Matthew 13:1-23',
            gap: { reached: 'Matthew 13:22', end: 'Matthew 13:23' },
            lead: null,
            slip: null,
        });
        const refusal = genLessonPointsRefusal(problem!);
        expect(refusal).toContain(
            'the passage is Matthew 13:1-23, and the points stop at ' +
                'Matthew 13:22.',
        );
        expect(refusal).toContain(
            'the last ending where it ends, at Matthew 13:23',
        );
        // A devotion's one point, its heading bold, the book named twice.
        expect(
            findLessonPointsProblem(
                '[^Psalm 46:1-11]\n## **1. Our refuge**\n[^Psalms 46:1-3]',
            )?.gap,
        ).toEqual({ reached: 'Psalm 46:3', end: 'Psalm 46:11' });
        // Lines a model wrote out as "\n".
        expect(
            findLessonPointsProblem(
                '[^Luke 19:1-10]\\n## Point 1: Seeking\\n[^Luke 19:1-4]',
            )?.gap?.reached,
        ).toBe('Luke 19:4');
    });

    it('names a point that comes before the one above it', () => {
        const problem = findLessonPointsProblem(
            toLesson('[^1 Samuel 17:40-50]', [
                '[^1 Samuel 17:45-47]',
                '[^1 Samuel 17:38-40]',
                '[^1 Samuel 17:48-50]',
            ]),
        );
        expect(problem).toEqual({
            passage: '1 Samuel 17:40-50',
            gap: null,
            lead: null,
            slip: {
                point: 2,
                ref: '1 Samuel 17:38-40',
                earlierPoint: 1,
                earlierRef: '1 Samuel 17:45-47',
            },
        });
        expect(genLessonPointsRefusal(problem!)).toContain(
            'and point 2 (1 Samuel 17:38-40) comes before point 1 ' +
                '(1 Samuel 17:45-47) in it. The points follow it in its own ' +
                'order',
        );
        // Both at once, in one sentence.
        expect(
            genLessonPointsRefusal({
                ...problem!,
                gap: { reached: '1 Samuel 17:48', end: '1 Samuel 17:50' },
            }),
        ).toContain('in it, and the points stop at 1 Samuel 17:48.');
    });

    // BN-188 (ab50, Opus): the Good Samaritan's points began at 10:30 under
    // Luke 10:25-37, the lawyer's question in none of them.
    it('names points that begin well into their passage', () => {
        const problem = findLessonPointsProblem(
            toLesson('[^(KJV) Luke 10:25-37]', [
                '[^Luke 10:30-32]',
                '[^Luke 10:33-35]',
                '[^Luke 10:36-37]',
            ]),
        );
        expect(problem).toEqual({
            passage: 'Luke 10:25-37',
            gap: null,
            lead: { start: 'Luke 10:25', begins: 'Luke 10:30' },
            slip: null,
        });
        const refusal = genLessonPointsRefusal(problem!);
        expect(refusal).toContain(
            'the points begin at Luke 10:30, leaving out its first verses.',
        );
        expect(refusal).toContain(
            'the first starting where it starts, at Luke 10:25, the last ' +
                'ending where it ends --',
        );
        // The sower's setting, two verses before the parable, is let be,
        // and so is a first point that takes the lawyer in.
        expect(
            findLessonPointsProblem(
                toLesson('[^Matthew 13:1-23]', [
                    '[^Matthew 13:3-9, 19]',
                    '[^Matthew 13:20-22]',
                    '[^Matthew 13:8, 23]',
                ]),
            ),
        ).toBe(null);
        expect(
            findLessonPointsProblem(
                toLesson('[^Luke 10:25-37]', [
                    '[^Luke 10:25-32]',
                    '[^Luke 10:33-35]',
                    '[^Luke 10:36-37]',
                ]),
            ),
        ).toBe(null);
    });

    it('lets points that cover the passage in order through', () => {
        // The parable and its meaning side by side, point by point.
        expect(
            findLessonPointsProblem(
                toLesson('[^Matthew 13:1-23]', [
                    '[^Matthew 13:3-9, 19]',
                    '[^Matthew 13:20-22]',
                    'The good ground [^Matthew 13:8, 23] bears fruit.',
                ]),
            ),
        ).toBe(null);
        // A point naming the whole chapter reaches every verse of it.
        expect(
            findLessonPointsProblem('[^Psalm 23:1-6]\n## 1. All\n[^Psalm 23]'),
        ).toBe(null);
    });

    it('counts only the points, and only their verses in the passage', () => {
        // The memory verse and a verse in another chapter or book are no
        // point's reach; a verse after the passage neither.
        expect(
            findLessonPointsProblem(
                toLesson('[^Luke 19:1-10]', [
                    '[^Luke 19:1-4]',
                    '[^Luke 19:5-7] and [^John 3:16]',
                    '[^Luke 15:7] [^Luke 19:12]',
                ]),
            ),
        ).toEqual({
            passage: 'Luke 19:1-10',
            gap: { reached: 'Luke 19:7', end: 'Luke 19:10' },
            lead: null,
            slip: null,
        });
        // Points that name no verse of the passage at all: nothing to hold.
        expect(
            findLessonPointsProblem(
                toLesson('[^Luke 19:1-10]', ['[^John 3:16]']),
            ),
        ).toBe(null);
    });

    it('lets a passage it cannot hold the points to be', () => {
        // A verse or two (a children's lesson's top), a whole chapter, a
        // list of places, a range over chapters, none at the top.
        for (const top of [
            '[^Jonah 2:10]',
            '[^Jonah 1:17-2:1]',
            '[^Psalm 23]',
            '[^Jonah 1:1-4, 1:17]',
            'No passage line.',
        ]) {
            expect(
                findLessonPointsProblem(
                    `${top}\n## 1. A point\n[^Jonah 1:3]\n[^Psalm 23:1]`,
                ),
            ).toBe(null);
        }
        // A passage line under a heading is not the lesson's top.
        expect(
            findLessonPointsProblem(
                '## Background\n[^Psalm 46:1-11]\n## 1. A point\n[^Psalm 46:1]',
            ),
        ).toBe(null);
    });

    // The David sermon gave its passage as a `passage` change with a `ref`,
    // and the check, reading words alone, found no passage to hold.
    it('reads a lesson written as changes the way it is written', () => {
        const text = toLessonChangeText({
            changes: [
                { block: 1, remove: true },
                { after: 0, kind: 'passage', ref: '1 Samuel 17:1-58' },
                { after: 1, kind: 'h2', text: '1. Faith sees God' },
                { after: 2, kind: 'passage', ref: '1 Samuel 17:33-40' },
                {
                    after: 3,
                    kind: 'section',
                    text: '## 2. The battle\n[^1 Samuel 17:41-50]',
                },
                { after: 4, kind: 'h3', text: '### Already marked' },
            ],
        });
        expect(text).toBe(
            [
                '',
                '[^1 Samuel 17:1-58]',
                '## 1. Faith sees God',
                '[^1 Samuel 17:33-40]',
                '## 2. The battle',
                '[^1 Samuel 17:41-50]',
                '### Already marked',
            ].join('\n'),
        );
        expect(findLessonPointsProblem(text)?.gap).toEqual({
            reached: '1 Samuel 17:50',
            end: '1 Samuel 17:58',
        });
        expect(toLessonChangeText({})).toBe('');
    });
});

// BN-197 (ab54, shape56): a children's lost sheep written to its memory
// verse, no Pointing to Jesus, response, prayer or questions.
describe("a new lesson's parts left out", () => {
    const toBlocks = (headingList: string[]) => {
        return headingList.flatMap((heading, index) => {
            return [
                { n: index * 2 + 1, kind: 'h2', text: heading },
                { n: index * 2 + 2, kind: 'paragraph', text: 'Words.' },
            ];
        });
    };

    it('names each with the block it goes after', () => {
        const blocks = toBlocks([
            'Big idea',
            'Background',
            'Introduction',
            'The Story of the Lost Sheep',
            '1. God looks for us',
            '2. God is happy when we return',
            'Something to show',
            'Memory verse',
        ]);
        const gapList = findMissingLessonParts(blocks);
        // Before the Memory verse heading (block 15): the four missing.
        expect(gapList).toEqual([
            {
                after: 14,
                names: [
                    'Pointing to Jesus',
                    'Response',
                    'Closing prayer',
                    'Questions for discussion',
                ],
            },
        ]);
        expect(genMissingLessonPartsNote(gapList)).toContain(
            'after block 14: Pointing to Jesus, then Response, then Closing ' +
                'prayer, then Questions for discussion',
        );
        // A part before the points goes before the first point.
        expect(
            findMissingLessonParts(
                toBlocks([
                    'Big idea',
                    'Background',
                    '1. One',
                    '2. Two',
                    'Pointing to Jesus',
                    'Response',
                    'Closing prayer',
                    'Questions for discussion',
                    'Memory verse',
                ]),
            ),
        ).toEqual([{ after: 4, names: ['Introduction'] }]);
    });

    it('lets a whole lesson, and a note that is no lesson, be', () => {
        expect(
            findMissingLessonParts(
                toBlocks([
                    'Big idea',
                    'Background',
                    'Introduction',
                    '1. One',
                    'Pointing to Jesus',
                    'Response',
                    'Closing prayer',
                    'Questions for reflection',
                    'Memory verse',
                ]),
            ),
        ).toEqual([]);
        expect(
            findMissingLessonParts(toBlocks(['Notes', 'More notes'])),
        ).toEqual([]);
    });
});

// BN-78 (2026-11-10): a devotion asked for by the card, reviewed as a
// sermon, was offered "Add points for verses 4-6".
describe('the form a lesson was asked for', () => {
    it('is read off the card and off what was typed', () => {
        expect(readLessonFormAsked('Help me prepare a short devotion')).toBe(
            'devotion',
        );
        expect(readLessonFormAsked("Help me prepare a children's lesson")).toBe(
            'children',
        );
        expect(readLessonFormAsked('Help me prepare a preaching lesson')).toBe(
            null,
        );
        expect(
            readLessonFormAsked(
                'a short devotion on Psalm 46 for our prayer meeting',
            ),
        ).toBe('devotion');
        expect(readLessonFormAsked("a children's lesson on Jonah")).toBe(
            'children',
        );
        // Not an ask for a lesson: no form.
        expect(readLessonFormAsked('is this a good devotion?')).toBe(null);
    });

    // BN-258 (ab90): "a short message for a baptism service" came back a
    // full three-point sermon in both batches.
    it('reads a short message, and writes it with two points at most', () => {
        expect(
            readLessonFormAsked(
                'a short message for a baptism service, from Romans 6:3-4',
            ),
        ).toBe('short');
        expect(readLessonFormAsked('write a brief sermon on Psalm 23')).toBe(
            'short',
        );
        // A length in minutes says it its own way; a devotion stays one.
        expect(
            readLessonFormAsked('a short 10 minute sermon on Psalm 23'),
        ).toBe(null);
        expect(readLessonFormAsked('a short devotion on Psalm 23')).toBe(
            'devotion',
        );
        expect(genLessonFormWriteLine('short')).toContain('TWO points at most');
        expect(genLessonFormLine('short')).toContain('two points at most');
    });

    it('rides a review of that lesson, and nothing else', () => {
        const note = { name: 'The Good Shepherd', text: '1. h2: "Big idea"' };
        const review = toNoteAsk(
            'is this a good sermon?',
            [note],
            null,
            false,
            null,
            null,
            false,
            null,
            'devotion',
        );
        expect(review).toContain(genLessonFormLine('devotion'));
        expect(review).toContain(NOTE_LESSON_REVIEW_HINT);
        expect(
            toNoteAsk(
                'make the headings blue',
                [note],
                null,
                false,
                null,
                null,
                false,
                null,
                'devotion',
            ),
        ).not.toContain(genLessonFormLine('devotion'));
    });

    // BN-94 (2026-11-11): the card's "short devotion", then a passage
    // pressed, was written as a three-point sermon of 1100 words in two runs
    // of two -- the passage pressed named no form.
    it('rides a lesson WRITTEN in it, off the tab or the words', () => {
        const blankRead = toNoteDocumentText({
            blockCount: 1,
            file: 'Default',
            hash: 'h1',
            blocks: [{ n: 1, kind: 'paragraph', text: '' }],
        });
        const blank = [{ name: 'Sunday', text: blankRead }];
        const pressed = toNoteAsk(
            'Psalm 23 (The Lord is my Shepherd)',
            blank,
            null,
            false,
            null,
            null,
            true,
            null,
            'devotion',
        );
        expect(pressed).toContain(NOTE_BLANK_LESSON_HINT);
        expect(pressed).toContain(genLessonFormWriteLine('devotion'));
        expect(genLessonFormWriteLine('devotion')).toContain(
            'never three points',
        );
        // BN-125: said last, the line agrees with the shape -- the psalm not
        // printed again under the one point, a child's verse of twenty words.
        expect(genLessonFormWriteLine('devotion')).toContain(
            'no passage printed under it again',
        );
        expect(genLessonFormWriteLine('children')).toContain(
            'ONE verse of twenty words at most',
        );
        expect(genLessonFormWriteLine('children')).not.toContain(
            'one short line',
        );
        // Typed with its form: the words say it, the tab need not.
        expect(toNoteAsk("a children's lesson on Jonah", blank)).toContain(
            genLessonFormWriteLine('children'),
        );
        // A sermon carries no form line; neither does a change.
        expect(
            toNoteAsk('help me prepare a sermon on John 10', blank),
        ).not.toContain('It was asked for as');
        expect(
            toNoteAsk(
                'make the headings blue',
                [{ name: 'Sunday', text: '1. h2: "Big idea"' }],
                null,
                false,
                null,
                null,
                false,
                null,
                'devotion',
            ),
        ).not.toContain(genLessonFormWriteLine('devotion'));
    });
});

// BN-79 (2026-11-10): a review's fix pressed in a lesson had none of the
// lesson's truth rules, and added what the passage does not say.
describe('a fix to a lesson carries its rules', () => {
    const LESSON =
        '1. h2: "Big idea"\n2. h2: "1. Lost"\n3. paragraph: "A sheep is lost."\n' +
        '4. h2: "2. Found"\n5. paragraph: "It is found."';

    it('rides a change to a lesson, never a question or a plain note', () => {
        const fix = toNoteAsk('Add details to the story', [
            { name: 'The Lost Sheep', text: LESSON },
        ]);
        expect(fix).toContain(NOTE_LESSON_CHANGE_HINT);
        expect(
            toNoteAsk('what does verse 4 mean?', [
                { name: 'The Lost Sheep', text: LESSON },
            ]),
        ).not.toContain(NOTE_LESSON_CHANGE_HINT);
        expect(
            toNoteAsk('Add a line about Tom', [
                { name: 'Shopping', text: '1. paragraph: "milk"' },
            ]),
        ).not.toContain(NOTE_LESSON_CHANGE_HINT);
    });
});

// BN-80 (2026-11-10): a fix done as block surgery broke a sermon's shape --
// a point's verses under the point before it, a lesson heading taken out.
describe('a fix to a lesson adds and rewords', () => {
    const adds = {
        changes: [
            { after: 7, kind: 'h2', text: '1. Why parables' },
            { block: 14, text: '2. The hardened heart' },
        ],
    };

    it('goes through when it adds and rewords', () => {
        expect(findLessonChangeSurgery(adds, 'Add a point on parables')).toBe(
            null,
        );
    });

    it('is refused when it moves or takes out what was not asked', () => {
        expect(
            findLessonChangeSurgery(
                { changes: [...adds.changes, { after: 11, block: 8 }] },
                'Add a point on why Jesus uses parables',
            ),
        ).toContain('block 8');
        expect(
            findLessonChangeSurgery(
                { changes: [{ block: 29, remove: true }] },
                'Fix point numbering and headings',
            ),
        ).toContain('it moves or takes out no block of it');
    });

    it('lets their own words ask for a move or a removal', () => {
        expect(
            findLessonChangeSurgery(
                { changes: [{ block: 12, after: 20 }] },
                'Move "Prayer for Restoration" to Point 2',
            ),
        ).toBe(null);
        expect(
            findLessonChangeSurgery(
                { changes: [{ block: 30, remove: true }] },
                'Remove the second question',
            ),
        ).toBe(null);
    });
});

// BN-259 (ab91, batch NC N-08): the model's own edit after the first write
// rewrote the three hearer questions and none of their answers -- "Who came
// to Jesus in the temple?" over "He did this to show...".
describe("a hearer's question goes with its answer", () => {
    const question = (text: string) => `**A hearer asks:** ${text}`;
    const answer = (text: string) => `**The passage answers:** ${text}`;

    it('refuses a question given new words with its answer left', () => {
        const refusal = findHearerAnswerLeft({
            action: 'edit',
            changes: [
                { block: 11, text: question('What did the prophet say?') },
                { block: 18, text: question('How did the city react?') },
            ],
        });
        expect(refusal).toContain('blocks 11, 18 are');
        expect(refusal).toContain('(12, 19)');
        expect(refusal).toContain('Nothing was changed');
        expect(
            findHearerAnswerLeft({
                changes: [{ block: 25, text: question('Who came to him?') }],
            }),
        ).toContain('block 25 is a');
    });

    it('lets a question through with its answer, or kept as written', () => {
        expect(
            findHearerAnswerLeft({
                changes: [
                    { block: 11, text: question('Why a colt?') },
                    { block: 12, text: answer('"that it might be fulfilled"') },
                ],
            }),
        ).toBe(null);
        expect(
            findHearerAnswerLeft({
                changes: [
                    { block: 11, text: question('Why a colt?') },
                    { block: 12, remove: true },
                ],
            }),
        ).toBe(null);
    });

    it('leaves alone what is no question rewritten in place', () => {
        // An answer made to fit its question, a new point added, another
        // line changed.
        expect(
            findHearerAnswerLeft({
                changes: [
                    { block: 12, text: answer('He cast away his garment.') },
                    { after: 30, text: question('What did he leave?') },
                    { block: 10, text: '**What it means:** a colt' },
                    { block: 11, after: 20 },
                ],
            }),
        ).toBe(null);
        expect(findHearerAnswerLeft({ action: 'read' })).toBe(null);
        expect(findHearerAnswerLeft(undefined)).toBe(null);
    });

    // BN-263 (batch NF N-08): the three questions came back with their
    // label plain, and went through.
    it('reads the label written plain', () => {
        expect(
            findHearerAnswerLeft({
                changes: [
                    {
                        block: 18,
                        text: 'A hearer asks: What happened when Jesus entered?',
                    },
                ],
            }),
        ).toContain('block 18 is a');
    });
});

// BN-268 (batch NI N-12): a children's lesson into an empty note, its adds
// numbered 0 … 9 then 11 … 34, refused whole at the gap.
describe("a new lesson's adds into an empty note", () => {
    it('are put in the order given when numbered as they will stand', () => {
        const result = withBlankFillInOrder(
            {
                action: 'edit',
                changes: [
                    { block: 1, remove: true },
                    { after: 0, kind: 'passage', ref: 'Daniel 3:16-18' },
                    { after: 1, kind: 'h2', text: 'Big idea' },
                    { after: 2, text: 'God is able.' },
                    { after: 4, kind: 'h2', text: 'Background' },
                    { after: 4, text: 'A king made an image.' },
                ],
            },
            1,
        );
        expect(
            result.changes.map((change: any) => change.after ?? 'remove'),
        ).toEqual(['remove', 0, 0, 0, 0, 0]);
        expect(result.changes[3]).toEqual({ after: 0, text: 'God is able.' });
    });

    it('leaves adds the empty note can take, and any that go down', () => {
        for (const changes of [
            // All at the top, or within the note's one block.
            [
                { after: 0, kind: 'passage', ref: 'Daniel 3' },
                { after: 1, kind: 'section', text: '## Big idea' },
            ],
            // A number going down is no lesson in order.
            [
                { after: 0, text: 'one' },
                { after: 5, text: 'two' },
                { after: 3, text: 'three' },
            ],
            // One add alone.
            [{ after: 7, text: 'one' }],
        ]) {
            const args = { action: 'edit', changes };
            expect(withBlankFillInOrder(args, 1)).toBe(args);
        }
    });
});

// BN-265 (batch NG N-08): "**A hearer asks:** …" rewritten as a bare
// question, its label and its answer left behind.
describe('a point label a change drops', () => {
    const read = JSON.stringify({
        name: 'Palm Sunday',
        blocks: [
            { n: 24, kind: 'paragraph', text: '**What it means:** a den' },
            { n: 25, kind: 'paragraph', text: '**A hearer asks:** Why?' },
            { n: 26, kind: 'paragraph', text: '**The passage answers:** He' },
            { n: 27, kind: 'paragraph', text: 'A line of their own' },
        ],
    });

    it('reads the blocks a note read answered', () => {
        expect(readNoteReadBlocks(read)?.[1]).toEqual({
            n: 25,
            text: '**A hearer asks:** Why?',
        });
        expect(readNoteReadBlocks('Tool refused: no')).toBe(null);
        expect(readNoteReadBlocks('{"name":"x"}')).toBe(null);
    });

    it('is kept where the block had one', () => {
        const result = withLessonLabelsKept(
            {
                action: 'edit',
                changes: [
                    { block: 25, text: 'Why did Jesus overthrow the tables?' },
                    { block: 24, text: '  a place of profit ' },
                ],
            },
            readNoteReadBlocks(read),
        );
        expect(result.changes.map((change: any) => change.text)).toEqual([
            '**A hearer asks:** Why did Jesus overthrow the tables?',
            '**What it means:** a place of profit',
        ]);
    });

    it('leaves a label sent, a block with none, and other changes', () => {
        const args = {
            changes: [
                { block: 25, text: 'A hearer asks: Why the tables?' },
                { block: 27, text: 'Their line, reworded' },
                { block: 26, kind: 'h3', text: 'Answers' },
                { block: 24, text: 'one\ntwo' },
                { block: 24, remove: true },
                { after: 25, text: 'A new line' },
            ],
        };
        expect(withLessonLabelsKept(args, readNoteReadBlocks(read))).toBe(args);
        // No read since the last write: nothing to go by.
        const bare = { changes: [{ block: 25, text: 'Why?' }] };
        expect(withLessonLabelsKept(bare, null)).toBe(bare);
    });
});

// BN-263 (batch NF N-08): a point's labels written plain in a lesson's
// own edit, the form the blind readers marked down.
describe("a lesson's point labels", () => {
    it('are put in bold where a line starts with one written plain', () => {
        const result = withLessonLabelsBold({
            action: 'edit',
            changes: [
                { block: 11, text: 'A hearer asks: What did Jesus do?' },
                {
                    after: 30,
                    text:
                        'What it means:  a den of thieves\n' +
                        'For example: a market in the temple',
                },
                { block: 12, text: '**The passage answers:** He cast out' },
                { block: 9, remove: true },
            ],
        });
        expect(result.changes.map((change: any) => change.text)).toEqual([
            '**A hearer asks:** What did Jesus do?',
            '**What it means:** a den of thieves\n' +
                '**For example:** a market in the temple',
            '**The passage answers:** He cast out',
            undefined,
        ]);
    });

    it('leaves a label inside a sentence, and an edit with none', () => {
        const args = {
            changes: [
                { block: 3, text: 'He said, for example: give thanks.' },
                { block: 4, text: '*This week:* call a friend' },
            ],
        };
        expect(withLessonLabelsBold(args)).toBe(args);
        expect(withLessonLabelsBold(undefined)).toBe(undefined);
    });
});

// BN-163: the words of the lesson's own passage, as the ask read them.
describe('the passage as read', () => {
    it('joins the reads that fall in the passage', () => {
        const read = JSON.stringify({
            bible: 'KJV',
            verses: [
                {
                    ref: 'Psalm 45:17',
                    text: 'I will make thy name to be remembered',
                },
                { ref: 'Psalm 46:1-3', text: '(1): God is our refuge' },
                {
                    ref: 'Psalm 46:8',
                    text: '(8): what desolations he hath made',
                },
                { ref: 'John 4:14', text: 'a well of water' },
            ],
        });
        expect(readPassageVerseWords(['the ask', read], 'Psalm 46:1-11')).toBe(
            '(1): God is our refuge\n(8): what desolations he hath made',
        );
        expect(readPassageVerseWords(['the ask', read], null)).toBe('');
        expect(readPassageVerseWords(null, 'Psalm 46')).toBe('');
        expect(readPassageVerseWords([read], 'Nowhere 1:1')).toBe('');
    });
});

// BN-175 (shape44's children's Jonah): told "<its number>", the model
// changed two headings; the note names the memory verse's block now.
describe("a child's memory verse by its block", () => {
    it('finds the block after the Memory verse heading', () => {
        const blocks = [
            { n: 1, kind: 'passage', text: '(KJV) Jonah 3:10' },
            { n: 35, kind: 'h2', text: 'Memory verse' },
            { n: 36, kind: 'paragraph', text: '' },
            { n: 37, kind: 'passage', text: '(KJV) 1 John 4:16 -- And we' },
        ];
        expect(findMemoryVerseBlock(blocks)).toBe(37);
        expect(findMemoryVerseBlock(blocks.slice(0, 1))).toBeNull();
        const note = genChildMemoryVerseNote('1 John 4:16', 29, []);
        // BN-208: no short verse of the passage to offer, the shape's own
        // way -- one from elsewhere, read first.
        expect(note).toContain(
            'when no verse of the passage is that short, a short verse from ' +
                'elsewhere in Scripture that says it, read with ' +
                'owa_find_verse first',
        );
        expect(withMemoryVerseBlock(note, 37)).toContain(
            '{block: 37, ref: "<the verse>"}',
        );
        expect(withMemoryVerseBlock(note, 37)).toContain(
            "give block 37, the memory verse's passage, that verse",
        );
        expect(withMemoryVerseBlock(note, null)).toBe(note);
    });

    // BN-213 (ab63, Sonnet: Proverbs 3:5-6 at 19, 3:5 under two points):
    // the same verses printed under two points are sent back, a short
    // passage too; a clause quoted with a chip is no printing.
    it('sends back a point that prints the verses of one above it', () => {
        const lesson = (second: string) => {
            return (
                '[^Proverbs 3:5-6]\n## Big idea\nTrust him.\n' +
                '## 1. Trust the Lord\n[^Proverbs 3:5]\n**What it means:** Trust.\n' +
                `## 2. Lean not\n${second}\n**What it means:** Lean.\n` +
                '## 3. Acknowledge him\n[^Proverbs 3:6]\n## Memory verse\n' +
                '[^Proverbs 3:5]'
            );
        };
        const problem = findLessonPointsProblem(lesson('[^Proverbs 3:5]'));
        expect(problem?.repeat).toEqual({
            point: 2,
            earlierPoint: 1,
            ref: 'Proverbs 3:5',
        });
        expect(genLessonPointsRefusal(problem!)).toContain(
            'point 2 prints Proverbs 3:5 again, as point 1 does',
        );
        expect(genLessonPointsRefusal(problem!)).toContain(
            'a short passage gives its points from its clauses',
        );
        expect(
            findLessonPointsProblem(
                lesson(
                    '"lean not unto thine own understanding" [^Proverbs 3:5]',
                ),
            ),
        ).toBeNull();
        // Two halves of one verse print it whole, twice (shape67).
        expect(
            findLessonPointRepeat(
                lesson('[^Proverbs 3:5b]').replace(
                    '[^Proverbs 3:5]\n**What it means:** Trust.',
                    '[^Proverbs 3:5a]\n**What it means:** Trust.',
                ),
            ),
        ).toEqual({ point: 2, earlierPoint: 1, ref: 'Proverbs 3:5' });
        // The memory verse printing the passage's verse is no point.
        expect(findLessonPointRepeat(lesson('[^(KJV) Proverbs 3:6]'))).toEqual({
            point: 3,
            earlierPoint: 2,
            ref: 'Proverbs 3:6',
        });
    });

    // BN-220 (shape69): a point's long printing of verses the top already
    // prints is named instead -- 1 Samuel 17 printed whole twice.
    it('names a point printing more than ten verses the top prints', () => {
        const args = {
            action: 'edit',
            changes: [
                { block: 1, remove: true },
                {
                    after: 0,
                    kind: 'section',
                    text:
                        '[^1 Samuel 17:1-54]\n## Big idea\nGod saves.\n' +
                        '## 1. The giant defies\n[^1 Samuel 17:1-26]\n' +
                        '**What it means:** Fear.\n' +
                        '## 2. The past faithfulness\n[^1 Samuel 17:34-37]\n' +
                        '**What it means:** Trust.\n' +
                        '## 3. The name of the LORD\n[^(KJV) 1 Samuel 17:38-54]\n' +
                        '## Memory verse\n[^1 Samuel 17:47]',
                },
            ],
        };
        const text = withLongPointPassagesNamed(args).changes[1].text;
        expect(text).toContain('**Verses:** [^1 Samuel 17:1-26]');
        // Four verses are printed as they were.
        expect(text).toContain('\n[^1 Samuel 17:34-37]\n');
        expect(text).toContain('**Verses:** [^(KJV) 1 Samuel 17:38-54]');
        // The top, the memory verse: as they were.
        expect(text.startsWith('[^1 Samuel 17:1-54]\n')).toBe(true);
        expect(text).toContain('## Memory verse\n[^1 Samuel 17:47]');
        // A passage change of its own becomes a paragraph naming it.
        const parted = withLongPointPassagesNamed({
            action: 'edit',
            changes: [
                { after: 0, kind: 'passage', ref: 'Matthew 13:1-23' },
                { after: 1, kind: 'h2', text: '4. The good ground' },
                { after: 2, kind: 'passage', ref: 'Matthew 13:8-23' },
            ],
        });
        expect(parted.changes[2]).toEqual({
            after: 2,
            kind: 'paragraph',
            text: '**Verses:** [^Matthew 13:8-23]',
        });
        // Verses the top does not print are printed by the point.
        const outside = {
            action: 'edit',
            changes: [
                {
                    after: 0,
                    kind: 'section',
                    text:
                        '[^Luke 15:1-7]\n## 1. The lost son\n' +
                        '[^Luke 15:11-32]',
                },
            ],
        };
        expect(withLongPointPassagesNamed(outside)).toBe(outside);
    });

    // BN-208 (shape62): the verse put in a named memory verse's place,
    // read off the edit that swaps it.
    it('reads the one verse an edit swaps in', () => {
        expect(findSwappedVerseRef([{ block: 39, ref: 'Jonah 4:2' }])).toBe(
            'Jonah 4:2',
        );
        expect(
            findSwappedVerseRef([
                { block: 28, text: 'Jonah was in the fish.' },
                { block: 39, ref: 'Psalm 103:8' },
            ]),
        ).toBe('Psalm 103:8');
        expect(
            findSwappedVerseRef([
                { block: 3, ref: 'Jonah 1:1' },
                { block: 39, ref: 'Psalm 103:8' },
            ]),
        ).toBeNull();
        expect(findSwappedVerseRef([{ block: 2, text: 'a line' }])).toBeNull();
        expect(findSwappedVerseRef(undefined)).toBeNull();
    });
});

// BN-280 (2026-11-14, batch PE's Esther): every "A hearer asks" line turned
// into a statement in one later edit, its answers left answering nothing.
describe("a statement written over a hearer's question", () => {
    const blocks = [
        { n: 11, text: '**A hearer asks:** Why was Esther so afraid?' },
        { n: 12, text: '**The passage answers:** the law was absolute.' },
        { n: 18, text: 'A hearer asks: What if she kept silent?' },
        { n: 20, text: '**What it means:** a fast' },
    ];

    it('is refused, naming each question', () => {
        const refusal = findHearerQuestionTurned(
            {
                action: 'edit',
                changes: [
                    {
                        block: 11,
                        text: 'The verses say that Esther had not been called.',
                    },
                    {
                        block: 18,
                        text: 'The verses say deliverance would arise.',
                    },
                ],
            },
            blocks,
        );
        expect(refusal).toContain("blocks 11, 18 are hearer's questions");
        expect(refusal).toContain(
            '("A hearer asks: Why was Esther so afraid?")',
        );
        expect(refusal).toContain('ask it another way');
    });

    it('lets a question, another block and a removal through', () => {
        for (const change of [
            { block: 11, text: 'What did the law say of the inner court?' },
            {
                block: 11,
                text: '**A hearer asks:** Why could Esther not go in?',
            },
            { block: 20, text: '**What it means:** a fast of three days' },
            { block: 11, remove: true },
            { block: 11, kind: 'h3', text: 'The law' },
            { after: 11, text: 'A new line' },
        ]) {
            expect(
                findHearerQuestionTurned({ changes: [change] }, blocks),
                JSON.stringify(change),
            ).toBe(null);
        }
        expect(
            findHearerQuestionTurned(
                { changes: [{ block: 11, text: 'A statement.' }] },
                null,
            ),
        ).toBe(null);
    });
});

// BN-282 (ab105, Sonnet: an error): a short quote before a misquote --
// "debt" -- had its closing mark paired with the next quote's opening, and
// 1 Peter 2:24 in a modern translation's words under a KJV label was never
// read. 333 quotes of 2 752 lessons went unchecked so.
describe('a short quote leaves the next one paired', () => {
    const line =
        'Jesus is the one who took the ultimate "debt" of our sin upon ' +
        'Himself on the cross. As it is written, "For he himself bore our ' +
        'sins in his body on the tree" [^(KJV) 1 Peter 2:24].';

    it('finds the quotation after it, tied to its verse', () => {
        expect(findCitedQuotes(line)).toEqual([
            {
                quote: 'For he himself bore our sins in his body on the tree',
                ref: '1 Peter 2:24',
            },
        ]);
    });

    it('holds the quotation after it to the passage read', () => {
        expect(
            findNoteMisquotes(line, [
                '(24): Who his own self bare our sins in his own body on the ' +
                    'tree, that we, being dead to sins, should live unto ' +
                    'righteousness: by whose stripes ye were healed.',
            ]),
        ).toEqual(['For he himself bore our sins in his body on the tree']);
    });

    it('still passes a short quote over', () => {
        expect(findCitedQuotes('the "debt" [^Matthew 6:12] paid')).toEqual([]);
    });
});
