// The AI Chat window's tabs, and the file they live in.
//
// The shape of `chatSessionHelpers.ts` applied to a different kind of tab:
// one that holds a WEBSITE rather than a conversation with the app's
// assistant. The conversation itself lives on the company's site, under the
// user's own account, so what a tab keeps is small -- which site, where on it
// the tab last was, what the tab is called, and its lock -- and the same rules
// hold: one small setting file, caps on everything, fields listed rather than
// spread on the way back off disk.

import {
    getSetting,
    getSettingForce,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import {
    genSessionId,
    toChatSessionTitle,
} from '../chatbot/chatSessionHelpers';
import { checkIsOnAiChatSite, getAiChatProvider } from './aiChatProviders';

export type AiChatSessionType = {
    id: string;
    // Which site this tab holds, or null for a tab still on the chooser.
    providerKey: string | null;
    // The name the user typed over the tab, if they did.
    title: string;
    // The last title the site gave its page -- the conversation's name, on
    // every site in the list -- which is what the tab is called until the user
    // names it.
    pageTitle: string;
    // Where the tab last was ON THE SITE, so it reopens on the same
    // conversation. Never a sign-in page: see `toKeptUrl`.
    lastUrl: string | null;
    isLocked: boolean;
    // When the tab was last in front. Which guests stay loaded is decided by
    // this (`toLiveSessionIds`), not by the strip's order.
    lastUsedAt: number;
};

export type AiChatSessionStateType = {
    sessions: AiChatSessionType[];
    activeId: string;
};

const SESSIONS_SETTING_NAME = 'aichat-sessions';
// One past the most AI Chat windows the main process lets be open at once
// (`MAX_AI_CHAT_WINDOW_COUNT`, `electron/aiChatWindowHelpers.ts`), with room:
// a sign-out sweeps every slot up to here.
const MAX_WINDOW_SLOT_COUNT = 8;
export const MAX_AI_CHAT_SESSION_COUNT = 8;
/**
 * How many tabs keep their site LOADED at once. Every loaded site is a
 * renderer process of its own -- ChatGPT's page is a couple of hundred
 * megabytes on its own -- and this app runs on machines that cannot spare
 * that eight times over. The tab in front plus the two used most recently
 * stay; the rest reload their last page when they are chosen again, which
 * costs a second and loses nothing, because the conversation lives on the
 * site.
 */
export const MAX_LIVE_GUEST_COUNT = 3;
const MAX_PAGE_TITLE_LENGTH = 60;
const MAX_SHOWN_TITLE_LENGTH = 26;
// A conversation address is a few dozen characters. One past this is not an
// address worth writing to the settings file on every navigation.
const MAX_URL_LENGTH = 2000;

export function genNewAiChatSession(
    providerKey: string | null = null,
): AiChatSessionType {
    return {
        id: genSessionId(),
        providerKey,
        title: '',
        pageTitle: '',
        lastUrl: null,
        isLocked: false,
        lastUsedAt: Date.now(),
    };
}

/** What the site said its page is called, trimmed to something storable. */
export function toPageTitle(text: string) {
    return text.trim().replace(/\s+/g, ' ').slice(0, MAX_PAGE_TITLE_LENGTH);
}

/**
 * The name on the tab: what the user typed, else what the site calls the
 * page, else the site, else nothing yet.
 */
export function genAiChatSessionTitle(session: AiChatSessionType) {
    if (session.title.length > 0) {
        return session.title;
    }
    const provider = getAiChatProvider(session.providerKey);
    if (session.pageTitle.length > 0) {
        return session.pageTitle.length <= MAX_SHOWN_TITLE_LENGTH
            ? session.pageTitle
            : session.pageTitle.slice(0, MAX_SHOWN_TITLE_LENGTH - 1) + '…';
    }
    return provider?.name ?? 'New chat';
}

/**
 * The address a tab may remember, or null.
 *
 * Only a page ON the site: https, on one of the provider's own hosts. A
 * sign-in page on accounts.google.com is where a tab often is when the window
 * closes, and reopening onto it lands the user on an expired half of a
 * redirect; reopening onto the site's home instead lets the site send them
 * wherever it needs to.
 */
export function toKeptUrl(providerKey: string | null, url: unknown) {
    const provider = getAiChatProvider(providerKey);
    if (
        provider === null ||
        typeof url !== 'string' ||
        url.length > MAX_URL_LENGTH ||
        !URL.canParse(url)
    ) {
        return null;
    }
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') {
        return null;
    }
    return checkIsOnAiChatSite(provider.key, hostname) ? url : null;
}

/**
 * Whether "clear all" would change anything. One unnamed tab still on the
 * chooser is exactly what clearing leaves behind.
 */
export function checkCanClearAiChatSessions(sessions: AiChatSessionType[]) {
    return sessions.some((session) => {
        return (
            !session.isLocked &&
            (sessions.length > 1 ||
                session.providerKey !== null ||
                session.title.length > 0)
        );
    });
}

/**
 * The tabs whose site stays loaded: the one in front, then the most recently
 * used, up to the cap. A tab still on the chooser has no site to load and
 * takes no place.
 */
export function toLiveSessionIds(
    sessions: AiChatSessionType[],
    activeId: string,
    maxCount = MAX_LIVE_GUEST_COUNT,
) {
    const liveIds = new Set<string>();
    const ranked = sessions
        .filter((session) => {
            return session.providerKey !== null;
        })
        .sort((a, b) => {
            if (a.id === activeId) {
                return -1;
            }
            if (b.id === activeId) {
                return 1;
            }
            return b.lastUsedAt - a.lastUsedAt;
        });
    for (const session of ranked.slice(0, maxCount)) {
        liveIds.add(session.id);
    }
    return liveIds;
}

// Listed, never spread: this file is plain JSON on disk and a hand-edited one
// must not be able to put an arbitrary address into a guest. The same check
// reads a tab dragged in from another window (`toAiChatSession`).
function toValidSession(raw: any): AiChatSessionType | null {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }
    if (typeof raw.id !== 'string' || raw.id.length === 0) {
        return null;
    }
    const providerKey =
        getAiChatProvider(raw.providerKey) === null ? null : raw.providerKey;
    return {
        id: raw.id,
        providerKey,
        title:
            typeof raw.title === 'string' ? toChatSessionTitle(raw.title) : '',
        // A page title belongs to the site it was read off; a tab whose site
        // this build no longer knows is back on the chooser, and is called so.
        pageTitle:
            providerKey !== null && typeof raw.pageTitle === 'string'
                ? toPageTitle(raw.pageTitle)
                : '',
        lastUrl: toKeptUrl(providerKey, raw.lastUrl),
        isLocked: raw.isLocked === true,
        lastUsedAt:
            typeof raw.lastUsedAt === 'number' &&
            Number.isFinite(raw.lastUsedAt) &&
            raw.lastUsedAt > 0
                ? raw.lastUsedAt
                : 0,
    };
}

/**
 * The key a window's tabs are kept under. Several AI Chat windows can be
 * open at once, and each holds a SLOT (`aiChatWindowSlotHelpers.ts`); the
 * first keeps the key a single window always had, so a window that was open
 * before there could be more than one comes back with its tabs.
 */
export function genAiChatSessionsSettingName(slot = 0) {
    return slot === 0
        ? SESSIONS_SETTING_NAME
        : `${SESSIONS_SETTING_NAME}-${slot + 1}`;
}

/**
 * A tab another AI Chat window handed over when it was dragged out of it,
 * read field by field as a tab off disk is, or null. It is in front from the
 * moment it arrives.
 */
export function toAiChatSession(raw: unknown) {
    const session = toValidSession(raw);
    return session === null ? null : { ...session, lastUsedAt: Date.now() };
}

/** What was on screen last time in this slot, or one tab on the chooser. */
export function loadAiChatSessions(
    slot = 0,
    isForced = false,
): AiChatSessionStateType {
    const settingName = genAiChatSessionsSettingName(slot);
    const stored = isForced
        ? getSettingForce(settingName)
        : getSetting(settingName);
    let sessions: AiChatSessionType[] = [];
    let activeId = '';
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            sessions = (Array.isArray(parsed?.sessions) ? parsed.sessions : [])
                .map(toValidSession)
                .filter((session: AiChatSessionType | null) => {
                    return session !== null;
                })
                .slice(-MAX_AI_CHAT_SESSION_COUNT);
            activeId =
                typeof parsed?.activeId === 'string' ? parsed.activeId : '';
        } catch (_error) {
            // A half-written or hand-edited file is not worth a message: the
            // user gets a fresh tab and the site still has every conversation.
            sessions = [];
        }
    }
    if (sessions.length === 0) {
        sessions = [genNewAiChatSession()];
    }
    const isActiveIdKnown = sessions.some((session) => {
        return session.id === activeId;
    });
    return {
        sessions,
        activeId: isActiveIdKnown ? activeId : sessions[0].id,
    };
}

export function saveAiChatSessions(state: AiChatSessionStateType, slot = 0) {
    const sessions = state.sessions.slice(-MAX_AI_CHAT_SESSION_COUNT);
    setSetting(
        genAiChatSessionsSettingName(slot),
        JSON.stringify({ sessions, activeId: state.activeId }),
    );
}

/**
 * What a sign-out leaves of a window's tabs: the names the user typed stay,
 * what came FROM the sites -- their pages and the names they gave them --
 * goes.
 */
export function toSignedOutAiChatSessions(
    state: AiChatSessionStateType,
): AiChatSessionStateType {
    return {
        ...state,
        sessions: state.sessions.map((session) => {
            return { ...session, pageTitle: '', lastUrl: null };
        }),
    };
}

/**
 * A sign-out swept through every OTHER slot's saved tabs, and the list of
 * recently closed ones. A window that is
 * open is told as well and does the same to its own (`AiChatAppComp`); this
 * is for the windows that are closed, whose tabs would otherwise go on
 * holding the previous person's conversation names in the settings file.
 */
export function forgetAiChatSiteTraces(exceptSlot: number) {
    forgetAiChatClosedTabs();
    for (let slot = 0; slot < MAX_WINDOW_SLOT_COUNT; slot++) {
        // Past the setting store's short cache: the other windows write
        // these, not this one.
        if (
            slot === exceptSlot ||
            !getSettingForce(genAiChatSessionsSettingName(slot))
        ) {
            continue;
        }
        saveAiChatSessions(
            toSignedOutAiChatSessions(loadAiChatSessions(slot, true)),
            slot,
        );
    }
}

// ---------------------------------------------------------------------------
// Recently closed tabs.
//
// A closed tab is gone from the strip but not from the site: its conversation
// is still there under the user's account, at the address the tab was on. So
// what a closed tab leaves behind is that address and its names, newest
// first, for the window to offer back -- the browser's "reopen closed tab".
// ONE list for every AI Chat window, like the sign-ins it belongs with: a tab
// closed in one window is reopened from another as easily. It holds what came
// from the sites (a conversation's name, its address), so a sign-out empties
// it along with the rest (`forgetAiChatSiteTraces`).

export type AiChatClosedTabType = {
    id: string;
    providerKey: string;
    title: string;
    pageTitle: string;
    lastUrl: string | null;
    closedAt: number;
};

const CLOSED_TABS_SETTING_NAME = 'aichat-closed-tabs';
export const MAX_AI_CHAT_CLOSED_TAB_COUNT = 20;

// Listed, never spread, for the reason `toValidSession` gives.
function toValidClosedTab(raw: any): AiChatClosedTabType | null {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }
    if (
        typeof raw.id !== 'string' ||
        raw.id.length === 0 ||
        getAiChatProvider(raw.providerKey) === null
    ) {
        return null;
    }
    return {
        id: raw.id,
        providerKey: raw.providerKey,
        title:
            typeof raw.title === 'string' ? toChatSessionTitle(raw.title) : '',
        pageTitle:
            typeof raw.pageTitle === 'string' ? toPageTitle(raw.pageTitle) : '',
        lastUrl: toKeptUrl(raw.providerKey, raw.lastUrl),
        closedAt:
            typeof raw.closedAt === 'number' && Number.isFinite(raw.closedAt)
                ? raw.closedAt
                : 0,
    };
}

/**
 * The list as it is on disk NOW. Read past the setting store's short cache,
 * because another AI Chat window may have just closed a tab into it.
 */
export function loadAiChatClosedTabs(): AiChatClosedTabType[] {
    const stored = getSettingForce(CLOSED_TABS_SETTING_NAME);
    if (!stored) {
        return [];
    }
    try {
        const parsed = JSON.parse(stored);
        return (Array.isArray(parsed) ? parsed : [])
            .map(toValidClosedTab)
            .filter((tab: AiChatClosedTabType | null) => {
                return tab !== null;
            })
            .slice(0, MAX_AI_CHAT_CLOSED_TAB_COUNT);
    } catch (_error) {
        return [];
    }
}

function saveAiChatClosedTabs(closedTabs: AiChatClosedTabType[]) {
    setSetting(
        CLOSED_TABS_SETTING_NAME,
        JSON.stringify(closedTabs.slice(0, MAX_AI_CHAT_CLOSED_TAB_COUNT)),
    );
}

/** The same conversation twice is one entry: the newer. */
function toClosedTabKey(tab: { providerKey: string; lastUrl: string | null }) {
    return tab.lastUrl === null ? null : `${tab.providerKey} ${tab.lastUrl}`;
}

/**
 * Closed tabs put at the top of the list. A tab still on the chooser was
 * never anywhere, and is not worth offering back.
 */
export function rememberClosedAiChatTabs(sessions: AiChatSessionType[]) {
    const closedAt = Date.now();
    const added: AiChatClosedTabType[] = [];
    for (const session of sessions) {
        if (session.providerKey === null) {
            continue;
        }
        added.push({
            id: genSessionId(),
            providerKey: session.providerKey,
            title: session.title,
            pageTitle: session.pageTitle,
            lastUrl: session.lastUrl,
            closedAt,
        });
    }
    if (added.length === 0) {
        return;
    }
    const addedKeySet = new Set(
        added.map(toClosedTabKey).filter((key) => {
            return key !== null;
        }),
    );
    saveAiChatClosedTabs([
        ...added,
        ...loadAiChatClosedTabs().filter((tab) => {
            const key = toClosedTabKey(tab);
            return key === null || !addedKeySet.has(key);
        }),
    ]);
}

/**
 * Takes one entry off the list, to be reopened. The newest when no id is
 * given (Ctrl+Shift+T). Null when it is already gone -- reopened from
 * another window, most likely.
 */
export function takeClosedAiChatTab(id?: string) {
    const closedTabs = loadAiChatClosedTabs();
    const index =
        id === undefined
            ? 0
            : closedTabs.findIndex((tab) => {
                  return tab.id === id;
              });
    const closedTab = closedTabs[index];
    if (closedTab === undefined) {
        return null;
    }
    closedTabs.splice(index, 1);
    saveAiChatClosedTabs(closedTabs);
    return closedTab;
}

/** A closed tab, back as a tab: on its site, at its conversation. */
export function toReopenedAiChatSession(
    closedTab: AiChatClosedTabType,
): AiChatSessionType {
    return {
        ...genNewAiChatSession(closedTab.providerKey),
        title: closedTab.title,
        pageTitle: closedTab.pageTitle,
        lastUrl: closedTab.lastUrl,
    };
}

export function forgetAiChatClosedTabs() {
    removeSetting(CLOSED_TABS_SETTING_NAME);
}
