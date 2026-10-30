// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Its own lean surface rather than `domHelpers.test.tsx`'s: these are the
// paths that one cannot reach -- the caution in front of three menu entries,
// the relays' failure answers and the edges of the hover and scroll helpers.
const h = vi.hoisted(() => ({
    listeners: {} as Record<string, (...args: any[]) => void>,
    askAiCaution: vi.fn(),
    openPopupWindow: vi.fn(),
    openAiChatPage: vi.fn(),
    requestChatbotReport: vi.fn(),
    revealVirtualItem: vi.fn(),
    bringDomToNearestView: vi.fn(),
    bringDomToCenterView: vi.fn(),
    sendData: vi.fn(),
    describeScreensForAgent: vi.fn(),
    describePresenterForAgent: vi.fn(),
    handleAgentBibleRequest: vi.fn(),
    handleAgentNoteRequest: vi.fn(),
    handleAgentForegroundRequest: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        POPUP_FRAME_NAME_PREFIX: 'owa-frame',
        aboutHomePage: 'https://app.local/about',
        chatbotHomePage: 'https://app.local/chatbot',
        messageUtils: {
            sendData: h.sendData,
            sendDataSync: vi.fn(),
            listenForData: (channel: string, callback: () => void) => {
                h.listeners[channel] = callback;
            },
        },
    },
}));
vi.mock('./ai/aiCautionHelpers', () => ({ askAiCaution: h.askAiCaution }));
vi.mock('./ai/chatbotHandoffStoreHelpers', () => ({
    requestChatbotReport: h.requestChatbotReport,
}));
vi.mock('./popupWindowHelpers', () => ({
    checkIsPopupWindow: vi.fn(),
    openAiChatPage: h.openAiChatPage,
    openPopupWindow: h.openPopupWindow,
}));
vi.mock('../virtual-list/virtualRevealHelpers', () => ({
    revealVirtualItem: h.revealVirtualItem,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: vi.fn(),
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));
vi.mock('../event/KeyboardEventListener', () => ({
    default: {
        registerEventListener: vi.fn(),
        unregisterEventListener: vi.fn(),
        toEventMapperKey: vi.fn(),
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appHelpers', () => ({ pasteTextToInput: vi.fn() }));
vi.mock('./helpers', () => ({
    APP_FULL_VIEW_CLASSNAME: 'app-full-view',
    APP_AUTO_HIDE_CLASSNAME: 'app-auto-hide',
    bringDomToNearestView: h.bringDomToNearestView,
    bringDomToCenterView: h.bringDomToCenterView,
    checkIsVerticalPartialInvisible: vi.fn(),
    checkIsVerticalAtBottom: vi.fn(),
}));
vi.mock('./agentScreenHelpers', () => ({
    describeScreensForAgent: h.describeScreensForAgent,
}));
vi.mock('./agentPresenterHelpers', () => ({
    describePresenterForAgent: h.describePresenterForAgent,
}));
vi.mock('./agentBibleHelpers', () => ({
    handleAgentBibleRequest: h.handleAgentBibleRequest,
}));
vi.mock('./agentNoteHelpers', () => ({
    handleAgentNoteRequest: h.handleAgentNoteRequest,
}));
vi.mock('./agentForegroundHelpers', () => ({
    handleAgentForegroundRequest: h.handleAgentForegroundRequest,
}));

import {
    HoverMotionHandler,
    InputContextMenuHandler,
    handleActiveSelectedElementScrolling,
    notifyElementHighlight,
    removeDomTitle,
} from './domHelpers';

async function flush() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

beforeEach(() => {
    class ResizeObserverStub {
        observe = vi.fn();
        constructor(public callback: () => void) {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('the menu entries that ask the AI caution first', () => {
    test('Help -> App Help opens the assistant only once the caution is accepted', async () => {
        h.askAiCaution.mockResolvedValue(false);
        h.listeners['main:app:open-chatbot-page']();
        await flush();
        expect(h.askAiCaution).toHaveBeenCalledWith('assistant');
        expect(h.openPopupWindow).not.toHaveBeenCalled();

        h.askAiCaution.mockResolvedValue(true);
        h.listeners['main:app:open-chatbot-page']();
        await flush();
        expect(h.openPopupWindow).toHaveBeenCalledWith(
            'https://app.local/chatbot',
            expect.stringMatching(/^chatbot_\d+$/),
            'chatbot',
            expect.objectContaining({ width: 460, appGlassy: true }),
        );
    });

    test('Report a Problem leaves an empty report request, then opens', async () => {
        h.askAiCaution.mockResolvedValue(false);
        h.listeners['main:app:open-chatbot-report']();
        await flush();
        expect(h.requestChatbotReport).not.toHaveBeenCalled();
        expect(h.openPopupWindow).not.toHaveBeenCalled();

        h.askAiCaution.mockResolvedValue(true);
        h.listeners['main:app:open-chatbot-report']();
        await vi.waitFor(() => {
            expect(h.openPopupWindow).toHaveBeenCalledTimes(1);
        });
        expect(h.requestChatbotReport).toHaveBeenCalledWith('');
        expect(h.requestChatbotReport.mock.invocationCallOrder[0]).toBeLessThan(
            h.openPopupWindow.mock.invocationCallOrder[0],
        );
    });

    test('Help -> AI Chat asks its own caution', async () => {
        h.askAiCaution.mockResolvedValue(false);
        h.listeners['main:app:open-aichat-page']();
        await flush();
        expect(h.askAiCaution).toHaveBeenCalledWith('aichat');
        expect(h.openAiChatPage).not.toHaveBeenCalled();

        h.askAiCaution.mockResolvedValue(true);
        h.listeners['main:app:open-aichat-page']();
        await flush();
        expect(h.openAiChatPage).toHaveBeenCalledTimes(1);
    });
});

describe('an agent relay whose worker fails answers with the reason', () => {
    async function request(eventName: string, detail: unknown) {
        const answer = new Promise<CustomEvent>((resolve) => {
            document.addEventListener(
                `${eventName}-answer`,
                (event) => resolve(event as CustomEvent),
                { once: true },
            );
        });
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
        return (await answer).detail;
    }

    test('the screens', async () => {
        h.describeScreensForAgent.mockImplementation(() => {
            throw new Error('no screen manager');
        });
        expect(await request('owa-agent-screens', { token: 1 })).toEqual({
            token: 1,
            result: { isError: true, reason: 'no screen manager' },
        });
    });

    test('the presenter', async () => {
        h.describePresenterForAgent.mockRejectedValue(new Error('no document'));
        expect(await request('owa-agent-presenter', { token: 2 })).toEqual({
            token: 2,
            result: { isError: true, reason: 'no document' },
        });
    });

    test('a Bible passage, with a reason that is not an Error', async () => {
        h.handleAgentBibleRequest.mockRejectedValue('locked screen');
        expect(await request('owa-agent-bible', { token: 3 })).toEqual({
            token: 3,
            result: { isError: true, reason: 'locked screen' },
        });
    });

    test('the data relay', async () => {
        h.handleAgentNoteRequest.mockRejectedValue(new Error('note is open'));
        expect(
            await request('owa-agent-data', { token: 4, domain: 'note' }),
        ).toEqual({
            token: 4,
            result: { isError: true, reason: 'note is open' },
        });
    });

    test('a foreground extra', async () => {
        h.handleAgentForegroundRequest.mockRejectedValue(
            new Error('no ticked screen'),
        );
        expect(await request('owa-agent-foreground', { token: 5 })).toEqual({
            token: 5,
            result: { isError: true, reason: 'no ticked screen' },
        });
    });
});

describe('the element helpers ignore what is not an element', () => {
    test('a text node is never scrolled to', () => {
        handleActiveSelectedElementScrolling(document.createTextNode('x'));
        expect(h.bringDomToNearestView).not.toHaveBeenCalled();
        expect(h.bringDomToCenterView).not.toHaveBeenCalled();
    });

    test('a text node has no hover motion, inputs or title', async () => {
        const text = document.createTextNode('x');
        const hoverHandler = new HoverMotionHandler();
        const initSpy = vi.spyOn(hoverHandler, 'init');
        hoverHandler.listenForHoverMotion(text);
        expect(initSpy).not.toHaveBeenCalled();

        const inputHandler = new InputContextMenuHandler();
        const inputInitSpy = vi.spyOn(inputHandler, 'init');
        inputHandler.listenForInputContextMenu(text);
        expect(inputInitSpy).not.toHaveBeenCalled();

        await expect(removeDomTitle(text, 'added')).resolves.toBeUndefined();
    });
});

describe('HoverMotionHandler', () => {
    function genTree(minParentWidth?: string) {
        const top = document.createElement('div');
        top.className = HoverMotionHandler.topClassname;
        const middle = document.createElement('div');
        const child = document.createElement('span');
        child.className = HoverMotionHandler.lowDisplayClassname;
        if (minParentWidth !== undefined) {
            child.dataset.minParentWidth = minParentWidth;
        }
        middle.appendChild(child);
        top.appendChild(middle);
        document.body.appendChild(top);
        return { top, child };
    }

    test('finds the hover top past plain ancestors, and hides when too narrow', () => {
        const { top, child } = genTree('200');
        Object.defineProperty(top, 'offsetWidth', {
            configurable: true,
            value: 150,
        });
        child.classList.add('force-show');
        const hoverHandler = new HoverMotionHandler();
        expect(hoverHandler.findParent(child)).toBe(top);

        hoverHandler.init(child);
        expect(child.classList.contains('force-show')).toBe(false);
    });

    test('an element is watched once', () => {
        const { top, child } = genTree('100');
        Object.defineProperty(top, 'offsetWidth', {
            configurable: true,
            value: 300,
        });
        const hoverHandler = new HoverMotionHandler();
        hoverHandler.init(child);
        const observer = hoverHandler.map.get(child);
        expect(observer).toBeDefined();
        child.classList.remove('force-show');

        hoverHandler.init(child);
        expect(hoverHandler.map.get(child)).toBe(observer);
        // A second init did not measure again.
        expect(child.classList.contains('force-show')).toBe(false);
    });

    test('no hover top, or no minimum width, is nothing to watch', () => {
        const lonely = document.createElement('span');
        lonely.dataset.minParentWidth = '100';
        document.body.appendChild(lonely);
        const hoverHandler = new HoverMotionHandler();
        expect(hoverHandler.findParent(lonely)).toBeNull();
        hoverHandler.init(lonely);
        expect(hoverHandler.map.has(lonely)).toBe(false);

        const { child } = genTree();
        hoverHandler.init(child);
        expect(hoverHandler.map.has(child)).toBe(false);
    });
});

describe('notifyElementHighlight', () => {
    test('gives up on a row that never appears, asking the list each time', async () => {
        vi.useFakeTimers();
        const moveToView = vi.fn();
        const highlighting = notifyElementHighlight(() => null, {
            moveToView,
            revealKey: '/songs/amazing-grace.owl',
        });
        await vi.advanceTimersByTimeAsync(4_000);
        await highlighting;
        expect(moveToView).not.toHaveBeenCalled();
        expect(h.revealVirtualItem.mock.calls.length).toBeGreaterThan(30);
        expect(h.revealVirtualItem).toHaveBeenCalledWith(
            '/songs/amazing-grace.owl',
        );
    });

    test('flashes the asked-for kind of highlight and takes it off again', async () => {
        vi.useFakeTimers();
        const element = document.createElement('div');
        document.body.appendChild(element);
        const moveToView = vi.fn();
        await notifyElementHighlight(() => element, {
            moveToView,
            type: 'warning',
        });
        expect(moveToView).toHaveBeenCalledWith(element);
        expect(h.bringDomToNearestView).not.toHaveBeenCalled();

        const className = 'app-notify-element-highlight-warning';
        expect(element.classList.contains(className)).toBe(false);
        vi.advanceTimersByTime(100);
        expect(element.classList.contains(className)).toBe(true);
        vi.advanceTimersByTime(2_100);
        expect(element.classList.contains(className)).toBe(false);
    });
});
