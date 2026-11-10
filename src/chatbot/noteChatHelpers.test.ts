import { describe, expect, it } from 'vitest';

import type { ChatAttachmentType } from './attachmentHelpers';
import {
    NOTE_EDIT_TOOL_NAME,
    NOTE_FORMAT_HINT,
    NOTE_NEW_LESSON_HINT,
    NOTE_QUESTION_HINT,
    NOTE_SYSTEM_PROMPT,
    NOTE_WORDLESS_HINT,
    checkAddsNoteVerse,
    checkIsNewLessonAsk,
    checkIsNoteFormatAsk,
    checkIsNoteQuestionOnly,
    checkIsNoteAttachment,
    checkIsNoteOpenedLast,
    findNoteAskFiles,
    findOpenNoteAttachments,
    findSessionHoldingNote,
    findSessionNoteTarget,
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
