// More than one AI Chat window at a time.
//
// Every press of the ✨ opens another window, up to a cap, the way a browser
// opens another window beside the first. Two things have to hold for that:
//
//  - Each window keeps ITS OWN tabs. The tab list is a setting file, and two
//    windows writing one file each save over the other -- close one and the
//    other's tabs are gone next time. So every open window holds a SLOT, a
//    small number handed out here (the lowest one no open window holds), and
//    the page keeps its tabs under a key named for it
//    (`src/aichat/aiChatSessionHelpers.ts`). The first window is always slot
//    0, which reads the same key a single window always has, so nothing
//    anybody had open before is lost. The cap keeps the slots -- and so the
//    setting keys -- bounded.
//  - A tab can be dragged OUT of a window into a new one of its own. The tab
//    is handed here first, under the uuid the new window is opened with, and
//    the new window takes it as it starts -- the window.open that makes it
//    carries no data of its own, and an address carrying the tab would stop
//    the window being recognised as one of the AI Chat group.
//  - A sign-out is everyone's. All windows share one guest partition, so a
//    sign-out from one ends the sign-in of every site in all of them; the
//    other windows are told, so they throw away pages still showing a
//    conversation whose cookie has just gone.
//
// Its own file, with nothing but electron and the page names under it:
// `electronHelpers.ts` needs the cap, and `aiChatGuestHelpers.ts` reaches
// `aiHelpers.ts`, which imports `electronHelpers.ts` back.

import { BrowserWindow, type WebContents } from 'electron';

import { htmlFiles } from './fsServe';

/**
 * How many AI Chat windows may be open at once. Every window keeps up to
 * three sites loaded (`MAX_LIVE_GUEST_COUNT` in the page), and every loaded
 * site is a renderer process of a couple of hundred megabytes -- on the
 * machines this app runs on, three windows is already nine of them. A press
 * past the cap brings the open windows forward instead.
 */
export const MAX_AI_CHAT_WINDOW_COUNT = 3;

// Twins of the names in `src/aichat/aiChatWindowSlotHelpers.ts`.
export const AI_CHAT_WINDOW_SLOT_CHANNEL = 'main:app:ai-chat-window-slot';
export const AI_CHAT_SIGNED_OUT_CHANNEL = 'app:ai-chat:signed-out';
export const AI_CHAT_HAND_TAB_CHANNEL = 'main:app:ai-chat-hand-tab';
export const AI_CHAT_TAKE_TAB_CHANNEL = 'main:app:ai-chat-take-tab';

// A new window starts in well under a second; one that never came (the cap
// refused it) must not leave a tab here for the next window to find.
const HANDED_TAB_TTL_MILLISECOND = 30_000;
// Far past any real tab -- a name, a page title, an address -- and short of
// anything worth holding in the main process for a renderer.
const MAX_HANDED_TAB_LENGTH = 8_000;

// ONE at a time, like the chatbot's held attachment: a tab is dragged out by
// a person, and the next drag replaces a hand-off nobody took.
let handedTab: { uuid: string; tab: unknown; at: number } | null = null;

// Keyed by the window's web contents, which a reload keeps, so a window that
// reloads comes back to its own tabs. An entry goes with its window.
const slotMap = new Map<number, number>();

export function checkIsAiChatPageUrl(url: string) {
    if (!URL.canParse(url)) {
        return false;
    }
    const pageName = new URL(url).pathname.split('/').pop() ?? '';
    return pageName === htmlFiles.aichat;
}

/**
 * The slot this AI Chat window holds, claimed on its first ask. Anything that
 * is not an AI Chat page gets 0 and holds nothing.
 */
export function claimAiChatWindowSlot(contents: WebContents) {
    if (!checkIsAiChatPageUrl(contents.getURL())) {
        return 0;
    }
    const knownSlot = slotMap.get(contents.id);
    if (knownSlot !== undefined) {
        return knownSlot;
    }
    const usedSlotSet = new Set(slotMap.values());
    let slot = 0;
    while (usedSlotSet.has(slot)) {
        slot++;
    }
    const contentsId = contents.id;
    slotMap.set(contentsId, slot);
    contents.once('destroyed', () => {
        slotMap.delete(contentsId);
    });
    return slot;
}

/**
 * A tab dragged out of an AI Chat window, held for the window about to be
 * opened under `uuid`. Only an AI Chat page may hand one over, and what is
 * held is re-checked by the page that takes it, field by field, as it is
 * when read back off disk (`toAiChatSession`).
 */
function measureTab(tab: unknown) {
    try {
        return JSON.stringify(tab ?? null).length;
    } catch (_error) {
        // Not JSON at all (a cycle): not a tab either.
        return Infinity;
    }
}

export function handAiChatTab(sender: WebContents, data: unknown) {
    const { uuid, tab } = (data ?? {}) as { uuid?: unknown; tab?: unknown };
    if (
        !checkIsAiChatPageUrl(sender.getURL()) ||
        typeof uuid !== 'string' ||
        uuid.length === 0 ||
        measureTab(tab) > MAX_HANDED_TAB_LENGTH
    ) {
        return false;
    }
    handedTab = { uuid, tab, at: Date.now() };
    return true;
}

/** The tab held for the window opened under the sender's own uuid, once. */
export function takeAiChatTab(sender: WebContents) {
    const url = sender.getURL();
    if (handedTab === null || !checkIsAiChatPageUrl(url)) {
        return null;
    }
    const { uuid, tab, at } = handedTab;
    if (Date.now() - at > HANDED_TAB_TTL_MILLISECOND) {
        handedTab = null;
        return null;
    }
    if (new URL(url).searchParams.get('uuid') !== uuid) {
        return null;
    }
    handedTab = null;
    return tab;
}

/** The OTHER AI Chat windows, told that every site was just signed out of. */
export function tellOtherAiChatWindowsSignedOut(sender: WebContents) {
    for (const win of BrowserWindow.getAllWindows()) {
        if (win.isDestroyed()) {
            continue;
        }
        const { webContents } = win;
        if (
            webContents.id === sender.id ||
            !checkIsAiChatPageUrl(webContents.getURL())
        ) {
            continue;
        }
        webContents.send(AI_CHAT_SIGNED_OUT_CHANNEL);
    }
}
