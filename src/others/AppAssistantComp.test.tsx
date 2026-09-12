// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openChatbotPageMock: vi.fn(),
    openAiChatPageMock: vi.fn(),
    getIsAIEnabledMock: vi.fn(() => true),
    showAppConfirmMock: vi.fn(async () => true),
    popupWidgetManager: { openConfirm: vi.fn() },
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
    openAiChatPage: h.openAiChatPageMock,
}));
vi.mock('../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: h.getIsAIEnabledMock,
}));
// The AI caution runs for real here; only its dialog is stubbed, so these
// tests prove the gate rather than the fail-open shortcut behind it.
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirmMock,
    popupWidgetManager: h.popupWidgetManager,
}));

import AppAssistantComp from './AppAssistantComp';

// The open handlers await the AI caution, so nothing has happened yet when
// the call returns. One flushed microtask queue is all they need.
async function settle() {
    await act(async () => {
        await Promise.resolve();
    });
}

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
    h.showAppConfirmMock.mockResolvedValue(true);
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

function getMenuItems(): any[] {
    const call = h.setAppMenuItemsMock.mock.calls.at(-1);
    return call?.[1]?.tools ?? [];
}

function getMenuItem() {
    return getMenuItems()[0];
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
        await settle();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPageMock).toHaveBeenCalledTimes(1);
    });

    // Asked for by the user: the caution comes first, and declining it opens
    // nothing at all.
    test('opens nothing when the caution is declined', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<AppAssistantComp />);
        h.captured.kbCb();
        await settle();
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
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
        await settle();
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

    test('contributes the AI Chat entry beside it, with no shortcut', async () => {
        await render(<AppAssistantComp />);
        expect(getMenuItems()).toHaveLength(2);
        expect(getMenuItems()[1]).toEqual({
            label: 'AI Chat',
            clickData: { isOpenAiChat: true },
        });
        getMenuClickHandler()(null, { isOpenAiChat: true });
        await settle();
        expect(h.showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(h.openAiChatPageMock).toHaveBeenCalledTimes(1);
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
    });

    test('opens no AI Chat when its caution is declined', async () => {
        h.showAppConfirmMock.mockResolvedValueOnce(false);
        await render(<AppAssistantComp />);
        getMenuClickHandler()(null, { isOpenAiChat: true });
        await settle();
        expect(h.openAiChatPageMock).not.toHaveBeenCalled();
    });

    test('ignores the AI Chat click when another window is in front', async () => {
        await render(<AppAssistantComp />);
        h.appProvider.getIsWindowFocused.mockReturnValue(false);
        getMenuClickHandler()(null, { isOpenAiChat: true });
        expect(h.openAiChatPageMock).not.toHaveBeenCalled();
    });

    test('keeps only the AI Chat entry when AI is switched off', async () => {
        h.getIsAIEnabledMock.mockReturnValue(false);
        await render(<AppAssistantComp />);
        // Re-registered rather than withdrawn: a window that loaded while AI
        // was still on is corrected to the same one-item list.
        expect(getMenuItems()).toEqual([
            { label: 'AI Chat', clickData: { isOpenAiChat: true } },
        ]);
        h.captured.kbCb();
        getMenuClickHandler()(null, { isOpenChatbot: true });
        await settle();
        expect(h.openChatbotPageMock).not.toHaveBeenCalled();
        // The site window holds no key and asks the assistant nothing, so
        // the switch has nothing to turn off there.
        getMenuClickHandler()(null, { isOpenAiChat: true });
        await settle();
        expect(h.openAiChatPageMock).toHaveBeenCalledTimes(1);
    });
});
