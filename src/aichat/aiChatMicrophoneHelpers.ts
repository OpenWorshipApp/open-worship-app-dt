// The AI Chat window's side of a site asking for the microphone.
//
// The main process (`electron/aiChatGuestHelpers.ts`) refuses every device a
// guest asks for except one: the microphone, asked for by a site's own page,
// which it hands to THIS window rather than answering itself. Only this
// window knows which tab is in front and which site that tab is on, and the
// person who has to say yes is looking at it. Asked for on 2026-09-14 with a
// picture of claude.ai's "Microphone access is blocked" over its dictation
// button -- the site's own words pointing at a browser address bar this
// window does not have, which left the person nothing to press.

import { checkIsOnAiChatSite } from './aiChatProviders';

// Twins of the channel names in `electron/aiChatGuestHelpers.ts`.
export const AI_CHAT_MICROPHONE_ASK_CHANNEL = 'app:ai-chat:microphone-ask';
export const AI_CHAT_MICROPHONE_SETTLED_CHANNEL =
    'app:ai-chat:microphone-settled';
export const AI_CHAT_MICROPHONE_ANSWER_CHANNEL =
    'main:app:ai-chat-microphone-answer';

export type AiChatMicrophoneAskType = {
    askId: number;
    // The guest the ask came from, by the id `getWebContentsId` answers.
    guestId: number;
    // The host name of the page asking, e.g. `claude.ai`.
    hostname: string;
    // Already allowed for this site since the app started: no line is shown,
    // but the tab in front is still checked, so a tab behind cannot open it.
    isAllowed: boolean;
};

export type MicrophoneDecisionType = 'allow' | 'refuse' | 'ask';

function checkIsWholeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value);
}

/** The ask as the main process sent it, or null when it is not one. */
export function toMicrophoneAsk(data: unknown): AiChatMicrophoneAskType | null {
    if (typeof data !== 'object' || data === null) {
        return null;
    }
    const { askId, guestId, hostname, isAllowed } = data as Record<
        string,
        unknown
    >;
    if (
        !checkIsWholeNumber(askId) ||
        !checkIsWholeNumber(guestId) ||
        typeof hostname !== 'string' ||
        hostname.length === 0
    ) {
        return null;
    }
    return { askId, guestId, hostname, isAllowed: isAllowed === true };
}

/**
 * What to do with an ask: `refuse` it without a word when it did not come
 * from the tab in front, or came from a page that is not that tab's own site
 * (a sign-in page, a link followed off the site); `allow` it when the person
 * already said yes to that site; `ask` the person otherwise.
 *
 * A tab behind is refused even for a site already allowed: a page nobody is
 * looking at has no business opening a microphone in a church hall.
 */
export function decideMicrophoneAsk(
    ask: AiChatMicrophoneAskType,
    front: Readonly<{
        guestId: number | null;
        providerKey: string | null | undefined;
    }>,
): MicrophoneDecisionType {
    if (
        front.guestId !== ask.guestId ||
        !checkIsOnAiChatSite(front.providerKey, ask.hostname)
    ) {
        return 'refuse';
    }
    return ask.isAllowed ? 'allow' : 'ask';
}
