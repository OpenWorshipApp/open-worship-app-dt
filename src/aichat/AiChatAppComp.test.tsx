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
import {
    AI_CHAT_MICROPHONE_ANSWER_CHANNEL,
    AI_CHAT_MICROPHONE_ASK_CHANNEL,
    AI_CHAT_MICROPHONE_SETTLED_CHANNEL,
} from './aiChatMicrophoneHelpers';
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

function emit(channel: string, data: unknown) {
    const listener = h.listeners.get(channel);
    if (listener === undefined) throw new Error(`Missing listener: ${channel}`);
    act(() => listener({}, data));
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

describe('AI Chat window', () => {
    test('chooses a site and mounts its sandboxed guest with a fixed home URL', () => {
        expect(
            host.querySelector('[aria-label="Choose an AI chat"]'),
        ).not.toBeNull();
        expect(host.querySelectorAll('.aichat-choice')).toHaveLength(10);
        choose('ChatGPT');
        expect(frontSession().providerKey).toBe('chatgpt');
        expect(guest().getAttribute('partition')).toBe('persist:aichat');
        expect(guest().hasAttribute('allowpopups')).toBe(true);
        expect(guest().getAttribute('src')).toBe('https://chatgpt.com/');
        expect(
            host
                .querySelector('[role="progressbar"]')
                ?.getAttribute('aria-label'),
        ).toBe('Loading ChatGPT');
        expect(
            host.querySelector('[aria-label="Which AI chat"]'),
        ).not.toBeNull();
        expect(host.querySelector('#app')?.getAttribute('data-bs-theme')).toBe(
            'dark',
        );
    });

    test('tracks navigation and title, reports a real load failure, and offers browser controls', () => {
        choose('ChatGPT');
        let reloads = 0;
        let backs = 0;
        const view = guest();
        view.reload = () => {
            reloads += 1;
        };
        view.canGoBack = () => true;
        view.goBack = () => {
            backs += 1;
        };
        view.getURL = () => 'https://chatgpt.com/c/one';
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        guestEvent('page-title-updated', { title: '  A conversation  ' });
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/one' });
        guestEvent('did-navigate-in-page', {
            url: 'https://accounts.google.com/',
        });
        expect(frontSession().pageTitle).toBe('A conversation');
        expect(frontSession().lastUrl).toBeNull();
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/one' });
        expect(frontSession().lastUrl).toBe('https://chatgpt.com/c/one');
        guestEvent('did-fail-load', {
            errorCode: -3,
            errorDescription: 'aborted',
        });
        expect(host.querySelector('[role="alert"]')).toBeNull();
        guestEvent('did-fail-load', {
            errorCode: -7,
            errorDescription: 'offline',
        });
        expect(host.querySelector('[role="alert"]')?.textContent).toContain(
            'offline',
        );
        press('Try again');
        press('Back');
        press('Reload');
        press('Open in your browser');
        expect(reloads).toBe(2);
        expect(backs).toBe(1);
        expect(open).toHaveBeenCalledWith('https://chatgpt.com/c/one');
        guestEvent('did-start-loading');
        guestEvent('did-stop-loading');
        expect(host.querySelector('[role="alert"]')).toBeNull();
        expect(host.querySelector('[role="progressbar"]')).toBeNull();
    });

    test('closes a site tab and reopens its recently closed conversation', () => {
        choose('ChatGPT');
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/one' });
        press('Add tab');
        choose('Claude');
        expect(savedState().sessions).toHaveLength(2);
        press('Close tab');
        expect(savedState().sessions).toHaveLength(1);
        expect(JSON.parse(h.settings.get('aichat-closed-tabs')!)).toHaveLength(
            1,
        );
        press('Recently closed tabs');
        expect(
            host.querySelector('[aria-label="Recently closed tabs"]'),
        ).not.toBeNull();
        act(() =>
            window.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'T',
                    ctrlKey: true,
                    shiftKey: true,
                    bubbles: true,
                }),
            ),
        );
        expect(frontSession().providerKey).toBe('claude');
        expect(savedState().sessions).toHaveLength(2);
        expect(h.settings.get('aichat-closed-tabs')).toBe('[]');
    });

    test('signs out only after confirmation and forgets site traces', async () => {
        choose('ChatGPT');
        guestEvent('page-title-updated', { title: 'Private conversation' });
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/private' });
        press('Rename tab');
        press('Sign out of every site', host.querySelector('header')!);
        expect(h.signOutCount).toBe(0);
        expect(
            host.querySelector('[role="alertdialog"]')?.textContent,
        ).toContain('Keep me signed in');
        press('Keep me signed in');
        expect(h.signOutCount).toBe(0);
        press('Sign out of every site', host.querySelector('header')!);
        await act(async () => {
            press('Sign out');
            await Promise.resolve();
        });
        expect(h.signOutCount).toBe(1);
        expect(frontSession()).toMatchObject({
            title: 'Named tab',
            pageTitle: '',
            lastUrl: null,
        });
        expect(host.querySelector('[role="alertdialog"]')).toBeNull();
        expect(guest().getAttribute('src')).toBe('https://chatgpt.com/');
    });

    test('asks for the front guest microphone and refuses background requests', () => {
        choose('ChatGPT');
        guest().getWebContentsId = () => 7;
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 1,
            guestId: 8,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        expect(h.sent.at(-1)).toEqual({
            channel: AI_CHAT_MICROPHONE_ANSWER_CHANNEL,
            data: { askId: 1, isAllowed: false },
        });
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 2,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        expect(
            host.querySelector('[aria-label="Microphone"]')?.textContent,
        ).toContain('chatgpt.com wants to use your microphone');
        press('Allow');
        expect(h.sent.at(-1)?.data).toEqual({ askId: 2, isAllowed: true });
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 3,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        press('Add tab');
        expect(h.sent.at(-1)?.data).toEqual({ askId: 3, isAllowed: false });
        expect(host.querySelector('[aria-label="Microphone"]')).toBeNull();
    });

    test('moves a tab only when a new window accepts it', () => {
        choose('ChatGPT');
        h.openAllowed = false;
        press('Move tab');
        expect(savedState().sessions).toHaveLength(1);
        h.openAllowed = true;
        press('Move tab');
        expect(h.opened).toEqual([
            { uuid: 'new-window', place: undefined },
            { uuid: 'new-window', place: undefined },
        ]);
        expect(frontSession().providerKey).toBeNull();
        press('New window');
        expect(h.opened.at(-1)).toEqual({ uuid: undefined, place: undefined });
    });

    test('reorders tabs and preserves locked ones during solo and clear', () => {
        choose('ChatGPT');
        press('Add tab');
        choose('Claude');
        press('Move first');
        expect(
            savedState().sessions.map((session) => session.providerKey),
        ).toEqual(['claude', 'chatgpt']);
        press('Rename tab');
        press('Toggle lock');
        expect(frontSession()).toMatchObject({
            title: 'Named tab',
            isLocked: true,
        });
        press('Close tab');
        expect(savedState().sessions).toHaveLength(2);
        press('Add tab');
        choose('Gemini');
        press('Keep this tab');
        expect(
            savedState().sessions.map((session) => session.providerKey),
        ).toEqual(['claude', 'gemini']);
        press('Clear tabs');
        expect(savedState().sessions).toHaveLength(1);
        expect(frontSession()).toMatchObject({
            providerKey: 'claude',
            isLocked: true,
        });
    });

    test('shows a failed sign-out and keeps the guest session', async () => {
        choose('ChatGPT');
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/keep' });
        h.signOutFails = true;
        press('Sign out of every site', host.querySelector('header')!);
        await act(async () => {
            press('Sign out');
            await Promise.resolve();
        });
        expect(
            host.querySelector('[role="alertdialog"]')?.textContent,
        ).toContain('Signing out did not finish');
        expect(frontSession().lastUrl).toBe('https://chatgpt.com/c/keep');
        press('Close');
        expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    });

    test('drops settled microphone prompts and auto-allows only the front site', () => {
        choose('ChatGPT');
        guest().getWebContentsId = () => 7;
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 4,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: true,
        });
        expect(h.sent.at(-1)?.data).toEqual({ askId: 4, isAllowed: true });
        expect(host.querySelector('[aria-label="Microphone"]')).toBeNull();
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 5,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        emit(AI_CHAT_MICROPHONE_SETTLED_CHANNEL, { askId: 5 });
        expect(host.querySelector('[aria-label="Microphone"]')).toBeNull();
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 6,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 7,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        expect(h.sent.at(-1)?.data).toEqual({ askId: 6, isAllowed: false });
        press('Don’t allow');
        expect(h.sent.at(-1)?.data).toEqual({ askId: 7, isAllowed: false });
    });
});
