// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    listeners: new Map<string, (_event: unknown, data: unknown) => void>(),
    sent: [] as { channel: string; data: unknown }[],
    handed: [] as unknown[],
    opened: [] as { uuid?: string; place?: { x: number; y: number } }[],
    nextId: 0,
    handAllowed: true,
    signOutCount: 0,
    applyFont: vi.fn(),
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
// The save is debounced in the window; here it writes at once, so the file
// is what a test reads the tabs back from.
vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void) => callback(),
}));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'light' }),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isGlassCapable: false },
        messageUtils: {
            listenForData: (
                channel: string,
                listener: (_event: unknown, data: unknown) => void,
            ) => h.listeners.set(channel, listener),
            removeListener: (channel: string) => h.listeners.delete(channel),
            sendData: (channel: string, data: unknown) => {
                h.sent.push({ channel, data });
            },
            sendDataSync: (channel: string, data: unknown) => {
                if (channel === 'main:app:ai-chat-window-slot') return 0;
                if (channel === 'main:app:ai-chat-take-tab') return null;
                if (channel === 'main:app:ai-chat-hand-tab') {
                    h.handed.push(data);
                    return h.handAllowed;
                }
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
// A strip with one set of controls PER TAB, so a tab behind the front one
// can be chosen, closed or dragged out.
vi.mock('../chatbot/RenderSessionTabsComp', () => ({
    default: (props: any) => (
        <nav aria-label="Tabs">
            {props.sessions.map((session: any) => (
                <span
                    key={session.id}
                    className="test-tab"
                    data-id={session.id}
                    data-provider={session.providerKey ?? ''}
                    data-active={String(session.id === props.activeId)}
                >
                    <button
                        type="button"
                        onClick={() => props.onChoose(session.id)}
                    >{`Choose ${session.id}`}</button>
                    <button
                        type="button"
                        onClick={() => props.onClose(session.id)}
                    >{`Close ${session.id}`}</button>
                    <button
                        type="button"
                        onClick={() => props.onTearOff(session.id, 500, 300)}
                    >{`Tear off ${session.id}`}</button>
                </span>
            ))}
            <button type="button" onClick={props.onAdd}>
                Add tab
            </button>
        </nav>
    ),
}));
vi.mock('./aiChatSignOutHelpers', () => ({
    clearAiChatSiteData: async () => {
        h.signOutCount += 1;
        return true;
    },
}));
vi.mock('../helper/popupWindowHelpers', () => ({
    genAiChatWindowUuid: () => 'new-window',
    openAiChatPage: (uuid?: string, place?: { x: number; y: number }) => {
        h.opened.push({ uuid, place });
        return {} as Window;
    },
}));
vi.mock('./aiChatGuestFontHelpers', () => ({
    applyGuestLanguageFont: h.applyFont,
}));

import AiChatAppComp from './AiChatAppComp';
import {
    AI_CHAT_MICROPHONE_ANSWER_CHANNEL,
    AI_CHAT_MICROPHONE_ASK_CHANNEL,
} from './aiChatMicrophoneHelpers';
import { AI_CHAT_POPUP_REFUSED_CHANNEL } from './aiChatPopupHelpers';
import type {
    AiChatSessionStateType,
    AiChatSessionType,
} from './aiChatSessionHelpers';

let host: HTMLDivElement;
let root: Root;

function findButton(name: string, within: Element = host) {
    return Array.from(within.querySelectorAll('button')).find((item) => {
        return (
            item.textContent?.trim() === name ||
            item.getAttribute('aria-label') === name
        );
    });
}

function press(name: string, within: Element = host) {
    const button = findButton(name, within);
    if (button === undefined) throw new Error(`Missing button: ${name}`);
    act(() => button.click());
}

function tabs() {
    return Array.from(host.querySelectorAll<HTMLElement>('.test-tab')).map(
        (tab) => {
            return {
                id: tab.dataset.id!,
                provider: tab.dataset.provider!,
                isActive: tab.dataset.active === 'true',
            };
        },
    );
}

function frontTabId() {
    const tab = tabs().find((one) => one.isActive);
    if (tab === undefined) throw new Error('No tab in front');
    return tab.id;
}

function savedState(): AiChatSessionStateType {
    return JSON.parse(
        h.settings.get('aichat-sessions')!,
    ) as AiChatSessionStateType;
}

function savedSession(id: string): AiChatSessionType | undefined {
    return savedState().sessions.find((session) => session.id === id);
}

function guest() {
    const element = host.querySelector(
        'webview.aichat-guest:not(.is-off)',
    ) as HTMLElement & { getWebContentsId?: () => number };
    if (element === null) throw new Error('Missing guest');
    return element;
}

function guestEvent(type: string, values: Record<string, unknown> = {}) {
    const view = guest();
    act(() => view.dispatchEvent(Object.assign(new Event(type), values)));
}

function choose(providerName: string) {
    const button = Array.from(
        host.querySelectorAll<HTMLButtonElement>('.aichat-choice'),
    ).find((item) => {
        return (
            item.querySelector('.aichat-choice-name')?.textContent ===
            providerName
        );
    });
    if (button === undefined) throw new Error(`Missing site: ${providerName}`);
    act(() => button.click());
}

function emit(channel: string, data: unknown) {
    const listener = h.listeners.get(channel);
    if (listener === undefined) throw new Error(`Missing listener: ${channel}`);
    act(() => listener({}, data));
}

function keyDown(target: EventTarget, init: KeyboardEventInit) {
    act(() => {
        target.dispatchEvent(
            new KeyboardEvent('keydown', { bubbles: true, ...init }),
        );
    });
}

function reopenShortcut() {
    keyDown(window, { key: 'T', ctrlKey: true, shiftKey: true });
}

function mount() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<AiChatAppComp />));
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.settings.clear();
    h.sent.length = 0;
    h.handed.length = 0;
    h.opened.length = 0;
    h.handAllowed = true;
    h.signOutCount = 0;
    mount();
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('the guest stays a stranger', () => {
    test('it carries its partition, popups and address, and nothing else', () => {
        choose('ChatGPT');
        const view = guest();
        const names = view.getAttributeNames();
        // No preload, no node, no web preferences, no other session: the
        // host page gives the guest exactly these, and the main process
        // forces the sandbox on top.
        expect([...names].sort()).toEqual([
            'allowpopups',
            'class',
            'partition',
            'src',
        ]);
        // A guest's partition cannot change once it starts to navigate.
        expect(names.indexOf('partition')).toBeLessThan(names.indexOf('src'));
        expect(view.getAttribute('partition')).toBe('persist:aichat');
        // The attribute as Electron spells it, not React's "true"/"false".
        expect(view.getAttribute('allowpopups')).toBe('');
        expect(view.getAttribute('src')).toBe('https://chatgpt.com/');
    });

    test('the language face goes in at dom-ready and again once loaded', () => {
        choose('ChatGPT');
        const view = guest();
        expect(h.applyFont).not.toHaveBeenCalled();
        guestEvent('dom-ready');
        expect(h.applyFont).toHaveBeenCalledTimes(1);
        expect(h.applyFont).toHaveBeenLastCalledWith(view);
        guestEvent('did-stop-loading');
        expect(h.applyFont).toHaveBeenCalledTimes(2);
        expect(host.querySelector('[role="progressbar"]')).toBeNull();
    });

    test('only the main frame moves the tab, and only to an address', () => {
        choose('ChatGPT');
        const id = frontTabId();
        guestEvent('did-navigate-in-page', {
            isMainFrame: false,
            url: 'https://chatgpt.com/c/in-a-frame',
        });
        guestEvent('did-navigate', { url: 42 });
        expect(savedSession(id)?.lastUrl).toBeNull();
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/main' });
        expect(savedSession(id)?.lastUrl).toBe('https://chatgpt.com/c/main');
    });

    test('a frame failing is not the page failing; a bare code is still said', () => {
        choose('ChatGPT');
        guestEvent('did-fail-load', { isMainFrame: false, errorCode: -105 });
        expect(host.querySelector('[role="alert"]')).toBeNull();
        guestEvent('did-fail-load', { errorCode: -105, errorDescription: '' });
        expect(host.querySelector('[role="alert"]')?.textContent).toContain(
            'ChatGPT could not be loaded — error -105.',
        );
    });

    test('"Open in your browser" falls back while the guest cannot say where it is', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        choose('ChatGPT');
        // jsdom's element has no `getURL`: the same throw as a guest that
        // has not reached dom-ready.
        press('Open in your browser');
        expect(open).toHaveBeenLastCalledWith('https://chatgpt.com/');
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/two' });
        press('Open in your browser');
        expect(open).toHaveBeenLastCalledWith('https://chatgpt.com/c/two');
    });

    test('a guest not attached yet is refused the microphone, even when allowed', () => {
        choose('ChatGPT');
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 9,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: true,
        });
        expect(h.sent).toEqual([
            {
                channel: AI_CHAT_MICROPHONE_ANSWER_CHANNEL,
                data: { askId: 9, isAllowed: false },
            },
        ]);
        // Something that is not an ask is not answered at all.
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, { askId: 'x', guestId: 7 });
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, null);
        expect(h.sent).toHaveLength(1);
        expect(host.querySelector('[aria-label="Microphone"]')).toBeNull();
    });

    test('Escape on the microphone line is a no', () => {
        choose('ChatGPT');
        guest().getWebContentsId = () => 7;
        emit(AI_CHAT_MICROPHONE_ASK_CHANNEL, {
            askId: 10,
            guestId: 7,
            hostname: 'chatgpt.com',
            isAllowed: false,
        });
        const line = host.querySelector('[aria-label="Microphone"]')!;
        expect(line).not.toBeNull();
        keyDown(line, { key: 'Enter' });
        expect(host.querySelector('[aria-label="Microphone"]')).not.toBeNull();
        keyDown(line, { key: 'Escape' });
        expect(h.sent.at(-1)).toEqual({
            channel: AI_CHAT_MICROPHONE_ANSWER_CHANNEL,
            data: { askId: 10, isAllowed: false },
        });
        expect(host.querySelector('[aria-label="Microphone"]')).toBeNull();
    });

    test('a page refused for the tab in front is said on its line', () => {
        choose('ChatGPT');
        guest().getWebContentsId = () => 7;
        emit(AI_CHAT_POPUP_REFUSED_CHANNEL, {
            guestId: 8,
            hostname: 'behind.example',
        });
        expect(host.querySelector('[aria-label="Page not opened"]')).toBeNull();
        emit(AI_CHAT_POPUP_REFUSED_CHANNEL, {
            guestId: 7,
            hostname: 'front.example',
        });
        expect(
            host.querySelector('[aria-label="Page not opened"]')?.textContent,
        ).toContain('This site tried to open front.example in your browser');
    });
});

describe('signing out asks first', () => {
    test('the chooser card asks too, and Escape keeps everyone signed in', () => {
        const card = host.querySelector('.aichat-chooser')!;
        press('Sign out of every site', card);
        const dialog = host.querySelector('[role="alertdialog"]')!;
        expect(dialog.getAttribute('aria-label')).toBe(
            'Sign out of every site',
        );
        expect(dialog.textContent).toContain('This cannot be undone.');
        keyDown(dialog, { key: 'Tab' });
        expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
        keyDown(dialog, { key: 'Escape' });
        expect(host.querySelector('[role="alertdialog"]')).toBeNull();
        expect(h.signOutCount).toBe(0);
    });
});

describe('tabs', () => {
    test('a tab behind is chosen to the front, and closing one behind keeps it', () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
        choose('ChatGPT');
        const firstId = frontTabId();
        press('Add tab');
        choose('Claude');
        const secondId = frontTabId();
        expect(secondId).not.toBe(firstId);

        now.mockReturnValue(5_000);
        press(`Choose ${firstId}`);
        expect(frontTabId()).toBe(firstId);
        expect(savedState().activeId).toBe(firstId);
        expect(savedSession(firstId)?.lastUsedAt).toBe(5_000);
        expect(guest().getAttribute('src')).toBe('https://chatgpt.com/');

        press(`Close ${secondId}`);
        expect(tabs()).toEqual([
            { id: firstId, provider: 'chatgpt', isActive: true },
        ]);
        expect(
            JSON.parse(h.settings.get('aichat-closed-tabs')!).map(
                (tab: { providerKey: string }) => tab.providerKey,
            ),
        ).toEqual(['claude']);
    });

    test('a full strip takes no new tab and gives none back', () => {
        choose('ChatGPT');
        for (let index = 1; index < 8; index++) {
            press('Add tab');
            choose('Gemini');
        }
        expect(tabs()).toHaveLength(8);
        // Only the front tab and the two used last keep their site loaded.
        expect(host.querySelectorAll('webview')).toHaveLength(3);
        press('Add tab');
        expect(tabs()).toHaveLength(8);

        const closedTab = {
            id: 'closed-old',
            providerKey: 'claude',
            title: '',
            pageTitle: 'Old notes',
            lastUrl: null,
            closedAt: 1,
        };
        h.settings.set('aichat-closed-tabs', JSON.stringify([closedTab]));
        reopenShortcut();
        expect(tabs()).toHaveLength(8);
        expect(JSON.parse(h.settings.get('aichat-closed-tabs')!)).toEqual([
            closedTab,
        ]);

        // The clock's list says so too, and Escape puts it away.
        press('Recently closed tabs', host.querySelector('header')!);
        const panel = host.querySelector('.aichat-closed-panel')!;
        const item = panel.querySelector<HTMLButtonElement>(
            '.aichat-closed-item',
        )!;
        expect(item.disabled).toBe(true);
        expect(item.title).toBe('Close a tab before opening another');
        keyDown(panel, { key: 'ArrowDown' });
        expect(host.querySelector('.aichat-closed-panel')).not.toBeNull();
        keyDown(panel, { key: 'Escape' });
        expect(host.querySelector('.aichat-closed-panel')).toBeNull();
    });

    test('the shortcut with nothing closed opens nothing', () => {
        const before = tabs();
        reopenShortcut();
        // Ctrl+Alt+Shift+T is somebody else's shortcut.
        h.settings.set(
            'aichat-closed-tabs',
            JSON.stringify([
                {
                    id: 'closed-1',
                    providerKey: 'claude',
                    title: '',
                    pageTitle: '',
                    lastUrl: null,
                    closedAt: 1,
                },
            ]),
        );
        keyDown(window, {
            key: 't',
            ctrlKey: true,
            shiftKey: true,
            altKey: true,
        });
        expect(tabs()).toEqual(before);
        expect(before).toHaveLength(1);
        expect(before[0].provider).toBe('');
    });

    test('a closed tab reopens IN a blank chooser tab, and the list can be forgotten', () => {
        choose('ChatGPT');
        const firstId = frontTabId();
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/one' });
        press('Add tab');
        const blankId = frontTabId();
        press(`Choose ${firstId}`);
        press(`Close ${firstId}`);
        expect(frontTabId()).toBe(blankId);

        const card = host.querySelector('.aichat-chooser')!;
        expect(card.textContent).toContain('Recently closed');
        const item = card.querySelector<HTMLButtonElement>(
            '.aichat-closed-item',
        )!;
        expect(item.title).toBe('Open “ChatGPT” again');
        act(() => item.click());
        // The blank tab was replaced, not joined.
        const [reopened] = tabs();
        expect(tabs()).toHaveLength(1);
        expect(reopened).toMatchObject({ provider: 'chatgpt', isActive: true });
        expect(reopened.id).not.toBe(blankId);
        expect(guest().getAttribute('src')).toBe('https://chatgpt.com/c/one');
        expect(h.settings.get('aichat-closed-tabs')).toBe('[]');

        // Closing the last tab lands on a fresh chooser holding it again.
        press(`Close ${reopened.id}`);
        expect(tabs()).toHaveLength(1);
        expect(tabs()[0].provider).toBe('');
        expect(
            host.querySelector('.aichat-chooser .aichat-closed-list'),
        ).not.toBeNull();
        press('Clear this list', host.querySelector('.aichat-chooser')!);
        expect(h.settings.has('aichat-closed-tabs')).toBe(false);
        expect(
            host.querySelector('.aichat-chooser .aichat-closed-list'),
        ).toBeNull();
        expect(
            host.querySelector('.aichat-chooser')?.textContent,
        ).not.toContain('Recently closed');
    });

    test('a tab is dragged out only when the main process takes it', () => {
        choose('ChatGPT');
        const firstId = frontTabId();
        press('Add tab');
        choose('Claude');
        const secondId = frontTabId();

        h.handAllowed = false;
        press(`Tear off ${secondId}`);
        expect(h.opened).toEqual([]);
        expect(tabs().map((tab) => tab.id)).toEqual([firstId, secondId]);

        h.handAllowed = true;
        press(`Tear off ${secondId}`);
        // The new window is put where the tab was let go.
        expect(h.opened).toEqual([
            { uuid: 'new-window', place: { x: 410, y: 250 } },
        ]);
        expect(h.handed.at(-1)).toMatchObject({
            uuid: 'new-window',
            tab: { id: secondId, providerKey: 'claude' },
        });
        expect(tabs()).toEqual([
            { id: firstId, provider: 'chatgpt', isActive: true },
        ]);
        expect(savedSession(secondId)).toBeUndefined();
    });

    test('the head row moves the tab to another site, starting it afresh', () => {
        choose('ChatGPT');
        const id = frontTabId();
        guestEvent('page-title-updated', { title: 'A prayer' });
        guestEvent('did-navigate', { url: 'https://chatgpt.com/c/prayer' });
        const select =
            host.querySelector<HTMLSelectElement>('#aichat-provider')!;
        expect(select.value).toBe('chatgpt');
        act(() => {
            select.value = 'claude';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(savedSession(id)).toMatchObject({
            providerKey: 'claude',
            pageTitle: '',
            lastUrl: null,
        });
        expect(guest().getAttribute('src')).toBe('https://claude.ai/new');
        expect(host.querySelectorAll('webview')).toHaveLength(1);
    });

    test('the tabs are written at once as the window goes, and not after', () => {
        choose('ChatGPT');
        const id = frontTabId();
        h.settings.delete('aichat-sessions');
        act(() => window.dispatchEvent(new Event('beforeunload')));
        expect(savedSession(id)?.providerKey).toBe('chatgpt');

        act(() => root.unmount());
        h.settings.delete('aichat-sessions');
        window.dispatchEvent(new Event('beforeunload'));
        expect(h.settings.has('aichat-sessions')).toBe(false);
        host.remove();
        mount();
    });
});
