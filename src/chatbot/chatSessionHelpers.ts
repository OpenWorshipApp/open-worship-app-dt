// The help window's tabs, and the file they live in.
//
// One conversation is not enough for the way this window gets used. A
// volunteer looks something up while the band is still setting up, comes back
// during the service with a different question, and the answer they want is
// the one from twenty minutes ago -- so the window carries several
// conversations at once, the way a browser carries tabs, and every one of them
// is written to disk. Closing the window is not the same as throwing the
// answers away.
//
// It is all ONE setting file, kept small on purpose: this app runs on machines
// that have nothing to spare, and `appLocalStorage.setItem` is a synchronous
// write. So the strip is capped, the history inside each tab is capped, and
// the caller saves on a debounce rather than on every keystroke.

import { getSetting, setSetting } from '../helper/settingHelpers';
import type { BotActionType, BotFocusType } from './helpBotHelpers';
import type { LlmProviderType } from './llmBotHelpers';

export type ChatMessageType = {
    id: number;
    author: 'you' | 'bot';
    text: string;
    // Shown above the answer, small and quiet: why this answer came from
    // somewhere other than where the user asked it to.
    note?: string;
    actions?: BotActionType[];
};

export type ChatSessionType = {
    id: string;
    // A name the user typed. Empty means "call it after the first question",
    // which is right until the day there are four tabs and three of them start
    // "how do I" -- then they name them.
    title: string;
    messages: ChatMessageType[];
    // What is typed but not yet asked. A tab that loses the half-written
    // question when the user checks the other tab is a tab they stop using.
    draft: string;
    // Everything the head of the window shows belongs to the tab, not to the
    // window: which half of the app the answers are about, who answers, and
    // which of that provider's models. Switching to last Sunday's tab brings
    // back the conversation AND what it was being held with -- one tab asking
    // Claude about the presenter while the next asks a cheap model about the
    // reader is the point of having tabs at all.
    focus: BotFocusType;
    isFocusChosen: boolean;
    provider: LlmProviderType | null;
    model: string;
    // "Do not throw this one away." A locked tab has no close button, and it
    // is the one thing the two sweeping actions -- close the others, clear
    // them all -- step around. It exists because those two actions exist: the
    // answer someone wants kept is exactly the one that was worth opening a
    // second tab to keep, and a strip of twelve is cleared by someone in a
    // hurry.
    isLocked: boolean;
};

export type ChatSessionStateType = {
    sessions: ChatSessionType[];
    activeId: string;
};

const SESSIONS_SETTING_NAME = 'chatbot-sessions';
// The caps, in the order they bite. A strip past a dozen tabs cannot be read
// anyway, and nobody reopens this window for the sixtieth-last answer -- but a
// JSON blob nobody trims is exactly how a settings file reaches megabytes on a
// machine that cannot spare them.
export const MAX_SESSION_COUNT = 12;
const MAX_MESSAGE_COUNT = 60;
const MAX_TITLE_LENGTH = 26;
// A typed name may be longer than a derived one -- the user chose it -- but
// not without end: it is stored in the same file and drawn in the same strip.
const MAX_TYPED_TITLE_LENGTH = 40;

export function genSessionId() {
    const stamp = Date.now().toString(36);
    const salt = Math.random().toString(36).slice(2, 6);
    return `s${stamp}${salt}`;
}

export function genNewChatSession(
    focus: BotFocusType,
    provider: LlmProviderType | null,
    model: string,
    isFocusChosen = false,
): ChatSessionType {
    return {
        id: genSessionId(),
        title: '',
        messages: [],
        draft: '',
        focus,
        isFocusChosen,
        provider,
        model,
        isLocked: false,
    };
}

/** Trims a typed tab name to something the strip can hold. */
export function toChatSessionTitle(text: string) {
    return text.trim().replace(/\s+/g, ' ').slice(0, MAX_TYPED_TITLE_LENGTH);
}

/**
 * The name the user gave this tab, or -- until they give it one -- the
 * question that started it, which is the only other name for it they wrote
 * themselves and the one they will recognise.
 */
export function genChatSessionTitle(session: ChatSessionType) {
    if (session.title.length > 0) {
        return session.title;
    }
    const firstAsked = session.messages.find((message) => {
        return message.author === 'you';
    });
    if (firstAsked === undefined) {
        return 'New chat';
    }
    const text = firstAsked.text.trim().replace(/\s+/g, ' ');
    if (text.length <= MAX_TITLE_LENGTH) {
        return text;
    }
    return text.slice(0, MAX_TITLE_LENGTH - 1) + '…';
}

export function checkCanAddChatSession(sessions: ChatSessionType[]) {
    return sessions.length < MAX_SESSION_COUNT;
}

/** The tabs a sweeping action is allowed to take. Locked ones are not. */
export function toClearableChatSessions(sessions: ChatSessionType[]) {
    return sessions.filter((session) => {
        return !session.isLocked;
    });
}

/**
 * Whether throwing the unlocked conversations away would change anything. One
 * empty, unnamed tab is exactly what clearing LEAVES BEHIND, so offering it
 * then is offering to do nothing -- and an offer to do nothing, sitting in the
 * menu, is one more line to read on a window that is already asking enough. A
 * half-typed question does not count: the item appearing while someone is
 * still typing is the same noise, one keystroke later.
 */
export function checkCanClearChatSessions(sessions: ChatSessionType[]) {
    return sessions.some((session) => {
        return (
            !session.isLocked &&
            (sessions.length > 1 ||
                session.messages.length > 0 ||
                session.title.length > 0)
        );
    });
}

/**
 * Whether "close the other chats" has anything to close. A strip of locked
 * tabs and this one is already soloed, whatever the count says.
 */
export function checkCanSoloChatSession(
    sessions: ChatSessionType[],
    sessionId: string,
) {
    return sessions.some((session) => {
        return session.id !== sessionId && !session.isLocked;
    });
}

function toValidMessage(raw: any): ChatMessageType | null {
    if (
        typeof raw?.text !== 'string' ||
        (raw.author !== 'you' && raw.author !== 'bot')
    ) {
        return null;
    }
    return {
        id: typeof raw.id === 'number' ? raw.id : 0,
        author: raw.author,
        text: raw.text,
        ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
        ...(Array.isArray(raw.actions) ? { actions: raw.actions } : {}),
    };
}

function toValidSession(raw: any): ChatSessionType | null {
    if (typeof raw?.id !== 'string' || !Array.isArray(raw.messages)) {
        return null;
    }
    return {
        id: raw.id,
        title:
            typeof raw.title === 'string' ? toChatSessionTitle(raw.title) : '',
        messages: raw.messages
            .map(toValidMessage)
            .filter((message: ChatMessageType | null) => {
                return message !== null;
            })
            .slice(-MAX_MESSAGE_COUNT),
        draft: typeof raw.draft === 'string' ? raw.draft : '',
        focus: raw.focus === 'reader' ? 'reader' : 'presenter',
        isFocusChosen: raw.isFocusChosen === true,
        // Checked against the keys that are actually set by the caller, which
        // is the only place that knows: a key removed in Settings must not
        // leave a tab pointing at a provider that can only fail.
        provider:
            raw.provider === 'anthropic' || raw.provider === 'openai'
                ? raw.provider
                : null,
        model: typeof raw.model === 'string' ? raw.model : '',
        isLocked: raw.isLocked === true,
    };
}

/**
 * What was on screen last time, or one empty tab. Read once, at mount: the
 * file is only ever written by this window.
 */
export function loadChatSessions(
    focus: BotFocusType,
    provider: LlmProviderType | null,
    model: string,
): ChatSessionStateType {
    const stored = getSetting(SESSIONS_SETTING_NAME);
    let sessions: ChatSessionType[] = [];
    let activeId = '';
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            sessions = (Array.isArray(parsed?.sessions) ? parsed.sessions : [])
                .map(toValidSession)
                .filter((session: ChatSessionType | null) => {
                    return session !== null;
                })
                .slice(-MAX_SESSION_COUNT);
            activeId =
                typeof parsed?.activeId === 'string' ? parsed.activeId : '';
        } catch (_error) {
            // A half-written or hand-edited file is not worth a message to
            // someone about to start a service: they get a fresh, empty tab.
            sessions = [];
        }
    }
    if (sessions.length === 0) {
        sessions = [genNewChatSession(focus, provider, model)];
    }
    const isActiveIdKnown = sessions.some((session) => {
        return session.id === activeId;
    });
    return {
        sessions,
        activeId: isActiveIdKnown ? activeId : sessions[0].id,
    };
}

export function saveChatSessions(state: ChatSessionStateType) {
    const sessions = state.sessions.slice(-MAX_SESSION_COUNT).map((session) => {
        return {
            ...session,
            messages: session.messages.slice(-MAX_MESSAGE_COUNT),
        };
    });
    setSetting(
        SESSIONS_SETTING_NAME,
        JSON.stringify({ sessions, activeId: state.activeId }),
    );
}
