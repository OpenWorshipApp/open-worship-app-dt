// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks, listenerRegistry } = vi.hoisted(() => ({
    mocks: {
        askAiCaution: vi.fn(),
        revealVirtualItem: vi.fn(),
        openPopupWindow: vi.fn(),
        openAiChatPage: vi.fn(),
        requestChatbotReport: vi.fn(),
        bringDomToNearestView: vi.fn(),
        describeScreensForAgent: vi.fn(),
        numberScreenSlidesForAgent: vi.fn(),
        describePresenterForAgent: vi.fn(),
        handleAgentBibleRequest: vi.fn(),
        handleAgentBibleListRequest: vi.fn(),
        handleAgentForegroundRequest: vi.fn(),
    },
    listenerRegistry: {} as Record<string, (...args: any[]) => void>,
}));

vi.mock('./ai/aiCautionHelpers', () => ({
    askAiCaution: mocks.askAiCaution,
}));
vi.mock('../virtual-list/virtualRevealHelpers', () => ({
    revealVirtualItem: mocks.revealVirtualItem,
}));
vi.mock('./popupWindowHelpers', () => ({
    checkIsPopupWindow: () => false,
    openAiChatPage: mocks.openAiChatPage,
    openPopupWindow: mocks.openPopupWindow,
}));
vi.mock('./ai/chatbotHandoffStoreHelpers', () => ({
    requestChatbotReport: mocks.requestChatbotReport,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: () => {},
}));
vi.mock('../event/KeyboardEventListener', () => ({
    default: {
        registerEventListener: () => [],
        unregisterEventListener: () => {},
        toEventMapperKey: () => 'Escape',
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../server/appHelpers', () => ({ pasteTextToInput: () => {} }));
vi.mock('./helpers', () => ({
    APP_FULL_VIEW_CLASSNAME: 'app-full-view',
    APP_AUTO_HIDE_CLASSNAME: 'app-auto-hide',
    bringDomToNearestView: mocks.bringDomToNearestView,
    checkIsVerticalPartialInvisible: () => false,
    bringDomToCenterView: () => {},
    checkIsVerticalAtBottom: () => false,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        POPUP_FRAME_NAME_PREFIX: 'owa-frame',
        aboutHomePage: 'https://app.local/about',
        chatbotHomePage: 'https://app.local/chatbot',
        systemUtils: { isDev: false },
        messageUtils: {
            sendData: () => {},
            sendDataSync: () => 1,
            listenForData: (
                channel: string,
                callback: (...args: any[]) => void,
            ) => {
                listenerRegistry[channel] = callback;
            },
        },
    },
}));
vi.mock('./agentScreenHelpers', () => ({
    describeScreensForAgent: mocks.describeScreensForAgent,
}));
vi.mock('./agentPresenterHelpers', () => ({
    describePresenterForAgent: mocks.describePresenterForAgent,
    numberScreenSlidesForAgent: mocks.numberScreenSlidesForAgent,
}));
vi.mock('./agentBibleHelpers', () => ({
    handleAgentBibleRequest: mocks.handleAgentBibleRequest,
}));
vi.mock('./agentBibleListHelpers', () => ({
    handleAgentBibleListRequest: mocks.handleAgentBibleListRequest,
}));
vi.mock('./agentForegroundHelpers', () => ({
    handleAgentForegroundRequest: mocks.handleAgentForegroundRequest,
}));

import {
    HoverMotionHandler,
    InputContextMenuHandler,
    handleActiveSelectedElementScrolling,
    notifyElementHighlight,
    removeDomTitle,
} from './domHelpers';

async function settle() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
}

async function waitForCall(mock: ReturnType<typeof vi.fn>) {
    await vi.waitFor(() => {
        expect(mock).toHaveBeenCalled();
    });
}

describe('the native menu doors to the AI windows', () => {
    const chatbotFeatures = {
        width: 460,
        height: 640,
        appGlassy: true,
        appAlignHorizontal: 'right',
        appAlignVertical: 'center',
        appFollowScale: true,
        appTopToMain: true,
    };

    test('Help -> App Help asks the caution, then opens the chatbot beside the app', async () => {
        mocks.askAiCaution.mockResolvedValue(true);
        listenerRegistry['main:app:open-chatbot-page']();
        await waitForCall(mocks.openPopupWindow);
        expect(mocks.askAiCaution).toHaveBeenCalledWith('assistant');
        expect(mocks.openPopupWindow).toHaveBeenCalledWith(
            'https://app.local/chatbot',
            expect.stringMatching(/^chatbot_\d+$/),
            'chatbot',
            chatbotFeatures,
        );
    });

    test('a declined caution opens nothing', async () => {
        mocks.askAiCaution.mockResolvedValue(false);
        listenerRegistry['main:app:open-chatbot-page']();
        listenerRegistry['main:app:open-chatbot-report']();
        listenerRegistry['main:app:open-aichat-page']();
        await vi.waitFor(() => {
            expect(mocks.askAiCaution).toHaveBeenCalledTimes(3);
        });
        await settle();
        expect(mocks.openPopupWindow).not.toHaveBeenCalled();
        expect(mocks.openAiChatPage).not.toHaveBeenCalled();
        expect(mocks.requestChatbotReport).not.toHaveBeenCalled();
    });

    test('Report a Problem leaves an empty report request, then opens the chatbot', async () => {
        mocks.askAiCaution.mockResolvedValue(true);
        listenerRegistry['main:app:open-chatbot-report']();
        await waitForCall(mocks.openPopupWindow);
        expect(mocks.askAiCaution).toHaveBeenCalledWith('assistant');
        expect(mocks.requestChatbotReport).toHaveBeenCalledWith('');
        // The request is stored before the window that takes it opens.
        expect(
            mocks.requestChatbotReport.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.openPopupWindow.mock.invocationCallOrder[0]);
        expect(mocks.openPopupWindow.mock.calls[0][2]).toBe('chatbot');
    });

    test('Help -> AI Chat asks the aichat caution, then opens that window', async () => {
        mocks.askAiCaution.mockResolvedValue(true);
        listenerRegistry['main:app:open-aichat-page']();
        await waitForCall(mocks.openAiChatPage);
        expect(mocks.askAiCaution).toHaveBeenCalledWith('aichat');
        expect(mocks.openPopupWindow).not.toHaveBeenCalled();
    });
});

describe('agent relays answer a failing worker with the reason', () => {
    async function request(eventName: string, detail: unknown) {
        const answer = new Promise<any>((resolve) => {
            document.addEventListener(
                `${eventName}-answer`,
                (event) => {
                    resolve((event as CustomEvent).detail);
                },
                { once: true },
            );
        });
        document.dispatchEvent(new CustomEvent(eventName, { detail }));
        return await answer;
    }

    test('owa-agent-screens: a describe that throws', async () => {
        mocks.describeScreensForAgent.mockImplementation(() => {
            throw new Error('screen manager not ready');
        });
        expect(await request('owa-agent-screens', { token: 1 })).toEqual({
            token: 1,
            result: { isError: true, reason: 'screen manager not ready' },
        });
    });

    test('owa-agent-screens: a numbering pass that rejects with a bare string', async () => {
        mocks.describeScreensForAgent.mockReturnValue({
            isAuthoritative: true,
            screens: [],
        });
        mocks.numberScreenSlidesForAgent.mockRejectedValue('no document');
        expect(await request('owa-agent-screens', { token: 2 })).toEqual({
            token: 2,
            result: { isError: true, reason: 'no document' },
        });
    });

    test('owa-agent-presenter', async () => {
        mocks.describePresenterForAgent.mockRejectedValue(
            new Error('presenter closed'),
        );
        expect(await request('owa-agent-presenter', { token: 3 })).toEqual({
            token: 3,
            result: { isError: true, reason: 'presenter closed' },
        });
    });

    test('owa-agent-bible gets the whole detail, and its failure', async () => {
        mocks.handleAgentBibleRequest.mockRejectedValue(
            new Error('no bible installed'),
        );
        const detail = { token: 4, reference: 'John 3:16' };
        expect(await request('owa-agent-bible', detail)).toEqual({
            token: 4,
            result: { isError: true, reason: 'no bible installed' },
        });
        expect(mocks.handleAgentBibleRequest).toHaveBeenCalledWith(detail);
    });

    test('owa-agent-data', async () => {
        mocks.handleAgentBibleListRequest.mockRejectedValue(
            new Error('list locked'),
        );
        expect(
            await request('owa-agent-data', { token: 5, domain: 'bible-item' }),
        ).toEqual({
            token: 5,
            result: { isError: true, reason: 'list locked' },
        });
    });

    test('owa-agent-foreground', async () => {
        mocks.handleAgentForegroundRequest.mockRejectedValue(
            new Error('no screen ticked'),
        );
        expect(await request('owa-agent-foreground', { token: 6 })).toEqual({
            token: 6,
            result: { isError: true, reason: 'no screen ticked' },
        });
    });

    test('an event with no detail is still answered', async () => {
        mocks.describePresenterForAgent.mockRejectedValue(new Error('x'));
        expect(await request('owa-agent-presenter', undefined)).toEqual({
            token: undefined,
            result: { isError: true, reason: 'x' },
        });
    });
});

describe('guards against nodes that are not elements', () => {
    const textNode = () => document.createTextNode('just text');

    test('scrolling, hover motion, context menus and titles skip text nodes', async () => {
        expect(() => {
            handleActiveSelectedElementScrolling(textNode());
        }).not.toThrow();
        expect(mocks.bringDomToNearestView).not.toHaveBeenCalled();
        expect(() => {
            new HoverMotionHandler().listenForHoverMotion(textNode());
        }).not.toThrow();
        expect(() => {
            new InputContextMenuHandler().listenForInputContextMenu(textNode());
        }).not.toThrow();
        await expect(
            removeDomTitle(textNode(), 'added'),
        ).resolves.toBeUndefined();
    });
});

describe('HoverMotionHandler', () => {
    let observers: Array<{ callback: () => void; observed: Element[] }>;
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
        observers = [];
        (globalThis as any).ResizeObserver = class {
            observed: Element[] = [];
            constructor(public callback: () => void) {
                observers.push(this);
            }
            observe(element: Element) {
                this.observed.push(element);
            }
        };
    });

    afterEach(() => {
        (globalThis as any).ResizeObserver = originalResizeObserver;
        document.body.innerHTML = '';
    });

    function genWidget({ isTopMotion = true, minWidth = '100' } = {}) {
        const wrapper = document.createElement('div');
        if (isTopMotion) {
            wrapper.className = `panel ${HoverMotionHandler.topClassname}`;
        }
        const middle = document.createElement('div');
        const child = document.createElement('div');
        child.className = HoverMotionHandler.lowDisplayClassname;
        child.dataset.minParentWidth = minWidth;
        middle.appendChild(child);
        wrapper.appendChild(middle);
        document.body.appendChild(wrapper);
        let width = 80;
        Object.defineProperty(wrapper, 'offsetWidth', {
            configurable: true,
            get: () => width,
        });
        return {
            wrapper,
            child,
            setWidth: (value: number) => {
                width = value;
            },
        };
    }

    test('a parent too narrow hides the control, and widening shows it', () => {
        const { wrapper, child, setWidth } = genWidget();
        child.classList.add('force-show');
        const handler = new HoverMotionHandler();
        handler.listenForHoverMotion(wrapper);
        // 80px is not wider than the 100px minimum.
        expect(child.classList.contains('force-show')).toBe(false);
        expect(observers).toHaveLength(1);
        expect(observers[0].observed).toEqual([wrapper]);

        setWidth(100);
        observers[0].callback();
        expect(child.classList.contains('force-show')).toBe(false);
        setWidth(101);
        observers[0].callback();
        expect(child.classList.contains('force-show')).toBe(true);
    });

    test('an element is only ever observed once', () => {
        const { wrapper, child } = genWidget();
        const handler = new HoverMotionHandler();
        handler.listenForHoverMotion(wrapper);
        handler.listenForHoverMotion(wrapper);
        handler.init(child);
        expect(observers).toHaveLength(1);
    });

    test('without a hover-motion ancestor nothing is observed', () => {
        const { wrapper, child } = genWidget({ isTopMotion: false });
        const handler = new HoverMotionHandler();
        expect(handler.findParent(child)).toBeNull();
        handler.listenForHoverMotion(wrapper);
        expect(observers).toEqual([]);
        expect(child.classList.contains('force-show')).toBe(false);
    });

    test('the ancestor is found however deep the control sits', () => {
        const { wrapper, child } = genWidget();
        expect(new HoverMotionHandler().findParent(child)).toBe(wrapper);
    });

    test('a control with no minimum width is left alone', () => {
        const { child } = genWidget();
        delete child.dataset.minParentWidth;
        new HoverMotionHandler().init(child);
        expect(observers).toEqual([]);
    });
});

describe('notifyElementHighlight polling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('asks a windowed list to reveal the row on every poll until it mounts', async () => {
        const row = document.createElement('div');
        let polls = 0;
        const moveToView = vi.fn();
        const promise = notifyElementHighlight(
            () => {
                polls += 1;
                return polls >= 3 ? row : null;
            },
            { moveToView, revealKey: '/songs/amazing-grace.owa' },
        );
        await vi.advanceTimersByTimeAsync(300);
        await promise;
        expect(moveToView).toHaveBeenCalledWith(row);
        expect(mocks.revealVirtualItem.mock.calls).toEqual([
            ['/songs/amazing-grace.owa'],
            ['/songs/amazing-grace.owa'],
            ['/songs/amazing-grace.owa'],
        ]);
        vi.advanceTimersByTime(100);
        expect(
            row.classList.contains('app-notify-element-highlight-success'),
        ).toBe(true);
    });

    test('a typed highlight uses its own class', async () => {
        const row = document.createElement('div');
        await notifyElementHighlight(() => row, {
            moveToView: () => {},
            type: 'danger',
        });
        vi.advanceTimersByTime(100);
        expect(
            row.classList.contains('app-notify-element-highlight-danger'),
        ).toBe(true);
        // No reveal key: the list is never asked.
        expect(mocks.revealVirtualItem).not.toHaveBeenCalled();
    });

    test('gives up after about three seconds without the element', async () => {
        const moveToView = vi.fn();
        let isSettled = false;
        notifyElementHighlight(() => null, { moveToView }).then(() => {
            isSettled = true;
        });
        await vi.advanceTimersByTimeAsync(3_100);
        expect(isSettled).toBe(false);
        await vi.advanceTimersByTimeAsync(100);
        expect(isSettled).toBe(true);
        expect(moveToView).not.toHaveBeenCalled();
        expect(mocks.bringDomToNearestView).not.toHaveBeenCalled();
    });
});
