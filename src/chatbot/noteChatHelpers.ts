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
import { readLanguageNoteStyleAsk } from './languageEditAskHelpers';
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

/** `Default` out of `C:\…\Default.own`. */
function toNoteFileLabel(filePath: string) {
    return (filePath.split(/[\\/]/).pop() ?? '').replace(NOTE_FILE_PATTERN, '');
}

/**
 * Names two attached notes can be told apart by: a note keeps its own name
 * unless another attached note has it too -- notes are often titled by the
 * day, and two files may each hold a "Sun Sept 27 2026" -- then its file's
 * name is put after it, and its number in the file when even that is shared
 * (2026-11-08: the model names a note, and the first of two of a name had
 * been the one changed).
 */
function toDistinctNoteNames(files: NoteAskFileType[]): NoteAskFileType[] {
    const countOf = (list: string[], name: string) => {
        return list.filter((one) => {
            return toComparableName(one) === toComparableName(name);
        }).length;
    };
    const titleList = files.map((one) => {
        return one.name;
    });
    const withFile = files.map((one) => {
        return countOf(titleList, one.name) > 1
            ? `${one.name} (${toNoteFileLabel(one.filePath)})`
            : one.name;
    });
    return files.map((one, index) => {
        const name =
            countOf(withFile, withFile[index]) > 1
                ? `${withFile[index]} #${one.noteId}`
                : withFile[index];
        return { ...one, name };
    });
}

/**
 * The notes among a tab's open files -- each once, the first
 * `MAX_NOTE_ASK_FILES`, each by a name no other of them has.
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
    return toDistinctNoteNames(out.slice(0, MAX_NOTE_ASK_FILES));
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
    const matched = files.filter((one) => {
        return toComparableName(one.name) === toComparableName(text);
    });
    // Never a guess between two: the wrong note would be changed.
    if (matched.length > 1) {
        return {
            reason: `More than one attached note is called "${text}": ${names}. Name one of them exactly.`,
        };
    }
    // A name written a letter out is the ONE note attached (2026-11-08,
    // BN-30, seen live): Free's Nemotron named a non-Latin note with one of two
    // subscript letters that look alike in place of the other -- a swap
    // keyboards and models make -- was refused, and gave up after 75k
    // tokens. Never a guess between two notes.
    const attached =
        matched[0] ??
        (files.length === 1 && checkIsNearName(files[0].name, text)
            ? files[0]
            : undefined);
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

/**
 * Whether a name is the other one with a letter or two out -- one edit for a
 * short name, one a ten letters for a longer one -- compared letter by
 * letter (code points), any script.
 */
function checkIsNearName(name: string, written: string) {
    const left = [...toComparableName(name)];
    const right = [...toComparableName(written)];
    const allowed = Math.max(1, Math.floor(left.length / 10));
    if (Math.abs(left.length - right.length) > allowed) {
        return false;
    }
    let previousRow = Array.from({ length: right.length + 1 }, (_, index) => {
        return index;
    });
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
        const row = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
            row.push(
                Math.min(
                    previousRow[rightIndex] + 1,
                    row[rightIndex - 1] + 1,
                    previousRow[rightIndex - 1] +
                        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
                ),
            );
        }
        previousRow = row;
    }
    return previousRow[right.length] <= allowed;
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

// What a model's words are cut at to be compared piece by piece with the
// person's: white space and the mark-up's own signs, which no language's
// look-alike pair holds.
const TYPED_WORDS_CUT_PATTERN = /([\s*_~`[\]()^@#|]+)/;

/**
 * Words a model WROTE, put back to the person's own TYPED ones where the
 * only difference is a pair of look-alike letters a language names
 * (`lookAlikes`, `listLookAlikePairs`): each piece of the words is folded
 * with the typed line by the pairs, and a piece found in it that way is
 * that place of the typed line. A pair is two sequences of one length, so
 * a place in the folded line is the same place in the line. Words the
 * person did not type, and words already as typed, are left alone.
 * 2026-11-08, BN-37: on Free's Nemotron a typed non-Latin line went into a note
 * with one subscript written as its look-alike -- the same on screen, not
 * to a search.
 */
export function restoreTypedWords(
    written: string,
    typed: string,
    pairs: readonly (readonly [string, string])[],
): string {
    if (pairs.length === 0 || written === '' || typed.includes(written)) {
        return written;
    }
    const fold = (text: string) => {
        return pairs.reduce((folded, [kept, other]) => {
            return folded.replaceAll(other, kept);
        }, text.normalize('NFC'));
    };
    const typedText = typed.normalize('NFC');
    const foldedTyped = fold(typedText);
    if (foldedTyped.length !== typedText.length) {
        return written;
    }
    const restore = (piece: string) => {
        if (piece === '' || typedText.includes(piece)) {
            return piece;
        }
        const foldedPiece = fold(piece);
        const at = foldedTyped.indexOf(foldedPiece);
        return at < 0 || foldedPiece.length !== piece.normalize('NFC').length
            ? piece
            : typedText.slice(at, at + foldedPiece.length);
    };
    const whole = restore(written);
    if (whole !== written) {
        return whole;
    }
    return written
        .split(TYPED_WORDS_CUT_PATTERN)
        .map((piece, index) => {
            // The odd pieces are what the words were cut at.
            return index % 2 === 1 ? piece : restore(piece);
        })
        .join('');
}

/**
 * An `owa_note_edit` edit's words put back to the person's typed ones
 * (`restoreTypedWords`) -- each change's `text` and the new `title`.
 */
export function restoreNoteTypedWords<T extends Record<string, any>>(
    args: T,
    typed: string,
    pairs: readonly (readonly [string, string])[],
): T {
    if (pairs.length === 0 || typed.trim() === '') {
        return args;
    }
    const changes = Array.isArray(args.changes)
        ? args.changes.map((change: any) => {
              return typeof change?.text === 'string'
                  ? {
                        ...change,
                        text: restoreTypedWords(change.text, typed, pairs),
                    }
                  : change;
          })
        : args.changes;
    return {
        ...args,
        ...(changes === undefined ? {} : { changes }),
        ...(typeof args.title === 'string'
            ? { title: restoreTypedWords(args.title, typed, pairs) }
            : {}),
    };
}

/**
 * Whether an `owa_note_edit` edit puts a NEW verse in with no Bible named --
 * a `passage` block's `ref`, or a verse token written without its Bible
 * (`[^John 1:1]`, never `[^(KJV) John 1:1]`). A kept token written without
 * its Bible counts too: the Bible looked up for it is never used for one.
 */
export function checkAddsNoteVerse(args: unknown) {
    const call = args as { action?: unknown; changes?: unknown } | null;
    if (call?.action !== 'edit' || !Array.isArray(call.changes)) {
        return false;
    }
    return call.changes.some((change) => {
        if (change === null || typeof change !== 'object') {
            return false;
        }
        const { ref, text } = change as { ref?: unknown; text?: unknown };
        return (
            (typeof ref === 'string' && ref.trim() !== '') ||
            (typeof text === 'string' && /\[\^(?!\s*\()/.test(text))
        );
    });
}

/** What they typed, when the model is asked its English. */
export type NoteOwnWordsType = {
    // The language's English name.
    language: string;
    text: string;
};

/**
 * Said under the English of a question typed in another language
 * (2026-11-08, BN-23): a word of the note they name, or a line they want
 * written in, does not survive being put into English -- _make the word
 * <a word of the note> red_ became "make the word grace red" over a note
 * that holds no "grace", and the words of a line to add came back English.
 */
export function toNoteOwnWordsHint({ language, text }: NoteOwnWordsType) {
    return (
        `(They wrote it in ${language}, the line above being its English: ` +
        `${JSON.stringify(text)}. A word or line of the note it names, and ` +
        'words they give to be written in, are taken from THIS, exactly as ' +
        'they wrote it -- never the English of it; words you put INTO THE ' +
        `NOTE for them are in ${language} unless they name another ` +
        'language. Your answer to them stays in English: the window puts ' +
        'it into their language.)'
    );
}

// --- a lesson of its own ------------------------------------------------------
//
// BN-55 (2026-11-09, the elder run): asked _Can you make me a whole lesson
// about forgiveness_, _write a lesson about Joseph_, _a short devotion about
// Psalm 121 please_ in the conversation about their Good Shepherd lesson,
// gemma4:cloud rewrote that lesson into the new one (fifteen blocks given
// other words) or put the new lesson at its end -- 14 asks of 90, and still
// 6 after the prompt said a lesson on another subject is a NEW note. Such an
// ask now carries one sentence saying so. Read off what they asked for, a
// writing word before a lesson, devotion or outline that is "a" or "new":
// "help me with my lesson", "make the lesson bigger" and "is this a good
// lesson?" are not it. English; another language's ask is read in English
// by the window first, else left to the prompt.

const LESSON_NOUN =
    '(?:lesson|devotion(?:al)?|outline|sermon|homily|bible study)(?!\\s+plan)\\b';
// One to three describing words between "a" and the noun, never a word
// that ties it to something else ("a picture of a shepherd in my lesson").
const LESSON_WORDS =
    "(?:(?!(?:in|my|of|for|to|the|this|on|about|with)\\b)[\\w'-]+\\s+){0,3}?";
const NEW_LESSON_ASK_PATTERN = new RegExp(
    [
        `\\b(?:write|make|create|prepare|plan|draft|give|need|want|like|start)\\b[^.?!]{0,40}?\\b(?:a|an|another|new|one more)\\s+${LESSON_WORDS}(?:${LESSON_NOUN}|version of this)`,
        `\\b(?:make|write|create|need|want|start)\\s+(?:me\\s+)?(?:a\\s+)?${LESSON_NOUN}`,
        `\\bwrite\\s+the\\s+${LESSON_NOUN}\\s+(?:about|on)\\b`,
        `^\\s*(?:please\\s+)?(?:(?:a|an)\\s+)?${LESSON_WORDS}${LESSON_NOUN}\\s+(?:(?:about|on)\\b|for\\b[^.?!]{0,40}\\bplease\\b)`,
    ].join('|'),
    'i',
);

export const NOTE_NEW_LESSON_HINT =
    '(This asks for a lesson of its own: make it a NEW note -- ' +
    'owa_bible_note action "add", its title and text yours -- and leave the ' +
    'attached note as it is, unless their words say to put it in this note.)';

/** Whether they asked for a lesson, devotion or outline of its own. */
export function checkIsNewLessonAsk(text: string) {
    return NEW_LESSON_ASK_PATTERN.test(text);
}

// --- a greeting or a question, nothing to change ------------------------------
//
// BN-55 too: _HELLO CAN YOU HELP ME_, _are you a real person or a computer_
// and _How I start? I am new for this program_ each had the note's misspelt
// last line corrected, unasked, and said so -- the note an elderly person is
// writing changed under a hello. A line that greets or asks and has no word
// that asks for something done to the note (any part of it named, a style,
// a size, a verse, saving or showing it) carries one sentence: answer, and
// change nothing. Measured on the elder corpus: on 64 of its 189 answers and
// on none of its 248 changes.
const NOTE_QUESTION_START_PATTERN =
    /^\s*(?:hello|hi|hey|good (?:morning|afternoon|evening)|thank|thanks|god bless|bless you|ok|okay|what|who|whom|whose|why|how|where|when|which|is|are|was|were|do|does|did|can|could|will|would|should|am i|tell me|explain)\b/i;
const NOTE_CHANGE_WORD_PATTERN =
    /\b(?:add|put|insert|writ|make|making|made|chang|turn|set|draw|remov|delet|take|fix|correct|check|grammar|mistake|spell|mov|swap|replac|translat|bold|underlin|colou?r|highlight|cent(?:er|re)|middle|indent|number|tick|renam|shorten|simpl|expand|enlarg|bigger|smaller|larger|big|small|italic|capital|font|letter|space|tidy|organi[sz]|clean|includ|attach|giv|creat|need|want|like|undo|redo|back|again|instead|prayer|verse|psalm|question|point|title|heading|line|word|paragraph|table|list|bullet|sticky|copy|print|save|open|close|find|search|show|share|send|read)\w*/i;

export const NOTE_QUESTION_HINT =
    '(This greets you or asks a question: answer it and change nothing in ' +
    'the note -- offer a change as an OPTION instead.)';

// --- formatting a messy note -------------------------------------------------
//
// BN-58: the card's Format button and the words a person uses for the same
// job (_my note is messy_, _make it neat_, _tidy it up_). Not "a mess",
// which is a worry (_I think I made a mess of it_), nor "easy to read",
// which an older reader says of bigger letters.
const NOTE_FORMAT_ASK_PATTERN =
    /\b(?:re)?format|\btid(?:y|ied)\b|\bneat\b|\bmessy\b|\bclean(?:\s+it)?\s+up\b|\borgani[sz]e\b|\bwell[- ]formed?\b|\blook nice\b|\bin order\b/i;

export const NOTE_FORMAT_HINT =
    '(This asks to format the note: do it in ONE edit as FORMATTING says -- ' +
    'every word kept and none added, a run-together block split with its ' +
    'kind and its lines.)';

/** Whether they asked for the note formatted, tidied or made neat. */
export function checkIsNoteFormatAsk(text: string) {
    return NOTE_FORMAT_ASK_PATTERN.test(text);
}

/** Whether a line only greets or asks, asking nothing done to the note. */
export function checkIsNoteQuestionOnly(text: string) {
    const isQuestion =
        /\?\s*$/.test(text) || NOTE_QUESTION_START_PATTERN.test(text);
    return isQuestion && !NOTE_CHANGE_WORD_PATTERN.test(text);
}

/**
 * The question as the model is asked it: what they typed, then each attached
 * note as it reads now, named as `note` takes it. `ownWords` when `asked` is
 * the English of what they typed in another language.
 */
export function toNoteAsk(
    asked: string,
    notes: readonly { name: string; text: string | null }[],
    translateMode: LyricTranslateModeType | null = null,
    isWordless = false,
    ownWords: NoteOwnWordsType | null = null,
) {
    // A button pressed in the window's language is read off its own words:
    // the English of them no longer matches the button.
    const language =
        translateMode === null
            ? null
            : (readTranslateLanguageName(asked) ??
              (ownWords === null
                  ? null
                  : readTranslateLanguageName(ownWords.text)));
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
        ...(checkIsNewLessonAsk(asked) ? [NOTE_NEW_LESSON_HINT] : []),
        ...(checkIsNoteQuestionOnly(asked) ? [NOTE_QUESTION_HINT] : []),
        ...(checkIsNoteFormatAsk(asked) ? [NOTE_FORMAT_HINT] : []),
        ...(ownWords === null ? [] : [toNoteOwnWordsHint(ownWords)]),
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
    'request is about, and never remove a block they did not ask to ' +
    'remove. WORDS THEY SELECTED: "> " lines under a line ending ' +
    'in a colon quote what they selected in this note -- the words between ' +
    '** and ** (a selection mark, not bold), the rest of each line around ' +
    "them, … for words left out; in the brackets the note's name and, for " +
    "one line, the selection's first and last character in it. What they " +
    'wrote after the quote is about THOSE words: answer about them, and ' +
    'make a change it asks for to the blocks holding them, with `words` ' +
    'when it is part of a block. A BIBLE VERSE is never your words: put one in with a ' +
    'NEW token [^Book chapter:verse] in the words, or a block {after, kind: ' +
    '"passage", ref: "John 3:16-17"} for its whole text -- the app reads it ' +
    'from the installed Bible. Never type a verse out. A verse token names ' +
    'the Bible it is read from in brackets, [^(KJV) John 3:16] -- keep a ' +
    'token as read to keep that verse. To have a verse from ANOTHER Bible ' +
    '("make the English lines KJV"), write that Bible\'s short name in its ' +
    'token in place of the old one, [^(KJV) Hebrews 11:1] where ' +
    "[^(NIV) Hebrews 11:1] was -- written in the words that Bible's own " +
    "book names use -- and leave the other lines' tokens as " +
    'read; the summary names the Bible each new verse came from -- tell ' +
    'them only that. A new [@Name] or ' +
    '[#Place] is looked up in the names lookup and becomes a mention when ' +
    'it is there. When a request has one sensible reading, do it ' +
    'rather than ask: every change can be undone. CHANGE THE NOTE ONLY ' +
    'WHEN THEIR WORDS ASK for something in it: a greeting, a question ' +
    'about you or the app, thanks, a worry or "how do I start" changes ' +
    'nothing -- answer it and offer changes as OPTIONS; a mistake you ' +
    'notice is an option, never a change they did not ask for. Words they ' +
    'ask you to write FOR THIS LESSON -- a prayer, an introduction, words ' +
    'to say, a memory verse, more questions, a story for it -- go into the ' +
    'note in one edit, after the block they belong under. A lesson, ' +
    'devotion or outline on ANOTHER subject or passage, or a version of ' +
    'this one for another group (children, youth), is a NEW note ' +
    '(owa_bible_note "add") -- never this note rewritten into it or added ' +
    'to: this note is their lesson. WHEN SOMETHING WENT WRONG -- they say ' +
    'a change of yours was wrong, something is gone, looks strange or ' +
    'changed by itself -- put it back with action "undo" (one step for each ' +
    'change you made), never a new change on top that only looks like it ' +
    '(Clear Formatting turns headings into plain lines), and say it is ' +
    'back; when you made no change in this conversation, change nothing: ' +
    'ask what looks different. PUTTING AN ANSWER IN: ' +
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
    '"A -> B" an arrow from box A to box B, drawn top to bottom; only for ' +
    'a timeline, a cycle or a shape they ask for, a first line "layout: ' +
    'across", "circle" or "center"; background fills its boxes, ' +
    'color its lines; one in the note takes new lines, background, color, ' +
    'size "larger"/"smaller" and align. It draws boxes, words and arrows, ' +
    'never a picture of a thing -- a sheep, a cross: say so plainly and ' +
    "offer one of words) and example (the editor's own " +
    'sample note). A code block takes `language` and `theme`. Link block ' +
    'text is {block, words?, linkTo: n} (an arrow to block n, `linkToWords` ' +
    'for words there). Its Undo and Redo of what the note kept are ' +
    'actions "undo" and "redo", its ¶ is action "view" with ' +
    'invisibleCharacters true or false. Never answer one of these with the ' +
    "editor's steps: make it. FORMATTING a messy note (format it, tidy " +
    'it, make it neat or easy to read), in ONE edit, every word kept and ' +
    'none added: a title line becomes "h1"; a line that only names a part ' +
    '(points, prayer, questions) becomes "h2" -- Points, Prayer, Questions, ' +
    'never in capitals; every line and item starts with a capital letter ' +
    '(god looks -> God looks); a heading for a part that has none is a NEW block above ' +
    'it; points, questions or steps run together in one block are SPLIT -- ' +
    '{block: 7, kind: "bullet" (or "number"), text: "Who is lost ' +
    'today?\\nHow can we help?"} makes one item a line -- and a run-on ' +
    'paragraph of parts is {block, kind: "section", text} with "## A ' +
    'heading" and "- " lines of its own words; a reference written in words ' +
    '(luke 15 verse 4 to 7) becomes a token [^Luke 15:4-7] in its place; ' +
    'a line in capitals gets normal case, a line that starts in small ' +
    'letters a capital; a reminder or warning is made bold. Never give a ' +
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
    'opens it and the conversation moves to it. Opening, finding or ' +
    'printing ANOTHER note is never making one: list the notes ' +
    '(owa_bible_note "list") and say where it is in the Bible Notes list, ' +
    'or say none is called that. When the tool refuses, ' +
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
    'changes they might want that the tool can make.';

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
            // Formatting a messy note is the job asked for most (2026-11-09,
            // the user: _when bible-note attached to the chatbot it should
            // provide the option to format content_, BN-58); it does what
            // the old "Tidy it into headings and lists" did and more.
            tran('Format it so it is neat and easy to read'),
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

/**
 * A whole-note style asked in a short line, or null: English in code, any
 * other language in its own words (`readLanguageNoteStyleAsk`, its
 * `assistant.json`; BN-16).
 */
export function readNoteStyleAsk(text: string): NoteStyleAskType | null {
    const words = text
        .trim()
        .toLowerCase()
        .replace(/[.!]+$/, '')
        .replace(/^please\s+/, '');
    if (words.length > 80) {
        return readLanguageNoteStyleAsk(text);
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
    return readLanguageNoteStyleAsk(text);
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
