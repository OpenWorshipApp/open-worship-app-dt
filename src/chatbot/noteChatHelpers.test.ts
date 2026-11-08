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
    genNoteOpeningAnswer,
    resolveNoteEditTarget,
    toNoteAsk,
    toNoteDocumentText,
} from './noteChatHelpers';

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
