// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { appProviderMock } = vi.hoisted(() => ({
    appProviderMock: {
        messageUtils: {
            sendData: vi.fn(),
            sendDataSync: vi.fn(),
            listenForData: vi.fn(),
            removeListener: vi.fn(),
        },
    },
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../appHooks', async () => {
    const react = await import('react');
    return { useAppEffect: react.useEffect };
});

import { notifyChatbotBusy, useIsChatbotBusy } from './chatbotBusyHelpers';

function RenderBusyComp() {
    return <span>{useIsChatbotBusy() ? 'busy' : 'idle'}</span>;
}

describe('chatbotBusyHelpers', () => {
    let container: HTMLDivElement;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('the help window tells the main process, which tells every window', () => {
        notifyChatbotBusy(true);
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:chatbot-busy',
            { isBusy: true },
        );
    });

    test('a window listens, then asks -- never blocking on the answer', async () => {
        await act(async () => {
            root = createRoot(container);
            root.render(<RenderBusyComp />);
        });
        // A synchronous ask froze every window with a 🤖 the one time main
        // had no answer for it.
        expect(
            appProviderMock.messageUtils.sendDataSync,
        ).not.toHaveBeenCalled();
        const listenOrder =
            appProviderMock.messageUtils.listenForData.mock
                .invocationCallOrder[0];
        const askOrder =
            appProviderMock.messageUtils.sendData.mock.invocationCallOrder[0];
        expect(listenOrder).toBeLessThan(askOrder);
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:get-chatbot-busy',
        );
        expect(container.textContent).toBe('idle');

        // Opened mid-answer: the reply to the ask puts the point up.
        const [channel, listener] =
            appProviderMock.messageUtils.listenForData.mock.calls[0];
        expect(channel).toBe('main:app:chatbot-busy');
        await act(async () => {
            listener(null, { isBusy: true });
        });
        expect(container.textContent).toBe('busy');
        await act(async () => {
            listener(null, { isBusy: false });
        });
        expect(container.textContent).toBe('idle');

        // And the SAME listener comes off, or it would never stop listening.
        await act(async () => root?.unmount());
        root = null;
        expect(
            appProviderMock.messageUtils.removeListener,
        ).toHaveBeenCalledWith('main:app:chatbot-busy', listener);
    });
});
