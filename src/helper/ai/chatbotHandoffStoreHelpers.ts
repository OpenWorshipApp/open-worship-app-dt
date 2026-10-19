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

export function requestChatbotFile(filePath: string) {
    if (filePath.length > FILE_HANDOFF_MAX_CHARS) {
        return;
    }
    setSetting(FILE_HANDOFF_KEY, JSON.stringify({ filePath, at: Date.now() }));
}

/** The waiting file's path, once; null when none waits or it is stale. */
export function takeChatbotFile(): string | null {
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
        return data.filePath;
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

export function requestChatbotLookup(ask: LookupAskType) {
    const valid = toValidLookupAsk(ask);
    if (valid === null) {
        return;
    }
    setSetting(
        LOOKUP_HANDOFF_KEY,
        JSON.stringify({ ...valid, at: Date.now() }),
    );
}

/** The waiting record to ask about, once; null when none waits or it is stale. */
export function takeChatbotLookup(): LookupAskType | null {
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
        return toValidLookupAsk(data);
    } catch (_error) {
        return null;
    }
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
