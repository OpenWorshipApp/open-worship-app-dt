/**
 * WHICH foreground session a conversation is about -- a component, one of
 * its sessions, and for Camera Show and Screen Show (which have none) the
 * device or the source screen. Never its words or its look: the help window
 * reads those afresh before every question (`owa_foreground_edit read`).
 *
 * 2026-11-09, the user, with a panel's sessions strip circled: _sessions of
 * opening foreground component should be able to attached to the chatbot
 * for the chat context_. A leaf -- the panel's chip menu, its header 🤖,
 * the hand-over setting and the help window's attachment all read it.
 */
import { checkIsForegroundComponentKey } from '../../presenter-foreground/foregroundComponentKeys';
import type { ForegroundComponentKeyType } from '../../presenter-foreground/foregroundComponentKeys';

export type ForegroundAskType = {
    widget: ForegroundComponentKeyType;
    /** `''` is a panel's Default session. */
    sessionId: string;
    /** As the strip shows it, for the chip -- a person typed it. */
    sessionName: string;
    /** A camera's device id or a source screen's number. */
    itemId?: string;
    /** A camera's name, for the chip. */
    itemLabel?: string;
};

// A session id is the empty string or `s<base36 time>` (`genMediaSessionId`).
const SESSION_ID_PATTERN = /^(?:|s[a-z0-9]{1,20})$/;
const MAX_NAME_LENGTH = 80;
const MAX_ITEM_LENGTH = 200;

function toCleanText(value: unknown, maxLength: number) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
        : '';
}

/**
 * The subject as it may be kept and handed over: field by field, never
 * spread, because it arrives from a setting and a saved conversation.
 */
export function toValidForegroundAsk(value: unknown): ForegroundAskType | null {
    if (value === null || typeof value !== 'object') {
        return null;
    }
    const data = value as Record<string, unknown>;
    if (!checkIsForegroundComponentKey(data.widget)) {
        return null;
    }
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
    if (!SESSION_ID_PATTERN.test(sessionId)) {
        return null;
    }
    const itemId = toCleanText(data.itemId, MAX_ITEM_LENGTH);
    const itemLabel = toCleanText(data.itemLabel, MAX_NAME_LENGTH);
    return {
        widget: data.widget,
        sessionId,
        sessionName: toCleanText(data.sessionName, MAX_NAME_LENGTH),
        ...(itemId === '' ? {} : { itemId }),
        ...(itemLabel === '' ? {} : { itemLabel }),
    };
}

/** The same session, whichever chip or hand-over carries it. */
export function checkIsSameForegroundAsk(
    one: ForegroundAskType,
    other: ForegroundAskType,
) {
    return (
        one.widget === other.widget &&
        one.sessionId === other.sessionId &&
        (one.itemId ?? '') === (other.itemId ?? '')
    );
}
