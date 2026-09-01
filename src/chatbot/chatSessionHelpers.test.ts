import { beforeEach, describe, expect, test, vi } from 'vitest';

// The store the tabs live in. Kept as a plain map so a test can hand the
// loader a half-written or hand-edited file and see what it does with it --
// which is the whole job of this module.
const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    checkCanAddChatSession,
    checkCanClearChatSessions,
    checkCanSoloChatSession,
    genChatSessionTitle,
    genNewChatSession,
    genSessionId,
    loadChatSessions,
    saveChatSessions,
    toChatSessionTitle,
    MAX_SESSION_COUNT,
    type ChatMessageType,
    type ChatSessionType,
} from './chatSessionHelpers';

const SETTING_NAME = 'chatbot-sessions';

function genMessages(count: number): ChatMessageType[] {
    return Array.from({ length: count }, (_item, index) => {
        return {
            id: index + 1,
            author: (index % 2 === 0 ? 'you' : 'bot') as 'you' | 'bot',
            text: `message ${index + 1}`,
        };
    });
}

function genSession(overrides: Partial<ChatSessionType> = {}): ChatSessionType {
    return {
        ...genNewChatSession('presenter', 'anthropic', 'claude-sonnet-5'),
        ...overrides,
    };
}

function readStored() {
    return JSON.parse(settingMap.get(SETTING_NAME) ?? '{}');
}

describe('loadChatSessions', () => {
    beforeEach(() => {
        settingMap.clear();
    });

    test('a first run gets one empty tab on the given defaults', () => {
        const state = loadChatSessions('reader', 'openai', 'gpt-5-mini');

        expect(state.sessions).toHaveLength(1);
        expect(state.sessions[0]).toMatchObject({
            messages: [],
            draft: '',
            focus: 'reader',
            provider: 'openai',
            model: 'gpt-5-mini',
        });
        expect(state.activeId).toBe(state.sessions[0].id);
    });

    // Someone about to start a service must not be shown a parse error, and
    // must not be shown an empty window either.
    test('a corrupt file is replaced by a fresh tab, not an exception', () => {
        settingMap.set(SETTING_NAME, '{"sessions": [{"id": ');

        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions).toHaveLength(1);
        expect(state.sessions[0].messages).toEqual([]);
    });

    test('entries that are not sessions are dropped, the rest survive', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                sessions: [
                    { id: 'kept', messages: [], draft: 'half typed' },
                    { messages: [] },
                    { id: 'no-messages-array' },
                    null,
                ],
                activeId: 'kept',
            }),
        );

        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions).toHaveLength(1);
        expect(state.sessions[0].id).toBe('kept');
        expect(state.sessions[0].draft).toBe('half typed');
    });

    test('a message with no text or an unknown author is dropped', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                sessions: [
                    {
                        id: 'one',
                        messages: [
                            { id: 1, author: 'you', text: 'kept' },
                            { id: 2, author: 'somebody-else', text: 'dropped' },
                            { id: 3, author: 'bot' },
                        ],
                    },
                ],
            }),
        );

        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions[0].messages).toEqual([
            { id: 1, author: 'you', text: 'kept' },
        ]);
    });

    // A provider whose key was removed in Settings must not leave a tab
    // pointing at something that can only fail.
    test('an unknown provider becomes null rather than being trusted', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                sessions: [
                    { id: 'a', messages: [], provider: 'anthropic' },
                    { id: 'b', messages: [], provider: 'some-other-service' },
                ],
            }),
        );

        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions[0].provider).toBe('anthropic');
        expect(state.sessions[1].provider).toBe(null);
    });

    test('an activeId naming no tab falls back to the first one', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                sessions: [{ id: 'a', messages: [] }],
                activeId: 'a-tab-that-was-closed',
            }),
        );

        expect(loadChatSessions('presenter', null, '').activeId).toBe('a');
    });

    // The caps are what keep a settings file on a machine with nothing to
    // spare from growing without end.
    test('more tabs than the cap are trimmed to the newest', () => {
        const sessions = Array.from(
            { length: MAX_SESSION_COUNT + 4 },
            (_item, index) => {
                return { id: `s${index}`, messages: [] };
            },
        );
        settingMap.set(SETTING_NAME, JSON.stringify({ sessions }));

        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions).toHaveLength(MAX_SESSION_COUNT);
        expect(state.sessions[state.sessions.length - 1].id).toBe(
            `s${MAX_SESSION_COUNT + 3}`,
        );
    });

    test('a tab with more messages than the cap keeps the last of them', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                sessions: [{ id: 'a', messages: genMessages(200) }],
            }),
        );

        const messages = loadChatSessions('presenter', null, '').sessions[0]
            .messages;

        expect(messages).toHaveLength(60);
        expect(messages[messages.length - 1].text).toBe('message 200');
    });
});

describe('saveChatSessions', () => {
    beforeEach(() => {
        settingMap.clear();
    });

    test('writes both caps back down, so the file cannot creep up', () => {
        const sessions = Array.from(
            { length: MAX_SESSION_COUNT + 3 },
            (_item, index) => {
                return genSession({
                    id: `s${index}`,
                    messages: genMessages(90),
                });
            },
        );

        saveChatSessions({ sessions, activeId: 's0' });

        const stored = readStored();
        expect(stored.sessions).toHaveLength(MAX_SESSION_COUNT);
        expect(stored.sessions[0].messages).toHaveLength(60);
        expect(stored.activeId).toBe('s0');
    });

    test('a save then a load is the same state', () => {
        const session = genSession({
            id: 'round-trip',
            title: 'Sunday',
            draft: 'how do I',
            focus: 'reader',
            isFocusChosen: true,
            messages: genMessages(3),
        });

        saveChatSessions({ sessions: [session], activeId: session.id });
        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions).toEqual([session]);
        expect(state.activeId).toBe('round-trip');
    });
});

describe('titles', () => {
    test('an unnamed tab is called after the question that started it', () => {
        const session = genSession({
            messages: [
                { id: 1, author: 'bot', text: 'a note shown first' },
                { id: 2, author: 'you', text: 'How do I present a verse?' },
            ],
        });

        expect(genChatSessionTitle(session)).toBe('How do I present a verse?');
    });

    test('a long question is cut to something the strip can hold', () => {
        const session = genSession({
            messages: [
                {
                    id: 1,
                    author: 'you',
                    text: 'How do I put the words of a song on the projector?',
                },
            ],
        });

        const title = genChatSessionTitle(session);
        expect(title).toHaveLength(26);
        expect(title.endsWith('…')).toBe(true);
    });

    test('a tab with nothing asked in it yet has a name anyway', () => {
        expect(genChatSessionTitle(genSession())).toBe('New chat');
    });

    test('a name the user typed wins over the first question', () => {
        const session = genSession({
            title: 'Sunday',
            messages: [{ id: 1, author: 'you', text: 'anything' }],
        });

        expect(genChatSessionTitle(session)).toBe('Sunday');
    });

    test('a typed name is collapsed and bounded', () => {
        expect(toChatSessionTitle('  the   evening    service  ')).toBe(
            'the evening service',
        );
        expect(toChatSessionTitle('x'.repeat(80))).toHaveLength(40);
    });
});

describe('the tab cap', () => {
    test('closes the + button exactly at the cap', () => {
        const genSessions = (count: number) => {
            return Array.from({ length: count }, () => {
                return genSession();
            });
        };

        expect(checkCanAddChatSession(genSessions(MAX_SESSION_COUNT - 1))).toBe(
            true,
        );
        expect(checkCanAddChatSession(genSessions(MAX_SESSION_COUNT))).toBe(
            false,
        );
    });
});

// The two actions that take more than one tab at a time, and the lock that
// exists to stop them. Both are asked twice in the window, so what is tested
// here is only ever "would this offer do anything" -- the offer itself is what
// the user sees.
describe('the sweeping actions', () => {
    test('nothing to clear when the only tab is empty and unnamed', () => {
        expect(checkCanClearChatSessions([genSession()])).toBe(false);
    });

    test('a second tab, a name or an answer is something to clear', () => {
        expect(checkCanClearChatSessions([genSession(), genSession()])).toBe(
            true,
        );
        expect(
            checkCanClearChatSessions([genSession({ title: 'Sunday' })]),
        ).toBe(true);
        expect(
            checkCanClearChatSessions([
                genSession({ messages: genMessages(2) }),
            ]),
        ).toBe(true);
    });

    test('a locked tab is not something to clear', () => {
        expect(
            checkCanClearChatSessions([
                genSession({ title: 'Sunday', isLocked: true }),
            ]),
        ).toBe(false);
        // ... but the unlocked one beside it still is.
        expect(
            checkCanClearChatSessions([
                genSession({ title: 'Sunday', isLocked: true }),
                genSession(),
            ]),
        ).toBe(true);
    });

    test('soloing needs another tab that is not locked', () => {
        const kept = genSession();
        expect(checkCanSoloChatSession([kept], kept.id)).toBe(false);
        expect(checkCanSoloChatSession([kept, genSession()], kept.id)).toBe(
            true,
        );
        expect(
            checkCanSoloChatSession(
                [kept, genSession({ isLocked: true })],
                kept.id,
            ),
        ).toBe(false);
    });
});

describe('the lock', () => {
    beforeEach(() => {
        settingMap.clear();
    });

    test('survives a save and a load', () => {
        const locked = genSession({ title: 'Sunday', isLocked: true });
        saveChatSessions({
            sessions: [locked, genSession()],
            activeId: locked.id,
        });

        const state = loadChatSessions('presenter', 'anthropic', 'claude-x');

        expect(state.sessions[0].isLocked).toBe(true);
        expect(state.sessions[1].isLocked).toBe(false);
    });

    test('a file written before locks existed reads as unlocked', () => {
        settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                sessions: [{ id: 'old', messages: [] }],
                activeId: 'old',
            }),
        );

        const state = loadChatSessions('presenter', null, '');

        expect(state.sessions[0].isLocked).toBe(false);
    });
});

describe('genSessionId', () => {
    test('does not collide inside one burst', () => {
        const ids = new Set(
            Array.from({ length: 500 }, () => {
                return genSessionId();
            }),
        );

        expect(ids.size).toBe(500);
    });
});
