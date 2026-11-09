/**
 * A conversation about ONE of the user's BIBLE NOTES, attached to the tab --
 * from a note row's **Open in Chatbot** or the 🤖 in the note window's
 * footer.
 *
 * Asked for 2026-11-07 (the user, with a note row's menu open on Open / Edit
 * Title / Export / Duplicate / Move To: _add `Open in Chatbot` for bible-note,
 * to do what `Open in Chatbot` of appdocument … goal: chatbot can help modify
 * and answer everything on bible-note_).
 *
 * The slide document's conversation (`slideChatHelpers.ts`) is the shape: a
 * question asked while a note is open in the tab is a `note` ask. The window
 * reads the note as it stands NOW through `owa_note_edit read` (unsaved
 * typing included) and puts it under the question as numbered blocks in a
 * light mark-up (`toNoteAsk`) -- never the editor's JSON, whose pictures are
 * megabytes of base64. The ask goes out under its own prompt with
 * `owa_note_edit`, offered to no other question, beside the guide's two
 * tools -- how the note EDITOR works is the editor's own guide's, aimed at
 * the Bible Note window by the window -- and the verse finder. The model
 * names a note; the window turns the name into the note's file and id
 * (`resolveNoteEditTarget`), so no path ever reaches it or comes from it.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { ChatAttachmentType } from './attachmentHelpers';
import { checkIsFileAttachment } from './attachmentHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    type AssistantLanguageType,
} from './chatLangHelpers';
import { fillWords, tran } from './chatTranHelpers';
import {
    type LyricTranslateModeType,
    genLyricTranslateReplies,
    pickTranslateLanguage,
} from './lyricChatHelpers';
import {
    type SlideSizeAskType,
    readTranslateLanguageName,
} from './slideChatHelpers';
import {
    toNoteWindowTarget,
    type NoteWindowTargetType,
} from '../helper/ai/noteWindowMatchHelpers';

export const NOTE_ASK_KIND = 'note';
export const NOTE_EDIT_TOOL_NAME = 'owa_note_edit';
// A read on, a change (every block in one call), a retry after a refusal, a
// guide search and its page, and the answer.
export const NOTE_MAX_TOOL_ROUNDS = 8;
/** The most notes one question reads and may change. */
export const MAX_NOTE_ASK_FILES = 2;
// What one note may cost the question it rides on: a sermon's notes of
// sixty blocks are ~8 000 characters.
const MAX_NOTE_DOC_TEXT_CHARS = 16000;

const NOTE_FILE_PATTERN = /\.own$/i;

/** Whether an attachment is ONE note of a notes file. */
export function checkIsNoteAttachment(attachment: ChatAttachmentType) {
    return (
        checkIsFileAttachment(attachment) &&
        NOTE_FILE_PATTERN.test(attachment.filePath ?? '') &&
        Number.isSafeInteger(attachment.noteId)
    );
}

export type NoteAskFileType = {
    name: string;
    filePath: string;
    noteId: number;
};

function toNoteAskFile(attachment: ChatAttachmentType): NoteAskFileType {
    return {
        name: attachment.name,
        filePath: attachment.filePath as string,
        noteId: attachment.noteId as number,
    };
}

/**
 * The notes among a tab's open files -- each once, the first
 * `MAX_NOTE_ASK_FILES`.
 */
export function findNoteAskFiles(
    attachments: readonly ChatAttachmentType[],
): NoteAskFileType[] {
    const out: NoteAskFileType[] = [];
    for (const attachment of attachments) {
        if (
            !checkIsNoteAttachment(attachment) ||
            out.some((one) => {
                return (
                    one.filePath === attachment.filePath &&
                    one.noteId === attachment.noteId
                );
            })
        ) {
            continue;
        }
        out.push(toNoteAskFile(attachment));
    }
    return out.slice(0, MAX_NOTE_ASK_FILES);
}

/**
 * The notes a tab is still about, however many files came after: those of
 * the last question that attached one, unless the tab closed its files since
 * (`closedAfterId`) -- a picture attached later, a verse asked about, must
 * not close the note the conversation is changing.
 */
export function findOpenNoteAttachments(
    messages: readonly {
        id: number;
        author: string;
        attachments?: ChatAttachmentType[];
    }[],
    closedAfterId?: number,
): ChatAttachmentType[] {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAfterId !== undefined && message.id <= closedAfterId) {
            return [];
        }
        if (message.author !== 'you') {
            continue;
        }
        const notes = (message.attachments ?? []).filter(checkIsNoteAttachment);
        if (notes.length > 0) {
            return notes;
        }
    }
    return [];
}

// --- words selected in the note window -----------------------------------
//
// 2026-11-08, the user: _as a user I want to select bible note text then
// click the agent button then writing a qustion about the selected text_.
// The 🤖 on the note window's selection bar hands the words over beside the
// note, and the box is given them as a quote the question goes under.

function toComparablePath(filePath: string) {
    return filePath.replace(/\\/g, '/');
}

function checkIsSameNote(
    attachment: ChatAttachmentType,
    filePath: string,
    noteId: number,
) {
    return (
        checkIsNoteAttachment(attachment) &&
        attachment.noteId === noteId &&
        toComparablePath(attachment.filePath ?? '') ===
            toComparablePath(filePath)
    );
}

/**
 * The tab already on that note -- in its box, or open in what it asked --
 * and the note's attachment there; the tab in front first, then the newest.
 * Null when no tab holds it, and the note is attached in a tab of its own.
 */
export function findSessionHoldingNote(
    sessions: readonly {
        id: string;
        messages: Parameters<typeof findOpenNoteAttachments>[0];
        fileClosedAt?: number;
    }[],
    draftAttachmentMap: Readonly<
        Record<string, readonly ChatAttachmentType[] | undefined>
    >,
    activeId: string,
    filePath: string,
    noteId: number,
): { sessionId: string; attachment: ChatAttachmentType } | null {
    const ordered = [
        ...sessions.filter((session) => {
            return session.id === activeId;
        }),
        ...sessions
            .filter((session) => {
                return session.id !== activeId;
            })
            .reverse(),
    ];
    for (const session of ordered) {
        const attachment = [
            ...(draftAttachmentMap[session.id] ?? []),
            ...findOpenNoteAttachments(session.messages, session.fileClosedAt),
        ].find((one) => {
            return checkIsSameNote(one, filePath, noteId);
        });
        if (attachment !== undefined) {
            return { sessionId: session.id, attachment };
        }
    }
    return null;
}

function toComparableName(text: string) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A Bible note the assistant MADE in an answer (`owa_bible_note add`). */
export type CreatedNoteType = {
    name: string;
    filePath: string;
    noteId: number;
    undoId: string | null;
};

/**
 * The note an `owa_bible_note add` made, off its RESULT -- a refusal is a
 * sentence and made nothing (2026-11-08, the user: _chatbot should be able
 * to create new bible note (not allow delete), after create should open the
 * note and attach to the chatbot session_). The window opens that note's
 * own window and attaches it to the tab, as a row's Open in Chatbot does;
 * the path is the app's answer, never anything the model wrote.
 */
export function readCreatedNote(text: string): CreatedNoteType | null {
    try {
        const result = JSON.parse(text);
        if (
            typeof result?.added !== 'string' ||
            typeof result.filePath !== 'string' ||
            !NOTE_FILE_PATTERN.test(result.filePath) ||
            !Number.isSafeInteger(result.id) ||
            result.id < 0
        ) {
            return null;
        }
        return {
            name: result.added,
            filePath: result.filePath,
            noteId: result.id,
            undoId:
                typeof result.undoId === 'string' && result.undoId !== ''
                    ? result.undoId
                    : null,
        };
    } catch (_error) {
        return null;
    }
}

/**
 * What a model's call turns into: the attached note's file and id, or a
 * `reason` to refuse with. A model names a note; it never hands over a file
 * or an id -- words planted in a note could ask for any file -- and only an
 * ATTACHED note is changed here.
 */
export function resolveNoteEditTarget(
    args: Record<string, unknown>,
    files: readonly NoteAskFileType[],
): { file: string; id: number; note: string } | { reason: string } {
    if (args.file !== undefined || args.id !== undefined) {
        return {
            reason:
                'Name the note (`note`) as it is attached, by its name -- ' +
                'never a file or an id.',
        };
    }
    const text = typeof args.note === 'string' ? args.note.trim() : '';
    if (/[\\/]/.test(text)) {
        return {
            reason: 'Name the note as it is attached, by its name -- never a path.',
        };
    }
    const names = files
        .map((one) => {
            return `"${one.name}"`;
        })
        .join(', ');
    if (text === '') {
        return files.length === 1
            ? {
                  file: files[0].filePath,
                  id: files[0].noteId,
                  note: files[0].name,
              }
            : { reason: `Say which note (\`note\`): ${names}.` };
    }
    const attached = files.find((one) => {
        return toComparableName(one.name) === toComparableName(text);
    });
    if (attached === undefined) {
        return {
            reason:
                `Only the note attached here can be changed: ${names}. ` +
                'Another note is opened with Open in Chatbot on its row.',
        };
    }
    return {
        file: attached.filePath,
        id: attached.noteId,
        note: attached.name,
    };
}

function toBlockLine(block: any) {
    const number = Number.isInteger(block?.n) ? block.n : '?';
    const kind = String(block?.kind ?? 'paragraph');
    const indent = Number.isInteger(block?.level)
        ? '  '.repeat(block.level)
        : '';
    const tick =
        kind === 'check' ? (block?.checked === true ? ' [x]' : ' [ ]') : '';
    const fixed = block?.isFixed === true ? ' (fixed)' : '';
    const cut =
        block?.isTextCut === true
            ? ' (too long to show whole -- its words cannot be replaced)'
            : '';
    const words = String(block?.text ?? '');
    return `${indent}${number}. ${kind}${tick}${fixed}${cut}${words === '' ? '' : `: ${JSON.stringify(words)}`}`;
}

/**
 * One note as the model reads it: its name and file, how many blocks, the
 * hash a change gives back, then a line a block -- its number, kind and
 * words as a JSON string (a line break shows as `\n` and a translation
 * keeps it). Plain lines, never the editor's JSON: a model shown JSON writes
 * JSON back.
 */
export function toNoteDocumentText(read: any) {
    if (read === null || typeof read !== 'object') {
        return null;
    }
    const blocks: any[] = Array.isArray(read.blocks) ? read.blocks : [];
    const lines = [
        `Blocks: ${Number.isInteger(read.blockCount) ? read.blockCount : blocks.length}` +
            (typeof read.file === 'string'
                ? ` · in the notes file "${read.file}"`
                : '') +
            (typeof read.hash === 'string' ? ` · hash "${read.hash}"` : ''),
    ];
    if (blocks.length === 0) {
        lines.push('(the note is empty: add blocks with `after: 0`)');
    }
    for (const block of blocks) {
        lines.push(toBlockLine(block));
    }
    if (Number.isInteger(read.nextFrom)) {
        lines.push(
            `[... blocks from ${read.nextFrom} on were not included; ` +
                `${NOTE_EDIT_TOOL_NAME} "read" with \`from\` ${read.nextFrom} reads on]`,
        );
    }
    // What the font box lists, for a `font` change.
    if (Array.isArray(read.fonts) && read.fonts.length > 0) {
        lines.push(`Fonts: ${read.fonts.join(', ')}`);
    }
    const text = lines.join('\n');
    return text.length > MAX_NOTE_DOC_TEXT_CHARS
        ? `${text.slice(0, MAX_NOTE_DOC_TEXT_CHARS)}\n[... the rest was not included; ${NOTE_EDIT_TOOL_NAME} "read" with \`from\` reads on]`
        : text;
}

// Said to the model under a pressed translate button, so which way is never
// its guess -- the song's two ways, said for a note.
const NOTE_TRANSLATE_HINT_MAP: Record<LyricTranslateModeType, string> = {
    replace:
        '(They chose to REPLACE the words with the translation: ONE edit ' +
        'call giving every block with words its translated words, its ' +
        'mark-up and every [^…] [@…] [#…] token kept as they are. When no ' +
        'language is named, ask which first, with OPTIONS naming two or ' +
        'three languages -- never the two ways again.)',
    under:
        '(They chose to KEEP the words and add the translation under them: ' +
        'ONE edit call where each block with words is its own words, a line ' +
        'break, then the translation of them; the tokens stay in the first ' +
        'line only. When no language is named, ask which first, with ' +
        'OPTIONS naming two or three languages -- never the two ways again.)',
};

// Sent with nothing typed under the card.
export const NOTE_WORDLESS_HINT =
    '(They sent this with no words of their own: say in a sentence what you ' +
    'can do with this note and end with OPTIONS.)';

/**
 * The question as the model is asked it: what they typed, then each attached
 * note as it reads now, named as `note` takes it.
 */
export function toNoteAsk(
    asked: string,
    notes: readonly { name: string; text: string | null }[],
    translateMode: LyricTranslateModeType | null = null,
    isWordless = false,
) {
    const language =
        translateMode === null ? null : readTranslateLanguageName(asked);
    const shown = notes.map((note) => {
        return (
            `(The Bible note "${note.name}" is attached. Change it with ` +
            `${NOTE_EDIT_TOOL_NAME} action "edit", note "${note.name}", the ` +
            'hash below. It reads now:\n' +
            `${note.text ?? `(it could not be read just now; call ${NOTE_EDIT_TOOL_NAME} with action "read")`})`
        );
    });
    return [
        ...(isWordless ? [NOTE_WORDLESS_HINT] : []),
        asked,
        ...(translateMode === null
            ? []
            : [NOTE_TRANSLATE_HINT_MAP[translateMode]]),
        ...(language === null
            ? []
            : [
                  `(The language is ${language}: translate into it now, in ` +
                      'one call -- do not ask which language.)',
              ]),
        ...shown,
    ].join('\n\n');
}

/**
 * The system prompt of such a conversation: what a block is, what the tool
 * takes, that verse words are the Bible's, and where the editor's own help
 * is.
 */
export const NOTE_SYSTEM_PROMPT =
    'You are the help assistant inside Open Worship app, a church ' +
    'presentation program, helping a volunteer with a Bible note they ' +
    "attached -- sermon or study notes written in the app's Bible Note " +
    'editor. The note is given under their message as it reads now: every ' +
    'block numbered, its kind, and its words as a JSON string (\\n between ' +
    'lines). Kinds: paragraph, h1 to h6 (headings), quote, code, and list ' +
    'items bullet, number and check ([x] is ticked). A block marked fixed ' +
    '(table, passage -- a Bible passage --, picture, drawing, sticky, rule, ' +
    'video, columns, collapsible, date, poll, equation …) can be moved, ' +
    'removed, styled or aligned, never given words. WORDS carry a light ' +
    'mark-up: **bold**, *italic*, __underline__, ~~strike~~, `code`, ' +
    '[words](https://…), and mentions: [^John 3:16] a Bible verse, [@Moses] ' +
    'a person, [#Jerusalem] a place. CHANGE the note with ' +
    `${NOTE_EDIT_TOOL_NAME} action "edit", \`note\` its name as given and ` +
    '`hash` as given, EVERY change in ONE call: {block, text} gives a block ' +
    'new words (keep its mark-up and every mention token exactly as it is, ' +
    'unless asked to take one out), {block, kind} changes its kind, {block, ' +
    'remove: true} removes it, {block, after} moves it after block `after`, ' +
    '{after, kind, text} adds a block after block `after` (0 is the top; ' +
    'several after one block keep their order). Block numbers are the note ' +
    'as you read it, whatever the call does. Change only the blocks the ' +
    'request is about. WORDS THEY SELECTED: "> " lines under a line ending ' +
    'in a colon quote what they selected in this note -- the words between ' +
    '** and ** (a selection mark, not bold), the rest of each line around ' +
    "them, … for words left out; in the brackets the note's name and, for " +
    "one line, the selection's first and last character in it. What they " +
    'wrote after the quote is about THOSE words: answer about them, and ' +
    'make a change it asks for to the blocks holding them, with `words` ' +
    'when it is part of a block. A BIBLE VERSE is never your words: put one in with a ' +
    'NEW token [^Book chapter:verse] in the words, or a block {after, kind: ' +
    '"passage", ref: "John 3:16-17"} for its whole text -- the app reads it ' +
    'from the installed Bible. Never type a verse out. A new [@Name] or ' +
    '[#Place] is looked up in the names lookup and becomes a mention when ' +
    'it is there. When a request has one sensible reading, do it ' +
    'rather than ask: every change can be undone. PUTTING AN ANSWER IN: ' +
    'right after you answered or taught something, a short line -- "add ' +
    'it", "put it in", "save this", "new section", "new page" -- means that ' +
    'answer goes at the END of the note, its words whole, in ONE edit: ' +
    '{after: the last block, kind: "page-break"} first when they say page, ' +
    'then {after: the last block, kind: "section", text} -- text its lines, ' +
    'a block a line: "## Its heading", then a "- " line a point, verses as ' +
    '[^John 3:16]. TRANSLATING has two ways ' +
    'and the person chooses: REPLACE the words with the translation, or ADD ' +
    'the translation on the line under the words, keeping them. Only words ' +
    'that ask to translate, or name a language, are a translation. Unless ' +
    'their words already say which, ask which way first and end with ' +
    'OPTIONS: Replace the words | Add it under each line. Once the way is ' +
    'known and the language is not, ask which language, with OPTIONS naming ' +
    "two or three languages. Write natural words in the language's own " +
    "script, Bible names the way that language says them. THE EDITOR'S " +
    'TOOLBAR is yours to use, never to explain -- every control of it is a ' +
    'field of a change, on a whole block or, with `words`, only those words ' +
    'of it (its selection): size ("larger", "smaller" or px 8-72; for "make ' +
    'the text bigger" give every block with words size "larger" in ONE ' +
    'call, each part keeping its size against the others), font (one of ' +
    'the Fonts line, or "default"), color and background (a colour, or ' +
    '"none"), styles / stylesOff (bold, italic, underline, strikethrough, ' +
    'code, subscript, superscript, highlight, lowercase, uppercase, ' +
    'capitalize), clear: true (Clear Formatting), align (left, center, ' +
    'right, justify) and indent ("more", "less"; a list item nests under ' +
    'the one before). For "make the word grace red and bold" the change ' +
    'is {block: 5, words: "grace", color: "red", styles: ["bold"]}. Its ' +
    'Insert menu is kinds to add: table, columns, ' +
    'collapsible, page-break, rule, equation, sticky, date, poll, video ' +
    '(YouTube), website, media (a link or a path), drawing (a line a box, ' +
    '"A -> B" an arrow from box A to box B) and example (the editor\'s own ' +
    'sample note). A code block takes `language` and `theme`. Link block ' +
    'text is {block, words?, linkTo: n} (an arrow to block n, `linkToWords` ' +
    'for words there). Its Undo and Redo of what the note kept are ' +
    'actions "undo" and "redo", its ¶ is action "view" with ' +
    'invisibleCharacters true or false. Never answer one of these with the ' +
    "editor's steps: make it. TIDYING a note " +
    'into headings and lists: every block keeps its own words -- a heading ' +
    'that names a point is a NEW block ({after, kind: "h2", text}) put ' +
    'above the lines it covers, and a line that is a point becomes a ' +
    'bullet with {block, kind: "bullet"} and no `text`. Never give a ' +
    "block a heading's words in place of its own. Questions ABOUT the note " +
    '(sum it up, what verses it uses, what a point means) are answered from ' +
    'its words; a verse it names is quoted with owa_find_verse `refs`, never ' +
    'from memory. How to do something in the note EDITOR itself (sticky ' +
    'notes, tables, comments, drawings, Word copies, printing, read-only, ' +
    'zoom) is in its guide: search it with owa_help_search, open the page ' +
    'with owa_help_page, and answer in its words. A NEW note -- asked to ' +
    'make, write or start another one, or to put an answer into one -- is ' +
    'owa_bible_note action "add", ' +
    'its `title` and `text` written by you (# headings, - lists, **bold**, ' +
    'a verse as [^John 3:16]), never blocks added to this one; the app ' +
    'opens it and the conversation moves to it. When the tool refuses, ' +
    'read its reason, fix the call and try once more; then say plainly what ' +
    "went wrong. After a change, say in a sentence or two what the tool's " +
    'answer lists as done (its summary) -- never a change it does not list ' +
    '-- that ' +
    "it is NOT saved yet (the note window's Save, Ctrl+S, keeps it; a note " +
    'window that is open shows the change now) -- a new title is kept at ' +
    'once -- and that Undo this change puts it back (after an "undo", that ' +
    'a "redo" does). Never write the blocks, ' +
    'the mark-up or any JSON out in your answer: a verse is named plainly ' +
    '(John 3:16), never as [^John 3:16]. End with OPTIONS: two or three next ' +
    'changes they might want.';

/**
 * The card a note opens its tab with, written by the window with no model:
 * that it is attached, what can be done with it, and the changes asked for
 * most as buttons -- the song card's two translate buttons among them. Every
 * button is a question pressed, answered by the assistant.
 */
export function genNoteOpeningAnswer(
    name: string,
    appLanguage: AssistantLanguageType,
    languages: readonly AssistantLanguageType[],
) {
    const target = pickTranslateLanguage(name, appLanguage, languages);
    // Named as the reader of THIS window says it: its own word in a window
    // shown in English, the language's own name in any other.
    const targetName =
        target === null
            ? null
            : appLanguage.code === DEFAULT_CHAT_LANG_CODE
              ? target.name
              : target.nativeName;
    return {
        text: fillWords(
            tran(
                '“{name}” is attached below. I can change this note for you: ' +
                    'change or translate its words, check the spelling, tidy ' +
                    'it into headings and lists, or add Bible verses. I can ' +
                    'also sum it up, answer questions about it, and explain ' +
                    'how to do anything in the note editor. Press one, or say ' +
                    'what you want.',
            ),
            { name },
        ),
        replies: [
            ...genLyricTranslateReplies(targetName),
            tran('Check the spelling'),
            tran('Summarize this note'),
            tran('Tidy it into headings and lists'),
        ],
        translateLanguage: target,
    };
}

/**
 * Whether the document the tab opened LAST is a note -- of the files of the
 * last question that attached any, unless the tab closed its files since --
 * so a note opened after a slide document or a running order is the one a
 * question is about, and one opened before them is not.
 */
/**
 * The note a tab is a conversation about, as its own window names it -- read
 * off what the tab keeps, so it holds across a reload and a relaunch of the
 * help window (2026-11-08, the user: _chatbot should demand select a
 * bible-note window_). Null for a tab about no note.
 */
export function findSessionNoteTarget(
    messages: Parameters<typeof findOpenNoteAttachments>[0],
    closedAfterId?: number,
): NoteWindowTargetType | null {
    const note = findOpenNoteAttachments(messages, closedAfterId).at(-1);
    return note === undefined || typeof note.filePath !== 'string'
        ? null
        : toNoteWindowTarget(note.filePath, note.noteId);
}

export function checkIsNoteOpenedLast(
    messages: Parameters<typeof findOpenNoteAttachments>[0],
    closedAfterId?: number,
) {
    for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (closedAfterId !== undefined && message.id <= closedAfterId) {
            return false;
        }
        if (message.author !== 'you') {
            continue;
        }
        const files = (message.attachments ?? []).filter((one) => {
            return typeof one.filePath === 'string';
        });
        if (files.length > 0) {
            return files.some(checkIsNoteAttachment);
        }
    }
    return false;
}

// --- sizes the window changes by itself -------------------------------------

/**
 * Every block's words larger, smaller or one size: work with one right
 * answer, done by the WINDOW with no model (2026-11-08, the user, with a note
 * conversation answering "make text bigger" with the toolbar's steps: _check
 * why chatbot can't help increase text size_) -- the slide card's
 * **Make the words larger** for a note, instant, with no assistant needed.
 * One `size` change a block, each run scaled from its own size by the app
 * (`agentNoteBlockHelpers.ts`). Null for a note read in parts or a size the
 * editor does not have: the assistant takes those.
 */
export function genNoteSizeChanges(read: any, ask: SlideSizeAskType) {
    if (
        read === null ||
        typeof read !== 'object' ||
        Number.isInteger(read.nextFrom) ||
        !Array.isArray(read.blocks)
    ) {
        return null;
    }
    if (
        ask.kind === 'set' &&
        (ask.size < NOTE_SIZE_MIN || ask.size > NOTE_SIZE_MAX)
    ) {
        return null;
    }
    const size =
        ask.kind === 'set' ? ask.size : ask.factor > 1 ? 'larger' : 'smaller';
    const changes = read.blocks
        .filter((block: any) => {
            return (
                Number.isInteger(block?.n) &&
                block.isFixed !== true &&
                String(block.text ?? '').trim() !== ''
            );
        })
        .map((block: any) => {
            return { block: block.n as number, size };
        });
    return changes.length === 0 ? null : changes;
}

// --- whole-note styles the window makes by itself ---------------------------
//
// _make all the text bold_, _centre everything_, _use Georgia for the whole
// note_, _clear the formatting of the whole note_ (BN-08, 2026-11-08): like
// the size, a short English line about the WHOLE note is done by the window
// with no model -- with no key and no internet too. A line about one part
// (_make the heading bold_) is the assistant's.

export type NoteStyleAskType = {
    styles?: string[];
    color?: string;
    font?: string;
    align?: string;
    clear?: true;
};

const WHOLE_NOTE_PATTERN =
    '(?:all(?: of)?(?: the)?(?: text| words| note)?|everything|the whole note|' +
    'the whole text|the (?:text|words|note)(?: all)?|it all)';
const STYLE_WORD_MAP: Record<string, string> = {
    bold: 'bold',
    italic: 'italic',
    italics: 'italic',
    underline: 'underline',
    underlined: 'underline',
    highlighted: 'highlight',
    uppercase: 'uppercase',
    capitals: 'uppercase',
    'capital letters': 'uppercase',
    lowercase: 'lowercase',
    'crossed out': 'strikethrough',
    strikethrough: 'strikethrough',
};
const ALIGN_WORD_MAP: Record<string, string> = {
    centre: 'center',
    center: 'center',
    'left-align': 'left',
    'left align': 'left',
    'right-align': 'right',
    'right align': 'right',
    justify: 'justify',
};

/** A whole-note style asked in a short English line, or null. */
export function readNoteStyleAsk(text: string): NoteStyleAskType | null {
    const words = text
        .trim()
        .toLowerCase()
        .replace(/[.!]+$/, '')
        .replace(/^please\s+/, '');
    if (words.length > 80) {
        return null;
    }
    const make = new RegExp(
        `^(?:make|turn|put|set)\\s+${WHOLE_NOTE_PATTERN}\\s+(?:in\\s+|to\\s+)?(.+)$`,
    ).exec(words);
    if (make !== null) {
        const wanted = make[1].trim();
        if (STYLE_WORD_MAP[wanted] !== undefined) {
            return { styles: [STYLE_WORD_MAP[wanted]] };
        }
        if (/^[a-z]+(?: [a-z]+)?$/.test(wanted)) {
            return { color: wanted };
        }
        return null;
    }
    const align = new RegExp(
        `^(centre|center|left-align|left align|right-align|right align|justify)\\s+${WHOLE_NOTE_PATTERN}$`,
    ).exec(words);
    if (align !== null) {
        return { align: ALIGN_WORD_MAP[align[1]] };
    }
    const font = new RegExp(
        `^(?:use|put)\\s+(.+?)(?:\\s+font)?\\s+(?:for|on|in)\\s+${WHOLE_NOTE_PATTERN}$`,
    ).exec(words);
    if (font !== null) {
        return { font: font[1].trim() };
    }
    if (
        new RegExp(
            `^(?:clear|remove)\\s+(?:all\\s+)?(?:the\\s+)?formatting(?:\\s+(?:of|from)\\s+${WHOLE_NOTE_PATTERN})?$`,
        ).test(words)
    ) {
        return { clear: true };
    }
    return null;
}

/**
 * The change a whole-note style is: the same on every block with words, a
 * font only when the font box lists it (`read.fonts`). Null when it cannot
 * be done that way -- the assistant is asked instead.
 */
export function genNoteStyleChanges(read: any, ask: NoteStyleAskType) {
    if (
        read === null ||
        typeof read !== 'object' ||
        Number.isInteger(read.nextFrom) ||
        !Array.isArray(read.blocks)
    ) {
        return null;
    }
    let style: Record<string, unknown> = { ...ask };
    if (ask.font !== undefined) {
        const fontList: string[] = Array.isArray(read.fonts) ? read.fonts : [];
        const font = fontList.find((one) => {
            return one.toLowerCase() === ask.font!.toLowerCase();
        });
        if (font === undefined) {
            return null;
        }
        style = { font };
    }
    const changes = read.blocks
        .filter((block: any) => {
            return (
                Number.isInteger(block?.n) &&
                block.isFixed !== true &&
                String(block.text ?? '').trim() !== ''
            );
        })
        .map((block: any) => {
            return { block: block.n as number, ...style };
        });
    return changes.length === 0 ? null : changes;
}

/** The sentence under a style change the window made. */
export function genNoteStyleDoneText(name: string, blockCount: number) {
    return fillWords(
        tran(
            'Done in one change: the words of {count} blocks of “{name}” ' +
                'have a new style. It is not saved yet: Save in the note ' +
                'window keeps it, and Undo this change puts it back.',
        ),
        { count: String(blockCount), name },
    );
}

// The sizes the note editor's own size box takes.
const NOTE_SIZE_MIN = 8;
const NOTE_SIZE_MAX = 72;

/** The sentence under a size change the window made. */
export function genNoteSizeDoneText(name: string, blockCount: number) {
    return fillWords(
        tran(
            'Done in one change: the words of {count} blocks of “{name}” ' +
                'have a new size. It is not saved yet: Save in the note ' +
                'window keeps it, and Undo this change puts it back.',
        ),
        { count: String(blockCount), name },
    );
}
