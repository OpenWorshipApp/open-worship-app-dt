// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    listeners: new Map<string, (_event: unknown, data: unknown) => void>(),
    sent: [] as { channel: string; data: unknown }[],
    opened: [] as { uuid?: string; place?: { x: number; y: number } }[],
    nextId: 0,
    handAllowed: true,
    openAllowed: true,
    signOutFails: false,
    signOutCount: 0,
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isGlassCapable: true },
        messageUtils: {
            listenForData: (
                channel: string,
                listener: (_event: unknown, data: unknown) => void,
            ) => h.listeners.set(channel, listener),
            removeListener: (channel: string) => h.listeners.delete(channel),
            sendData: (channel: string, data: unknown) => {
                h.sent.push({ channel, data });
            },
            sendDataSync: (channel: string) => {
                if (channel === 'main:app:ai-chat-window-slot') return 0;
                if (channel === 'main:app:ai-chat-take-tab') return null;
                if (channel === 'main:app:ai-chat-hand-tab')
                    return h.handAllowed;
                return null;
            },
        },
    },
}));
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => h.settings.get(name) ?? null,
    getSettingForce: (name: string) => h.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        h.settings.set(name, value);
    },
    removeSetting: (name: string) => {
        h.settings.delete(name);
    },
}));
vi.mock('../chatbot/chatSessionHelpers', () => ({
    genSessionId: () => `tab-${++h.nextId}`,
    checkCanAddChatSession: (sessions: unknown[], maximum: number) =>
        sessions.length < maximum,
    toChatSessionTitle: (title: string) => title.trim().slice(0, 60),
}));
// The strip owns only its controls here. The window's real handlers, session
// store, provider rules and guest element still run for every press.
vi.mock('../chatbot/RenderSessionTabsComp', () => ({
    default: (props: any) => (
        <nav aria-label="Tabs">
            {props.sessions.map((session: any) => (
                <button
                    key={session.id}
                    type="button"
                    onClick={() => props.onChoose(session.id)}
                >
                    {props.genTitle(session)}
                </button>
            ))}
            <button type="button" onClick={props.onAdd}>
                Add tab
            </button>
            <button type="button" onClick={() => props.onClose(props.activeId)}>
                Close tab
            </button>
            <button
                type="button"
                onClick={() => props.onRename(props.activeId, 'Named tab')}
            >
                Rename tab
            </button>
            <button
                type="button"
                onClick={() => props.onTogglingLock(props.activeId)}
            >
                Toggle lock
            </button>
            <button type="button" onClick={() => props.onSolo(props.activeId)}>
                Keep this tab
            </button>
            <button type="button" onClick={props.onClearAll}>
                Clear tabs
            </button>
            <button
                type="button"
                onClick={() => props.onOpenInNewWindow(props.activeId)}
            >
                Move tab
            </button>
            <button type="button" onClick={props.onNewWindow}>
                New window
            </button>
            <button
                type="button"
                onClick={() => props.onReorder(props.activeId, 0)}
            >
                Move first
            </button>
        </nav>
    ),
}));
vi.mock('./RenderAiChatPopupNoticeComp', () => ({ default: () => null }));
vi.mock('./aiChatSignOutHelpers', () => ({
    clearAiChatSiteData: async () => {
        h.signOutCount += 1;
        if (h.signOutFails) throw new Error('clear failed');
        return true;
    },
}));
vi.mock('../helper/popupWindowHelpers', () => ({
    genAiChatWindowUuid: () => 'new-window',
    openAiChatPage: (uuid?: string, place?: { x: number; y: number }) => {
        h.opened.push({ uuid, place });
        return h.openAllowed ? ({} as Window) : null;
    },
}));

import AiChatAppComp from './AiChatAppComp';
import type { AiChatSessionStateType } from './aiChatSessionHelpers';

let host: HTMLDivElement;
let root: Root;

function press(name: string, within: Element = host) {
    const button = Array.from(within.querySelectorAll('button')).find(
        (item) =>
            item.textContent?.trim() === name ||
            item.getAttribute('aria-label') === name,
    );
    if (button === undefined) throw new Error(`Missing button: ${name}`);
    act(() => button.click());
}

function savedState(): AiChatSessionStateType {
    return JSON.parse(
        h.settings.get('aichat-sessions')!,
    ) as AiChatSessionStateType;
}

function frontSession() {
    const state = savedState();
    return state.sessions.find((session) => session.id === state.activeId)!;
}

function guest() {
    const element = host.querySelector('webview') as HTMLElement & {
        reload: () => void;
        canGoBack: () => boolean;
        goBack: () => void;
        getURL: () => string;
        getWebContentsId: () => number;
    };
    if (element === null) throw new Error('Missing guest');
    return element;
}

function guestEvent(type: string, values: Record<string, unknown> = {}) {
    const event = Object.assign(new Event(type), values);
    act(() => guest().dispatchEvent(event));
}

function choose(providerName: string) {
    const button = Array.from(
        host.querySelectorAll<HTMLButtonElement>('.aichat-choice'),
    ).find(
        (item) =>
            item.querySelector('.aichat-choice-name')?.textContent ===
            providerName,
    );
    if (button === undefined) throw new Error(`Missing site: ${providerName}`);
    act(() => button.click());
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settings.clear();
    h.sent.length = 0;
    h.opened.length = 0;
    h.handAllowed = true;
    h.openAllowed = true;
    h.signOutFails = false;
    h.signOutCount = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<AiChatAppComp />));
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
});
function pickSite(providerKey: string) {
    const select = host.querySelector<HTMLSelectElement>(
        '[aria-label="Which AI chat"]',
    )!;
    act(() => {
        select.value = providerKey;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

describe('the tab strip and the site picker, where nothing is to change', () => {
    test('picking the site a tab is already on keeps the page it was on', () => {
        choose('ChatGPT');
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/keep' });
        pickSite('chatgpt');
        expect(frontSession()).toMatchObject({
            providerKey: 'chatgpt',
            lastUrl: 'https://chatgpt.com/c/keep',
        });
        // Another site is another conversation: the page goes with it.
        pickSite('claude');
        expect(frontSession().providerKey).toBe('claude');
        expect(frontSession().lastUrl).not.toBe('https://chatgpt.com/c/keep');
    });

    test('keeping one tab when every other tab is locked closes nothing', () => {
        choose('ChatGPT');
        press('Toggle lock');
        press('Add tab');
        choose('Claude');
        const before = savedState();
        press('Keep this tab');
        expect(savedState()).toEqual(before);
        expect(
            savedState().sessions.map((session) => session.providerKey),
        ).toEqual(['chatgpt', 'claude']);
    });
});
