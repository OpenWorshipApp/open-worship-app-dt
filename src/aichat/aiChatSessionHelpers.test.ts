import { beforeEach, describe, expect, test, vi } from 'vitest';

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    getSettingForce: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
    removeSetting: (key: string) => {
        settingMap.delete(key);
    },
}));

import {
    checkCanClearAiChatSessions,
    forgetAiChatClosedTabs,
    forgetAiChatSiteTraces,
    genAiChatSessionsSettingName,
    loadAiChatClosedTabs,
    MAX_AI_CHAT_CLOSED_TAB_COUNT,
    rememberClosedAiChatTabs,
    takeClosedAiChatTab,
    toAiChatSession,
    toReopenedAiChatSession,
    toSignedOutAiChatSessions,
    genAiChatSessionTitle,
    genNewAiChatSession,
    loadAiChatSessions,
    MAX_AI_CHAT_SESSION_COUNT,
    saveAiChatSessions,
    toKeptUrl,
    toLiveSessionIds,
    toPageTitle,
    type AiChatSessionType,
} from './aiChatSessionHelpers';

function genSession(
    overrides: Partial<AiChatSessionType> = {},
): AiChatSessionType {
    return { ...genNewAiChatSession('chatgpt'), ...overrides };
}

beforeEach(() => {
    settingMap.clear();
});

describe('toKeptUrl', () => {
    test('a page on the site is kept, a sign-in page is not', () => {
        expect(toKeptUrl('chatgpt', 'https://chatgpt.com/c/abc123')).toBe(
            'https://chatgpt.com/c/abc123',
        );
        expect(toKeptUrl('chatgpt', 'https://chat.openai.com/c/abc')).toBe(
            'https://chat.openai.com/c/abc',
        );
        expect(toKeptUrl('gemini', 'https://gemini.google.com/app/x')).toBe(
            'https://gemini.google.com/app/x',
        );
        expect(
            toKeptUrl('gemini', 'https://accounts.google.com/signin/v2'),
        ).toBeNull();
        expect(toKeptUrl('chatgpt', 'https://auth.openai.com/log-in')).toBe(
            null,
        );
    });

    test('a subdomain of the site counts, a lookalike does not', () => {
        expect(toKeptUrl('claude', 'https://www.claude.ai/new')).toBe(
            'https://www.claude.ai/new',
        );
        expect(toKeptUrl('claude', 'https://notclaude.ai/new')).toBeNull();
        expect(toKeptUrl('claude', 'https://claude.ai.evil.com/')).toBeNull();
    });

    test('only https, only a known site, only a sane length', () => {
        expect(toKeptUrl('chatgpt', 'http://chatgpt.com/')).toBeNull();
        expect(toKeptUrl('nope', 'https://chatgpt.com/')).toBeNull();
        expect(toKeptUrl(null, 'https://chatgpt.com/')).toBeNull();
        expect(toKeptUrl('chatgpt', 42)).toBeNull();
        expect(toKeptUrl('chatgpt', 'not a url')).toBeNull();
        expect(
            toKeptUrl('chatgpt', 'https://chatgpt.com/?q=' + 'x'.repeat(2000)),
        ).toBeNull();
    });
});

describe('genAiChatSessionTitle', () => {
    test('the typed name, else the page, else the site, else nothing yet', () => {
        expect(genAiChatSessionTitle(genNewAiChatSession())).toBe('New chat');
        expect(genAiChatSessionTitle(genSession())).toBe('ChatGPT');
        expect(
            genAiChatSessionTitle(genSession({ pageTitle: 'Prayer ideas' })),
        ).toBe('Prayer ideas');
        expect(
            genAiChatSessionTitle(
                genSession({ pageTitle: 'Prayer ideas', title: 'Sunday' }),
            ),
        ).toBe('Sunday');
    });

    test('a long page title is cut for the strip', () => {
        const title = genAiChatSessionTitle(
            genSession({
                pageTitle: 'A very long conversation name that runs on',
            }),
        );
        expect(title.length).toBe(26);
        expect(title.endsWith('…')).toBe(true);
    });

    test('toPageTitle collapses whitespace and bounds the length', () => {
        expect(toPageTitle('  ChatGPT  -  Prayer\n ideas ')).toBe(
            'ChatGPT - Prayer ideas',
        );
        expect(toPageTitle('x'.repeat(100)).length).toBe(60);
    });
});

describe('toLiveSessionIds', () => {
    test('the tab in front, then the most recently used, up to the cap', () => {
        const sessions = [
            genSession({ id: 'a', lastUsedAt: 10 }),
            genSession({ id: 'b', lastUsedAt: 50 }),
            genSession({ id: 'c', lastUsedAt: 30 }),
            genSession({ id: 'd', lastUsedAt: 40 }),
            genSession({ id: 'e', lastUsedAt: 20 }),
        ];
        expect([...toLiveSessionIds(sessions, 'a')]).toEqual(['a', 'b', 'd']);
        expect([...toLiveSessionIds(sessions, 'e', 2)]).toEqual(['e', 'b']);
    });

    test('a tab still on the chooser takes no place', () => {
        const sessions = [
            genSession({ id: 'a', providerKey: null, lastUsedAt: 99 }),
            genSession({ id: 'b', lastUsedAt: 50 }),
        ];
        expect([...toLiveSessionIds(sessions, 'a')]).toEqual(['b']);
    });
});

describe('checkCanClearAiChatSessions', () => {
    test('one unnamed tab on the chooser is what clearing leaves behind', () => {
        expect(checkCanClearAiChatSessions([genNewAiChatSession()])).toBe(
            false,
        );
        expect(checkCanClearAiChatSessions([genSession()])).toBe(true);
        expect(
            checkCanClearAiChatSessions([
                genNewAiChatSession(),
                genNewAiChatSession(),
            ]),
        ).toBe(true);
        expect(
            checkCanClearAiChatSessions([genSession({ isLocked: true })]),
        ).toBe(false);
    });
});

describe('loadAiChatSessions / saveAiChatSessions', () => {
    test('round-trips what was on screen', () => {
        const sessions = [
            genSession({
                id: 'one',
                pageTitle: 'Prayer ideas',
                lastUrl: 'https://chatgpt.com/c/abc',
                isLocked: true,
                lastUsedAt: 5,
            }),
            genSession({ id: 'two', providerKey: 'claude' }),
        ];
        saveAiChatSessions({ sessions, activeId: 'two' });
        expect(loadAiChatSessions()).toEqual({ sessions, activeId: 'two' });
    });

    test('a fresh window gets one tab on the chooser', () => {
        const state = loadAiChatSessions();
        expect(state.sessions).toHaveLength(1);
        expect(state.sessions[0].providerKey).toBeNull();
        expect(state.activeId).toBe(state.sessions[0].id);
    });

    test('a hand-edited file cannot smuggle a site or an address in', () => {
        settingMap.set(
            'aichat-sessions',
            JSON.stringify({
                sessions: [
                    {
                        id: 'x',
                        providerKey: 'evil',
                        pageTitle: 'Sign in - Somewhere',
                        lastUrl: 'file:///C:/setting.json',
                        title: 'kept',
                        isLocked: 'yes',
                        lastUsedAt: 'now',
                        extra: 'dropped',
                    },
                    {
                        id: 'y',
                        providerKey: 'claude',
                        lastUrl: 'https://accounts.google.com/signin',
                    },
                    { providerKey: 'claude' },
                    'junk',
                ],
                activeId: 'nowhere',
            }),
        );
        const state = loadAiChatSessions();
        expect(state.sessions).toEqual([
            {
                id: 'x',
                providerKey: null,
                title: 'kept',
                pageTitle: '',
                lastUrl: null,
                isLocked: false,
                lastUsedAt: 0,
            },
            {
                id: 'y',
                providerKey: 'claude',
                title: '',
                pageTitle: '',
                lastUrl: null,
                isLocked: false,
                lastUsedAt: 0,
            },
        ]);
        expect(state.activeId).toBe('x');
    });

    test('a broken file is a fresh tab, not an error', () => {
        settingMap.set('aichat-sessions', '{not json');
        expect(loadAiChatSessions().sessions).toHaveLength(1);
    });

    test('the strip is capped on the way out and on the way in', () => {
        const sessions = Array.from(
            { length: MAX_AI_CHAT_SESSION_COUNT + 3 },
            (_one, index) => {
                return genSession({ id: `s${index}` });
            },
        );
        saveAiChatSessions({ sessions, activeId: 's0' });
        const state = loadAiChatSessions();
        expect(state.sessions).toHaveLength(MAX_AI_CHAT_SESSION_COUNT);
        expect(state.sessions[0].id).toBe('s3');
        // the dropped tab was the active one
        expect(state.activeId).toBe('s3');
    });
});

describe('one set of tabs per AI Chat window', () => {
    beforeEach(() => {
        settingMap.clear();
    });

    test('the first window keeps the key a single window always had', () => {
        expect(genAiChatSessionsSettingName()).toBe('aichat-sessions');
        expect(genAiChatSessionsSettingName(0)).toBe('aichat-sessions');
        expect(genAiChatSessionsSettingName(1)).toBe('aichat-sessions-2');
    });

    test('two windows save without taking each other’s tabs', () => {
        const first = genSession({ id: 'first' });
        const second = genSession({ id: 'second' });
        saveAiChatSessions({ sessions: [first], activeId: 'first' }, 0);
        saveAiChatSessions({ sessions: [second], activeId: 'second' }, 1);
        expect(loadAiChatSessions(0).sessions).toEqual([first]);
        expect(loadAiChatSessions(1).sessions).toEqual([second]);
    });

    test('a tab from another window is read like one off disk', () => {
        expect(toAiChatSession(null)).toBeNull();
        expect(toAiChatSession({ id: '' })).toBeNull();
        const moved = toAiChatSession({
            id: 'moved',
            providerKey: 'chatgpt',
            title: 'Sermon notes',
            pageTitle: 'Notes',
            lastUrl: 'https://evil.example/steal',
            isLocked: true,
            extra: 'dropped',
        });
        expect(moved).toMatchObject({
            id: 'moved',
            providerKey: 'chatgpt',
            title: 'Sermon notes',
            isLocked: true,
            // An address off the site is not kept.
            lastUrl: null,
        });
        expect(moved).not.toHaveProperty('extra');
        expect(moved!.lastUsedAt).toBeGreaterThan(0);
    });

    test('a sign-out forgets the pages, keeps the names, in every slot', () => {
        const session = genSession({
            id: 'kept',
            title: 'Mine',
            pageTitle: 'Their conversation',
            lastUrl: 'https://chatgpt.com/c/123',
        });
        expect(
            toSignedOutAiChatSessions({ sessions: [session], activeId: 'kept' })
                .sessions[0],
        ).toMatchObject({ title: 'Mine', pageTitle: '', lastUrl: null });

        saveAiChatSessions({ sessions: [session], activeId: 'kept' }, 0);
        saveAiChatSessions({ sessions: [session], activeId: 'kept' }, 2);
        rememberClosedAiChatTabs([session]);
        forgetAiChatSiteTraces(0);
        // The window that signed out forgets its own tabs itself.
        expect(loadAiChatSessions(0).sessions[0].lastUrl).toBe(
            'https://chatgpt.com/c/123',
        );
        expect(loadAiChatSessions(2).sessions[0]).toMatchObject({
            title: 'Mine',
            pageTitle: '',
            lastUrl: null,
        });
        // A slot nobody ever used is not written.
        expect(settingMap.has(genAiChatSessionsSettingName(1))).toBe(false);
        expect(loadAiChatClosedTabs()).toEqual([]);
    });
});

describe('recently closed tabs', () => {
    beforeEach(() => {
        settingMap.clear();
    });

    test('a closed tab is kept, newest first; a chooser tab is not', () => {
        rememberClosedAiChatTabs([
            genSession({ lastUrl: 'https://chatgpt.com/c/1', pageTitle: 'A' }),
        ]);
        rememberClosedAiChatTabs([
            genNewAiChatSession(),
            genSession({
                providerKey: 'claude',
                lastUrl: 'https://claude.ai/chat/2',
                pageTitle: 'B',
            }),
        ]);
        expect(
            loadAiChatClosedTabs().map((tab) => {
                return tab.pageTitle;
            }),
        ).toEqual(['B', 'A']);
    });

    test('the same conversation closed twice is one entry', () => {
        const url = 'https://chatgpt.com/c/1';
        rememberClosedAiChatTabs([genSession({ lastUrl: url, title: 'old' })]);
        rememberClosedAiChatTabs([genSession({ lastUrl: url, title: 'new' })]);
        const closedTabs = loadAiChatClosedTabs();
        expect(closedTabs).toHaveLength(1);
        expect(closedTabs[0].title).toBe('new');
    });

    test('the list is capped', () => {
        rememberClosedAiChatTabs(
            Array.from(
                { length: MAX_AI_CHAT_CLOSED_TAB_COUNT + 5 },
                (_one, index) => {
                    return genSession({
                        lastUrl: `https://chatgpt.com/c/${index}`,
                    });
                },
            ),
        );
        expect(loadAiChatClosedTabs()).toHaveLength(
            MAX_AI_CHAT_CLOSED_TAB_COUNT,
        );
    });

    test('reopening takes the entry off and gives a fresh tab', () => {
        rememberClosedAiChatTabs([
            genSession({ id: 'gone', lastUrl: 'https://chatgpt.com/c/1' }),
            genSession({
                providerKey: 'claude',
                title: 'Named',
                lastUrl: 'https://claude.ai/chat/2',
            }),
        ]);
        const [, second] = loadAiChatClosedTabs();
        const taken = takeClosedAiChatTab(second.id);
        expect(taken?.title).toBe('Named');
        expect(takeClosedAiChatTab(second.id)).toBeNull();
        expect(toReopenedAiChatSession(taken!)).toMatchObject({
            providerKey: 'claude',
            title: 'Named',
            lastUrl: 'https://claude.ai/chat/2',
            isLocked: false,
        });
        // With no id it is the newest; then nothing.
        expect(takeClosedAiChatTab()?.lastUrl).toBe('https://chatgpt.com/c/1');
        expect(takeClosedAiChatTab()).toBeNull();
    });

    test('a hand-edited list cannot point a tab off its site', () => {
        settingMap.set(
            'aichat-closed-tabs',
            JSON.stringify([
                {
                    id: 'x',
                    providerKey: 'chatgpt',
                    lastUrl: 'https://evil.example/',
                    closedAt: 1,
                },
                { id: 'y', providerKey: 'nope' },
                'junk',
            ]),
        );
        expect(loadAiChatClosedTabs()).toEqual([
            {
                id: 'x',
                providerKey: 'chatgpt',
                title: '',
                pageTitle: '',
                lastUrl: null,
                closedAt: 1,
            },
        ]);
        settingMap.set('aichat-closed-tabs', '{broken');
        expect(loadAiChatClosedTabs()).toEqual([]);
    });

    test('clearing the list empties it', () => {
        rememberClosedAiChatTabs([genSession()]);
        forgetAiChatClosedTabs();
        expect(loadAiChatClosedTabs()).toEqual([]);
    });
});
