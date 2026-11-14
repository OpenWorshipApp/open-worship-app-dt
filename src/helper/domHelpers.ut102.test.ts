// @vitest-environment jsdom

// The agent relays no other test reaches: the note editor and the note's own
// window, the language door, the one-flow editor and the screens' own
// controls -- each handed the whole detail and answered under its token.

import { describe, expect, test, vi } from 'vitest';

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
        handleAgentNoteEditRequest: vi.fn(),
        handleAgentNoteWindowRequest: vi.fn(),
        handleAgentLanguageRequest: vi.fn(),
        handleAgentPresentingFlowEditRequest: vi.fn(),
        handleAgentScreenEditRequest: vi.fn(),
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
vi.mock('./agentNoteEditHelpers', () => ({
    handleAgentNoteEditRequest: mocks.handleAgentNoteEditRequest,
}));
vi.mock('./agentNoteWindowHelpers', () => ({
    handleAgentNoteWindowRequest: mocks.handleAgentNoteWindowRequest,
}));
vi.mock('./agentLanguageHelpers', () => ({
    handleAgentLanguageRequest: mocks.handleAgentLanguageRequest,
}));
vi.mock('./agentPresentingFlowEditHelpers', () => ({
    handleAgentPresentingFlowEditRequest:
        mocks.handleAgentPresentingFlowEditRequest,
}));
vi.mock('./agentScreenControlHelpers', () => ({
    handleAgentScreenEditRequest: mocks.handleAgentScreenEditRequest,
}));

import './domHelpers';

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

describe('owa-agent-data: the domains only a help window asks for', () => {
    const DOMAIN_LIST = [
        ['note-edit', 'handleAgentNoteEditRequest'],
        ['note-window', 'handleAgentNoteWindowRequest'],
        ['language', 'handleAgentLanguageRequest'],
        ['presenting-flow-edit', 'handleAgentPresentingFlowEditRequest'],
    ] as const;

    test.each(DOMAIN_LIST)(
        '%s reaches its own worker with the whole detail',
        async (domain, workerName) => {
            const worker = mocks[workerName];
            worker.mockResolvedValue({ done: domain });
            const detail = { token: 21, domain, action: 'read' };
            expect(await request('owa-agent-data', detail)).toEqual({
                token: 21,
                result: { done: domain },
            });
            expect(worker).toHaveBeenCalledExactlyOnceWith(detail);
            // No other worker of the table was woken.
            for (const [, otherName] of DOMAIN_LIST) {
                if (otherName !== workerName) {
                    expect(mocks[otherName]).not.toHaveBeenCalled();
                }
            }
        },
    );

    test('a worker that fails is answered with its reason', async () => {
        mocks.handleAgentNoteEditRequest.mockRejectedValue(
            new Error('the note is not open'),
        );
        expect(
            await request('owa-agent-data', { token: 22, domain: 'note-edit' }),
        ).toEqual({
            token: 22,
            result: { isError: true, reason: 'the note is not open' },
        });
    });
});

describe('owa-agent-screen-edit', () => {
    test('the screens worker gets the detail and its answer is sent back', async () => {
        mocks.handleAgentScreenEditRequest.mockResolvedValue({
            changed: ['lock'],
        });
        const detail = { token: 31, screenId: 0, lock: true };
        expect(await request('owa-agent-screen-edit', detail)).toEqual({
            token: 31,
            result: { changed: ['lock'] },
        });
        expect(mocks.handleAgentScreenEditRequest).toHaveBeenCalledWith(detail);
    });

    test('a failure is answered with its reason, a thrown string too', async () => {
        mocks.handleAgentScreenEditRequest.mockRejectedValueOnce(
            new Error('no such screen'),
        );
        expect(await request('owa-agent-screen-edit', { token: 32 })).toEqual({
            token: 32,
            result: { isError: true, reason: 'no such screen' },
        });
        mocks.handleAgentScreenEditRequest.mockRejectedValueOnce('locked');
        expect(await request('owa-agent-screen-edit', { token: 33 })).toEqual({
            token: 33,
            result: { isError: true, reason: 'locked' },
        });
    });

    test('an event with no detail is still answered', async () => {
        mocks.handleAgentScreenEditRequest.mockResolvedValue({ ok: true });
        expect(await request('owa-agent-screen-edit', undefined)).toEqual({
            token: undefined,
            result: { ok: true },
        });
        expect(mocks.handleAgentScreenEditRequest).toHaveBeenCalledWith({});
    });
});
