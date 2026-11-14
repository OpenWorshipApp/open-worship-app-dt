/**
 * WORDS SELECTED where they are read, quoted in the help window's box for a
 * question about them.
 *
 * Asked for 2026-11-08 (the user: _as a user I want to select bible note
 * text then click the agent button then writing a qustion about the
 * selected text_; then, with a Bible view's selection bar in a picture,
 * _add the agent button for bible selected text as well_; _should provide
 * selection range in the input text for enough context, for bible should
 * include selection range among bible verse_; and _should reuse existing
 * (attached window) chatbot tab_). The 🤖 on a note window's selection bar
 * and on a Bible view's hands the words over beside the note or the verse,
 * with the words around them and where they sit
 * (`chatbotHandoffStoreHelpers.ts`); the window puts them in the box of the
 * conversation on that note or verse, else of the one working in that
 * window, and the person writes the question under them.
 *
 * Pure, every rule a test: no store, no tool call, no model.
 */
import type { SelectionMentionType } from '../helper/ai/chatbotHandoffStoreHelpers';
import { toPreviewPathKey } from '../helper/ai/windowOnTopRequestHelpers';
import type { ChatAttachmentType } from './attachmentHelpers';
import {
    checkIsFileAttachment,
    findOpenFileAttachments,
} from './attachmentHelpers';
import { fillWords, tran } from './chatTranHelpers';
import type { BotActionType } from './helpBotHelpers';

// The selection inside its line. Two asterisks a side: what every model
// reads as words picked out, and the prompts say so -- the note read's own
// **bold** is not in this quote, which is the words as the screen shows them.
const SELECTION_MARK = '**';

// The source's name, and a text file's lines the words are on after it the
// way an editor and every model write them -- `notes.md:7`, `notes.md:7-9`
// -- with no word of any language to translate.
function toSourceWhere(
    sourceName: string,
    lines: SelectionMentionType['lines'],
) {
    const name = sourceName.replace(/\s+/g, ' ').trim();
    if (lines === undefined || name.length === 0) {
        return name;
    }
    const range =
        lines.first === lines.last
            ? `${lines.first}`
            : `${lines.first}-${lines.last}`;
    return `${name}:${range}`;
}

/**
 * The words as the box quotes them: what they are, where they are from
 * (the note's name, the passage's title, a text file's name and lines) and
 * their first and last character in their line or verse, then their line
 * or verse as a `> ` quote with the
 * selection marked -- a frame every model reads as words the person points
 * at, in any language (`NOTE_SYSTEM_PROMPT` and `LOOKUP_SYSTEM_PROMPT` say
 * so). With nothing around it, the selection alone, unmarked. Null for no
 * words.
 */
export function toSelectionMentionText(
    sourceName: string,
    mention: SelectionMentionType,
) {
    const lineList = mention.text
        .split('\n')
        .map((line) => {
            return line.trim();
        })
        .filter((line) => {
            return line.length > 0;
        });
    if (lineList.length === 0) {
        return null;
    }
    const isMarked =
        mention.before.trim().length > 0 || mention.after.trim().length > 0;
    const quoted = lineList
        .map((line, index) => {
            const words = isMarked
                ? `${SELECTION_MARK}${line}${SELECTION_MARK}`
                : line;
            const before = index === 0 ? mention.before : '';
            const after = index === lineList.length - 1 ? mention.after : '';
            return `> ${(before + words + after).trim()}`;
        })
        .join('\n');
    const where = [
        toSourceWhere(sourceName, mention.lines),
        mention.start === null || mention.end === null
            ? ''
            : `${mention.start}-${mention.end}`,
    ].filter((part) => {
        return part.length > 0;
    });
    return (
        tran('Selected text') +
        (where.length > 0 ? ` (${where.join(', ')})` : '') +
        ':\n' +
        quoted
    );
}

/**
 * Whether the box holds selected words quoted (a `> ` line): what is typed
 * under them is a question about them, so no app question is offered over
 * it -- seen live, the quote of a note line naming John 3:16 brought up
 * six of them.
 */
export function checkHasSelectionQuote(draft: string) {
    return /(?:^|\n)> \S/.test(draft);
}

/**
 * The box with a quote added under what is in it, and a new line for the
 * question to start on. The same quote twice is put in once.
 */
export function appendSelectionMention(draft: string, mention: string) {
    if (draft.includes(mention)) {
        return draft;
    }
    const before = draft.replace(/\s+$/, '');
    return (before.length > 0 ? `${before}\n\n` : '') + `${mention}\n`;
}

// --- what to do with words selected in a note -------------------------------
//
// 2026-11-08, the user: _for bible note selected text: if user did not ask
// anything then try to provide options for user, like spell check
// translation change case do google search ..._ Under the quote, a card of
// the jobs asked of a few words most, each a press. A pseudo tool no model
// can press, carrying the quote and the words: an old button acts on its
// own words.

export const SELECTION_STEP_TOOL_NAME = 'owa_window_selection_step';

type SelectionJobType = {
    job: string;
    // Stored in English, drawn through the dictionary (`tranLabel`).
    label: string;
    // What the assistant is asked under the quote; none for the jobs the
    // window does itself.
    ask?: string;
};

const SELECTION_JOB_LIST: readonly SelectionJobType[] = [
    {
        job: 'explain',
        label: 'Explain it in simple words',
        ask: 'Explain these words in simple words.',
    },
    {
        job: 'spelling',
        label: 'Check the spelling',
        ask: 'Check the spelling of these words and correct any mistake in the note.',
    },
    {
        job: 'translate-replace',
        label: 'Replace the words with another language',
        ask: 'Translate these words: replace them with another language.',
    },
    {
        job: 'translate-add',
        label: 'Add another language under each line',
        ask: 'Translate these words: add another language under them, keeping them.',
    },
    {
        job: 'uppercase',
        label: 'Uppercase',
        ask: 'Make these words uppercase.',
    },
    { job: 'google', label: 'Search Selected Text on Google' },
    { job: 'copy', label: 'Copy Selected Text' },
];

/** Every label the card stores in English (held by `chatTranLabels.test`). */
export const SELECTION_ACTION_LABEL_LIST = SELECTION_JOB_LIST.map((one) => {
    return one.label;
});

const MAX_OFFER_NAME_CHARS = 60;

/**
 * The card under a note's selection: what to do with these words, a button
 * a job. `quote` is the box's quote (`toSelectionMentionText`).
 */
export function genSelectionOffer(quote: string, words: string) {
    const line = words.replace(/\s+/g, ' ').trim();
    const name =
        line.length > MAX_OFFER_NAME_CHARS
            ? `${line.slice(0, MAX_OFFER_NAME_CHARS).trimEnd()}…`
            : line;
    const actions: BotActionType[] = SELECTION_JOB_LIST.map((one) => {
        return {
            label: one.label,
            toolName: SELECTION_STEP_TOOL_NAME,
            args: { job: one.job, quote, words },
        };
    });
    return {
        text: fillWords(tran('What would you like to do with {name}?'), {
            name: `“${name}”`,
        }),
        actions,
    };
}

export type SelectionStepType = {
    job: string;
    quote: string;
    words: string;
    // For a job the assistant does: what it is asked, in English.
    ask: string | null;
    label: string;
};

/** A pressed button's job, or null for one that does not check out. */
export function toValidSelectionStep(args: any): SelectionStepType | null {
    const found = SELECTION_JOB_LIST.find((one) => {
        return one.job === args?.job;
    });
    if (
        found === undefined ||
        typeof args.quote !== 'string' ||
        typeof args.words !== 'string' ||
        args.words.trim().length === 0
    ) {
        return null;
    }
    return {
        job: found.job,
        quote: args.quote,
        words: args.words,
        ask: found.ask ?? null,
        label: found.label,
    };
}

/** The question a job asks: the quote, then the job under it. */
export function toSelectionStepAsk(quote: string, job: string) {
    return `${quote.trim()}\n${job}`;
}

const MAX_SEARCH_CHARS = 200;

/** A Google search for the words alone, built at the press. */
export function toSelectionSearchUrl(words: string) {
    const url = new URL('https://www.google.com/search');
    url.searchParams.set(
        'q',
        words.replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_CHARS),
    );
    return url.toString();
}

/**
 * The tab a selection's quote goes to: one already on that note or passage
 * (`isOnIt`), else one working in the window the words were selected in;
 * the tab in front first, then the newest. Null: a tab of its own.
 */
export function pickSelectionSession<T extends { id: string }>(
    sessions: readonly T[],
    activeId: string,
    checkIsOnIt: (session: T) => boolean,
    checkIsInWindow: (session: T) => boolean,
): { sessionId: string; isOnIt: boolean } | null {
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
    const onIt = ordered.find(checkIsOnIt);
    if (onIt !== undefined) {
        return { sessionId: onIt.id, isOnIt: true };
    }
    const inWindow = ordered.find(checkIsInWindow);
    return inWindow === undefined
        ? null
        : { sessionId: inWindow.id, isOnIt: false };
}

/**
 * The tab already on a whole FILE -- waiting in its box, or still open in
 * what it asked (`findOpenFileAttachments`) -- and the file's attachment
 * there; the tab in front first, then the newest. A note of the file is not
 * the file. Null when no tab holds it, and the file is attached in a tab of
 * its own. Paths compare as the window aim compares them, slashes and case
 * alike (`toPreviewPathKey`).
 */
export function findSessionHoldingFile(
    sessions: readonly {
        id: string;
        messages: Parameters<typeof findOpenFileAttachments>[0];
        fileClosedAt?: number;
    }[],
    draftAttachmentMap: Readonly<
        Record<string, readonly ChatAttachmentType[] | undefined>
    >,
    activeId: string,
    filePath: string,
): { sessionId: string; attachment: ChatAttachmentType } | null {
    const key = toPreviewPathKey(filePath);
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
            ...(draftAttachmentMap[session.id] ?? []).filter(
                checkIsFileAttachment,
            ),
            ...findOpenFileAttachments(session.messages, session.fileClosedAt),
        ].find((one) => {
            return (
                one.noteId === undefined &&
                one.filePath !== undefined &&
                toPreviewPathKey(one.filePath) === key
            );
        });
        if (attachment !== undefined) {
            return { sessionId: session.id, attachment };
        }
    }
    return null;
}
