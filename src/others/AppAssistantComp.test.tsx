// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openChatbotPageMock: vi.fn(),
    getIsAIEnabledMock: vi.fn(() => true),
    setAppMenuItemsMock: vi.fn(),
    // Typed, so `mock.calls.at(-1)?.[0]` is the handler rather than `never`:
    // an untyped `vi.fn` infers an empty parameter tuple.
    registerAppMenuClickedMock: vi.fn((_handler: any) => () => {}),
    captured: { kbMappers: undefined as any, kbCb: undefined as any },
    appProvider: {
        systemUtils: { isDev: false, isMac: false },
        getIsWindowFocused: vi.fn(() => true),
    },
}));

vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (mappers: any, cb: any) => {
        h.captured.kbMappers = mappers;
        h.captured.kbCb = cb;
    },
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => key,
    setAppMenuItems: h.setAppMenuItemsMock,
    registerAppMenuClicked: h.registerAppMenuClickedMock,
}));
vi.mock('../server/appProvider', () => ({ default: h.appProvider }));
// `domHelpers` registers IPC listeners at module scope, which the appProvider
// mock above has no channel for.
vi.mock('../helper/domHelpers', () => ({
    openChatbotPage: h.openChatbotPageMock,
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: h.getIsAIEnabledMock,
}));

import AppAssistantComp from './AppAssistantComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function render(node: any) {
    await act(async () => {
        root = createRoot(container);
        root.render(node);
    });
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    h.getIsAIEnabledMock.mockReturnValue(true);
    h.appProvider.getIsWindowFocused.mockReturnValue(true);
});

afterEach(async () => {
    if (root !== null) {
        await act(async () => {
            root?.unmount();
        });
        root = null;
    }
    container.remove();
});

function getMenuItem() {
    const call = h.setAppMenuItemsMock.mock.calls.at(-1);
    return call?.[1]?.tools?.[0];
}

function getMenuClickHandler() {
    const handler = h.registerAppMenuClickedMock.mock.calls.at(-1)?.[0];
    if (handler === undefined) {
        throw new Error('no menu click handler was registered');
    }
    return handler;
}

describe('AppAssistantComp', () => {
    test('draws nothing: it is a menu entry and a shortcut', async () => {
        await render(<AppAssistantComp />);
        expect(container.innerHTML).toBe('');
    });

    test('contributes a Tools entry routed to the focused window', async () => {
        await render(<AppAssistantComp />);
        const [key, , options] = h.setAppMenuItemsMock.mock.calls.at(-1) ?? [];
        expect(key).toBe('chatbot-assistant');
        expect(getMenuItem()).toMatchObject({
            label: 'App Assistant',
            accelerator: 'Ctrl+Shift+A',
            clickData: { isOpenChatbot: true },
        });
        // Every window contributes this key, so an owner-routed click would
        // reach only whichever one loaded last.
        expect(options).toEqual({ isRoutedToFocusedWindow: true });
    });

    test('opens the assistant on the shortcut', async () => {
        await render(<AppAssistantComp />);
        h.captured.kbCb();
        expect(h.openChatbotPageMock).toHaveBeenCalledTimes(1);
    });

    test('spells the shortcut out for every platform', async () => {
        await render(<AppAssistantComp />);
        for (const mapper of h.captured.kbMappers) {
            expect(mapper.mControlKey).toBeDefined();
            expect(mapper.wControlKey).toBeDefined();
            expect(mapper.lControlKey).toBeDefined();
        }
    });

    test('opens on the menu click when this window is in front', async () => {
        await render(<AppAssistantComp />);
        const handler = getMenuClickHandler();
        handler(null, { isOpenChatbot: true });
        expect(h.openChatbotPageMock).toHaveBeenCalledTimes(1);
    });

    test('ignores the menu click when another window is in front', async () => {
        await render(<AppAssistantComp />);
        h.appProvider.getIsWindowFocused.mockReturnValue(false);
        const handler = getMenuClickHandler();
        handler(null, { isOpenChatbot: true });
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    test('ignores a menu click that is not its own', async () => {
        await render(<AppAssistantComp />);
        const handler = getMenuClickHandler();
        handler(null, { isTogglePresentingControl: true });
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    test('withdraws the entry when AI is switched off', async () => {
        h.getIsAIEnabledMock.mockReturnValue(false);
        await render(<AppAssistantComp />);
        // Withdrawn, not merely never contributed: a window that loaded while
        // AI was still on may have left the same key registered.
        expect(h.setAppMenuItemsMock).toHaveBeenCalledWith(
            'chatbot-assistant',
            null,
        );
        h.captured.kbCb();
        getMenuClickHandler()(null, { isOpenChatbot: true });
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });
});
