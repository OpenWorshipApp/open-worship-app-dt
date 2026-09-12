// The questions this window has been asked before, and the walk back through
// them.
//
// A volunteer asks nearly the same thing twice: the verse reference was wrong,
// the screen number was wrong, the model answered the neighbouring question.
// Retyping a sentence on a machine in a back room, minutes before a service,
// is the part of using this window that costs the most and teaches the least
// -- so the box remembers, the way a terminal does, and **Alt+↑ / Alt+↓** walk
// it. Alt rather than the bare arrows because the bare ones already belong to
// two things that matter more: the caret (the box holds several lines now) and
// the type-ahead list.
//
// It is ONE list for the whole window, not one per tab. What was asked is a
// thing the user typed, not a thing that belongs to a conversation, and the
// tab it was typed in is usually not the tab they are in when they want it
// back -- a second tab is opened precisely BECAUSE the first one went wrong.
//
// Everything here is capped three ways (count, one entry's length, the whole
// blob) because this rides `appLocalStorage`, which is a synchronous write on
// a machine that has nothing to spare, and a list nobody trims is how a
// settings file reaches megabytes.

import { getSetting, setSetting } from '../helper/settingHelpers';
import type { ChatSessionType } from './chatSessionHelpers';

const HISTORY_SETTING_NAME = 'chatbot-ask-history';

// Newest FIRST in the array, so index 0 is the first press of Alt+↑ and the
// oldest entry is the one that falls off the end.
export const MAX_ASK_HISTORY_COUNT = 30;
// A question longer than this is not a question any more -- it is a pasted log
// or a whole document -- and it is not REMEMBERED rather than remembered cut
// in half: a recalled question that has silently lost its end is worse than
// one the user has to paste again, because they would ask it as it stands.
const MAX_ASK_LENGTH = 2000;
// ...and the whole list has a budget of its own, so thirty long ones cannot
// add up to a settings file worth reading synchronously at startup.
const MAX_ASK_HISTORY_LENGTH = 20000;

/** Nothing chosen -- the box holds what the user typed themselves. */
export const NO_ASK_HISTORY_INDEX = -1;

function checkIsRememberable(text: string) {
    return text.length > 0 && text.length <= MAX_ASK_LENGTH;
}

function toCappedHistory(history: string[]) {
    const capped: string[] = [];
    let total = 0;
    for (const one of history.slice(0, MAX_ASK_HISTORY_COUNT)) {
        total += one.length;
        if (total > MAX_ASK_HISTORY_LENGTH) {
            break;
        }
        capped.push(one);
    }
    return capped;
}

/**
 * The list with this question at the front of it.
 *
 * An identical earlier entry is REMOVED rather than left where it was: asking
 * the same thing three times is what happens when it is being got right, and a
 * walk back through three copies of it is a walk through nothing. The text is
 * kept verbatim (trimmed only), because the point of recalling it is to ask it
 * again -- a normalised one would go back to the model as something the user
 * never wrote.
 */
export function toAskHistoryAdded(history: string[], asked: string) {
    const text = asked.trim();
    if (!checkIsRememberable(text)) {
        return history;
    }
    return toCappedHistory([
        text,
        ...history.filter((one) => {
            return one !== text;
        }),
    ]);
}

/**
 * Where a press of Alt+↑ (`step` 1, older) or Alt+↓ (`step` -1, newer) lands.
 *
 * It CLAMPS rather than wraps at both ends. Wrapping past the oldest entry
 * would put the newest question back in the box with nothing on screen saying
 * the walk had started over, and the user's own half-written words -- kept at
 * index -1 -- are the thing they must always be able to get back to.
 */
export function toAskHistoryIndex(count: number, index: number, step: number) {
    const oldest = count - 1;
    const next = index + step;
    if (next < NO_ASK_HISTORY_INDEX) {
        return NO_ASK_HISTORY_INDEX;
    }
    if (next > oldest) {
        return Math.max(NO_ASK_HISTORY_INDEX, oldest);
    }
    return next;
}

/**
 * What the window has been asked before, or -- the first time, before this
 * ever wrote anything -- what the saved conversations say it was asked.
 *
 * The seed matters more than it looks: without it the feature is invisible to
 * everyone who has used this window until now, since the only way to find out
 * that Alt+↑ does anything is to press it and get something back.
 */
export function loadAskHistory(sessions?: ChatSessionType[]) {
    const stored = getSetting(HISTORY_SETTING_NAME);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            const history = (Array.isArray(parsed) ? parsed : [])
                .filter((one: any) => {
                    return typeof one === 'string';
                })
                .map((one: string) => {
                    return one.trim();
                })
                .filter(checkIsRememberable);
            // Deduped on the way in as well as on the way out: this is plain
            // JSON on disk and a hand-edited file must not be able to fill the
            // walk with copies of one line.
            return toCappedHistory([...new Set<string>(history)]);
        } catch (_error) {
            // A half-written file is not worth a word to someone about to
            // start a service. They get an empty walk.
            return [];
        }
    }
    return sessions === undefined ? [] : genAskHistoryFromSessions(sessions);
}

export function saveAskHistory(history: string[]) {
    setSetting(HISTORY_SETTING_NAME, JSON.stringify(toCappedHistory(history)));
}

/**
 * The questions in the saved conversations, newest first.
 *
 * Only the ones with no `note` on them. A noted "you" message is not something
 * the user typed -- it is a walkthrough card's rescue, quoted into the
 * transcript so the transcript is honest -- and putting machine instructions
 * into the box behind Alt+↑ would hand them straight back to the model.
 */
export function genAskHistoryFromSessions(sessions: ChatSessionType[]) {
    const asked: string[] = [];
    for (const session of sessions) {
        for (const message of session.messages) {
            if (message.author === 'you' && message.note === undefined) {
                asked.push(message.text.trim());
            }
        }
    }
    const history: string[] = [];
    for (const one of asked.reverse()) {
        if (checkIsRememberable(one) && !history.includes(one)) {
            history.push(one);
        }
    }
    return toCappedHistory(history);
}
