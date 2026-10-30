// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
    AI_CHAT_POPUP_REFUSED_CHANNEL,
    POPUP_NOTICE_SHOW_MS,
} from './aiChatPopupHelpers';

type ListenerType = (event: unknown, data: unknown) => void;

const state = vi.hoisted(() => ({
    listeners: new Map<string, Set<(event: unknown, data: unknown) => void>>(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        // appHooks reads it at load: plain useEffect, as in production.
        systemUtils: { isDev: false },
        messageUtils: {
            listenForData: (channel: string, listener: ListenerType) => {
                if (!state.listeners.has(channel)) {
                    state.listeners.set(channel, new Set());
                }
                state.listeners.get(channel)!.add(listener);
            },
            removeListener: (channel: string, listener: ListenerType) => {
                state.listeners.get(channel)?.delete(listener);
            },
        },
    },
}));

import RenderAiChatPopupNoticeComp from './RenderAiChatPopupNoticeComp';

let host: HTMLDivElement;
let root: Root;
let frontGuestId: number | null = 11;

function refuse(data: unknown) {
    act(() => {
        for (const listener of state.listeners.get(
            AI_CHAT_POPUP_REFUSED_CHANNEL,
        ) ?? []) {
            listener({}, data);
        }
    });
}

function renderNotice(activeId: string) {
    act(() => {
        root.render(
            <RenderAiChatPopupNoticeComp
                activeId={activeId}
                getFrontGuestId={() => frontGuestId}
            />,
        );
    });
}

function notice() {
    return host.querySelector('[role="status"]');
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.listeners.clear();
    frontGuestId = 11;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('the line that says a page was not opened', () => {
    test('names the site for a refusal in the tab in front and goes away on its own', () => {
        renderNotice('tab-1');
        expect(notice()).toBeNull();

        refuse({ guestId: 11, hostname: 'example.com' });

        expect(notice()?.getAttribute('aria-label')).toBe('Page not opened');
        expect(notice()?.textContent).toContain('example.com');
        act(() => {
            vi.advanceTimersByTime(POPUP_NOTICE_SHOW_MS - 1);
        });
        expect(notice()).not.toBeNull();
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(notice()).toBeNull();
    });

    test('ignores a refusal from a tab behind, with no tab in front, or that is malformed', () => {
        renderNotice('tab-1');

        refuse({ guestId: 12, hostname: 'example.com' });
        refuse({ guestId: 11, hostname: '' });
        refuse({ guestId: 1.5, hostname: 'example.com' });
        refuse('example.com');
        frontGuestId = null;
        refuse({ guestId: 11, hostname: 'example.com' });

        expect(notice()).toBeNull();
    });

    test('closes when pressed and when the tab it was about is no longer in front', () => {
        renderNotice('tab-1');
        refuse({ guestId: 11, hostname: 'one.example' });
        act(() => {
            host.querySelector<HTMLButtonElement>('button')!.click();
        });
        expect(notice()).toBeNull();

        refuse({ guestId: 11, hostname: 'two.example' });
        expect(notice()?.textContent).toContain('two.example');
        renderNotice('tab-2');
        expect(notice()).toBeNull();
    });

    test('stops listening when the window goes', () => {
        renderNotice('tab-1');
        expect(state.listeners.get(AI_CHAT_POPUP_REFUSED_CHANNEL)?.size).toBe(
            1,
        );

        act(() => root.unmount());
        root = createRoot(host);

        expect(state.listeners.get(AI_CHAT_POPUP_REFUSED_CHANNEL)?.size).toBe(
            0,
        );
    });
});
