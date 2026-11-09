import { describe, expect, it } from 'vitest';

import type { ChatAttachmentType } from './attachmentHelpers';
import {
    NOTE_EDIT_TOOL_NAME,
    NOTE_SYSTEM_PROMPT,
    NOTE_WORDLESS_HINT,
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
    toNoteAsk,
    toNoteDocumentText,
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
            'Tidy it into headings and lists',
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
