// Which of the open AI Chat windows this one is.
//
// Several can be open at once, and each keeps its own tabs under a key named
// for its SLOT (`aiChatSessionHelpers.ts`). The main process hands the slots
// out, because only it can see every window (`electron/aiChatWindowHelpers.ts`,
// which also says why). Its own file for the reason `aiChatSignOutHelpers.ts`
// is one: `appProvider` touches `document` when it loads, and the session
// helpers are tested in node.

import appProvider from '../server/appProvider';

// Twins of the names in `electron/aiChatWindowHelpers.ts`.
const AI_CHAT_WINDOW_SLOT_CHANNEL = 'main:app:ai-chat-window-slot';
export const AI_CHAT_SIGNED_OUT_CHANNEL = 'app:ai-chat:signed-out';
const AI_CHAT_HAND_TAB_CHANNEL = 'main:app:ai-chat-hand-tab';
const AI_CHAT_TAKE_TAB_CHANNEL = 'main:app:ai-chat-take-tab';
// Past anything the main process's cap hands out; a number beyond it is not
// a slot but a mistake, and would name a setting nothing ever cleans up.
const MAX_SLOT = 7;

/** Whether a value from the main process is a slot at all. */
export function toAiChatWindowSlot(value: unknown) {
    return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= MAX_SLOT
        ? value
        : 0;
}

/**
 * A tab dragged out of this window, handed to the main process for the new
 * window about to be opened under `uuid`. Synchronous, so the tab is there
 * before the window is. False when it was not taken in.
 */
export function handAiChatTab(uuid: string, tab: unknown) {
    try {
        return (
            appProvider.messageUtils.sendDataSync(AI_CHAT_HAND_TAB_CHANNEL, {
                uuid,
                tab,
            }) === true
        );
    } catch (_error) {
        return false;
    }
}

/**
 * The tab this window was opened to hold, if it was opened by a tab dragged
 * out of another -- still unchecked, for `toAiChatSession` to read.
 */
export function takeHandedAiChatTab(): unknown {
    try {
        return appProvider.messageUtils.sendDataSync(AI_CHAT_TAKE_TAB_CHANNEL);
    } catch (_error) {
        return null;
    }
}

let slot: number | null = null;
/**
 * This window's slot, asked once. The main process keeps it for the
 * window's whole life, a reload included, so asking again would say the
 * same thing. A failure is slot 0 -- the key a single window always used.
 */
export function getAiChatWindowSlot() {
    if (slot === null) {
        try {
            slot = toAiChatWindowSlot(
                appProvider.messageUtils.sendDataSync(
                    AI_CHAT_WINDOW_SLOT_CHANNEL,
                ),
            );
        } catch (_error) {
            slot = 0;
        }
    }
    return slot;
}
