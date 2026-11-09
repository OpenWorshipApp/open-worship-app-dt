/**
 * The request a window leaves for the assistant, and the assistant takes
 * (see `chatbotHandoffHelpers.ts`). A leaf of its own -- settings only --
 * so the chat window reads it without pulling in the dialogs and window
 * openers the button that LEAVES it needs.
 */
import { toPathScrubbed } from '../../server/accountPathHelpers';
import { getSettingForce, removeSetting, setSetting } from '../settingHelpers';
import type { LookupAskType } from './lookupAskHelpers';
import { toValidLookupAsk } from './lookupAskHelpers';
import type { ResourceReadingType } from './resourceReadingAskHelpers';
import { toValidResourceReading } from './resourceReadingAskHelpers';
import type { ForegroundAskType } from './foregroundAskHelpers';
import { toValidForegroundAsk } from './foregroundAskHelpers';

const HANDOFF_KEY = 'chatbot-handoff-ask';
const HANDOFF_MAX_AGE_MS = 30 * 1000;
const HANDOFF_MAX_CHARS = 600;

export function requestChatbotAsk(text: string) {
    setSetting(
        HANDOFF_KEY,
        JSON.stringify({
            text: text.slice(0, HANDOFF_MAX_CHARS),
            at: Date.now(),
        }),
    );
}

/** A waiting request's words, once; null when none waits or it is stale. */
function takeHandoffText(key: string): string | null {
    const raw = getSettingForce(key);
    if (!raw) {
        return null;
    }
    removeSetting(key);
    try {
        const data = JSON.parse(raw);
        if (
            typeof data?.text !== 'string' ||
            typeof data?.at !== 'number' ||
            Math.abs(Date.now() - data.at) > HANDOFF_MAX_AGE_MS
        ) {
            return null;
        }
        return data.text.trim().slice(0, HANDOFF_MAX_CHARS);
    } catch (_error) {
        return null;
    }
}

/** The waiting request, once; null when there is none or it is stale. */
export function takeChatbotAsk(): string | null {
    return takeHandoffText(HANDOFF_KEY) || null;
}

// A second request, of another kind (2026-10-13, the user's asks: Help's
// third row and the error dialog -- _open chatbot for reporting problem,
// consult and ask user and collect and analyze then post the report_): the
// assistant is opened to REPORT A PROBLEM. `problem` is what went wrong when
// the app itself knows -- an error it caught -- and empty when a person
// asked from the Help button, who is then asked what happened.
const REPORT_HANDOFF_KEY = 'chatbot-handoff-report';

export function requestChatbotReport(problem: string) {
    setSetting(
        REPORT_HANDOFF_KEY,
        JSON.stringify({
            text: problem.slice(0, HANDOFF_MAX_CHARS),
            at: Date.now(),
        }),
    );
}

/**
 * The waiting report request, once: the problem's words (empty when the
 * person is to be asked), or null when none waits or it is stale.
 */
export function takeChatbotReport(): string | null {
    return takeHandoffText(REPORT_HANDOFF_KEY);
}

// A third kind (2026-10-17, the user, with a picture of the Resources
// panel: _add robot icon to each file, click to open file in chatbot in
// attachment to analyze_): a FILE to ask about. Its path is the whole
// request, and is never cut -- half a path is another file, or none.
const FILE_HANDOFF_KEY = 'chatbot-handoff-file';
const FILE_HANDOFF_MAX_CHARS = 4096;

// WHICH note of a Bible notes file (2026-11-07, the user, with a note row's
// menu open: _add `Open in Chatbot` for bible-note_): a `.own` holds many
// notes, and the conversation is about one of them. Its id, checked both
// ways -- a hand-edited setting cannot name anything but a note number.
export function toValidNoteId(noteId: unknown) {
    return typeof noteId === 'number' &&
        Number.isSafeInteger(noteId) &&
        noteId >= 0
        ? noteId
        : null;
}

// WORDS SELECTED where they are read (2026-11-08, the user: _as a user I
// want to select bible note text then click the agent button then writing a
// qustion about the selected text_, then _add the agent button for bible
// selected text as well_ and _should provide selection range in the input
// text for enough context, for bible should include selection range among
// bible verse_): a note window's selection toolbar hands them over beside
// the note, a Bible view's beside the verse -- with the words around them
// in their line or verse and where they sit in it -- and the help window
// quotes them in the box for the question to follow. The whole note or
// verse rides with the question anyway, so a long selection keeps its
// beginning and its end -- enough to find it there -- and never fills the
// box, and the words around it are a line's worth at most.
const SELECTION_MENTION_MAX_CHARS = 1200;
const SELECTION_MENTION_HEAD_CHARS = 900;
const SELECTION_AROUND_MAX_CHARS = 240;
export const SELECTION_MENTION_GAP = ' … ';
const SELECTION_AROUND_CUT = '…';

/**
 * Words selected, and where: the words before and after them in their verse
 * or line ('' at its edge), and their first and last character in it,
 * counted from 1 -- null when the selection runs over several lines.
 */
export type SelectionMentionType = {
    text: string;
    before: string;
    after: string;
    start: number | null;
    end: number | null;
};

function toSelectedWords(text: unknown) {
    if (typeof text !== 'string') {
        return null;
    }
    const words = text
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    if (words.length === 0) {
        return null;
    }
    if (words.length <= SELECTION_MENTION_MAX_CHARS) {
        return words;
    }
    const tailChars =
        SELECTION_MENTION_MAX_CHARS -
        SELECTION_MENTION_HEAD_CHARS -
        SELECTION_MENTION_GAP.length;
    return (
        words.slice(0, SELECTION_MENTION_HEAD_CHARS).trimEnd() +
        SELECTION_MENTION_GAP +
        words.slice(-tailChars).trimStart()
    );
}

// The words on the selection's own line only, its spacing kept where it
// meets the selection, cut away from it when long.
function toAroundWords(text: unknown, side: 'before' | 'after') {
    if (typeof text !== 'string') {
        return '';
    }
    const lineList = text.split(/\r?\n|\r/);
    const line = (
        side === 'before' ? lineList[lineList.length - 1] : lineList[0]
    ).replace(/[ \t]+/g, ' ');
    if (line.length <= SELECTION_AROUND_MAX_CHARS) {
        return line;
    }
    return side === 'before'
        ? SELECTION_AROUND_CUT + line.slice(-SELECTION_AROUND_MAX_CHARS)
        : line.slice(0, SELECTION_AROUND_MAX_CHARS) + SELECTION_AROUND_CUT;
}

/**
 * Selected words as the box quotes them -- given as words alone or with
 * where they are -- or null for none. Every field checked and copied by
 * name: a hand-edited setting cannot carry anything else along.
 */
export function toValidSelectionMention(
    raw: unknown,
): SelectionMentionType | null {
    const source: any =
        typeof raw === 'string' ? { text: raw } : (raw ?? undefined);
    if (typeof source !== 'object' || source === null) {
        return null;
    }
    const text = toSelectedWords(source.text);
    if (text === null) {
        return null;
    }
    const { start, end } = source;
    const hasRange =
        !text.includes('\n') &&
        Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start >= 1 &&
        end >= start;
    return {
        text,
        before: toAroundWords(source.before, 'before'),
        after: toAroundWords(source.after, 'after'),
        start: hasRange ? start : null,
        end: hasRange ? end : null,
    };
}

export function requestChatbotFile(
    filePath: string,
    reading: ResourceReadingType | null = null,
    noteId: number | null = null,
    mention: SelectionMentionType | string | null = null,
) {
    if (filePath.length > FILE_HANDOFF_MAX_CHARS) {
        return;
    }
    // The passage the Reader was on rides beside the path (2026-10-22,
    // `resourceReadingAskHelpers.ts`), checked on the way in and out.
    const validReading = toValidResourceReading(reading);
    const validNoteId = toValidNoteId(noteId);
    // Words selected in a note, only beside the note they were selected in.
    const validMention =
        validNoteId === null ? null : toValidSelectionMention(mention);
    setSetting(
        FILE_HANDOFF_KEY,
        JSON.stringify({
            filePath,
            ...(validReading === null ? {} : { reading: validReading }),
            ...(validNoteId === null ? {} : { noteId: validNoteId }),
            ...(validMention === null ? {} : { mention: validMention }),
            at: Date.now(),
        }),
    );
}

export type ChatbotFileRequestType = {
    filePath: string;
    reading: ResourceReadingType | null;
    noteId: number | null;
    mention: SelectionMentionType | null;
};

/**
 * The waiting file and the passage the Reader was on, once; null when none
 * waits or it is stale. A reading that does not check out is dropped and
 * the file still opens.
 */
export function takeChatbotFileRequest(): ChatbotFileRequestType | null {
    const raw = getSettingForce(FILE_HANDOFF_KEY);
    if (!raw) {
        return null;
    }
    removeSetting(FILE_HANDOFF_KEY);
    try {
        const data = JSON.parse(raw);
        if (
            typeof data?.filePath !== 'string' ||
            data.filePath.length === 0 ||
            data.filePath.length > FILE_HANDOFF_MAX_CHARS ||
            typeof data?.at !== 'number' ||
            Math.abs(Date.now() - data.at) > HANDOFF_MAX_AGE_MS
        ) {
            return null;
        }
        const noteId = toValidNoteId(data.noteId);
        return {
            filePath: data.filePath,
            reading: toValidResourceReading(data.reading),
            noteId,
            mention:
                noteId === null ? null : toValidSelectionMention(data.mention),
        };
    } catch (_error) {
        return null;
    }
}

/** The waiting file's path, once; null when none waits or it is stale. */
export function takeChatbotFile(): string | null {
    return takeChatbotFileRequest()?.filePath ?? null;
}

// A fifth kind (2026-11-09, the user, with a foreground panel's sessions
// strip circled: _sessions of opening foreground component should be able
// to attached to the chatbot for the chat context_): WHICH session of which
// component -- a chip's menu or a panel header's 🤖 -- never its words.
const FOREGROUND_HANDOFF_KEY = 'chatbot-handoff-foreground';

export function requestChatbotForeground(ask: ForegroundAskType) {
    const valid = toValidForegroundAsk(ask);
    if (valid === null) {
        return;
    }
    setSetting(
        FOREGROUND_HANDOFF_KEY,
        JSON.stringify({ ...valid, at: Date.now() }),
    );
}

/** The waiting foreground session, once; null when none waits or it is stale. */
export function takeChatbotForegroundRequest(): ForegroundAskType | null {
    const raw = getSettingForce(FOREGROUND_HANDOFF_KEY);
    if (!raw) {
        return null;
    }
    removeSetting(FOREGROUND_HANDOFF_KEY);
    try {
        const data = JSON.parse(raw);
        if (
            typeof data?.at !== 'number' ||
            Math.abs(Date.now() - data.at) > HANDOFF_MAX_AGE_MS
        ) {
            return null;
        }
        return toValidForegroundAsk(data);
    } catch (_error) {
        return null;
    }
}

// A fourth kind (2026-10-18, the user, with the robot circled on three
// Lookup Detail panels: _as a user I want to ask the chatbot about
// location/name/bible by opening from the detail panel_): WHICH person,
// place or passage, never its words -- the chat reads those itself through
// `owa_lookup_record` (`lookupAskHelpers.ts`).
const LOOKUP_HANDOFF_KEY = 'chatbot-handoff-lookup';

// Words selected in the passage (a Bible view's selection toolbar) ride
// beside it, quoted in the box like a note's.
export function requestChatbotLookup(
    ask: LookupAskType,
    mention: SelectionMentionType | string | null = null,
) {
    const valid = toValidLookupAsk(ask);
    if (valid === null) {
        return;
    }
    const validMention = toValidSelectionMention(mention);
    setSetting(
        LOOKUP_HANDOFF_KEY,
        JSON.stringify({
            ...valid,
            ...(validMention === null ? {} : { mention: validMention }),
            at: Date.now(),
        }),
    );
}

export type ChatbotLookupRequestType = {
    ask: LookupAskType;
    mention: SelectionMentionType | null;
};

/**
 * The waiting record to ask about and the words selected in it, once; null
 * when none waits or it is stale.
 */
export function takeChatbotLookupRequest(): ChatbotLookupRequestType | null {
    const raw = getSettingForce(LOOKUP_HANDOFF_KEY);
    if (!raw) {
        return null;
    }
    removeSetting(LOOKUP_HANDOFF_KEY);
    try {
        const data = JSON.parse(raw);
        if (
            typeof data?.at !== 'number' ||
            Math.abs(Date.now() - data.at) > HANDOFF_MAX_AGE_MS
        ) {
            return null;
        }
        const ask = toValidLookupAsk(data);
        return ask === null
            ? null
            : { ask, mention: toValidSelectionMention(data.mention) };
    } catch (_error) {
        return null;
    }
}

/** The waiting record to ask about, once; null when none waits or it is stale. */
export function takeChatbotLookup(): LookupAskType | null {
    return takeChatbotLookupRequest()?.ask ?? null;
}

/**
 * An error the app caught, in one line for a report: its kind and message
 * and the window it happened in. Never the stack -- its paths name the
 * computer's account, and the report reads the console for itself.
 */
export function toProblemText(error: unknown, windowTitle: string) {
    const name =
        typeof (error as any)?.name === 'string' ? (error as any).name : '';
    const message =
        typeof error === 'string'
            ? error
            : typeof (error as any)?.message === 'string'
              ? (error as any).message
              : '';
    const said = toPathScrubbed(
        [name, message]
            .filter((part) => {
                return part.length > 0;
            })
            .join(': ')
            .replace(/\s+/g, ' ')
            .trim(),
    );
    const where = windowTitle.trim();
    return (
        'The app showed an error' +
        (where.length > 0 ? ` in the ${where} window` : '') +
        (said.length > 0 ? `: ${said}` : '')
    ).slice(0, HANDOFF_MAX_CHARS);
}
