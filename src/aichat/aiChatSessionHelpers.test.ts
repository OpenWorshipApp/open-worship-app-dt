import { beforeEach, describe, expect, test, vi } from 'vitest';

const settingMap = new Map<string, string>();

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settingMap.get(key) ?? null,
    setSetting: (key: string, value: string) => {
        settingMap.set(key, value);
    },
}));

import {
    checkCanClearAiChatSessions,
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
