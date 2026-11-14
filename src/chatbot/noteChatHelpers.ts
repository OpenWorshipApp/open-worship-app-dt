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
import { EMPTY_NOTE_BODY } from './noteFileTextHelpers';
import { checkIsChangeReply } from './quickReplyHelpers';
import {
    DEFAULT_CHAT_LANG_CODE,
    groupLettersByScript,
    listAssistantLanguages,
    type AssistantLanguageType,
} from './chatLangHelpers';
import { fillWords, tran } from './chatTranHelpers';
import { readLanguageNoteStyleAsk } from './languageEditAskHelpers';
import {
    LESSON_OUTLINE,
    PREACHING_LESSON_SHAPE,
    checkIsBareFinishAsk,
    genLessonLengthLine,
    checkIsLessonFinishAsk,
    checkIsLessonQuestion,
    checkIsLessonReviewAsk,
    checkIsLessonShortenAsk,
    checkIsLessonWriteAsk,
    checkIsNewLessonAsk,
} from './noteCreatePromptHelpers';
import {
    type LyricTranslateModeType,
    genLyricTranslateReplies,
    pickTranslateLanguage,
    readLyricTranslateMode,
} from './lyricChatHelpers';
import { pickBibleInLanguage } from './verseAskLanguageHelpers';
import { listStudyStrayLetters } from './studyTranslateHelpers';
import {
    type SlideSizeAskType,
    readTranslateLanguageName,
} from './slideChatHelpers';
import {
    toNoteWindowTarget,
    type NoteWindowTargetType,
} from '../helper/ai/noteWindowMatchHelpers';
import {
    readPassageLineRef,
    splitVerseTokenRefs,
} from '../helper/agentNoteMarkupHelpers';
import { parseRefParts } from '../helper/bibleVerseFindHelpers';
import kjvBibleConfig from '../helper/bible-helpers/kjvBibleConfig.json';

export const NOTE_ASK_KIND = 'note';
export const NOTE_EDIT_TOOL_NAME = 'owa_note_edit';
// A read on, a change (every block in one call), a retry after a refusal, a
// guide search and its page, and the answer.
export const NOTE_MAX_TOOL_ROUNDS = 8;
// A new lesson written into the empty note: its passage, the verses
// before it, a word or two looked up, a check's refusal or two, the
// write and the answer (BN-140, 2026-11-11: a children's Jonah read
// the whole book, was sent back for its memory verse, searched for a
// shorter one, and ran out of eight rounds with no lesson written).
// Sixteen since BN-255 (2026-11-13): 64 of the 413 held-out lessons ended
// "changed, but the assistant stopped before saying what it did", the
// children's Samuel in nearly every batch -- asked three times with the
// stop logged, two ran out of twelve: after the write, the memory verse
// named too long, the model searched three to five rounds for a shorter
// one elsewhere, and the one more edit a legend or the memory verse asked
// for was refused once (a block number off by one) with no round left to
// send it again. The fixes the window names after the write were lost.
export const NOTE_LESSON_MAX_TOOL_ROUNDS = 16;
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
// by the window first, else left to the prompt. The words read are in
// `noteCreatePromptHelpers.ts`, beside what a lesson HOLDS
// (`PREACHING_LESSON_SHAPE`, 2026-11-10), which every lesson hint here
// carries: the shape rides on a lesson ask alone, never in the prompt.

export { checkIsNewLessonAsk };

export const NOTE_NEW_LESSON_HINT =
    '(This asks for a lesson of its own: make it a NEW note -- ' +
    'owa_bible_note action "add", its title and text yours -- and leave the ' +
    'attached note as it is, unless their words say to put it in this note. ' +
    `${PREACHING_LESSON_SHAPE})`;

// A note made to hold a lesson that does not exist yet -- the panel's +,
// then Open in Chatbot, then "help me prepare a sermon on John 10" -- IS
// where the lesson goes: a second note beside an empty one is two notes
// to find on Sunday. Written with `owa_bible_note add` all the same, and
// the WINDOW puts it into the empty note (`toBlankNoteFillArgs`): measured
// 2026-11-10 against the shared gemma4:cloud, a whole lesson nested in
// `owa_note_edit`'s `changes` came back as no reply at all 7 times of 8 --
// the server dropped the call it could not parse -- and as one flat `text`
// 5 times of 5.
export const NOTE_BLANK_LESSON_HINT =
    '(The attached note is empty and the lesson goes INTO it: write it ' +
    'with ONE owa_bible_note action "add", its `title` the lesson\'s and ' +
    'its `text` the whole lesson -- the window puts it into this empty ' +
    'note, not a new one -- on the passage or subject they named, else the ' +
    "note's name; when neither names one, ask only which passage, with " +
    `OPTIONS of three. ${PREACHING_LESSON_SHAPE})`;

// A question for the PERSON is no lesson (2026-11-10, BN-66's eight asked
// again: the children's lesson button pressed, gemma4:cloud "added" a note
// reading "Please tell me which Bible passage …" with its OPTIONS frame
// under it, and the window wrote that into the empty note). Its frame, or a
// few words that ask, are said back, never written.
const NOTE_ADD_FRAME_PATTERN = /^\s*(?:\*\*)?(?:OPTIONS|CHOICES)\s*:/im;

/** Why an add for an empty note is no lesson, or null when it is one. */
export function findBlankFillProblem(text: string) {
    const words = String(text ?? '').match(/[\p{L}\p{M}\p{N}']+/gu) ?? [];
    if (
        NOTE_ADD_FRAME_PATTERN.test(text) ||
        (words.length < 40 && /[?？]/u.test(text))
    ) {
        return (
            'Nothing was written: that is a question for them, not a lesson. ' +
            'Ask it in your answer, with OPTIONS of three, and write the ' +
            'lesson into the note once they choose.'
        );
    }
    return null;
}

// --- a quote of the passage is its words (BN-76) ------------------------------
//
// 2026-11-10, the blind readers of BN-74: the lessons' commonest error was a
// phrase in quotation marks that the passage, read a moment before, does not
// say -- "sinners shall return unto thee" for Psalm 51:13's "sinners shall be
// converted unto thee" -- and a preacher reads a quote out as the Bible's own.
// A factual error keeps a lesson from the standard's best band whatever else
// it does well. A quote that shares little with the passage (a hearer's
// question, a saying) is the lesson's own words and left alone; one that
// takes most of its words from the passage and is not word for word is a
// misquote.
// Every pair of marks is matched, a short one too, and a short one is passed
// over in the code (BN-282, 2026-11-14): with six letters asked of the
// pattern, a short quote ("debt") went unmatched, its closing mark was taken
// for an opening, and the prose up to the next quote was read as one --
// the quotation after it never read. 333 quotes of 2 752 lessons were never
// checked so, among them 1 Peter 2:24 given in a modern translation's words
// under a KJV label (ab105, Sonnet: an error).
const NOTE_QUOTE_PATTERN = /[«“"]([^«»“”"\n]{1,400})[»”"]/gu;
// The shortest quote the checks read.
export const MIN_NOTE_QUOTE_CHARS = 6;
const MIN_NOTE_QUOTE_LETTERS = 12;
// A quotation that names its own verse is held to it from a shorter phrase
// (BN-224, 2026-11-13, a held-out Ecclesiastes 3: "under the sun" given
// 3:1, which reads "under the heaven" -- read by the window, eleven letters,
// and never compared). An unnamed one keeps the longer floor: a few words a
// lesson shares with the passage are its own.
const MIN_CITED_QUOTE_LETTERS = 8;
const NEAR_QUOTE_WORD_SHARE = 0.6;
const MAX_NOTE_MISQUOTES = 5;

/** Letters alone, lower case: a quote compared with the passage as read. */
export function toLetterKey(text: string) {
    return String(text ?? '')
        .normalize('NFC')
        .replace(/[^\p{L}\p{M}]/gu, '')
        .toLowerCase();
}

function toQuoteWordList(text: string) {
    return (
        String(text ?? '')
            .normalize('NFC')
            .toLowerCase()
            .match(/\p{L}{3,}/gu) ?? []
    );
}

/**
 * The phrases a note change puts in quotation marks as the passage's words
 * that the passage as read does not have -- `sourceTexts` being every verse
 * read in this ask and the note as it was read -- or none. A quote cut with
 * an ellipsis is checked a piece at a time.
 */
export function findNoteMisquotes(
    text: string,
    sourceTexts: readonly string[],
) {
    const sourceKeyList = sourceTexts.map(toLetterKey);
    const sourceWordSet = new Set(sourceTexts.flatMap(toQuoteWordList));
    if (sourceWordSet.size === 0) {
        return [];
    }
    const misquoted: string[] = [];
    for (const match of String(text ?? '').matchAll(NOTE_QUOTE_PATTERN)) {
        if (match[1].length < MIN_NOTE_QUOTE_CHARS) {
            continue;
        }
        const quote = match[1].trim();
        const isMisquoted = quote.split(/…|\.\.\./).some((piece) => {
            const key = toLetterKey(piece);
            if (
                key.length < MIN_NOTE_QUOTE_LETTERS ||
                sourceKeyList.some((source) => source.includes(key))
            ) {
                return false;
            }
            const wordList = toQuoteWordList(piece);
            const knownCount = wordList.filter((word) => {
                return sourceWordSet.has(word);
            }).length;
            return (
                wordList.length >= 3 &&
                knownCount / wordList.length >= NEAR_QUOTE_WORD_SHARE
            );
        });
        if (isMisquoted && !misquoted.includes(quote)) {
            misquoted.push(quote);
        }
        if (misquoted.length >= MAX_NOTE_MISQUOTES) {
            break;
        }
    }
    return misquoted;
}

// The passage shown with a misquote refusal: a lesson's runs about twenty
// verses, a few thousand letters at most.
const MAX_WINDOW_READ_PASSAGE_CHARS = 3000;

/** What the model is told when its change misquotes the passage. */
export function genNoteMisquoteRefusal(
    misquotes: readonly string[],
    // The passage the WINDOW read, the model having read none (BN-274):
    // given, or "as it was read" points at words it never saw.
    windowRead: { ref: string; text: string } | null = null,
) {
    const refusal =
        'Nothing was written: words in quotation marks are read out as the ' +
        "Bible's own, and the passage as read does not say " +
        misquotes.map((quote) => `“${quote}”`).join(', ') +
        '. Quote it word for word as it was read, or say it in your own ' +
        'words without quotation marks -- then send the change again, whole.';
    if (windowRead === null) {
        return refusal;
    }
    const text = windowRead.text.trim();
    const shown =
        text.length > MAX_WINDOW_READ_PASSAGE_CHARS
            ? `${text.slice(0, MAX_WINDOW_READ_PASSAGE_CHARS).trimEnd()}…`
            : text;
    return (
        `${refusal} The passage had not been read, so the window read it ` +
        `-- ${windowRead.ref}: ${shown}`
    );
}

// --- a quote given its chapter and verse is that verse's words (BN-110) ------
//
// 2026-11-11, the blind reads after BN-104: the factual errors left were
// quotations tied to a reference the ask never read -- "I seek not mine own
// will" as John 6:38 (it is 5:30), "He hath spoken well, for he hath spoken
// truth" as 1 Samuel 17:52 (no such words), Matthew 11:28's "labour" as
// "weary and heavy laden". BN-76 holds a quote to what the ask READ, so a
// verse quoted from memory and never read was let by. A quote that names its
// own chapter and verse in its sentence is held to that verse, read by the
// window: one book, one chapter, a verse or a few.
const CITED_REF_SOURCE =
    '(?:[1-3] ?)?[A-Z][a-z]+(?: of [A-Z][a-z]+)? \\d{1,3}:\\d{1,3}' +
    '(?:\\s*[-–,]\\s*\\d{1,3})?';
const CITED_REF_PATTERN = new RegExp(CITED_REF_SOURCE, 'g');
// The quote's own sentence on either side, never past another quotation.
const QUOTE_MARK_OR_LINE_PATTERN = /[«»“”"\n]/u;
const SENTENCE_END_PATTERN = /[.!?](?=\s|$)/u;
// Every cited quote a lesson holds is found (a bound for safety only); at
// most MAX_CITED_REFS_READ of their verses are read, the ones written from
// memory first (BN-132).
const MAX_CITED_QUOTES = 40;
export const MAX_CITED_REFS_READ = 8;

function toSentenceAfter(text: string) {
    return text
        .split(QUOTE_MARK_OR_LINE_PATTERN)[0]
        .split(SENTENCE_END_PATTERN)[0];
}

// Back to the start of the quote's sentence. A sentence that runs back to
// another quotation gives nothing: a reference in it is that one's ("He was
// "wearied …" (John 4:6) and calls "all ye that labour"").
function toSentenceBefore(text: string) {
    const match = /([«»“”"\n])?([^«»“”"\n]*)$/u.exec(text);
    const sentences = (match?.[2] ?? '').split(SENTENCE_END_PATTERN);
    if (
        sentences.length === 1 &&
        match?.[1] !== undefined &&
        match[1] !== '\n'
    ) {
        return '';
    }
    return sentences[sentences.length - 1];
}

export type CitedQuoteType = { quote: string; ref: string };

// What may stand between a quote and its own reference: a mark, a space, a
// verse token's or a bracket's opening.
const CITED_REF_AT_ONCE_PATTERN =
    /^[\s,;:]*(?:\[\^(?:\([^)\]\n]*\)\s*)?|\()?$/u;

/**
 * The quotations a change ties to a chapter and verse in their own sentence
 * -- `"…" (Matthew 11:28)`, `In John 4:6, "…"` -- the reference after the
 * quote first, else the last one before it.
 */
export function findCitedQuotes(text: string): CitedQuoteType[] {
    const source = String(text ?? '');
    const list: CitedQuoteType[] = [];
    for (const match of source.matchAll(NOTE_QUOTE_PATTERN)) {
        if (match[1].length < MIN_NOTE_QUOTE_CHARS) {
            continue;
        }
        const start = match.index ?? 0;
        const end = start + match[0].length;
        const after = toSentenceAfter(source.slice(end, end + 160));
        const before = toSentenceBefore(
            source.slice(Math.max(0, start - 160), start),
        );
        const afterRef = after.match(CITED_REF_PATTERN);
        const ref =
            afterRef?.[0] ?? before.match(CITED_REF_PATTERN)?.at(-1) ?? null;
        // A short phrase is the quote of the reference right after it only
        // (BN-224): `paid "two pence"—two days' wages [^Matthew 20:2]` names
        // the wages' verse, not the phrase's.
        const isNamedAtOnce =
            afterRef !== null &&
            CITED_REF_AT_ONCE_PATTERN.test(
                after.slice(0, after.search(CITED_REF_PATTERN)),
            );
        const isShort = toLetterKey(match[1]).length < MIN_NOTE_QUOTE_LETTERS;
        if (ref !== null && (!isShort || isNamedAtOnce)) {
            list.push({
                quote: match[1].trim(),
                ref: ref.replace(/\s*–\s*/, '-'),
            });
        }
        if (list.length >= MAX_CITED_QUOTES) {
            break;
        }
    }
    return list;
}

// How much of a text's letters are a-z: a quote and a verse in different
// scripts (an English quote, the Khmer Bible) are not compared.
function toLatinShare(key: string) {
    return key.length === 0
        ? 0
        : (key.match(/[a-z]/g) ?? []).length / key.length;
}

// What an ask read, a verse read by its book (`REV 20:6-15` -> `REV`); words
// that are no read of verses -- the note, the ask -- have none.
type ReadEntryType = {
    bookKey: string | null;
    key: string;
    // `REV 21:1-7` and the read's own words, for naming the verse a
    // quotation comes from (BN-160); null for words that are no read.
    verseKey: string | null;
    raw: string;
};

function toReadEntryList(readTexts: readonly string[]) {
    return readTexts.flatMap((text): ReadEntryType[] => {
        try {
            const verses = JSON.parse(text)?.verses;
            if (Array.isArray(verses) && verses.length > 0) {
                return verses.map((verse: any) => {
                    const verseKey = String(verse?.key ?? '').toUpperCase();
                    const bookKey = verseKey.split(' ')[0];
                    return {
                        bookKey: bookKey === '' ? null : bookKey,
                        key: toLetterKey(String(verse?.text ?? '')),
                        verseKey: verseKey === '' ? null : verseKey,
                        raw: String(verse?.text ?? ''),
                    };
                });
            }
        } catch {
            // words, not a read of verses
        }
        return [
            {
                bookKey: null,
                key: toLetterKey(text),
                verseKey: null,
                raw: text,
            },
        ];
    });
}

// The KJV book key a reference names, or null for a name the table lacks.
function toRefBookKey(ref: string) {
    return (
        BOOK_NAME_KEY_MAP.get(
            ref.replace(/\s*\d{1,3}:.*$/, '').toLowerCase(),
        ) ?? null
    );
}

/**
 * The key a read answers ONE cited verse with -- `Matthew 11:28` -> `MAT
 * 11:28` -- so several are read in one call and matched back (BN-148);
 * null for a range or a book the KJV's names do not hold, read alone.
 */
export function toCitedVerseKey(ref: string) {
    const match = /^(.*?\S)\s+(\d{1,3}):(\d{1,3})$/.exec(
        String(ref ?? '').trim(),
    );
    const bookKey = match === null ? null : toRefBookKey(match[0]);
    return match === null || bookKey === null
        ? null
        : `${bookKey} ${Number(match[2])}:${Number(match[3])}`;
}

/**
 * The cited quotes whose verses the window reads, at most
 * MAX_CITED_REFS_READ references (BN-132, 2026-11-11). Taken in the
 * lesson's order and cut at eight, the quotes read were the Background's
 * and the points' -- copied from the passage read -- and the Christ
 * section's, written from memory near the end, were never read: "became
 * flesh and dwelt among us" (John 1:14) went in, a funeral lesson's ninth.
 * Now a quote found in nothing the ask read comes first, one found only in
 * a read of its own cited book next (the right words, perhaps the wrong
 * verse, BN-117), and one found in another book's read not at all: the
 * check lets it be (BN-113).
 */
export function pickCitedQuotesToRead(
    citedList: readonly CitedQuoteType[],
    readTexts: readonly string[] = [],
) {
    const readEntryList = toReadEntryList(readTexts);
    const toRank = (cited: CitedQuoteType) => {
        const citedBookKey = toRefBookKey(cited.ref);
        const keyList = cited.quote
            .split(/…|\.\.\./)
            .map(toLetterKey)
            .filter((key) => key.length >= MIN_CITED_QUOTE_LETTERS);
        const foundList = keyList.map((key) => {
            return readEntryList.filter((entry) => entry.key.includes(key));
        });
        if (foundList.some((found) => found.length === 0)) {
            return 0;
        }
        const isOtherBook = foundList.every((found) => {
            return found.some((entry) => {
                return citedBookKey === null || entry.bookKey !== citedBookKey;
            });
        });
        return isOtherBook ? 2 : 1;
    };
    const ranked = citedList
        .map((cited, index) => ({ cited, index, rank: toRank(cited) }))
        .filter((item) => item.rank < 2)
        .sort((a, b) => a.rank - b.rank || a.index - b.index);
    const refSet = new Set<string>();
    const picked: CitedQuoteType[] = [];
    for (const { cited } of ranked) {
        if (!refSet.has(cited.ref) && refSet.size >= MAX_CITED_REFS_READ) {
            continue;
        }
        refSet.add(cited.ref);
        picked.push(cited);
    }
    return picked;
}

/**
 * The cited quotes whose words the verse read for their reference does not
 * have, with the verse as it reads. A quote cut with an ellipsis is checked a
 * piece at a time; a reference that could not be read, a verse read cut
 * short ("…"), or a quote in another script than its verse is let be -- and
 * so is a quote of what the ask READ in ANOTHER book (`readTexts`, BN-113,
 * BN-117): "Purge me with hyssop" is the passage's own Psalm 51:7, the
 * Exodus 12:22 beside it named for what hyssop was. Read in the cited
 * verse's own book, the words are that book's other verse, and the
 * reference is wrong: "written in the book of life" given Revelation 20:12
 * is 20:15's, in the funeral lesson's own read.
 */
export function findCitedMisquotes(
    citedList: readonly CitedQuoteType[],
    verseTextMap: ReadonlyMap<string, string>,
    readTexts: readonly string[] = [],
) {
    const readEntryList = toReadEntryList(readTexts);
    const misquoted: (CitedQuoteType & { verse: string })[] = [];
    for (const cited of citedList) {
        const verse = verseTextMap.get(cited.ref);
        if (verse === undefined) {
            continue;
        }
        const verseKey = toLetterKey(verse);
        const isCut = /…\s*$/u.test(verse);
        const citedBookKey = toRefBookKey(cited.ref);
        const isMisquoted = cited.quote.split(/…|\.\.\./).some((piece) => {
            const key = toLetterKey(piece);
            return (
                key.length >= MIN_CITED_QUOTE_LETTERS &&
                !verseKey.includes(key) &&
                !readEntryList.some((entry) => {
                    return (
                        (citedBookKey === null ||
                            entry.bookKey !== citedBookKey) &&
                        entry.key.includes(key)
                    );
                }) &&
                !isCut &&
                Math.abs(toLatinShare(key) - toLatinShare(verseKey)) < 0.5
            );
        });
        if (
            isMisquoted &&
            !misquoted.some((item) => item.quote === cited.quote)
        ) {
            misquoted.push({ ...cited, verse });
        }
    }
    return misquoted.slice(0, MAX_NOTE_MISQUOTES);
}

// --- a verse is in the Testament its book is in (BN-114) ---------------------
//
// 2026-11-11, the BN-108..112 read (Sonnet): a David and Goliath lesson's
// Christ section read "The New Testament tells us that 'But he was wounded
// for our transgressions' [^(KJV) Isaiah 53:5]" -- the quote right, so
// BN-110 let it be, and the Testament wrong. A sentence that names one
// Testament, never the other, while every reference in it is a book of the
// other, is sent back once. A book this table does not know is let be.
const OLD_TESTAMENT_KEY_SET = new Set<string>(kjvBibleConfig.bookKeysOld);
const BOOK_NAME_KEY_MAP = new Map<string, string>([
    ...Object.entries(kjvBibleConfig.keyBookMap as Record<string, string>).map(
        ([key, name]): [string, string] => [name.toLowerCase(), key],
    ),
    ['psalm', 'PSA'],
    ['psalms', 'PSA'],
]);
const TESTAMENT_NAME_PATTERN = /\b(New|Old) Testament\b/gi;

export type TestamentSlipType = { testament: 'New' | 'Old'; refs: string[] };

/**
 * The sentences that put a verse in the other Testament: the first
 * reference after the Testament is named is the one it introduces ("The New
 * Testament tells us that '…' [^Isaiah 53:5], and that '…' [^Colossians
 * 2:15]", BN-115's live run); a sentence with none after it is let be
 * ("Isaiah 53:5 is quoted in the New Testament").
 */
export function findTestamentSlips(text: string) {
    const slips: TestamentSlipType[] = [];
    for (const sentence of String(text ?? '').split(/(?<=[.!?])\s+|\n/)) {
        const namedList = [...sentence.matchAll(TESTAMENT_NAME_PATTERN)];
        const named = new Set(namedList.map((match) => match[1].toLowerCase()));
        if (named.size !== 1) {
            continue;
        }
        const namedEnd = (namedList[0].index ?? 0) + namedList[0][0].length;
        const ref = [...sentence.matchAll(CITED_REF_PATTERN)].find((match) => {
            return (match.index ?? 0) >= namedEnd;
        })?.[0];
        const key =
            ref === undefined
                ? null
                : (BOOK_NAME_KEY_MAP.get(
                      ref.replace(/\s*\d{1,3}:.*$/, '').toLowerCase(),
                  ) ?? null);
        const isNew = named.has('new');
        if (
            ref !== undefined &&
            key !== null &&
            OLD_TESTAMENT_KEY_SET.has(key) === isNew
        ) {
            slips.push({ testament: isNew ? 'New' : 'Old', refs: [ref] });
        }
    }
    return slips.slice(0, MAX_NOTE_MISQUOTES);
}

/** What the model is told when a sentence puts a verse in the other Testament. */
export function genTestamentSlipRefusal(slips: readonly TestamentSlipType[]) {
    return (
        'Nothing was written: ' +
        slips
            .map((slip) => {
                const other = slip.testament === 'New' ? 'Old' : 'New';
                return (
                    `${slip.refs.join(', ')} ${slip.refs.length > 1 ? 'are' : 'is'} ` +
                    `in the ${other} Testament, and the sentence says the ` +
                    `${slip.testament} Testament`
                );
            })
            .join('; ') +
        '. Name the Testament it is in, or name it by its book, then send ' +
        'the change again, whole.'
    );
}

// --- a verse token is never a sentence's words (BN-120) ----------------------
//
// 2026-11-11, the BN-116/117 read: a funeral message's Christ section read
// "finds its fulfillment in Jesus, who [^(KJV) John 1:14]." -- and, a read
// before, "Jesus says, [^(KJV) Matthew 11:28]." A token shows as its
// reference alone, so each sentence was left with no words where the
// verse's were meant to be. A token right after "who", "which" or "whom",
// or after a saying word and its comma or colon, that ends its sentence,
// is sent back once; "as Jesus said [^John 3:16]." cites, and is let be.
const TOKEN_AS_WORDS_PATTERN =
    /(?:\b(?:who|which|whom)|\b(?:says?|said|saith|writes?|wrote|declares?|promises?|promised|cries|cried|answers?|answered|asks?|asked|reads?|prays?|prayed|tells? us|told us)\s*[,:])\s*(\[\^[^\]\n]+\])\s*(?=[.!?;]|$)/gi;
const MAX_TOKEN_SENTENCE_CHARS = 160;

/** The sentences whose words a verse token stands in for, three at most. */
export function findTokenAsWords(text: string) {
    const found: { sentence: string; token: string }[] = [];
    for (const line of String(text ?? '').split(/\r?\n/)) {
        for (const match of line.matchAll(TOKEN_AS_WORDS_PATTERN)) {
            const at = match.index ?? 0;
            const before = line.slice(0, at);
            const start = Math.max(
                ...['. ', '! ', '? '].map((end) => {
                    const index = before.lastIndexOf(end);
                    return index < 0 ? 0 : index + 2;
                }),
            );
            const end = at + match[0].length;
            const closing = /[.!?;]/.test(line[end] ?? '') ? line[end] : '';
            let sentence = `${line.slice(start, end)}${closing}`
                .replace(/^\s*(?:[-*]\s+)?(?:\*\*[^*]+\*\*\s*)?/, '')
                .trim();
            if (sentence.length > MAX_TOKEN_SENTENCE_CHARS) {
                sentence = `…${sentence.slice(-MAX_TOKEN_SENTENCE_CHARS)}`;
            }
            if (!found.some((item) => item.sentence === sentence)) {
                found.push({ sentence, token: match[1] });
            }
        }
    }
    return found.slice(0, 3);
}

/** What the model is told when a token stands in for a verse's words. */
export function genTokenAsWordsRefusal(
    found: readonly { sentence: string; token: string }[],
) {
    return (
        'Nothing was written: ' +
        found.map((item) => `“${item.sentence}”`).join(' and ') +
        ' -- a token shows only as its reference, never its words, so ' +
        (found.length > 1 ? 'those sentences are' : 'that sentence is') +
        " left without them. Write the verse's words in quotes as you read " +
        'them with owa_find_verse, then its token -- ' +
        found
            .slice(0, 1)
            .map((item) => {
                return `“${item.sentence.replace(
                    item.token,
                    `“<its words, as read>” ${item.token}`,
                )}”`;
            })
            .join('') +
        ' -- or end the sentence in your own words before the token, then ' +
        'send the change again, whole.'
    );
}

// --- a child's memory verse a child can say (BN-129) -------------------------
//
// 2026-11-11: told "ONE verse of twenty words at most" in the shape AND in
// the form line said last (BN-124, BN-125), the lost sheep's children's
// lesson still took Luke 15:7 -- 28 words -- run after run, and both blind
// readers marked it down each time. The window reads the verse the Memory
// verse part names and sends a longer one back, once an ask.
export const MAX_CHILD_MEMORY_VERSE_WORDS = 20;
// Sent back twice an ask at most (BN-132): once, the model swapped Luke
// 15:7's 28 words for 1 John 4:16's 29, and Jonah 2:9's 24 for Nehemiah
// 9:31's 23 -- the second choice let in unread.
export const MAX_CHILD_MEMORY_VERSE_REFUSALS = 2;
const MEMORY_VERSE_HEADING_PATTERN = /^#{1,6}\s*memory verse\b/im;

/** The reference a lesson's Memory verse part gives, or null. */
export function findMemoryVerseRef(text: string) {
    const lesson = String(text ?? '');
    const at = lesson.search(MEMORY_VERSE_HEADING_PATTERN);
    if (at < 0) {
        return null;
    }
    const token = /\[\^([^\]\n]+)\]/.exec(lesson.slice(at));
    const ref = token?.[1].replace(/^\([^)]*\)\s*/, '').trim() ?? '';
    return ref === '' ? null : ref;
}

/**
 * The one verse an edit gives a passage block as its `ref` -- after the
 * window named a child's memory verse, the verse put in its place (BN-208:
 * the swap came as `{block: 39, ref: "Jonah 4:2"}`, no Memory verse heading
 * in the change, and went unread). Null for no such change, or for more
 * than one.
 */
export function findSwappedVerseRef(changes: unknown) {
    if (!Array.isArray(changes)) {
        return null;
    }
    const refList = changes
        .map((change) => {
            return typeof change?.ref === 'string' ? change.ref.trim() : '';
        })
        .filter((ref) => {
            return ref !== '';
        });
    return refList.length === 1 ? refList[0] : null;
}

/** The words of a verse as read, its numbers left out. */
export function countVerseWords(verseText: string) {
    return (
        String(verseText ?? '')
            .replace(/\(\d{1,3}\):\s*/g, ' ')
            .match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
    );
}

// A short verse of the passage read offered in its place: one a child can
// say, and long enough to carry something.
const MIN_CHILD_MEMORY_VERSE_WORDS = 6;
const MAX_CHILD_MEMORY_VERSE_OFFERS = 3;

// Words of a lesson's big idea that say nothing a verse could share.
const BIG_IDEA_STOP_WORD_SET = new Set([
    'that',
    'with',
    'they',
    'them',
    'this',
    'those',
    'these',
    'unto',
    'shall',
    'will',
    'from',
    'have',
    'hath',
    'every',
    'into',
    'there',
    'their',
    'which',
    'when',
    'what',
    'whom',
    'whose',
    'then',
    'than',
    'your',
    'were',
    'been',
    'being',
    'also',
    'even',
    'just',
    'like',
    'more',
    'most',
    'only',
    'other',
    'over',
    'such',
    'very',
    'single',
    'person',
    'people',
    'thing',
    'things',
]);

// A word by its first four letters: "searches" and "search", "loves" and
// "loved" alike.
function toBigIdeaStemSet(text: string) {
    return new Set(
        (
            String(text ?? '')
                .toLowerCase()
                .match(/[a-z]{4,}/g) ?? []
        )
            .filter((word) => {
                return !BIG_IDEA_STOP_WORD_SET.has(word);
            })
            .map((word) => {
                return word.slice(0, 4);
            }),
    );
}

/** A lesson's Big idea, its first line under the heading, or ''. */
export function readLessonBigIdea(text: string) {
    return (
        /^#{1,6}\s*big idea\s*\n+([^\n]+)/im.exec(String(text ?? ''))?.[1] ?? ''
    );
}

// A passage's span by its book key: `Luke 15:1-7`, `Genesis 6:9-9:17`, a
// whole chapter (`Psalm 23`) or chapters (`Psalm 42-43`); null when its
// book is not one the KJV names.
function toPassageSpan(ref: string) {
    const match =
        /^(.*?\S)\s+(\d{1,3})(?::(\d{1,3}))?(?:\s*[-–]\s*(?:(\d{1,3}):)?(\d{1,3}))?$/.exec(
            String(ref ?? '').trim(),
        );
    const bookKey =
        match === null
            ? null
            : (BOOK_NAME_KEY_MAP.get(match[1].toLowerCase()) ?? null);
    if (match === null || bookKey === null) {
        return null;
    }
    const fromChapter = Number(match[2]);
    const fromVerse = match[3] === undefined ? 1 : Number(match[3]);
    let toChapter = fromChapter;
    let toVerse = match[3] === undefined ? 999 : fromVerse;
    if (match[5] !== undefined) {
        if (match[4] !== undefined) {
            toChapter = Number(match[4]);
            toVerse = Number(match[5]);
        } else if (match[3] !== undefined) {
            toVerse = Number(match[5]);
        } else {
            toChapter = Number(match[5]);
        }
    }
    return {
        bookKey,
        from: fromChapter * 1000 + fromVerse,
        to: toChapter * 1000 + toVerse,
    };
}

/**
 * The words of the lesson's own passage as this ask read them -- every read
 * of verses (`noteQuoteSources`) that falls in its span -- or '' when its
 * passage is unknown or was not read (BN-163: whether a word quoted in
 * Pointing to Jesus is the passage's own).
 */
export function readPassageVerseWords(
    sources: readonly string[] | null | undefined,
    passageRef: string | null,
) {
    const passageSpan = passageRef === null ? null : toPassageSpan(passageRef);
    if (passageSpan === null) {
        return '';
    }
    const wordList: string[] = [];
    for (const source of sources ?? []) {
        let verses: unknown;
        try {
            verses = JSON.parse(source)?.verses;
        } catch (_error) {
            continue;
        }
        if (!Array.isArray(verses)) {
            continue;
        }
        for (const verse of verses) {
            const span = toPassageSpan(String(verse?.ref ?? ''));
            if (
                span !== null &&
                span.bookKey === passageSpan.bookKey &&
                span.from <= passageSpan.to &&
                span.to >= passageSpan.from
            ) {
                wordList.push(String(verse?.text ?? ''));
            }
        }
    }
    return wordList.join('\n');
}

/**
 * Verses of the passages this ask read that a child can say and that share
 * a word with the lesson's big idea, each with its reference and how many
 * words it is, three at most, those sharing most first -- `sources` being
 * the reads kept for the ask (`noteQuoteSources`). None when no verse read
 * shares one: offered in read order, the model took Luke 15:1 ("Then drew
 * near unto him all the publicans and sinners") for a lesson on God
 * seeking the lost (shape29). With the lesson's passage known, only its own
 * verses (BN-155, ab32: the verses read just before Luke 15 for its
 * background offered Luke 14:34, "Salt is good: but if the salt have lost
 * his savour" -- "lost" -- and a lost sheep lesson took it).
 */
export function listShortReadVerses(
    sources: readonly string[],
    bigIdea: string,
    passageRef: string | null = null,
) {
    const ideaStemSet = toBigIdeaStemSet(bigIdea);
    const passageSpan = passageRef === null ? null : toPassageSpan(passageRef);
    const checkIsInPassage = (ref: string) => {
        if (passageSpan === null) {
            return true;
        }
        const span = toPassageSpan(ref);
        return (
            span !== null &&
            span.bookKey === passageSpan.bookKey &&
            span.from >= passageSpan.from &&
            span.from <= passageSpan.to
        );
    };
    const offers: { ref: string; wordCount: number; shared: number }[] = [];
    const seenSet = new Set<string>();
    for (const source of sources) {
        let verses: unknown;
        try {
            verses = JSON.parse(source)?.verses;
        } catch (_error) {
            continue;
        }
        if (!Array.isArray(verses)) {
            continue;
        }
        for (const verse of verses) {
            const ref = String(verse?.ref ?? '');
            const chapterRef = /^(.*\d+):\d+(?:-\d+)?$/.exec(ref)?.[1];
            const verseText = String(verse?.text ?? '');
            const parts = [...verseText.matchAll(/\((\d{1,3})\):\s*([^(]*)/g)];
            const pieces =
                parts.length > 0
                    ? parts.map((part) => {
                          return {
                              ref: `${chapterRef}:${part[1]}`,
                              text: part[2],
                          };
                      })
                    : [{ ref, text: verseText }];
            for (const piece of pieces) {
                const wordCount = countVerseWords(piece.text);
                const shared = [...toBigIdeaStemSet(piece.text)].filter(
                    (stem) => {
                        return ideaStemSet.has(stem);
                    },
                ).length;
                if (
                    chapterRef !== undefined &&
                    !seenSet.has(piece.ref) &&
                    checkIsInPassage(piece.ref) &&
                    shared > 0 &&
                    wordCount >= MIN_CHILD_MEMORY_VERSE_WORDS &&
                    wordCount <= MAX_CHILD_MEMORY_VERSE_WORDS
                ) {
                    seenSet.add(piece.ref);
                    offers.push({ ref: piece.ref, wordCount, shared });
                }
            }
        }
    }
    return offers
        .sort((one, other) => {
            return other.shared - one.shared;
        })
        .slice(0, MAX_CHILD_MEMORY_VERSE_OFFERS)
        .map(({ ref, wordCount }) => {
            return { ref, wordCount };
        });
}

/**
 * What the model is told under a children's lesson written with a memory
 * verse too long to say (BN-143, 2026-11-11, shape29: sent back whole, a
 * Lost Sheep lesson searched for a shorter verse until its rounds ran out,
 * and nothing was written). The lesson is in; one more edit changes the
 * one line.
 */
export function genChildMemoryVerseNote(
    ref: string,
    wordCount: number,
    offers: readonly { ref: string; wordCount: number }[],
) {
    // None of the passage's own is short enough (BN-208, shape62: a Jonah
    // lesson's Jonah 2:9 named, the model put in Jonah 4:2, 60 words): the
    // shape's own way, a short verse from elsewhere, read first.
    const offered =
        offers.length === 0
            ? ' -- when no verse of the passage is that short, a short verse ' +
              'from elsewhere in Scripture that says it, read with ' +
              'owa_find_verse first and counted'
            : ` -- for instance ${offers
                  .map((offer) => `${offer.ref} (${offer.wordCount} words)`)
                  .join(', ')}, read already`;
    // Seen live (shape29): told to change "the memory verse's line", the
    // model put the same verse back -- the line is a passage block by then,
    // printed whole, and takes another verse as its `ref`.
    return (
        `(The lesson is in, but its memory verse, ${ref}, runs ${wordCount} ` +
        'words: a child cannot say it. Choose ANOTHER verse -- not ' +
        `${ref} -- of ${MAX_CHILD_MEMORY_VERSE_WORDS} words at most that ` +
        `says the big idea${offered}. With ONE more edit, give the memory ` +
        "verse's passage block that verse as its ref -- {block: <its " +
        'number>, ref: "<the verse>"} -- every other block as it is now; ' +
        'then answer.)'
    );
}

/**
 * The block a lesson's memory verse is in, read off the note after the
 * change: the first block with words after its Memory verse heading; null
 * when the note has none (BN-175).
 */
export function findMemoryVerseBlock(
    blocks: readonly { n?: unknown; kind?: unknown; text?: unknown }[],
) {
    const headingIndex = blocks.findLastIndex((block) => {
        return (
            /^h[1-6]$/.test(String(block.kind ?? '')) &&
            /\bmemory verse\b/i.test(String(block.text ?? ''))
        );
    });
    if (headingIndex < 0) {
        return null;
    }
    const verse = blocks.slice(headingIndex + 1).find((block) => {
        return String(block.text ?? '').trim() !== '';
    });
    return verse !== undefined && typeof verse.n === 'number' ? verse.n : null;
}

/**
 * The memory-verse note with the block it names: told "<its number>", a
 * model counted its own blocks and changed two headings (BN-175, shape44's
 * children's Jonah -- the Memory verse heading made a verse token, the
 * Pointing to Jesus heading given its paragraph).
 */
export function withMemoryVerseBlock(note: string, block: number | null) {
    if (block === null) {
        return note;
    }
    return note
        .replace(
            "give the memory verse's passage block that verse",
            `give block ${block}, the memory verse's passage, that verse`,
        )
        .replace('{block: <its number>,', `{block: ${block},`);
}

/** What the model is told when a quote is not the verse it names. */
export function genCitedMisquoteRefusal(
    misquotes: readonly (CitedQuoteType & { verse: string })[],
) {
    return (
        'Nothing was written: a quote given its chapter and verse is read ' +
        'out as that verse, and ' +
        misquotes
            .map((item) => {
                return `${item.ref} reads: “${item.verse
                    .replaceAll(/\(\d{1,3}\):\s*/g, '')
                    .trim()}” -- not “${item.quote}”`;
            })
            .join('; ') +
        '. Quote each word for word as it reads, write it as its token ' +
        `([^${misquotes[0]?.ref ?? ''}]), or say it in your own words ` +
        'without quotation marks -- then send the change again, whole.'
    );
}

// --- a quotation names the verse it comes from (BN-160) ----------------------
//
// 2026-11-12, the ab34 read (Opus: an error): a funeral message's Christ
// section, "provides the water of life freely [John 4:14]" -- the words of
// its own passage, Revelation 21:6. BN-113 lets a quotation of what the ask
// read be, whatever it names beside it, so the wrong reference went by.

export type CitedMisattributionType = {
    quote: string;
    ref: string;
    source: string;
};

// The verse of a read that holds a quotation's words: `Revelation 21:6`.
function toQuoteSourceRef(entry: ReadEntryType, key: string) {
    const match = /^([1-3]?[A-Z]{2,3})\s+(\d{1,3}):(\d{1,3})/.exec(
        entry.verseKey ?? '',
    );
    const name =
        match === null
            ? undefined
            : (kjvBibleConfig.keyBookMap as Record<string, string>)[match[1]];
    if (match === null || name === undefined) {
        return null;
    }
    const pieces = [...entry.raw.matchAll(/\((\d{1,3})\):\s*([^(]*)/g)];
    const verseNumber =
        pieces.length === 0
            ? match[3]
            : pieces.find((piece) => {
                  return toLetterKey(piece[2]).includes(key);
              })?.[1];
    return verseNumber === undefined
        ? `${name} ${match[2]}`
        : `${name} ${match[2]}:${verseNumber}`;
}

// The most quotations one change is read for, on top of BN-132's.
const MAX_MISATTRIBUTION_CANDIDATES = 3;

/**
 * The quotations BN-113 lets be -- their words found in a read verse of
 * ANOTHER book than the one they name -- whose named verse is worth one
 * read: the passage's own words given another verse's name.
 */
export function pickMisattributionCandidates(
    citedList: readonly CitedQuoteType[],
    readTexts: readonly string[] = [],
) {
    const readEntryList = toReadEntryList(readTexts);
    return citedList
        .filter((cited) => {
            const citedBookKey = toRefBookKey(cited.ref);
            const key = toLetterKey(cited.quote);
            return (
                citedBookKey !== null &&
                key.length >= MIN_NOTE_QUOTE_LETTERS &&
                readEntryList.some((entry) => {
                    return (
                        entry.bookKey !== null &&
                        entry.bookKey !== citedBookKey &&
                        entry.key.includes(key)
                    );
                }) &&
                !readEntryList.some((entry) => {
                    return (
                        entry.bookKey === citedBookKey &&
                        entry.key.includes(key)
                    );
                })
            );
        })
        .slice(0, MAX_MISATTRIBUTION_CANDIDATES);
}

/**
 * The quotations whose named verse, read, does not hold them while a read
 * of another book does: the words of another verse, named for the verse
 * they come from.
 */
export function findCitedMisattributions(
    citedList: readonly CitedQuoteType[],
    verseTextMap: ReadonlyMap<string, string>,
    readTexts: readonly string[] = [],
): CitedMisattributionType[] {
    const readEntryList = toReadEntryList(readTexts);
    const found: CitedMisattributionType[] = [];
    for (const cited of citedList) {
        const verse = verseTextMap.get(cited.ref);
        const key = toLetterKey(cited.quote);
        if (
            verse === undefined ||
            /…\s*$/u.test(verse) ||
            key.length < MIN_NOTE_QUOTE_LETTERS ||
            toLetterKey(verse).includes(key)
        ) {
            continue;
        }
        const citedBookKey = toRefBookKey(cited.ref);
        const entry = readEntryList.find((item) => {
            return (
                item.bookKey !== null &&
                item.bookKey !== citedBookKey &&
                item.key.includes(key)
            );
        });
        const source =
            entry === undefined ? null : toQuoteSourceRef(entry, key);
        if (
            source !== null &&
            !found.some((item) => {
                return item.quote === cited.quote;
            })
        ) {
            found.push({ quote: cited.quote, ref: cited.ref, source });
        }
    }
    return found.slice(0, MAX_NOTE_MISQUOTES);
}

/** Said under the change: each quotation, by its block, and its own verse. */
export function genCitedMisattributionNote(
    found: readonly (CitedMisattributionType & { sentence: string })[],
    blockNumbers: readonly (number | null)[] = [],
) {
    if (found.length === 0) {
        return null;
    }
    const said = found.map((item, index) => {
        const block = blockNumbers[index] ?? null;
        const sentence =
            item.sentence.length > 200
                ? `${item.sentence.slice(0, 200)}…`
                : item.sentence;
        return (
            (block === null ? '' : `block ${block}: `) +
            `"${sentence}" -- "${item.quote}" is ${item.source}'s words, not ` +
            `${item.ref}'s`
        );
    });
    const numberList = blockNumbers
        .slice(0, found.length)
        .filter((block, index, list) => {
            return block !== null && list.indexOf(block) === index;
        });
    const isEveryNumbered =
        blockNumbers.length >= found.length &&
        !blockNumbers.slice(0, found.length).includes(null);
    const change = isEveryNumbered
        ? ` -- {block: ${numberList.length === 1 ? numberList[0] : '<each>'}, ` +
          'text: <its words, the quotation given the verse it comes from>}' +
          (numberList.length === 1
              ? ''
              : ` for each of blocks ${numberList.join(' and ')}`) +
          ' --'
        : ', the quotation given the verse it comes from,';
    return (
        '(The change is made, but a quotation names a verse its words are ' +
        `not in: ${said.join('; ')}. Change ONLY ` +
        `${found.length === 1 ? 'that line' : 'those lines'} with ONE more ` +
        `edit${change} every other block as it is now -- then answer.)`
    );
}

// Every verse of a read that holds the words, as "Book C:V".
function listQuoteSourceRefs(entry: ReadEntryType, key: string) {
    const match = /^([1-3]?[A-Z]{2,3})\s+(\d{1,3}):(\d{1,3})/.exec(
        entry.verseKey ?? '',
    );
    const name =
        match === null
            ? undefined
            : (kjvBibleConfig.keyBookMap as Record<string, string>)[match[1]];
    if (match === null || name === undefined) {
        return [];
    }
    const pieces = [...entry.raw.matchAll(/\((\d{1,3})\):\s*([^(]*)/g)];
    if (pieces.length === 0) {
        return [`${name} ${match[2]}:${match[3]}`];
    }
    return pieces
        .filter((piece) => toLetterKey(piece[2]).includes(key))
        .map((piece) => `${name} ${match[2]}:${piece[1]}`);
}

// --- a point quoting a verse that is not its own (BN-230) --------------------
//
// 2026-11-13, the held-out reads ab69 and ab74: a children's Noah set Genesis
// 7:5's words -- "Noah did according unto all that the LORD commanded him" --
// under a point that prints Genesis 6:22, and both readers counted the
// verse's words given another verse. A quotation in a point's lines names no
// verse, so no check held it: the point's own printed verses do.

type PointVerseRangeType = {
    bookKey: string;
    chapter: number;
    from: number | null;
    to: number | null;
};

// "(KJV) Genesis 6:22", "Psalm 139:1-12", "Ruth 1" as a range of a chapter.
function toPointVerseRange(ref: string): PointVerseRangeType | null {
    const match =
        /^\s*(?:\([^)]*\)\s*)?(.*?\S)\s+(\d{1,3})(?::(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\s*$/.exec(
            String(ref ?? ''),
        );
    const bookKey = match === null ? null : toRefBookKey(`${match[1]} 1:1`);
    if (match === null || bookKey === null) {
        return null;
    }
    const from = match[3] === undefined ? null : Number(match[3]);
    return {
        bookKey,
        chapter: Number(match[2]),
        from,
        to: match[4] === undefined ? from : Number(match[4]),
    };
}

function checkIsInPointRange(
    range: PointVerseRangeType,
    list: readonly PointVerseRangeType[],
) {
    return list.some((own) => {
        return (
            own.bookKey === range.bookKey &&
            own.chapter === range.chapter &&
            (own.from === null ||
                range.from === null ||
                (range.from >= own.from && range.from <= (own.to ?? own.from)))
        );
    });
}

const POINT_HEADING_LINE_PATTERN = /^\s*#{1,6}\s*\d+[.)]\s/;
const LONE_VERSE_TOKEN_LINE_PATTERN = /^\s*\[\^([^\]\n]+)\]\s*$/;
const NOTE_SECTION_HEADING_PATTERN = /^\s*#{1,6}\s/;
// A quotation is the point's own words only from this many letters.
const MIN_POINT_QUOTE_LETTERS = 20;

/**
 * The lines of a lesson's points that quote, word for word, a verse the ask
 * read which is not one of the point's own printed verses -- each with what
 * it says, the shape a legend is named in. A quotation with its own verse
 * token right after it is the cited checks' to read, and one found in the
 * point's own verses too is let be.
 */
export function findPointQuoteMisplacements(
    text: string,
    readTexts: readonly string[] = [],
): { sentence: string; text: string }[] {
    const readEntryList = toReadEntryList(readTexts).filter((entry) => {
        return entry.verseKey !== null;
    });
    if (readEntryList.length === 0) {
        return [];
    }
    const found: { sentence: string; text: string }[] = [];
    let pointRefs: string[] = [];
    let pointRanges: PointVerseRangeType[] | null = null;
    // The passage printed at the top, before the lesson's first heading.
    const lessonRanges: PointVerseRangeType[] = [];
    let isTop = true;
    for (const line of String(text ?? '').split(/\r?\n/)) {
        if (isTop) {
            const top = LONE_VERSE_TOKEN_LINE_PATTERN.exec(line);
            const range = top === null ? null : toPointVerseRange(top[1]);
            if (range !== null) {
                lessonRanges.push(range);
            }
            // A title (`# …`) is still the top; a part's heading ends it.
            if (/^\s*#{2,6}\s/.test(line)) {
                isTop = false;
            }
        }
        if (POINT_HEADING_LINE_PATTERN.test(line)) {
            pointRefs = [];
            pointRanges = [];
            continue;
        }
        if (NOTE_SECTION_HEADING_PATTERN.test(line)) {
            pointRanges = null;
            continue;
        }
        if (pointRanges === null) {
            continue;
        }
        const lone = LONE_VERSE_TOKEN_LINE_PATTERN.exec(line);
        if (lone !== null) {
            const range = toPointVerseRange(lone[1]);
            if (range !== null) {
                pointRanges.push(range);
                pointRefs.push(lone[1].replace(/^\s*\([^)]*\)\s*/, ''));
            }
            continue;
        }
        if (pointRanges.length === 0) {
            continue;
        }
        for (const match of line.matchAll(NOTE_QUOTE_PATTERN)) {
            const end = (match.index ?? 0) + match[0].length;
            const key = toLetterKey(match[1]);
            if (
                key.length < MIN_POINT_QUOTE_LETTERS ||
                /^\s*[,;:.]?\s*[[(]/u.test(line.slice(end, end + 4))
            ) {
                continue;
            }
            // EVERY verse that holds the words: "whosoever believeth in him
            // should not perish" is John 3:15 and 3:16 alike.
            const sources = readEntryList
                .filter((entry) => entry.key.includes(key))
                .flatMap((entry) => listQuoteSourceRefs(entry, key));
            const ranges = sources
                .map(toPointVerseRange)
                .filter((range): range is PointVerseRangeType => {
                    return range !== null && range.from !== null;
                });
            // A verse of the passage the lesson prints at its top is the
            // lesson's own to quote: Isaiah 40:30 explaining 40:31.
            if (
                ranges.length === 0 ||
                ranges.some((range) => {
                    return (
                        checkIsInPointRange(range, pointRanges!) ||
                        checkIsInPointRange(range, lessonRanges)
                    );
                })
            ) {
                continue;
            }
            const source = sources.find((one) => /:\d/.test(one))!;
            found.push({
                sentence: line.trim(),
                text:
                    `"${match[1].trim()}" is ${source}'s words, not the ` +
                    `point's own ${pointRefs.join(', ')} -- quote ` +
                    `${pointRefs.join(', ')} as it reads, or name ` +
                    `[^${source}] right after these words`,
            });
            break;
        }
        if (found.length >= MAX_NOTE_MISQUOTES) {
            break;
        }
    }
    return found;
}

// --- a lesson's points follow and cover its passage (BN-83) -------------------
//
// 2026-11-11, BN-81's two runs read again by their verses: in each, five
// lessons of thirteen stopped before their passage did. The sower sermon
// stopped at the thorns (Matthew 13:22), though the good ground of 13:23 was
// its memory verse. The Psalm 46 and Psalm 23 devotions' one point stopped at
// verse 3, while their big idea rested on "be still" (46:10) and the valley
// (23:4). Psalm 51 stopped at 17 of 19, David at 17:47 of 58. Both blind
// readers marked the points down for it. The shape has asked for "the last
// ending where the passage ends" since BN-66; a small model reads a
// sentence, and this reads the lesson. The same day, the template's first
// run put David's points at 17:45-47, then 17:38-40, then 17:48-50: the
// armour after the speech the passage puts after it. So no point's verses
// may all come before the point above it either. It checks only a new
// lesson's first write, once an ask, and only a passage the app reads as one
// book, one chapter and three verses or more: a children's lesson's verse or
// two, John 3:16, a whole chapter unnumbered or a list of places is let be.
// Only the points' verses inside the passage count.
const LESSON_POINT_HEADING_PATTERN =
    /^[ \t]*#{2,3}[ \t]+(?:\*\*)?(?:point[ \t]+)?\d{1,2}[.):]/i;
const LESSON_HEADING_PATTERN = /^[ \t]*#{1,6}[ \t]/;
// A heading under the title: the lesson's top, where its passage is, ends.
const LESSON_PART_HEADING_PATTERN = /^[ \t]*#{2,6}[ \t]/;
const LESSON_VERSE_TOKEN_PATTERN = /\[\^([^\]\n]+)\]/g;
const LESSON_BIBLE_PREFIX_PATTERN = /^\([^)\n]{1,24}\)\s*/;
const MIN_COVERED_PASSAGE_VERSES = 3;
// BN-188 (ab50, Opus; both Good Samaritan lessons of shape50 and shape51):
// Luke 10:25-37 printed, its points from 10:30 -- the lawyer's question,
// what the parable answers, in no point. Points that begin this many verses
// into their passage leave its start out; the sower's setting (13:1-2, two
// verses before the parable) is let be.
const MIN_LEFT_OUT_START_VERSES = 3;

type LessonRefType = NonNullable<ReturnType<typeof parseRefParts>>;

export type LessonPointsProblemType = {
    // The passage at the lesson's top: "Matthew 13:1-23".
    passage: string;
    // Where the points stop, short of its end: "Matthew 13:22" of "13:23".
    gap: { reached: string; end: string } | null;
    // Where the points begin, well into it: "Luke 10:30" of "10:25".
    lead: { start: string; begins: string } | null;
    // A point that comes before the point above it in the passage.
    slip: {
        point: number;
        ref: string;
        earlierPoint: number;
        earlierRef: string;
    } | null;
    // A point that prints the very verses a point above it printed
    // (BN-213: Proverbs 3:5 under points 1 and 2, marked by both readers).
    repeat?: { point: number; earlierPoint: number; ref: string } | null;
};

function toLessonRefParts(words: string) {
    const parts = parseRefParts(
        words.replace(LESSON_BIBLE_PREFIX_PATTERN, '').trim(),
    );
    // A range over chapters ("Jonah 1:17-2:10") reads as a book named
    // "Jonah 1:17-2:", which no point's verse is in.
    if (parts === null || /\d\s*[:.]/.test(parts.book)) {
        return null;
    }
    return parts;
}

function toLessonBookKey(book: string) {
    return book
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/s$/u, '');
}

function toLessonRefText({
    book,
    chapter,
    verseStart,
    verseEnd,
}: LessonRefType) {
    if (verseStart === null) {
        return `${book} ${chapter}`;
    }
    return verseEnd === null || verseEnd === verseStart
        ? `${book} ${chapter}:${verseStart}`
        : `${book} ${chapter}:${verseStart}-${verseEnd}`;
}

/** The passage at a new lesson's top, and each point's verses inside it. */
function readLessonPoints(text: string) {
    const lines = String(text ?? '')
        .replace(/\\r\\n|\\n/g, '\n')
        .replace(/\r\n?/g, '\n')
        .split('\n');
    let passageWords: string | null = null;
    let isPastTop = false;
    let isInPoint = false;
    const pointWords: string[][] = [];
    for (const line of lines) {
        if (LESSON_POINT_HEADING_PATTERN.test(line)) {
            isPastTop = true;
            isInPoint = true;
            pointWords.push([]);
            continue;
        }
        if (LESSON_HEADING_PATTERN.test(line)) {
            isPastTop = isPastTop || LESSON_PART_HEADING_PATTERN.test(line);
            isInPoint = false;
            continue;
        }
        if (!isPastTop) {
            passageWords ??= readPassageLineRef(line);
        } else if (isInPoint) {
            for (const match of line.matchAll(LESSON_VERSE_TOKEN_PATTERN)) {
                pointWords[pointWords.length - 1].push(
                    ...(splitVerseTokenRefs(match[1]) ?? [match[1]]),
                );
            }
        }
    }
    if (passageWords === null || splitVerseTokenRefs(passageWords) !== null) {
        return null;
    }
    const passage = toLessonRefParts(passageWords);
    if (
        passage === null ||
        passage.verseStart === null ||
        passage.verseEnd === null ||
        passage.verseEnd - passage.verseStart + 1 < MIN_COVERED_PASSAGE_VERSES
    ) {
        return null;
    }
    const { chapter, verseStart, verseEnd } = passage;
    const bookKey = toLessonBookKey(passage.book);
    const points = pointWords.map((words) => {
        return words
            .map(toLessonRefParts)
            .filter((parts): parts is LessonRefType => {
                if (
                    parts === null ||
                    parts.chapter !== chapter ||
                    toLessonBookKey(parts.book) !== bookKey
                ) {
                    return false;
                }
                // A whole chapter holds the passage.
                if (parts.verseStart === null) {
                    return true;
                }
                const end = parts.verseEnd ?? parts.verseStart;
                return parts.verseStart <= verseEnd && end >= verseStart;
            });
    });
    return { passage: { ...passage, verseStart, verseEnd }, points };
}

/**
 * Where a new lesson's numbered points stop before its passage ends, or
 * leave its order; null when they cover it in order, or cannot be read.
 */
/**
 * A numbered point that prints -- on a line of their own -- the very verses
 * a point above it printed; a verse named in a sentence is a chip, not a
 * printing. For any passage, a short one most of all: Proverbs 3:5-6 under
 * three points printed 3:5 twice (BN-213).
 */
export function findLessonPointRepeat(text: string) {
    const lines = String(text ?? '')
        .replace(/\\r\\n|\\n/g, '\n')
        .replace(/\r\n?/g, '\n')
        .split('\n');
    const printedList: string[][] = [];
    let isInPoint = false;
    for (const line of lines) {
        if (LESSON_POINT_HEADING_PATTERN.test(line)) {
            isInPoint = true;
            printedList.push([]);
            continue;
        }
        if (LESSON_HEADING_PATTERN.test(line)) {
            isInPoint = false;
            continue;
        }
        const printed = /^[ \t>]*\[\^([^\]\n]+)\][ \t]*$/.exec(line);
        if (isInPoint && printed !== null) {
            // A half verse is printed whole: "3:5a" and "3:5b" are 3:5 twice
            // (shape67: the repeat went in as two halves).
            printedList[printedList.length - 1].push(
                printed[1]
                    .replace(LESSON_BIBLE_PREFIX_PATTERN, '')
                    .replace(/(\d)[a-c]\b/g, '$1')
                    .trim(),
            );
        }
    }
    const seenMap = new Map<string, number>();
    for (const [index, printed] of printedList.entries()) {
        if (printed.length === 0) {
            continue;
        }
        const key = [...printed].sort().join('; ');
        const earlier = seenMap.get(key);
        if (earlier !== undefined) {
            return { point: index + 1, earlierPoint: earlier, ref: key };
        }
        seenMap.set(key, index + 1);
    }
    return null;
}

export function findLessonPointsProblem(
    text: string,
): LessonPointsProblemType | null {
    const lesson = readLessonPoints(text);
    if (lesson === null) {
        // Too short a passage for the cover and the order -- the printing
        // twice is still read (BN-213).
        const repeat = findLessonPointRepeat(text);
        return repeat === null
            ? null
            : { passage: '', gap: null, lead: null, slip: null, repeat };
    }
    const { passage, points } = lesson;
    const chapter = `${passage.book} ${passage.chapter}`;
    const refs = points.flat();
    let gap: LessonPointsProblemType['gap'] = null;
    if (refs.length > 0 && refs.every((ref) => ref.verseStart !== null)) {
        const reached = Math.max(
            ...refs.map((ref) => ref.verseEnd ?? ref.verseStart ?? 0),
        );
        if (reached < passage.verseEnd) {
            gap = {
                reached: `${chapter}:${reached}`,
                end: `${chapter}:${passage.verseEnd}`,
            };
        }
    }
    // Only a point whose verses ALL come before the point above it is out of
    // order: a sower's point may pair the parable's verse with its meaning's.
    let slip: LessonPointsProblemType['slip'] = null;
    let last: { point: number; start: number; ref: string } | null = null;
    for (const [index, pointRefs] of points.entries()) {
        const numbered = pointRefs.filter((ref) => ref.verseStart !== null);
        if (numbered.length === 0) {
            continue;
        }
        const start = Math.min(...numbered.map((ref) => ref.verseStart ?? 0));
        const end = Math.max(
            ...numbered.map((ref) => ref.verseEnd ?? ref.verseStart ?? 0),
        );
        if (last !== null && end < last.start) {
            slip = {
                point: index + 1,
                ref: toLessonRefText(numbered[0]),
                earlierPoint: last.point,
                earlierRef: last.ref,
            };
            break;
        }
        last = { point: index + 1, start, ref: toLessonRefText(numbered[0]) };
    }
    let lead: LessonPointsProblemType['lead'] = null;
    if (refs.length > 0 && refs.every((ref) => ref.verseStart !== null)) {
        const begins = Math.min(...refs.map((ref) => ref.verseStart ?? 0));
        if (begins - passage.verseStart >= MIN_LEFT_OUT_START_VERSES) {
            lead = {
                start: `${chapter}:${passage.verseStart}`,
                begins: `${chapter}:${begins}`,
            };
        }
    }
    const repeat = findLessonPointRepeat(text);
    if (gap === null && slip === null && lead === null && repeat === null) {
        return null;
    }
    return {
        passage: `${chapter}:${passage.verseStart}-${passage.verseEnd}`,
        gap,
        lead,
        slip,
        ...(repeat === null ? {} : { repeat }),
    };
}

/**
 * Said over a new lesson's passage read when the window read the verses
 * just before it too (BN-89, `findVersesBeforeRef`): what the Background
 * tells of them is to come from these words. It names the passage they come
 * before (BN-105): read wider than the passage asked for, a lesson told the
 * verses before its READ as the verses before its passage.
 */
export function genVersesBeforeNote(ref: string, passage?: string | null) {
    const before =
        typeof passage === 'string' && passage.trim() !== ''
            ? passage.trim()
            : 'the passage';
    return (
        `(The window also read ${ref}, the verses just before ${before}, ` +
        'for the Background: say what happens there from these words, never ' +
        'from memory.)'
    );
}

// The kinds a heading change names, as its mark-up's `#`s.
const LESSON_HEADING_KIND_PATTERN = /^h([1-6])$/;

/**
 * A lesson's changes as the mark-up lines they write, in the order given:
 * a model adds the passage as a `passage` change with its `ref`, and a
 * heading as an `h2` change, as often as it writes `[^ref]` and `## ` lines
 * in a section. The David sermon's passage was one, and the check, reading
 * only words, found no passage at the top to hold its points to.
 */
export function toLessonChangeText(args: any) {
    const changes = Array.isArray(args?.changes) ? args.changes : [];
    return changes
        .map((change: any) => {
            const kind = String(change?.kind ?? '');
            if (kind === 'passage' && typeof change?.ref === 'string') {
                return `[^${change.ref}]`;
            }
            const text = typeof change?.text === 'string' ? change.text : '';
            const heading = LESSON_HEADING_KIND_PATTERN.exec(kind);
            return heading !== null && !/^\s*#/.test(text)
                ? `${'#'.repeat(Number(heading[1]))} ${text}`
                : text;
        })
        .join('\n');
}

/** What the model is told when a new lesson's points leave its passage. */
export function genLessonPointsRefusal(problem: LessonPointsProblemType) {
    const faults = [
        problem.slip === null
            ? ''
            : `point ${problem.slip.point} (${problem.slip.ref}) comes ` +
              `before point ${problem.slip.earlierPoint} ` +
              `(${problem.slip.earlierRef}) in it`,
        problem.lead === null
            ? ''
            : `the points begin at ${problem.lead.begins}, leaving out its ` +
              `first verses`,
        problem.gap === null ? '' : `the points stop at ${problem.gap.reached}`,
        (problem.repeat ?? null) === null
            ? ''
            : `point ${problem.repeat!.point} prints ${problem.repeat!.ref} ` +
              `again, as point ${problem.repeat!.earlierPoint} does`,
    ].filter((fault) => fault !== '');
    // A repeat alone: the order and the cover are right, only the printing
    // is twice (BN-213).
    if (
        problem.gap === null &&
        problem.lead === null &&
        problem.slip === null &&
        (problem.repeat ?? null) !== null
    ) {
        return (
            `Nothing was written: ${faults[0]}. Each point prints its OWN ` +
            'verses; a short passage gives its points from its clauses -- ' +
            'under the second, the clause it rests on quoted in a sentence ' +
            'with its verse as a chip, "lean not unto thine own ' +
            'understanding" [^Proverbs 3:5], never the verse printed ' +
            'again. Change only that, then send the lesson again, whole.'
        );
    }
    const start =
        problem.lead === null
            ? ''
            : `the first starting where it starts, at ${problem.lead.start}, `;
    const end = problem.gap === null ? '' : `, at ${problem.gap.end}`;
    return (
        `Nothing was written: the passage is ${problem.passage}, and ` +
        `${faults.join(', and ')}. The points follow it in its own order and ` +
        `together cover ALL of it, ${start}the last ending where it ends` +
        `${end} -- a ` +
        "devotion's one point walks the whole passage. Keep the passage as " +
        'it is, put the points in its order and give any verses left out to ' +
        'them, then send the lesson again, whole.'
    );
}

// Said when a reply came back empty in a conversation about an empty note:
// the server dropped a call it could not read, which a whole lesson nested
// in `changes` is (BN-61) -- and the flat one it reads.
export const NOTE_BLANK_DROPPED_NUDGE =
    '(Nothing arrived: a call that long could not be read as a change. ' +
    'Write the whole lesson as ONE owa_bible_note action "add" -- its ' +
    "`title`, and its `text` the lesson's lines -- and the window puts it " +
    'into the empty note.)';

// BN-67 (2026-11-10): the same drop, for a note with words in it --
// finishing a sermon of loose lines, the one long edit came back empty twice.
// Told only to send it in parts, the model sent the top of the note first
// and then named blocks by the numbers it had READ, which that first part
// had moved: points went under the big idea's heading. What an edit adds
// moves only the blocks AFTER it, so the parts go from the end up.
export const NOTE_DROPPED_NUDGE =
    '(Nothing arrived: a call that long could not be read as a change. ' +
    `Send it in two or three smaller ${NOTE_EDIT_TOOL_NAME} edits, a few ` +
    'places each, FROM THE END OF THE NOTE UP -- the places with the ' +
    'highest block numbers first -- so the numbers you read stay right for ' +
    'every edit after; each one with the hash the one before it answered.)';

// 2026-11-10: finishing a lesson whose points were three one-line bullets
// wrote each point out as a section of its own and left the three bullets
// under them, the same points twice. A point already there is expanded
// where it stands: its line made the point's heading, its words kept.
// BN-67 (2026-11-10, four partial sermons asked live): a model numbered
// each new block after the one it had just added, put "## " into a
// heading's words, left a point's one sentence as all it had, and wrote no
// passage where the note had none.
// A fix to a lesson -- a review's button pressed, or a change typed so --
// writes new words into it with none of the lesson's rules on the ask
// (BN-79, 2026-11-10: the blind readers found the fixes' own words adding
// what the passage does not say -- the lost sheep "scared and stuck" in
// prickly bushes, the crowd "a symbol of social walls" -- and a point added
// after the last, a second "3.", out of the passage's order).
export const NOTE_LESSON_CHANGE_HINT =
    '(Their note is a lesson to preach: write this change from the passage ' +
    'as read with owa_find_verse -- no feeling, motive, place, detail or ' +
    'symbol it does not give, every quote word for word -- and a point ' +
    "added goes where its verses fall in the passage's order, the points " +
    'after it numbered on in the same edit.)';

// Words that ask for a block to move, or to go (BN-80).
const LESSON_MOVE_ASK_PATTERN =
    /\b(?:move|swap|reorder|put\b.*\b(?:before|after|above|below))\b/i;
const LESSON_REMOVE_ASK_PATTERN =
    /\b(?:remove|delete|take (?:out|away)|cut|drop|replace|shorten|shorter|fewer|merge|combine)\b/i;

/**
 * Why a fix to their lesson is refused, or null: it moves or takes out a
 * block their words did not ask to move or take out (BN-80). A small model
 * renumbering by moving blocks lost track of them -- a point's verses went
 * under the point before, a heading of the lesson went for good -- where
 * adding the new blocks in their place and rewording the numbers keeps it.
 */
export function findLessonChangeSurgery(args: any, typed: string) {
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    const moved = changes.filter((change) => {
        return (
            Number.isInteger(change?.block) &&
            change?.after !== undefined &&
            change?.remove !== true
        );
    });
    const removed = changes.filter((change) => {
        return Number.isInteger(change?.block) && change?.remove === true;
    });
    const isMoveAsked = LESSON_MOVE_ASK_PATTERN.test(typed);
    const isRemoveAsked = LESSON_REMOVE_ASK_PATTERN.test(typed);
    const named = [
        ...(isMoveAsked ? [] : moved),
        ...(isRemoveAsked ? [] : removed),
    ].map((change) => change.block);
    if (named.length === 0) {
        return null;
    }
    return (
        'Nothing was changed: this fix adds to their lesson and rewords it -- ' +
        `it moves or takes out no block of it (this named block${
            named.length === 1 ? '' : 's'
        } ${[...new Set(named)].slice(0, 8).join(', ')}). Put each new block ` +
        'where it goes with `after` (numbers as read), give the points after ' +
        'it their new numbers by changing their words, and send it again.'
    );
}

/**
 * A new lesson's adds into an EMPTY note numbered as they will stand, put
 * in the order given (BN-268, 2026-11-14, batch NI's children's Daniel 3):
 * the model gave its adds `after` 0, 1 … 9, then 11 … 34 -- one number
 * skipped -- the chain of adds (`chainSectionAdds`, one up at a time) broke
 * at the gap, every `after` past it named a block an empty note does not
 * have, and the whole lesson was refused; the retries then met the acting
 * limit and nothing was written. In an empty note of `blankCount` blocks,
 * adds whose `after` never goes down and reaches past the note can only be
 * the lesson in order: each is given the first one's `after`. Adds that
 * name blocks the note has are left as sent.
 */
export function withBlankFillInOrder(args: any, blankCount: number) {
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    const addList = changes.filter((change) => {
        return (
            change?.block === undefined &&
            Number.isInteger(change?.after) &&
            change.after >= 0
        );
    });
    if (addList.length < 2) {
        return args;
    }
    const afterList = addList.map((change) => change.after as number);
    const isRising = afterList.every((after, index) => {
        return index === 0 || after >= afterList[index - 1];
    });
    if (!isRising || Math.max(...afterList) <= blankCount) {
        return args;
    }
    const first = afterList[0];
    const addSet = new Set(addList);
    return {
        ...args,
        changes: changes.map((change) => {
            return addSet.has(change) ? { ...change, after: first } : change;
        }),
    };
}

// A hearer's question as the lesson shape writes it
// (`PREACHING_LESSON_SHAPE`), the line answering it the block right under
// -- its label bold or not (BN-263, batch NF: the three questions rewritten
// alone came as "A hearer asks: …", and went through).
const HEARER_QUESTION_PATTERN = /^\s*(?:\*\*)?A hearer asks:/i;

// A point's labels as the lesson shape writes them, at the start of a line
// with no bold (BN-263): the model's own edits after the first write wrote
// them so ("A hearer asks: What happened when Jesus entered the city?"),
// and the blind readers marked the form down for it.
const LESSON_PLAIN_LABEL_PATTERN =
    /^([ \t]*)(What it means|A hearer asks|The passage answers|For example|This week):[ \t]*/gim;

// The point labels, as the lesson shape writes them.
const LESSON_LABEL_LIST = [
    'What it means',
    'A hearer asks',
    'The passage answers',
    'For example',
    'This week',
] as const;
const LESSON_LABEL_START_PATTERN =
    /^\s*(?:\*\*)?(What it means|A hearer asks|The passage answers|For example|This week):/i;

export type LessonReadBlockType = { n: number; text: string };

/** The blocks an `owa_note_edit` read answered, or null (BN-265). */
export function readNoteReadBlocks(
    resultText: string,
): LessonReadBlockType[] | null {
    try {
        const blocks = JSON.parse(String(resultText ?? ''))?.blocks;
        if (!Array.isArray(blocks)) {
            return null;
        }
        return blocks
            .filter((block: any) => {
                return Number.isInteger(block?.n);
            })
            .map((block: any) => {
                return { n: block.n as number, text: String(block.text ?? '') };
            });
    } catch {
        return null;
    }
}

/**
 * `args` with the label a block had kept, where a change gives the block's
 * line new words with no label (BN-265, 2026-11-13, batch NG's Palm Sunday:
 * "**A hearer asks:** …" rewritten as a bare "Why did Jesus cast out those
 * selling …?", its answer left -- BN-259's case, unseen with no label).
 * `readBlocks` is the note as last read, with no write since.
 */
export function withLessonLabelsKept(
    args: any,
    readBlocks: readonly LessonReadBlockType[] | null,
) {
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    if (readBlocks === null || changes.length === 0) {
        return args;
    }
    const labelMap = new Map<number, string>();
    for (const block of readBlocks) {
        const label = LESSON_LABEL_START_PATTERN.exec(block.text)?.[1];
        const shown = LESSON_LABEL_LIST.find((one) => {
            return one.toLowerCase() === label?.toLowerCase();
        });
        if (shown !== undefined) {
            labelMap.set(block.n, shown);
        }
    }
    let isChanged = false;
    const keptList = changes.map((change) => {
        const label = labelMap.get(change?.block);
        if (
            label === undefined ||
            change?.after !== undefined ||
            change?.remove === true ||
            !(change?.kind === undefined || change?.kind === 'paragraph') ||
            typeof change?.text !== 'string' ||
            change.text.trim() === '' ||
            change.text.includes('\n') ||
            LESSON_LABEL_START_PATTERN.test(change.text)
        ) {
            return change;
        }
        isChanged = true;
        return { ...change, text: `**${label}:** ${change.text.trim()}` };
    });
    return isChanged ? { ...args, changes: keptList } : args;
}

/**
 * `args` with each change's point labels in bold where a line starts with
 * one written plain -- for an edit in a lesson ask only, "For example:"
 * being words of any note (BN-263).
 */
export function withLessonLabelsBold(args: any) {
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    if (
        !changes.some((change) => {
            LESSON_PLAIN_LABEL_PATTERN.lastIndex = 0;
            return (
                typeof change?.text === 'string' &&
                LESSON_PLAIN_LABEL_PATTERN.test(change.text)
            );
        })
    ) {
        return args;
    }
    return {
        ...args,
        changes: changes.map((change) => {
            if (typeof change?.text !== 'string') {
                return change;
            }
            return {
                ...change,
                text: change.text.replace(
                    LESSON_PLAIN_LABEL_PATTERN,
                    (_whole: string, indent: string, label: string) => {
                        return `${indent}**${label}:** `;
                    },
                ),
            };
        }),
    };
}

/**
 * Why an edit to a lesson is refused, or null: it gives a hearer's question
 * new words and leaves the answer under it as it was (BN-259, 2026-11-13).
 * Read blind, the craft slip both readers named most was a "The passage
 * answers" line that does not answer its question -- "What does Abraham say
 * when Isaac asks where the lamb is?" over "Yes, because he trusted the
 * character of God". The first draft's pairs had matched ("Why did Jesus
 * use a colt instead of a horse?" over "that it might be fulfilled"); the
 * model's own edit after it rewrote the three questions and none of their
 * answers -- 32 of 208 held-out lessons, with no word from the window
 * asking it to. The answer is sent with the question, or the question
 * stays.
 */
export function findHearerAnswerLeft(args: any) {
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    const changedBlockSet = new Set(
        changes
            .filter((change) => {
                return (
                    Number.isInteger(change?.block) &&
                    (typeof change?.text === 'string' ||
                        change?.remove === true)
                );
            })
            .map((change) => change.block),
    );
    const named = changes
        .filter((change) => {
            return (
                Number.isInteger(change?.block) &&
                change?.after === undefined &&
                change?.remove !== true &&
                typeof change?.text === 'string' &&
                HEARER_QUESTION_PATTERN.test(change.text) &&
                !changedBlockSet.has(change.block + 1)
            );
        })
        .map((change) => change.block as number);
    if (named.length === 0) {
        return null;
    }
    const questions = [...new Set(named)].slice(0, 6);
    const answers = questions.map((block) => block + 1);
    const isOne = questions.length === 1;
    return (
        `Nothing was changed: block${isOne ? '' : 's'} ` +
        `${questions.join(', ')} ${isOne ? 'is a' : 'are'} hearer's ` +
        `question${isOne ? '' : 's'}, and the block under each ` +
        `(${answers.join(', ')}) the answer written for it -- this edit ` +
        'gives the question new words and leaves its answer as it was, and ' +
        'the old answer under a new question answers nothing it asks. Send ' +
        'the edit again with each answer block too, written to answer its ' +
        'new question from the verses as read (or with its own words, where ' +
        'they already answer it), or leave the question as it was.'
    );
}

/**
 * Why an edit to a lesson is refused, or null: it writes a statement over a
 * hearer's question (BN-280, 2026-11-14). Three lessons of the held-out
 * batches lost every question they had in ONE later edit -- "**A hearer
 * asks:** Why was Esther so afraid to go to the king?" became "The verses
 * say that Esther had not been called … for thirty days" -- most likely
 * told by the second look that the question took for granted what the
 * verses do not say; each "The passage answers" line was left answering
 * nothing, and the readers marked the points down. A question asked another
 * way goes in; a statement over it does not.
 */
export function findHearerQuestionTurned(
    args: any,
    readBlocks: readonly LessonReadBlockType[] | null,
) {
    if (readBlocks === null) {
        return null;
    }
    const readMap = new Map(
        readBlocks.map((block) => {
            return [block.n, block.text];
        }),
    );
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    const turned = changes.filter((change) => {
        return (
            Number.isInteger(change?.block) &&
            change?.after === undefined &&
            change?.remove !== true &&
            typeof change?.text === 'string' &&
            (change?.kind === undefined || change?.kind === 'paragraph') &&
            HEARER_QUESTION_PATTERN.test(readMap.get(change.block) ?? '') &&
            !change.text.includes('?')
        );
    });
    if (turned.length === 0) {
        return null;
    }
    const blockList = [
        ...new Set(turned.map((change) => change.block as number)),
    ].slice(0, 6);
    const isOne = blockList.length === 1;
    const first = String(readMap.get(blockList[0]) ?? '')
        .replace(/\*\*/g, '')
        .trim()
        .slice(0, 160);
    return (
        `Nothing was changed: block${isOne ? '' : 's'} ` +
        `${blockList.join(', ')} ${isOne ? 'is a' : 'are'} hearer's ` +
        `question${isOne ? '' : 's'} ("${first}"), and this edit writes a ` +
        `statement over ${isOne ? 'it' : 'them'}, leaving the "The passage ` +
        'answers" line under each answering nothing. Give each a question a ' +
        'hearer would ask that the passage answers, kept as "**A hearer ' +
        'asks:** …?" -- where the old one took for granted what the verses ' +
        'do not say, ask it another way -- or leave it as it was, and send ' +
        'the edit again.'
    );
}

export type FinishOwnBlockType = { n: number; words: string };

const NOTE_VERSE_TOKEN_TEXT_PATTERN = /\[\^[^\]\n]*\]/g;

/**
 * Their own blocks in a lesson to finish in place, as the ask carries them
 * -- each block with words, a passage aside -- or null for any other ask
 * (BN-223).
 */
export function readFinishOwnBlocks(
    asked: string,
): FinishOwnBlockType[] | null {
    if (!String(asked ?? '').includes(NOTE_LESSON_FINISH_HINT)) {
        return null;
    }
    // The note's last line closes the ask's own bracket after its words.
    const noteLines = asked.replace(/"\)[ \t]*$/gm, '"');
    const blocks = readNoteBlockLines(noteLines).flatMap((block) => {
        const words = block.words
            .replace(NOTE_VERSE_TOKEN_TEXT_PATTERN, ' ')
            .trim();
        if (block.kind === 'passage' || block.isFixed || words === '') {
            return [];
        }
        return [{ n: block.n, words }];
    });
    return blocks.length > 0 ? blocks : null;
}

/**
 * Why a finish is refused, or null: it rewrites one of their own blocks into
 * other words, or takes it out (BN-223, 2026-11-13, a finish ask: the
 * preacher's introduction, "Have you ever been told to stop asking for
 * help?", was written over with the model's own scene -- the lesson shape
 * says an introduction never opens so, a rule for the model's words, not
 * theirs). A heading of theirs given its number keeps its words, and passes.
 */
export function findFinishOwnWordsLoss(
    args: any,
    ownBlocks: readonly FinishOwnBlockType[],
) {
    const changes: any[] = Array.isArray(args?.changes) ? args.changes : [];
    const lost = changes.flatMap((change) => {
        if (!Number.isInteger(change?.block)) {
            return [];
        }
        const own = ownBlocks.find((block) => block.n === change.block);
        if (own === undefined) {
            return [];
        }
        if (change.remove === true) {
            return [own];
        }
        if (
            typeof change.text === 'string' &&
            findLostNoteLines([own.words], change.text).length > 0
        ) {
            return [own];
        }
        return [];
    });
    if (lost.length === 0) {
        return null;
    }
    const named = lost
        .slice(0, 4)
        .map((own) => `block ${own.n}, ${JSON.stringify(own.words)}`)
        .join('; ');
    return (
        'Nothing was changed: finishing keeps their own words as they are, ' +
        `and this edit writes over or takes out ${named}. Keep each as ` +
        'written -- a heading of theirs may become "1. " and its own words ' +
        '-- put what you write AFTER it with `after`, and send the whole ' +
        'edit again.'
    );
}

export const NOTE_LESSON_FINISH_HINT =
    '(This asks to make their lesson whole IN this note, in ONE edit: the ' +
    'parts of WHAT A LESSON HOLDS it lacks added where they belong, their ' +
    'own words kept as they are, nothing removed or written twice. A block ' +
    'number is the note AS YOU READ IT -- what you add never renumbers ' +
    'anything -- so give each place ONE add: {after: n, kind: "section", ' +
    'text: every line that goes after block n, as mark-up}. With no ' +
    'passage printed yet, the first is {after: 0, kind: "section"} opening ' +
    'with the passage token alone on its line. A point of theirs -- a ' +
    'heading, a list item or a line -- stays where it is and becomes that ' +
    'point: {block: n, kind: "h2", text: "1. " and its own words}, then ' +
    'one section after it with its [^ref], what it means, an example from ' +
    'life and how to live it this week, even when it has a sentence of its ' +
    `own. ${PREACHING_LESSON_SHAPE})`;

// 2026-11-10: "it is too long, make it fit 15 minutes" took out every
// example and every "this week" -- what makes a lesson one to preach --
// and kept a second hymn.
export const NOTE_LESSON_SHORTEN_HINT =
    '(This asks to make their lesson shorter, in ONE edit: keep its shape ' +
    '-- the passage, the big idea, each point with its verse, ONE example ' +
    'and how to live it, the response and the prayer -- and shorten by ' +
    'tightening their words ({block, text}, fewer sentences) and taking out ' +
    "extras first: a second illustration, cross references, a children's " +
    'part, extra questions. About 130 spoken words a minute; say how long ' +
    'it runs now.)';

// The parts of WHAT A LESSON HOLDS, by the English words a heading names
// them with; a numbered heading is a point, never one of these.
const LESSON_PART_PATTERN_LIST: readonly [string, RegExp][] = [
    ['Big idea', /\b(?:big|main|central) idea\b/i],
    ['Background', /\bbackground\b|\bsetting\b|\bcontext\b/i],
    ['Introduction', /\bintroduction\b/i],
    [
        'Pointing to Jesus',
        /\bpoint(?:s|ing)? to (?:jesus|christ)\b|\bgospel\b|\bjesus in\b/i,
    ],
    ['Response', /\brespon(?:se|d)\b|\binvitation\b|\bapplication\b/i],
    ['Closing prayer', /\bprayer\b/i],
    ['Questions for discussion', /\bquestions?\b|\bdiscussion\b/i],
    ['Memory verse', /\bmemory\b/i],
];
const NOTE_BLOCK_LINE_PATTERN =
    /^\s*(\d+)\.\s+([\w-]+)(?: \[[ x]\])?( \(fixed\))?[^:\n]*?(?::\s+(".*"))?\s*$/;
const POINT_HEADING_PATTERN = /^\s*(?:\*\*)?\s*(\d+)[.)]/;

function readNoteBlockLines(text: string) {
    return text.split('\n').flatMap((line) => {
        const match = NOTE_BLOCK_LINE_PATTERN.exec(line);
        if (match === null) {
            return [];
        }
        let words: string;
        try {
            words = match[4] === undefined ? '' : String(JSON.parse(match[4]));
        } catch (_error) {
            words = match[4] ?? '';
        }
        return [
            {
                n: Number(match[1]),
                kind: match[2],
                isFixed: match[3] !== undefined,
                words,
            },
        ];
    });
}

/**
 * Whether a note as read is a lesson already: two numbered points, two of
 * a lesson's parts named, or a passage printed with a numbered point --
 * what "finish it" can be said of (BN-67). A note of reminders or prayer
 * requests is none.
 */
export function checkIsLessonNoteText(text: string | null) {
    if (text === null) {
        return false;
    }
    const blocks = readNoteBlockLines(text);
    const headings = blocks.filter((block) => /^h[1-6]$/.test(block.kind));
    const pointCount = headings.filter((block) => {
        return POINT_HEADING_PATTERN.test(block.words);
    }).length;
    const partCount = LESSON_PART_PATTERN_LIST.filter(([, pattern]) => {
        return headings.some((block) => {
            return (
                !POINT_HEADING_PATTERN.test(block.words) &&
                pattern.test(block.words)
            );
        });
    }).length;
    const hasPassage = blocks.some((block) => block.kind === 'passage');
    return pointCount >= 2 || partCount >= 2 || (hasPassage && pointCount >= 1);
}

// The parts before the points and after them, in the order WHAT A LESSON
// HOLDS gives: Big idea, Background, Introduction, the points, then the rest.
const LESSON_POINTS_ORDER = 3;

export type LessonPartsGapType = { after: number; names: string[] };

/**
 * The parts a new lesson's first write left out, grouped by the block each
 * goes after (BN-197, ab54: shape56's children's lost sheep was written to
 * its memory verse with no Pointing to Jesus, response, prayer or
 * questions). Only a note that reads as a lesson -- a point and three of
 * the named parts -- is held to it.
 */
export function findMissingLessonParts(
    blocks: readonly { n: number; kind: string; text: string }[],
): LessonPartsGapType[] {
    const headings = blocks.filter((block) => /^h[1-6]$/.test(block.kind));
    const pointList = headings.filter((block) => {
        return POINT_HEADING_PATTERN.test(block.text);
    });
    const presentMap = new Map<number, number>();
    for (const heading of headings) {
        if (POINT_HEADING_PATTERN.test(heading.text)) {
            continue;
        }
        const index = LESSON_PART_PATTERN_LIST.findIndex(([, pattern]) => {
            return pattern.test(heading.text);
        });
        if (index >= 0 && !presentMap.has(index)) {
            presentMap.set(index, heading.n);
        }
    }
    if (pointList.length === 0 || presentMap.size < 3) {
        return [];
    }
    const lastN = blocks.at(-1)?.n ?? 0;
    const firstPointN = pointList[0].n;
    const gapList: LessonPartsGapType[] = [];
    LESSON_PART_PATTERN_LIST.forEach(([name], index) => {
        if (presentMap.has(index)) {
            return;
        }
        // Before the next part of its side that is there: a part before the
        // points goes before the first point at the latest.
        const end =
            index < LESSON_POINTS_ORDER
                ? LESSON_POINTS_ORDER
                : LESSON_PART_PATTERN_LIST.length;
        let after = index < LESSON_POINTS_ORDER ? firstPointN - 1 : lastN;
        for (let next = index + 1; next < end; next++) {
            const n = presentMap.get(next);
            if (n !== undefined) {
                after = n - 1;
                break;
            }
        }
        const gap = gapList.find((item) => item.after === after);
        if (gap === undefined) {
            gapList.push({ after, names: [name] });
        } else {
            gap.names.push(name);
        }
    });
    return gapList;
}

/** What the model is told under a new lesson that left parts out. */
export function genMissingLessonPartsNote(
    gapList: readonly LessonPartsGapType[],
) {
    const nameList = gapList.flatMap((gap) => gap.names);
    const placeList = gapList.map((gap) => {
        return (
            `after block ${gap.after}${gap.after === 0 ? ' (the top)' : ''}: ` +
            gap.names.join(', then ')
        );
    });
    return (
        `(The lesson is written, but it lacks ${nameList.join('; ')}. Add ` +
        `them with ONE more edit -- ${placeList.join('; ')} -- each a "## " ` +
        'heading with its lines as WHAT A LESSON HOLDS gives them, every ' +
        'other block as it is now -- then answer.)'
    );
}

function toLessonPartOrder(partIndex: number) {
    return partIndex < LESSON_POINTS_ORDER ? partIndex : partIndex + 1;
}

/**
 * What a lesson attached to a _finish my sermon_ still lacks, and WHERE
 * each goes, read by the window off the note as read (2026-11-10, BN-67).
 * Told only to add "the parts it lacks", gemma4:cloud added the closing
 * parts to a sermon whose three points were one line each and left them
 * so, with no background; told the parts, it put the Introduction after the
 * points and each point's own line under its new words. So every part
 * missing is named with the block it goes after -- the end of the part
 * before it in that order, a point's own last line for its words -- one
 * place a line, in the order the adds go. The parts are read by their
 * English names only when the note names some of them so: a lesson headed
 * in another language is told only its passage and its points. A note with
 * no numbered point is told what it lacks, its points being its own lines
 * to make into points. Null when nothing is found missing.
 */
export function genLessonGapsText(text: string | null) {
    if (text === null) {
        return null;
    }
    const blocks = readNoteBlockLines(text);
    if (blocks.length === 0) {
        return null;
    }
    type SectionType = {
        point: string | null;
        partIndex: number;
        lastN: number;
        lineCount: number;
        wordCount: number;
    };
    const sections: SectionType[] = [];
    let topLastN = 0;
    for (const block of blocks) {
        if (/^h[1-6]$/.test(block.kind)) {
            const point = POINT_HEADING_PATTERN.exec(block.words);
            sections.push({
                point: point === null ? null : point[1],
                partIndex:
                    point === null
                        ? LESSON_PART_PATTERN_LIST.findIndex(([, pattern]) => {
                              return pattern.test(block.words);
                          })
                        : -1,
                lastN: block.n,
                lineCount: 0,
                wordCount: 0,
            });
            continue;
        }
        const section = sections.at(-1);
        if (section === undefined) {
            topLastN = block.n;
            continue;
        }
        section.lastN = block.n;
        section.lineCount += 1;
        section.wordCount += block.words.split(/\s+/).filter(Boolean).length;
    }
    const named = sections.filter((section) => section.point === null);
    const presentSet = new Set(
        named.map((section) => section.partIndex).filter((index) => index >= 0),
    );
    const isNamedInEnglish = presentSet.size >= Math.min(2, named.length);
    const missingList = isNamedInEnglish
        ? LESSON_PART_PATTERN_LIST.map(([name], index) => {
              return { name, index };
          }).filter(({ index }) => !presentSet.has(index))
        : [];
    const hasPassage = blocks.some((block) => block.kind === 'passage');
    const points = sections.filter((section) => section.point !== null);
    const itemBlocks = blocks.filter((block) => {
        return block.kind === 'bullet' || block.kind === 'number';
    });
    // An outline with no heading whose points are list items (BN-67: three
    // points as a list, the frame came out at the top and the points after
    // the memory verse): each item its point, made a heading where it is.
    if (sections.length === 0 && itemBlocks.length >= 2) {
        const firstIndex = blocks.indexOf(itemBlocks[0]);
        const topN = firstIndex > 0 ? blocks[firstIndex - 1].n : 0;
        const lastN = (itemBlocks.at(-1) as (typeof blocks)[number]).n;
        const lines = [
            `after block ${topN}${topN === 0 ? ' (the top)' : ''}: ` +
                [
                    ...(hasPassage
                        ? []
                        : ['the main passage, its token alone on its line']),
                    ...LESSON_PART_PATTERN_LIST.slice(
                        0,
                        LESSON_POINTS_ORDER,
                    ).map(([name]) => name),
                ].join(', then '),
            ...itemBlocks.map((item, index) => {
                const tail =
                    item.n === lastN
                        ? LESSON_PART_PATTERN_LIST.slice(
                              LESSON_POINTS_ORDER,
                          ).map(([name]) => `, then ${name}`)
                        : [];
                return (
                    `after block ${item.n}: point ${index + 1} -- block ` +
                    `${item.n} itself made {kind: "h2", text: "${index + 1}. " ` +
                    'and its own words} -- its verse token, what it means, ' +
                    'an example from life and how to live it this week' +
                    tail.join('')
                );
            }),
        ];
        return (
            '(Where each missing part goes, by the note as read -- one add a ' +
            `place: ${lines.join('; ')}.)`
        );
    }
    if (points.length === 0) {
        const gaps = [
            ...(hasPassage ? [] : ['the main passage printed first']),
            ...missingList.map(({ name }) => name),
        ];
        return gaps.length === 0
            ? null
            : `(What the window found in it, to work down -- it lacks: ${gaps.join('; ')}.)`;
    }
    const placeList = [
        ...named
            .filter((section) => section.partIndex >= 0)
            .map((section) => {
                return {
                    order: toLessonPartOrder(section.partIndex),
                    lastN: section.lastN,
                };
            }),
        {
            order: LESSON_POINTS_ORDER,
            lastN: (points.at(-1) as SectionType).lastN,
        },
    ];
    const anchorOf = (order: number) => {
        const before = placeList
            .filter((place) => place.order < order)
            .sort((a, b) => b.order - a.order)[0];
        return before === undefined ? topLastN : before.lastN;
    };
    const placeMap = new Map<number, string[]>();
    const put = (after: number, words: string) => {
        placeMap.set(after, [...(placeMap.get(after) ?? []), words]);
    };
    if (!hasPassage) {
        put(0, 'the main passage, its token alone on its line');
    }
    for (const point of points) {
        if (point.lineCount < 2 && point.wordCount < 40) {
            put(
                point.lastN,
                `point ${point.point}'s verse token if it has none, what it ` +
                    'means, an example from life and how to live it this week',
            );
        }
    }
    for (const { name, index } of missingList) {
        put(anchorOf(toLessonPartOrder(index)), name);
    }
    if (placeMap.size === 0) {
        return null;
    }
    const lines = [...placeMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([after, list]) => {
            return `after block ${after}${after === 0 ? ' (the top)' : ''}: ${list.join(', then ')}`;
        });
    return (
        '(Where each missing part goes, by the note as read -- one add a ' +
        `place: ${lines.join('; ')}.)`
    );
}

// BN-66 (2026-11-10): what blind readers of 38 lessons held against the
// textbooks' standard marked down most -- a claim the passage does not make,
// a verse only restated, a stock picture, points that stop before the
// passage does, Christ added at the end, a response that does not gather --
// is what a review names, in that order of weight, so that "is this a good
// sermon?" and its buttons are the way from a good lesson to the best one.
export const NOTE_LESSON_REVIEW_HINT =
    '(This asks what you think of their lesson: judge it as a teacher of ' +
    'preaching would, against WHAT A LESSON HOLDS. Read its passage with ' +
    'owa_find_verse first when you have it. Weigh, in this order: is every ' +
    'word about the passage true to it and every quote its own words; one ' +
    'big idea; points that follow the WHOLE passage; each verse explained, ' +
    'not only restated; a concrete example for each point; something to do ' +
    'this week; Christ grown from the passage, not added; a response that ' +
    "gathers the big idea. A devotion keeps its ONE point and a children's " +
    'lesson its story told: a fix for them adds to that point or that story, ' +
    'never another point. Say what is strong, then the two or three things ' +
    'that would most improve it, naming the part by its heading; change ' +
    'nothing, and END with them as OPTIONS, a short button each (under 40 ' +
    'letters) that SAYS the change it makes to the note, opening on Add, ' +
    'Write, Move or Make -- e.g. "OPTIONS: Add a point on the good soil | ' +
    `Add what verse 19 means to point 1". ${PREACHING_LESSON_SHAPE})`;

// A block line of the note read with words or a fixed object in it:
// `3. paragraph: "Grace"`, `4. passage (fixed)`; and one with neither,
// `1. paragraph` (`toBlockLine`).
const NOTE_FILLED_BLOCK_LINE_PATTERN =
    /^\s*\d+\.\s+\S[^:\n]*?(?:\(fixed\)|: ")/;
const NOTE_EMPTY_BLOCK_LINE_PATTERN = /^\s*\d+\.\s+[\w-]+(?: \[[ x]\])?\s*$/;

/**
 * Whether a note as read holds nothing -- no words, no object -- said by
 * the read itself: `(the note is empty …)` or only empty block lines.
 */
export function checkIsBlankNoteText(text: string | null) {
    if (text === null) {
        return false;
    }
    const lines = text.split('\n');
    return (
        !lines.some((line) => NOTE_FILLED_BLOCK_LINE_PATTERN.test(line)) &&
        lines.some((line) => {
            return (
                line.startsWith('(the note is empty') ||
                NOTE_EMPTY_BLOCK_LINE_PATTERN.test(line)
            );
        })
    );
}

// The empty note card's buttons (BN-64), in English: a press asks the words
// as the window shows them, which `checkIsLessonCardAsk` reads either way --
// a Gemma 4 is asked in the person's language, where no English reader sees.
const LESSON_CARD_ASK_LIST = [
    'Help me prepare a preaching lesson',
    "Help me prepare a children's lesson",
    'Help me prepare a short devotion',
];

/** The empty note card's buttons, as the window shows them. */
function genLessonCardReplies() {
    return [
        tran('Help me prepare a preaching lesson'),
        tran("Help me prepare a children's lesson"),
        tran('Help me prepare a short devotion'),
    ];
}

/** Whether a line is a press of the empty note card's lesson buttons. */
export function checkIsLessonCardAsk(text: string) {
    const line = String(text ?? '').trim();
    return (
        line !== '' &&
        [...LESSON_CARD_ASK_LIST, ...genLessonCardReplies()].includes(line)
    );
}

// --- the form a lesson was asked for (BN-78) --------------------------------
//
// 2026-11-10: a short devotion, asked for by the card's button, was reviewed
// as a sermon -- _is this a good sermon?_ named no form, the note neither --
// and its first fix was _Add points for verses 4-6_, the one point a
// devotion keeps undone. The tab's own earlier ask says what it is.
export type LessonFormType = 'devotion' | 'children' | 'short';

const DEVOTION_ASK_PATTERN = /\bdevotion(?:al)?s?\b/i;
const CHILDREN_ASK_PATTERN =
    /\b(?:children'?s?|child'?s|kids?'?|sunday school|youth group)\b/i;
// A short message asked for in so many words (BN-258, 2026-11-13, the
// fourth held-out read ab90: "a short message for a baptism service" was
// written as a full three-point sermon of ~1 000 words in both batches, and
// a reader marked its length and its points down). A length in minutes
// says it its own way (`genLessonLengthLine`).
const SHORT_ASK_PATTERN =
    /\b(?:short|brief|quick)\s+(?:message|sermon|talk|word|homily|meditation|exhortation)\b/i;

/** The form an ask for a lesson names, or null for a sermon or none. */
export function readLessonFormAsked(text: string): LessonFormType | null {
    const line = String(text ?? '').trim();
    const cardIndex = [LESSON_CARD_ASK_LIST, genLessonCardReplies()]
        .map((list) => list.indexOf(line))
        .find((index) => index >= 0);
    if (cardIndex !== undefined) {
        return cardIndex === 1
            ? 'children'
            : cardIndex === 2
              ? 'devotion'
              : null;
    }
    if (!checkIsLessonWriteAsk(line) && !checkIsLanguageLessonAsk(line)) {
        return null;
    }
    if (DEVOTION_ASK_PATTERN.test(line)) {
        return 'devotion';
    }
    if (CHILDREN_ASK_PATTERN.test(line)) {
        return 'children';
    }
    return SHORT_ASK_PATTERN.test(line) &&
        !/\b\d{1,2}[ -]?(?:minutes?|mins?)\b/i.test(line)
        ? 'short'
        : null;
}

/** Said with a review of a lesson asked for in another form than a sermon. */
export function genLessonFormLine(form: LessonFormType) {
    if (form === 'short') {
        return (
            '(It was asked for as a short message: judge it as one -- two ' +
            'points at most, every part short -- and a fix adds to a point, ' +
            'never another.)'
        );
    }
    return form === 'devotion'
        ? '(It was asked for as a short devotion: judge it as one -- its ONE ' +
              'point covering the whole passage -- and a fix adds to that ' +
              'point, never another.)'
        : "(It was asked for as a children's lesson: judge it as one -- the " +
              'story told, two points a child can hold, a memory verse a ' +
              "child can say -- and a fix keeps a child's words.)";
}

/**
 * Said with a lesson WRITTEN in another form than a sermon (BN-94,
 * 2026-11-11). The empty note card's "short devotion", then a passage
 * pressed, had been written as a three-point sermon of 1100 words in two
 * runs of two: the passage pressed names no form, and the line above went
 * to a review or a finish alone.
 */
export function genLessonFormWriteLine(form: LessonFormType) {
    // BN-125 (2026-11-11): said last, these words win over the shape's --
    // "a memory verse of one short line" here, twenty words there, and the
    // children's lessons took Luke 15:7 (28 words) and Jonah 2:9 (24); the
    // devotions printed their psalm again under their one point.
    if (form === 'short') {
        return (
            '(It was asked for as a short message: write it as one -- every ' +
            'part short, TWO points at most, each with its verses, a What it ' +
            'means of two or three sentences, one hearer question and its ' +
            'answer, and This week; one example in the whole message, about ' +
            '600 words in all; never three points.)'
        );
    }
    return form === 'devotion'
        ? '(It was asked for as a short devotion: write it as one -- every ' +
              'part short and ONE point that walks the whole passage ' +
              'movement by movement, no passage printed under it again, its ' +
              'What it means a line for each movement opening with its ' +
              'verses as a token, one example and a Response with a clear ' +
              'call, about 450 words in all; never three points.)'
        : "(It was asked for as a children's lesson: write it as one -- the " +
              'story told in short sentences under its own heading, two ' +
              'points a child can hold, something to show, and a memory verse ' +
              'a child can say: ONE verse of twenty words at most, from the ' +
              'story or elsewhere in Scripture.)';
}

/**
 * Whether a note attachment holds nothing -- its text, read off the file,
 * is its title line alone (`genNoteAttachment`): the card a lesson's.
 */
export function checkIsEmptyNoteAttachment(attachment: ChatAttachmentType) {
    if (
        !checkIsNoteAttachment(attachment) ||
        typeof attachment.summary !== 'string'
    ) {
        return false;
    }
    // Read off the file, a note with no words is its title line and the
    // empty body's marker (seen live 2026-11-10: the card had looked for the
    // title line alone and never offered a lesson).
    const head = `Note: ${attachment.name}`;
    const summary = attachment.summary.trimEnd();
    return (
        summary.endsWith(head) ||
        summary.endsWith(`${head}\n${EMPTY_NOTE_BODY}`)
    );
}

/**
 * How many blocks a blank note read holds (0 for none), or null when the
 * note holds anything: what the window takes out when a lesson fills it.
 */
export function readBlankNoteBlockCount(text: string | null) {
    if (!checkIsBlankNoteText(text)) {
        return null;
    }
    const count = /^Blocks: (\d+)/.exec(text ?? '');
    return count === null ? 0 : Number(count[1]);
}

/**
 * A NEW note a model asked for in a conversation about an EMPTY note,
 * written into that note instead: one `owa_note_edit` edit that gives it
 * the title, takes out its empty blocks and puts the words in as a
 * `section` -- a block a line, read as a new note's are. Null when the
 * call is not such an add (no words, another action).
 */
export function toBlankNoteFillArgs(
    args: any,
    noteName: string,
    blockCount: number,
) {
    if (
        args?.action !== 'add' ||
        typeof args?.text !== 'string' ||
        args.text.trim() === ''
    ) {
        return null;
    }
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    // A first line that only says the title again is the note's name
    // already, as a new note's is (`toNoteAddChanges`).
    const toLoose = (line: string) => {
        return line
            .replace(/[#*_~`>]/g, ' ')
            .replace(/^\s*title\s*:/i, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[\s:.]+$/, '')
            .trim()
            .toLowerCase();
    };
    const lines = args.text.replace(/\r\n?/g, '\n').split('\n');
    const firstIndex = lines.findIndex((line: string) => line.trim() !== '');
    const text =
        title !== '' && toLoose(lines[firstIndex] ?? '') === toLoose(title)
            ? lines.slice(firstIndex + 1).join('\n')
            : args.text;
    return {
        action: 'edit',
        note: noteName,
        ...(title === '' ? {} : { title }),
        changes: [
            ...Array.from({ length: blockCount }, (_, index) => {
                return { block: index + 1, remove: true };
            }),
            { after: 0, kind: 'section', text },
        ],
    };
}

/**
 * A new lesson's line that is one verse token and nothing else is that verse
 * printed whole (BN-112, 2026-11-11). Written as a section, a lesson's
 * memory verse on its own line was printed; written as a change of its own,
 * one verse stayed a chip, and the children's Jonah lesson's memory verse
 * read to both blind readers as "a bare reference with no words", in both
 * runs. Elsewhere one verse alone stays its chip: a key verse is often only
 * named. Only lines the change adds; a block it rewrites keeps its kind.
 */
export function toLessonVerseLines(args: any) {
    if (!Array.isArray(args?.changes)) {
        return args;
    }
    return {
        ...args,
        changes: args.changes.map((change: any) => {
            const isNewParagraph =
                change?.block === undefined &&
                (change?.kind === undefined || change?.kind === 'paragraph') &&
                typeof change?.text === 'string';
            const ref = isNewParagraph ? readPassageLineRef(change.text) : null;
            if (ref === null) {
                return change;
            }
            const { text: _text, ...rest } = change;
            return { ...rest, kind: 'passage', ref };
        }),
    };
}

// --- a translated note's verses from its language's Bible (BN-133) ------------
//
// 2026-11-11, the user: _when user ask to do translation the content
// chatbot should follow-up for the language's bible, e.g. I asked to
// translate the whole content into Khmer then bible of translated should
// into khmer bible_. The translation kept every [^…] token as it was, so a
// lesson put into Khmer kept its KJV verses, in English, chips and passages
// alike. A note whose words are REPLACED with another language now has its
// verses read from an installed Bible in that language -- by the window,
// never written by the model -- and, with none installed, is told so.

const NOTE_TRANSLATE_INTO_PATTERN =
    /\btranslat\w*\b([^.?!\n]{0,60}?)\b(?:into|to)\s+(\p{L}[\p{L}'-]*(?: \p{L}[\p{L}'-]*)??)(?=\s*(?:[.,!?;:]|$)|\s+(?:please|for|so|and|now)\b)/iu;
// "Translate the title into Khmer", "the prayer", "point 2": a PART put
// into the language, the rest of the note -- and its verses -- left as
// they are.
const NOTE_TRANSLATE_PART_PATTERN =
    /\b(?:title|headings?|lines?|blocks?|paragraphs?|points?|prayers?|questions?|sections?|sentences?|verses?|passages?|introduction|conclusion|bullets?|items?|parts?|first|second|third|last)\b/i;
// "Add it under", "keep the English": a translation beside the words keeps
// their Bible.
const NOTE_TRANSLATE_BESIDE_PATTERN =
    /\b(?:under|below|beneath|beside|alongside|next to|keep(?:ing)? the)\b/i;
// The note answer's own options for the way (NOTE_SYSTEM_PROMPT).
const NOTE_REPLACE_CHOICE_PATTERN = /^replace(?: the words| them)?\b/i;

/**
 * The language a note's words are REPLACED with, by its name -- a pressed
 * "Replace the words with Khmer", a typed "translate the whole content into
 * Khmer" -- or null: no translation, or one added beside the words.
 */
export function readNoteTranslateLanguageName(asked: string) {
    const text = String(asked ?? '').trim();
    const mode = readLyricTranslateMode(text);
    if (mode === 'under') {
        return null;
    }
    if (mode === 'replace') {
        return readTranslateLanguageName(text);
    }
    if (NOTE_TRANSLATE_BESIDE_PATTERN.test(text)) {
        return null;
    }
    const found = NOTE_TRANSLATE_INTO_PATTERN.exec(text);
    if (found === null || NOTE_TRANSLATE_PART_PATTERN.test(found[1])) {
        return null;
    }
    return found[2].trim();
}

/** Whether a line chooses the REPLACE way with no language of its own. */
export function checkIsNoteReplaceChoice(asked: string) {
    return NOTE_REPLACE_CHOICE_PATTERN.test(String(asked ?? '').trim());
}

/**
 * The installed Bible a translation into `langCode` reads its verses from,
 * off `owa_find_verse` with no arguments: the Lookup's own when it is in
 * that language, else the first whole one in it. Null when none is.
 */
export function pickTranslateBibleKey(listed: unknown, langCode: string) {
    const result = listed as {
        bible?: unknown;
        bibles?: { key?: unknown; locale?: unknown }[];
    } | null;
    const langBase = String(langCode ?? '')
        .toLowerCase()
        .split('-')[0];
    if (langBase === '') {
        return null;
    }
    const lookup = (Array.isArray(result?.bibles) ? result.bibles : []).find(
        (bible) => {
            return (
                typeof bible?.key === 'string' && bible.key === result?.bible
            );
        },
    );
    if (
        lookup !== undefined &&
        String(lookup.locale ?? '')
            .toLowerCase()
            .startsWith(langBase)
    ) {
        return lookup.key as string;
    }
    return pickBibleInLanguage(listed, null, langCode, true);
}

const NOTE_VERSE_TOKEN_REWRITE_PATTERN =
    /\[\^(?:\([^)\n]{1,24}\)\s*)?([^\]\n]+)\]/g;
// The block kinds a read gives as their own words (a table, a sticky or a
// drawing reads as a summary, and is never given its read back).
const NOTE_WORD_BLOCK_KIND_SET = new Set([
    'paragraph',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'bullet',
    'number',
    'check',
    'quote',
]);

/** Words with every verse token named `bibleKey`. */
export function toVerseTokensInBible(text: string, bibleKey: string) {
    return String(text ?? '').replace(
        NOTE_VERSE_TOKEN_REWRITE_PATTERN,
        (_token, ref: string) => {
            return `[^(${bibleKey}) ${ref.trim()}]`;
        },
    );
}

export type NoteReadBlockType = {
    n: number;
    kind: string;
    text: string;
    isTextCut?: boolean;
};

/**
 * A translation's edit with the note's verses read from `bibleKey`: every
 * verse token in its words named that Bible; every passage block not in it
 * re-read from it in its place (a change giving a passage words of its own
 * -- the model writing Scripture -- becomes that); a block of words with
 * verse chips the edit leaves alone given its own words back, its chips so
 * named. `blocks`: the note as read just before.
 */
export function withNoteVersesInBible(
    args: any,
    blocks: readonly NoteReadBlockType[],
    bibleKey: string,
) {
    if (!Array.isArray(args?.changes)) {
        return args;
    }
    const passageRefMap = new Map<number, string>();
    for (const block of blocks) {
        const head = String(block.text ?? '').split(' — ')[0];
        const ref = head.replace(LESSON_BIBLE_PREFIX_PATTERN, '').trim();
        if (
            block.kind === 'passage' &&
            ref !== '' &&
            !head.startsWith(`(${bibleKey})`)
        ) {
            passageRefMap.set(block.n, ref);
        }
    }
    const toRepoint = (block: number) => {
        return { block, ref: `(${bibleKey}) ${passageRefMap.get(block)}` };
    };
    const touched = new Set<number>();
    const changes: any[] = args.changes.map((change: any) => {
        const block = change?.block;
        const isOnBlock =
            typeof block === 'number' && change?.after === undefined;
        if (isOnBlock) {
            touched.add(block);
        }
        if (isOnBlock && change.remove !== true && passageRefMap.has(block)) {
            return toRepoint(block);
        }
        return typeof change?.text === 'string'
            ? { ...change, text: toVerseTokensInBible(change.text, bibleKey) }
            : change;
    });
    for (const block of blocks) {
        if (touched.has(block.n)) {
            continue;
        }
        if (passageRefMap.has(block.n)) {
            changes.push(toRepoint(block.n));
            continue;
        }
        const rekeyed = toVerseTokensInBible(block.text, bibleKey);
        if (
            NOTE_WORD_BLOCK_KIND_SET.has(block.kind) &&
            block.isTextCut !== true &&
            rekeyed !== block.text
        ) {
            changes.push({ block: block.n, text: rekeyed });
        }
    }
    return { ...args, changes, bible: bibleKey };
}

/** What the model is told when no Bible in the language is installed. */
export function genNoteTranslateNoBibleNote(languageName: string) {
    return (
        `(No ${languageName} Bible is installed here, so the note's verses ` +
        `stay in the Bible they were read from. Say so in a sentence, and ` +
        `that once a ${languageName} Bible is added to this app, asking ` +
        'again reads the verses from it.)'
    );
}

// --- a translated note is held to its language (BN-134) --------------------
//
// Seen live the day BN-133 was made (gemma4:cloud, "Translate all of it
// into Khmer, replace the English words"): the "Big idea" heading was left
// in English, and a Khmer line carried three Thai letters -- a word for
// "he" in Thai's royal register -- which a Khmer reader cannot read.

// A token, a link: words that are never the language's own.
const NOTE_TRANSLATE_SKIP_PATTERN = /\[[\^@#][^\]\n]*\]|https?:\/\/\S+/g;
const ENGLISH_LETTER_PATTERN = /[A-Za-z]/g;
// Fewer English letters than this is a name or an abbreviation, not words
// left untranslated.
const NOTE_ENGLISH_LEFT_MIN_LETTERS = 4;
const MAX_NOTE_TRANSLATE_LEFT_NAMED = 6;

function toNoteTranslateWords(text: unknown) {
    return String(text ?? '').replace(NOTE_TRANSLATE_SKIP_PATTERN, ' ');
}

function toOneTestPattern(pattern: RegExp) {
    return new RegExp(pattern.source, pattern.flags.replace('g', ''));
}

function checkIsLeftInEnglish(text: string, scriptPattern: RegExp) {
    const words = toNoteTranslateWords(text);
    return (
        (words.match(ENGLISH_LETTER_PATTERN)?.length ?? 0) >=
            NOTE_ENGLISH_LEFT_MIN_LETTERS &&
        !toOneTestPattern(scriptPattern).test(words)
    );
}

/**
 * The letters of a third script in words a translation writes, each once,
 * eight at most: neither Latin, nor the language's own script
 * (`scriptPattern`; for a language in Latin letters, the script most of the
 * words' letters are in), nor one the words had before -- a Greek word
 * kept. A letter slipped into a word and a block written in another
 * language alike.
 */
function listNoteStrayLetters(
    before: string,
    given: string,
    scriptPattern: RegExp | null,
) {
    const beforeWords = toNoteTranslateWords(before);
    const givenWords = toNoteTranslateWords(given);
    if (scriptPattern === null) {
        return listStudyStrayLetters(beforeWords, givenWords);
    }
    const ownPattern = toOneTestPattern(scriptPattern);
    const beforeScriptSet = new Set(groupLettersByScript(beforeWords).keys());
    const letterSet = new Set<string>();
    for (const [name, letters] of groupLettersByScript(givenWords)) {
        if (name === 'Latin' || beforeScriptSet.has(name)) {
            continue;
        }
        for (const letter of letters) {
            if (!ownPattern.test(letter)) {
                letterSet.add(letter);
            }
        }
    }
    return [...letterSet].slice(0, 8);
}

/**
 * The script a translation is written in, read off the words it writes:
 * the one most of their letters are in, when that is not Latin -- a
 * language written in Latin letters cannot be told from English by them.
 * For a language no plugin here describes (BN-133's live run: Khmer asked
 * for on a profile with no Khmer installed).
 */
function inferNoteTranslateScript(givenList: readonly string[]) {
    const countMap = new Map<string, number>();
    for (const text of givenList) {
        const letterMap = groupLettersByScript(toNoteTranslateWords(text));
        for (const [name, letters] of letterMap) {
            countMap.set(name, (countMap.get(name) ?? 0) + letters.length);
        }
    }
    let bestName: string | null = null;
    let bestCount = 0;
    for (const [name, count] of countMap) {
        if (count > bestCount) {
            bestName = name;
            bestCount = count;
        }
    }
    return bestName === null || bestName === 'Latin'
        ? null
        : new RegExp(`\\p{Script=${bestName}}`, 'u');
}

export type NoteTranslateLeftType = {
    english: { n: number; text: string }[];
    stray: { n: number | null; text: string; letters: string[] }[];
};

/**
 * What a translation's edit leaves out of the language: blocks of words
 * still in English once it is made -- given English words, or left alone
 * -- when the language has a script of its own (`languagePattern`, the
 * installed language's; else read off the words the edit writes), and
 * letters of a third script slipped into the words it writes. Null when
 * there is none. `blocks`: the note as read just before.
 */
export function findNoteTranslateLeft(
    args: any,
    blocks: readonly NoteReadBlockType[],
    languagePattern: RegExp | null,
): NoteTranslateLeftType | null {
    if (!Array.isArray(args?.changes)) {
        return null;
    }
    const givenMap = new Map<number, string>();
    const goneSet = new Set<number>();
    const added: string[] = [];
    for (const change of args.changes) {
        if (typeof change?.after === 'number') {
            if (typeof change.text === 'string') {
                added.push(change.text);
            }
            continue;
        }
        if (typeof change?.block !== 'number') {
            continue;
        }
        if (change.remove === true) {
            goneSet.add(change.block);
        } else if (typeof change.text === 'string') {
            givenMap.set(change.block, change.text);
        }
    }
    const scriptPattern =
        languagePattern ??
        inferNoteTranslateScript([...givenMap.values(), ...added]);
    const english: NoteTranslateLeftType['english'] = [];
    const stray: NoteTranslateLeftType['stray'] = [];
    for (const block of blocks) {
        if (!NOTE_WORD_BLOCK_KIND_SET.has(block.kind) || goneSet.has(block.n)) {
            continue;
        }
        const given = givenMap.get(block.n);
        const text = given ?? block.text;
        if (
            scriptPattern !== null &&
            (given !== undefined || block.isTextCut !== true) &&
            checkIsLeftInEnglish(text, scriptPattern)
        ) {
            english.push({ n: block.n, text: toNoteTranslateWords(text) });
        }
        if (given !== undefined) {
            const letters = listNoteStrayLetters(
                block.text,
                given,
                scriptPattern,
            );
            if (letters.length > 0) {
                stray.push({
                    n: block.n,
                    text: toNoteTranslateWords(given),
                    letters,
                });
            }
        }
    }
    for (const text of added) {
        if (
            scriptPattern !== null &&
            checkIsLeftInEnglish(text, scriptPattern)
        ) {
            english.push({ n: 0, text: toNoteTranslateWords(text) });
        }
        const letters = listNoteStrayLetters('', text, scriptPattern);
        if (letters.length > 0) {
            stray.push({ n: null, text: toNoteTranslateWords(text), letters });
        }
    }
    return english.length === 0 && stray.length === 0
        ? null
        : { english, stray };
}

function toLeftBlockName(n: number | null, text?: string) {
    const words = String(text ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const head = words.length > 40 ? `${words.slice(0, 40)}…` : words;
    if (n === null || n === 0) {
        return head === ''
            ? 'a block you add'
            : `the block you add ("${head}")`;
    }
    return head === '' ? `block ${n}` : `block ${n} ("${head}")`;
}

/**
 * What the model is told under a translation's change that left words out
 * of its language: the change is IN -- refused, gemma4:cloud sent the
 * translation again in four parts and ran out of rounds (2026-11-11) --
 * and one more edit puts the blocks named right.
 */
export function genNoteTranslateLeftNote(
    left: NoteTranslateLeftType,
    languageName: string,
) {
    const parts: string[] = [];
    if (left.english.length > 0) {
        const named = left.english
            .slice(0, MAX_NOTE_TRANSLATE_LEFT_NAMED)
            .map((item) => toLeftBlockName(item.n, item.text));
        parts.push(
            `${named.join(', ')} ${left.english.length === 1 ? 'is' : 'are'} ` +
                'still in English',
        );
    }
    if (left.stray.length > 0) {
        const named = left.stray
            .slice(0, MAX_NOTE_TRANSLATE_LEFT_NAMED)
            .map((item) => {
                return `${toLeftBlockName(item.n, item.text)} (${item.letters.join(' ')})`;
            });
        parts.push(
            `${named.join(', ')} ${left.stray.length === 1 ? 'has' : 'have'} ` +
                `letters of another language's script, which a ${languageName} ` +
                'reader cannot read',
        );
    }
    return (
        `(The change is made, but not all of it is in ${languageName} yet: ` +
        `${parts.join('; ')}. Put those blocks into ${languageName} with ` +
        `ONE more edit -- ${languageName} letters only, every [^…] token ` +
        'as it is, every other block left as it is now -- then answer.)'
    );
}

// --- the passage printed once (BN-130) ----------------------------------------
//
// 2026-11-11, the BN-125..127 read and the reads before it: the whole
// passage printed again after the memory verse (Luke 10:25-37, Philippians
// 4:4-13 -- "delete the duplicate passage block", both readers), a
// devotion's psalm printed again under its one point though its movement
// lines carry their own verses, a one-verse sermon's verse "repeated four
// times". The shape and the form line both say a passage is printed once;
// the model printed it again. The window takes out a line that is the top
// passage's token again -- after the memory verse, or under a point whose
// other lines carry verses of their own -- and nothing else.

function toPassageKey(ref: string) {
    return ref
        .replace(LESSON_BIBLE_PREFIX_PATTERN, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

type LessonLineType = {
    changeIndex: number;
    lineIndex: number | null;
    text: string;
};

/** A new lesson's changes with its passage's repeated printings taken out. */
export function dropRepeatedLessonPassages(args: any) {
    if (!Array.isArray(args?.changes)) {
        return args;
    }
    // Every line of the lesson in the order given, and where it came from.
    const lines: LessonLineType[] = [];
    args.changes.forEach((change: any, changeIndex: number) => {
        const kind = String(change?.kind ?? '');
        if (kind === 'section' && typeof change?.text === 'string') {
            change.text
                .split('\n')
                .forEach((text: string, lineIndex: number) => {
                    lines.push({ changeIndex, lineIndex, text });
                });
            return;
        }
        lines.push({
            changeIndex,
            lineIndex: null,
            text: toLessonChangeText({ changes: [change] }),
        });
    });
    const topLine = lines.find((line) => readPassageLineRef(line.text));
    if (topLine === undefined) {
        return args;
    }
    const topKey = toPassageKey(readPassageLineRef(topLine.text) ?? '');
    const checkIsTopRepeat = (line: LessonLineType) => {
        const ref = readPassageLineRef(line.text);
        return line !== topLine && ref !== null && toPassageKey(ref) === topKey;
    };
    const dropped = new Set<LessonLineType>();
    const points: LessonLineType[][] = [];
    let pointLines: LessonLineType[] | null = null;
    let memoryState: 'none' | 'heading' | 'verse' = 'none';
    for (const line of lines) {
        if (line === topLine) {
            continue;
        }
        if (LESSON_POINT_HEADING_PATTERN.test(line.text)) {
            pointLines = [];
            points.push(pointLines);
            continue;
        }
        if (LESSON_HEADING_PATTERN.test(line.text)) {
            pointLines = null;
            if (MEMORY_VERSE_HEADING_PATTERN.test(line.text)) {
                memoryState = 'heading';
            }
            continue;
        }
        // The memory verse's own line is kept, whatever it is.
        if (memoryState === 'heading' && readPassageLineRef(line.text)) {
            memoryState = 'verse';
            continue;
        }
        if (memoryState === 'verse' && checkIsTopRepeat(line)) {
            dropped.add(line);
            continue;
        }
        pointLines?.push(line);
    }
    for (const point of points) {
        const repeats = point.filter(checkIsTopRepeat);
        const hasOwnVerse = point.some((line) => {
            return !repeats.includes(line) && /\[\^[^\]\n]+\]/.test(line.text);
        });
        if (hasOwnVerse) {
            repeats.forEach((line) => dropped.add(line));
        }
    }
    if (dropped.size === 0) {
        return args;
    }
    return {
        ...args,
        changes: args.changes.flatMap((change: any, changeIndex: number) => {
            const own = lines.filter(
                (line) => line.changeIndex === changeIndex,
            );
            if (!own.some((line) => dropped.has(line))) {
                return [change];
            }
            if (own[0]?.lineIndex === null) {
                return [];
            }
            return [
                {
                    ...change,
                    text: own
                        .filter((line) => !dropped.has(line))
                        .map((line) => line.text)
                        .join('\n'),
                },
            ];
        }),
    };
}

// A point's own printing of more verses than this, all of them printed
// already by the passage at the lesson's top, is named instead (BN-220).
const MAX_POINT_PRINTED_VERSES = 10;

/**
 * A new lesson's changes with each point's long printing of verses the
 * passage at its top already prints made a line naming them: shape69 printed
 * 1 Samuel 17:1-54 at the top and again as 17:1-26, 27-37 and 38-54 under
 * its points (4 420 words), the Sower 13:8-23 under its fourth -- the one
 * fault both readers marked in most reads, the shape's own words not holding
 * it. The line keeps the verses as a chip, which the cover and order checks
 * read.
 */
export function withLongPointPassagesNamed(args: any) {
    if (!Array.isArray(args?.changes)) {
        return args;
    }
    const lines: LessonLineType[] = [];
    args.changes.forEach((change: any, changeIndex: number) => {
        const kind = String(change?.kind ?? '');
        if (kind === 'section' && typeof change?.text === 'string') {
            change.text
                .split('\n')
                .forEach((text: string, lineIndex: number) => {
                    lines.push({ changeIndex, lineIndex, text });
                });
            return;
        }
        lines.push({
            changeIndex,
            lineIndex: null,
            text: toLessonChangeText({ changes: [change] }),
        });
    });
    const topLine = lines.find((line) => readPassageLineRef(line.text));
    const top =
        topLine === undefined
            ? null
            : toLessonRefParts(readPassageLineRef(topLine.text) ?? '');
    if (top === null || top.verseStart === null || top.verseEnd === null) {
        return args;
    }
    const named = new Map<LessonLineType, string>();
    let isInPoint = false;
    for (const line of lines) {
        if (line === topLine) {
            continue;
        }
        if (LESSON_POINT_HEADING_PATTERN.test(line.text)) {
            isInPoint = true;
            continue;
        }
        if (LESSON_HEADING_PATTERN.test(line.text)) {
            isInPoint = false;
            continue;
        }
        const ref = isInPoint ? readPassageLineRef(line.text) : null;
        const parts = ref === null ? null : toLessonRefParts(ref);
        if (
            ref === null ||
            parts === null ||
            parts.verseStart === null ||
            parts.verseEnd === null ||
            parts.verseEnd - parts.verseStart + 1 <= MAX_POINT_PRINTED_VERSES ||
            toLessonBookKey(parts.book) !== toLessonBookKey(top.book) ||
            parts.chapter !== top.chapter ||
            parts.verseStart < top.verseStart ||
            parts.verseEnd > top.verseEnd
        ) {
            continue;
        }
        named.set(line, `**Verses:** [^${ref}]`);
    }
    if (named.size === 0) {
        return args;
    }
    return {
        ...args,
        changes: args.changes.map((change: any, changeIndex: number) => {
            const own = lines.filter(
                (line) => line.changeIndex === changeIndex,
            );
            if (!own.some((line) => named.has(line))) {
                return change;
            }
            if (own[0]?.lineIndex === null) {
                const { ref: _ref, ...rest } = change;
                return {
                    ...rest,
                    kind: 'paragraph',
                    text: named.get(own[0]),
                };
            }
            return {
                ...change,
                text: own
                    .map((line) => named.get(line) ?? line.text)
                    .join('\n'),
            };
        }),
    };
}

// --- a lesson written in place of loose lines (BN-67) -------------------------
//
// 2026-11-10, _please finish my sermon from these notes_ under six loose
// lines (`mark 4 storm`, `jesus asleep in the boat` …): the change that makes
// them a lesson is the longest a note gets, and the shared gemma4:cloud
// server dropped it as it drops a whole lesson nested in `changes` (BN-61);
// asked again in parts, the model named blocks by numbers its own first part
// had moved, and once it gave up at 47.8k tokens. An empty note had the
// answer already: ONE flat `owa_bible_note add`, put in place by the window.
// A note of plain lines takes it too -- every line of theirs checked to be in
// the lesson before anything is changed, the lesson written in their place,
// one step of the note's Undo.

/** At most this many lines are a note of loose lines, not a lesson. */
const NOTE_REWRITE_MAX_BLOCKS = 20;

export type NoteRewriteType = {
    // Their lines with words, and the block each is.
    lines: string[];
    lineBlocks: number[];
    // Every block of the note, empty ones too.
    blockCount: number;
};

export const NOTE_LESSON_REWRITE_HINT =
    '(This asks to make their notes -- a few loose lines -- a whole ' +
    'lesson. Write it as ONE owa_bible_note action "add": `title`, and ' +
    '`text` the whole lesson in mark-up, with EVERY line of theirs in it in ' +
    "its own words, where it belongs -- a line can be a point's heading, a " +
    "sentence of a point, the introduction's story. The window checks their " +
    'lines are all there and puts the lesson IN PLACE of them, in this ' +
    `note. ${PREACHING_LESSON_SHAPE})`;

export const NOTE_REWRITE_DROPPED_NUDGE =
    '(Nothing arrived: a call that long could not be read as a change. ' +
    'Write the whole lesson as ONE owa_bible_note action "add" -- its ' +
    "`title`, and its `text` the lesson's lines, every line of theirs in " +
    'it -- and the window puts it in place of their lines.)';

/**
 * The note a _finish my sermon_ is about, when it is loose lines: every
 * block a paragraph, read whole, no more than `NOTE_REWRITE_MAX_BLOCKS`,
 * two lines with words at least. Null for anything else -- headings, a
 * list, a passage, a table, a long note -- which is finished in place.
 */
export function readNoteRewrite(
    asked: string,
    notes: readonly { name: string; text: string | null }[],
    isLessonContinued = false,
): NoteRewriteType | null {
    if (notes.length !== 1) {
        return null;
    }
    const text = notes[0].text;
    if (text === null || checkIsBlankNoteText(text)) {
        return null;
    }
    const hint = genNoteLessonHint(
        asked,
        false,
        isLessonContinued,
        checkIsLessonNoteText(text),
    );
    if (hint !== NOTE_LESSON_FINISH_HINT) {
        return null;
    }
    const blocks = readNoteBlockLines(text);
    const total = /^Blocks: (\d+)/m.exec(text);
    if (
        blocks.length === 0 ||
        blocks.length > NOTE_REWRITE_MAX_BLOCKS ||
        total === null ||
        Number(total[1]) !== blocks.length ||
        blocks.some((block) => block.kind !== 'paragraph' || block.isFixed)
    ) {
        return null;
    }
    const withWords = blocks.filter((block) => block.words.trim() !== '');
    return withWords.length >= 2
        ? {
              lines: withWords.map((block) => block.words.trim()),
              lineBlocks: withWords.map((block) => block.n),
              blockCount: blocks.length,
          }
        : null;
}

/**
 * An EDIT that makes their loose lines a lesson and leaves the lines beside
 * it (BN-67, seen live: the model wove all six into the lesson, in bold, and
 * left the six at the end of the note). Each line the edit does not touch
 * and whose words its new text holds is taken out in the same edit -- a
 * lesson put after it takes its place -- and, once one is, the empty blocks
 * between them. A line the new text does not hold stays.
 */
export function withRewrittenLinesRemoved(args: any, rewrite: NoteRewriteType) {
    if (args?.action !== 'edit' || !Array.isArray(args?.changes)) {
        return args;
    }
    const changes: any[] = args.changes;
    const touchedSet = new Set(
        changes
            .filter((change) => typeof change?.block === 'number')
            .map((change) => change.block as number),
    );
    const newText = changes
        .filter((change) => {
            return typeof change?.text === 'string' && change.remove !== true;
        })
        .map((change) => change.text as string)
        .join('\n');
    if (newText.trim() === '') {
        return args;
    }
    const removeList = rewrite.lineBlocks.filter((block, index) => {
        return (
            !touchedSet.has(block) &&
            findLostNoteLines([rewrite.lines[index]], newText).length === 0
        );
    });
    if (removeList.length === 0) {
        return args;
    }
    const lineBlockSet = new Set(rewrite.lineBlocks);
    const emptyList = Array.from({ length: rewrite.blockCount }, (_, index) => {
        return index + 1;
    }).filter((block) => !lineBlockSet.has(block) && !touchedSet.has(block));
    return {
        ...args,
        changes: [
            ...changes,
            ...[...removeList, ...emptyList]
                .sort((a, b) => a - b)
                .map((block) => ({ block, remove: true })),
        ],
    };
}

/**
 * Why an EDIT making their loose lines a lesson is refused, or null: it
 * takes out or writes over a line of theirs that its new words do not hold
 * (BN-223, 2026-11-13: "my story: the night at the hospital" removed by the
 * model's own edit, a stock scene of its own in the lesson instead -- the
 * window had looked only at the lines IT takes out).
 */
export function findRewriteLineLoss(args: any, rewrite: NoteRewriteType) {
    if (args?.action !== 'edit' || !Array.isArray(args?.changes)) {
        return null;
    }
    const changes: any[] = args.changes;
    const newText = changes
        .filter((change) => {
            return typeof change?.text === 'string' && change.remove !== true;
        })
        .map((change) => change.text as string)
        .join('\n');
    const lost = rewrite.lineBlocks.flatMap((block, index) => {
        const isTouched = changes.some((change) => {
            return (
                change?.block === block &&
                (change.remove === true || typeof change.text === 'string')
            );
        });
        const line = rewrite.lines[index];
        return isTouched && findLostNoteLines([line], newText).length > 0
            ? [line]
            : [];
    });
    return lost.length > 0 ? genLostNoteLinesRefusal(lost) : null;
}

function toLineWords(text: string) {
    return (
        String(text ?? '')
            .toLowerCase()
            .match(/[\p{L}\p{M}\p{N}']+/gu) ?? []
    );
}

// A word and its plural or past said alike ("obeys" for "obey").
function toWordStem(word: string) {
    const stem = word.replace(/(?:ing|ed|es|s)$/u, '');
    return Array.from(stem).length >= 3 ? stem : word;
}

// A line that marks their own story -- "my story: the night at the
// hospital" -- is what no lesson can write for them (BN-223).
const OWN_STORY_LINE_PATTERN =
    /^\s*(?:(?:my|our)\s+(?:own\s+)?)?(?:story|testimony|illustration|experience)\b\s*[:\-–—]\s*|^\s*(?:my|our)\s+(?:own\s+)?(?:story|testimony|illustration|experience)\b\s*/i;

function checkIsOwnStoryLine(line: string) {
    return OWN_STORY_LINE_PATTERN.test(line);
}

/**
 * Their lines a written lesson leaves out: a line fewer than four in five
 * of whose words are anywhere in it, a word's plural or past counting as
 * the word. A verse token's words count -- "mark 4 storm" made the passage
 * `[^Mark 4:35-41]` and the storm the lesson's. A line marking their own
 * story keeps EVERY word of four letters or more after its mark (BN-223,
 * 2026-11-13, a finish ask: "my story: the night at the hospital" passed on
 * "my", "story", "the", "night" and "at" with no hospital in the lesson, and
 * the window took the preacher's own story out -- a stock waiting-room
 * scene in its place). Not every line: "jesus asleep in the boat" told as
 * the KJV's "ship" is kept.
 */
export function findLostNoteLines(lines: readonly string[], text: string) {
    const keptSet = new Set(toLineWords(text).map(toWordStem));
    const checkIsKept = (word: string) => keptSet.has(toWordStem(word));
    return lines.filter((line) => {
        if (checkIsOwnStoryLine(line)) {
            const storyWords = toLineWords(
                line.replace(OWN_STORY_LINE_PATTERN, ''),
            ).filter((word) => Array.from(word).length >= 4);
            if (storyWords.length > 0) {
                return !storyWords.every(checkIsKept);
            }
        }
        const words = toLineWords(line);
        if (words.length === 0) {
            return false;
        }
        return words.filter(checkIsKept).length / words.length < 0.8;
    });
}

/** Why a lesson that leaves out their lines is not put in place of them. */
export function genLostNoteLinesRefusal(lost: readonly string[]) {
    // Their story is their example, never one written in its place.
    const storyText = lost.some(checkIsOwnStoryLine)
        ? ' A story of theirs is the example of the point it fits: its ' +
          '**For example:** line names it in their words, said as their own ' +
          'story to tell, with no scene of yours.'
        : '';
    return (
        'Nothing was changed: these lines of theirs are not in the lesson -- ' +
        `${lost.map((line) => JSON.stringify(line)).join('; ')}. Write the ` +
        'whole lesson again as ONE owa_bible_note "add" with each of them in ' +
        `it, in its own words.${storyText}`
    );
}

// --- checking the verses a lesson cites ---------------------------------------
//
// 2026-11-10, a sermon's follow-ups on gemma4:cloud: _check that my verses
// are right_ was answered "I have checked your verses against the KJV text.
// All the references are correct" with no verse read -- and a point said
// Isaiah 53:6 was the servant "wounded for our transgressions", which is
// 53:5. The window reads every verse the note cites (one `owa_find_verse
// refs` call a Bible, no model round) and the ask carries their words, so
// the answer compares instead of claiming.
// A checking word before the verses, or THEIR verses said right or wrong:
// "add verses that fit point 2" and "are there verses about love?" ask for
// verses, not a check. A study's "cross references" are its verses too
// (EC-497: _Are the cross references in this study file right?_).
const NOTE_VERSE_CHECK_ASK_PATTERN =
    /\b(?:check|verify|double[- ]check|look over|confirm|make sure)\b[^.?!]{0,40}?\b(?:cross[- ]?)?(?:verses?|references?|scriptures?|refs?|bible quotes?)\b|\b(?:my|the|these|all|our|its|their)\s+(?:bible\s+|cross[- ]?)?(?:verses?|references?|scriptures?|refs?)\b[^.?!]{0,30}?\b(?:right|correct|accurate|wrong)\b/i;
const NOTE_VERSE_TOKEN_PATTERN =
    /\[\^(?:\(([^)\]\n]{1,24})\)\s*)?([^\]\n]+)\]/g;
const MAX_NOTE_CHECK_VERSES = 24;

/** Whether they asked to check the verses their note cites. */
export function checkIsNoteVerseCheckAsk(text: string) {
    const line = String(text ?? '');
    return (
        NOTE_VERSE_CHECK_ASK_PATTERN.test(line) ||
        listAssistantLanguages().some((language) => {
            return language.verseCheckAskPatterns.some((pattern) => {
                return pattern.test(line);
            });
        })
    );
}

/**
 * Whether a lesson is asked to be written in the words of an installed
 * language (its `lessonAsks`, BN-65): a Gemma 4 is asked in the person's own
 * language, untranslated, where the English readers see nothing.
 */
export function checkIsLanguageLessonAsk(text: string) {
    const line = String(text ?? '');
    return listAssistantLanguages().some((language) => {
        return language.lessonAskPatterns.some((pattern) => {
            return pattern.test(line);
        });
    });
}

/**
 * The verses the attached notes cite, by the Bible each token names (null:
 * the Lookup's), each once, at most `MAX_NOTE_CHECK_VERSES`: what the window
 * reads before a verse check.
 */
export function collectNoteVerseRefs(texts: readonly (string | null)[]) {
    const byBible = new Map<string | null, string[]>();
    let count = 0;
    for (const text of texts) {
        for (const match of String(text ?? '').matchAll(
            NOTE_VERSE_TOKEN_PATTERN,
        )) {
            const bible = match[1]?.trim() || null;
            const ref = match[2].trim();
            const refs = byBible.get(bible) ?? [];
            if (refs.includes(ref) || count >= MAX_NOTE_CHECK_VERSES) {
                continue;
            }
            refs.push(ref);
            byBible.set(bible, refs);
            count++;
        }
    }
    return [...byBible.entries()].map(([bible, refs]) => {
        return { bible, refs };
    });
}

// A block line of the note read: `14. bullet: "words"` -- its words.
const NOTE_BLOCK_WORDS_PATTERN = /^\s*\d+\.\s+[^:\n]+?: (".*")\s*$/;

/**
 * The words of the note around each verse it cites, by its reference: the
 * first block that cites it, its tokens written as plain references.
 */
function collectNoteVerseLines(texts: readonly (string | null)[]) {
    const lineMap = new Map<string, string>();
    for (const text of texts) {
        for (const line of String(text ?? '').split('\n')) {
            const quoted = NOTE_BLOCK_WORDS_PATTERN.exec(line);
            if (quoted === null) {
                continue;
            }
            let words: string;
            try {
                words = String(JSON.parse(quoted[1]));
            } catch (_error) {
                continue;
            }
            const plain = words.replace(
                NOTE_VERSE_TOKEN_PATTERN,
                (_token, _bible, ref: string) => ref.trim(),
            );
            for (const match of words.matchAll(NOTE_VERSE_TOKEN_PATTERN)) {
                const key = match[2].trim().toLowerCase();
                if (!lineMap.has(key)) {
                    lineMap.set(key, plain);
                }
            }
        }
    }
    return lineMap;
}

/**
 * The verses as a Bible read them (`owa_find_verse` results), for the ask:
 * each verse with what the NOTE says about it beside what the Bible says --
 * told only "the Bible reads", gemma4:cloud called a line giving Isaiah
 * 53:5's words to 53:6 right.
 */
export function toNoteVerseReadText(
    results: readonly any[],
    noteTexts: readonly (string | null)[] = [],
) {
    const lineMap = collectNoteVerseLines(noteTexts);
    const lines = results.flatMap((result) => {
        const bible = typeof result?.bible === 'string' ? result.bible : '';
        const verses: any[] = Array.isArray(result?.verses)
            ? result.verses
            : [];
        return verses.map((verse) => {
            const ref = String(verse?.ref ?? verse?.key ?? '');
            const noteLine = lineMap.get(ref.trim().toLowerCase());
            return (
                `- ${bible === '' ? '' : `(${bible}) `}${ref}\n` +
                (noteLine === undefined
                    ? ''
                    : `  the note says: ${JSON.stringify(noteLine)}\n`) +
                `  the Bible says: ${JSON.stringify(String(verse?.text ?? ''))}`
            );
        });
    });
    if (lines.length === 0) {
        return null;
    }
    return (
        '(This asks to check the verses. For each verse the note cites: is ' +
        'it named right, and does what the note says about it match what the ' +
        'verse says? A line that gives a verse words or a meaning it does not ' +
        "have -- another verse's words -- is WRONG: name it, say which verse " +
        'says that if you know, and offer the fix as an OPTION. Change ' +
        'nothing unasked, and say only what these show.\n' +
        `${lines.join('\n')})`
    );
}

// "Choose one of these", "you pick", "any": the passage left to the
// assistant (BN-144, 2026-11-11, shape29: pressed under its own "which
// passage?", the model offered three passages again and wrote nothing).
const NOTE_LEFT_TO_YOU_PATTERN =
    /^(?:please\s+)?(?:(?:you\s+)?(?:choose|pick|select|decide)(?:\s+(?:one|for me|of (?:these|them|those)|any|whichever|it))*|any(?:\s+(?:one|of (?:these|them|those)))?|whichever|either|anything|(?:it )?(?:doesn'?t|does not) matter|(?:it'?s )?up to you|your (?:choice|pick))[.!]*$/i;

/** Whether a reply leaves the lesson's passage to the assistant. */
export function checkIsLeftToYouAsk(asked: string) {
    return NOTE_LEFT_TO_YOU_PATTERN.test(String(asked ?? '').trim());
}

export const NOTE_LESSON_YOU_CHOOSE_HINT =
    '(They left the passage to you: choose ONE of the passages you ' +
    'offered -- the first, unless another fits the lesson they asked for ' +
    'better -- and write the whole lesson on it now. Never ask which again.)';

/** The one lesson hint an ask about a note carries, if it is about one. */
export function genNoteLessonHint(
    asked: string,
    isBlank: boolean,
    isLessonContinued = false,
    // The note is a lesson already (`checkIsLessonNoteText`): "finish it"
    // names it.
    isLessonNote = false,
) {
    // "How do I write a sermon here?" is a question about the editor.
    const isQuestion = checkIsLessonQuestion(asked);
    // The answer to "which passage?" under a lesson asked for in this tab is
    // that lesson too (2026-11-10: _The Prodigal Son (Luke 15:11-32)_,
    // pressed under it, was written as a fifteen-line outline).
    if (
        isBlank &&
        (checkIsLessonWriteAsk(asked) ||
            checkIsLanguageLessonAsk(asked) ||
            (isLessonContinued && !checkIsNoteQuestionOnly(asked)))
    ) {
        return NOTE_BLANK_LESSON_HINT;
    }
    if (!isQuestion && checkIsLessonShortenAsk(asked)) {
        return NOTE_LESSON_SHORTEN_HINT;
    }
    // Before a new lesson: "make it a full sermon" names THIS one.
    if (
        !isQuestion &&
        (checkIsLessonFinishAsk(asked) ||
            (isLessonNote && checkIsBareFinishAsk(asked)))
    ) {
        return NOTE_LESSON_FINISH_HINT;
    }
    if (!isQuestion && checkIsNewLessonAsk(asked)) {
        return NOTE_NEW_LESSON_HINT;
    }
    if (checkIsLessonReviewAsk(asked)) {
        return NOTE_LESSON_REVIEW_HINT;
    }
    return null;
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
 * the English of what they typed in another language; `verseReadText` the
 * verses the notes cite as the Bible reads them, for a verse check
 * (`toNoteVerseReadText`); `isLessonContinued` when the question before it in
 * the tab asked for a lesson.
 */
export function toNoteAsk(
    asked: string,
    notes: readonly { name: string; text: string | null }[],
    translateMode: LyricTranslateModeType | null = null,
    isWordless = false,
    ownWords: NoteOwnWordsType | null = null,
    verseReadText: string | null = null,
    isLessonContinued = false,
    rewrite: NoteRewriteType | null = null,
    // The form the tab's lesson was asked for in (BN-78): a review or a
    // finish is told it, the words of either naming none.
    lessonForm: LessonFormType | null = null,
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
    const lessonHint = genNoteLessonHint(
        asked,
        notes.length === 1 && checkIsBlankNoteText(notes[0].text),
        isLessonContinued,
        notes.length === 1 && checkIsLessonNoteText(notes[0].text),
    );
    // Loose lines are written over as a whole lesson, by the flat add the
    // window puts in their place (BN-67) -- decided ONCE, by the window, off
    // the words as typed (`readNoteRewrite`), so the hint and the redirect
    // agree; a lesson already is finished in place, the window naming what
    // it lacks and where it goes.
    const isRewrite = rewrite !== null;
    const gapsText =
        lessonHint === NOTE_LESSON_FINISH_HINT &&
        notes.length === 1 &&
        !isRewrite
            ? genLessonGapsText(notes[0].text)
            : null;
    const shownHint = isRewrite ? NOTE_LESSON_REWRITE_HINT : lessonHint;
    const writtenForm = readLessonFormAsked(asked) ?? lessonForm;
    // A change to a lesson that is no lesson ask of its own (BN-79).
    const isLessonChange =
        shownHint === null &&
        notes.length === 1 &&
        checkIsLessonNoteText(notes[0].text) &&
        checkIsChangeReply(asked);
    // A length they gave, as a number of words (BN-73) -- a lesson written
    // or finished, never a review or a cut.
    const lengthLine =
        shownHint === NOTE_BLANK_LESSON_HINT ||
        shownHint === NOTE_NEW_LESSON_HINT ||
        shownHint === NOTE_LESSON_FINISH_HINT ||
        shownHint === NOTE_LESSON_REWRITE_HINT
            ? genLessonLengthLine(asked)
            : null;
    return [
        ...(isWordless ? [NOTE_WORDLESS_HINT] : []),
        asked,
        ...(shownHint === null ? [] : [shownHint]),
        ...(shownHint === NOTE_BLANK_LESSON_HINT &&
        isLessonContinued &&
        checkIsLeftToYouAsk(asked)
            ? [NOTE_LESSON_YOU_CHOOSE_HINT]
            : []),
        ...(isLessonChange ? [NOTE_LESSON_CHANGE_HINT] : []),
        ...(lengthLine === null ? [] : [lengthLine]),
        ...(gapsText === null ? [] : [gapsText]),
        ...(lessonForm !== null &&
        (shownHint === NOTE_LESSON_REVIEW_HINT ||
            shownHint === NOTE_LESSON_FINISH_HINT)
            ? [genLessonFormLine(lessonForm)]
            : []),
        // A lesson written: in the form these words name, else the tab's
        // (BN-94).
        ...(writtenForm !== null &&
        (shownHint === NOTE_BLANK_LESSON_HINT ||
            shownHint === NOTE_NEW_LESSON_HINT)
            ? [genLessonFormWriteLine(writtenForm)]
            : []),
        ...(verseReadText === null ? [] : [verseReadText]),
        // The review hint and the verse check say to change nothing already.
        ...(lessonHint !== NOTE_LESSON_REVIEW_HINT &&
        verseReadText === null &&
        checkIsNoteQuestionOnly(asked)
            ? [NOTE_QUESTION_HINT]
            : []),
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
    'from memory, and never say you checked a verse you did not read. ' +
    'How to do something in the note EDITOR itself (sticky ' +
    'notes, tables, comments, drawings, Word copies, printing, read-only, ' +
    'zoom) is in its guide: search it with owa_help_search, open the page ' +
    'with owa_help_page, and answer in its words. A NEW note -- asked to ' +
    'make, write or start another one, or to put an answer into one -- is ' +
    'owa_bible_note action "add", ' +
    'its `title` and `text` written by you (# headings, - lists, **bold**, ' +
    'a verse as [^John 3:16]), never blocks added to this one; the app ' +
    'opens it and the conversation moves to it. When the attached note is ' +
    'EMPTY, a lesson asked for goes INTO it: write it the same way, ONE ' +
    'owa_bible_note "add", and the window puts it into the empty note. ' +
    `${LESSON_OUTLINE} Opening, finding or ` +
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
    '(John 3:16), never as [^John 3:16], and a part of the note by its ' +
    'heading or its words, never by a block number they cannot see. End ' +
    'with OPTIONS: two or three next ' +
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
    isEmpty = false,
) {
    // An EMPTY note is made to hold a lesson (2026-11-10, BN-64): its card
    // offers one, where translating, a spelling check and formatting would
    // have nothing to work on.
    if (isEmpty) {
        return {
            text: fillWords(
                tran(
                    '“{name}” is still empty. I can write a whole preaching ' +
                        'lesson into it and help you prepare it. Press one, ' +
                        'or say what you want.',
                ),
                { name },
            ),
            replies: genLessonCardReplies(),
            translateLanguage: null,
        };
    }
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

/**
 * The note a tab works in the window of when nothing was set as it was
 * attached: the one waiting in its box -- which a reload of the help window
 * keeps now (EC-498; BN-19, a tab whose note had not been asked about yet
 * went back to the Bible Reader) -- else the one it keeps open.
 */
export function findTabNoteTarget(
    messages: Parameters<typeof findOpenNoteAttachments>[0],
    closedAfterId: number | undefined,
    box: readonly ChatAttachmentType[] | undefined,
): NoteWindowTargetType | null {
    const boxNote = (box ?? []).filter(checkIsNoteAttachment).at(-1);
    if (boxNote !== undefined && typeof boxNote.filePath === 'string') {
        return toNoteWindowTarget(boxNote.filePath, boxNote.noteId);
    }
    return findSessionNoteTarget(messages, closedAfterId);
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
