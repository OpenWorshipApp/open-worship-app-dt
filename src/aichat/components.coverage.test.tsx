// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    listeners: new Map<string, (_event: unknown, data: unknown) => void>(),
    removed: [] as string[],
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
vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            listenForData: (
                channel: string,
                listener: (_event: unknown, data: unknown) => void,
            ) => {
                h.listeners.set(channel, listener);
            },
            removeListener: (
                channel: string,
                listener: (_event: unknown, data: unknown) => void,
            ) => {
                if (h.listeners.get(channel) === listener) {
                    h.listeners.delete(channel);
                    h.removed.push(channel);
                }
            },
        },
    },
}));

import RenderAiChatClosedTabsComp from './RenderAiChatClosedTabsComp';
import RenderAiChatPopupNoticeComp from './RenderAiChatPopupNoticeComp';
import {
    AI_CHAT_POPUP_REFUSED_CHANNEL,
    POPUP_NOTICE_SHOW_MS,
} from './aiChatPopupHelpers';
import type { AiChatClosedTabType } from './aiChatSessionHelpers';

let container: HTMLDivElement;
let root: Root;

function refuse(data: unknown) {
    const listener = h.listeners.get(AI_CHAT_POPUP_REFUSED_CHANNEL);
    if (listener === undefined) {
        throw new Error('The notice is not listening');
    }
    act(() => listener({}, data));
}

function notice() {
    return container.querySelector('[role="status"]');
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.listeners.clear();
    h.removed.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('RenderAiChatPopupNoticeComp', () => {
    function renderNotice(activeId: string, frontGuestId: number | null) {
        act(() =>
            root.render(
                <RenderAiChatPopupNoticeComp
                    activeId={activeId}
                    getFrontGuestId={() => frontGuestId}
                />,
            ),
        );
    }

    test('says a refused page for the tab in front, as a status line', () => {
        renderNotice('tab-1', 7);
        expect(notice()).toBeNull();
        refuse({ guestId: 7, hostname: 'example.com' });
        const line = notice();
        expect(line?.getAttribute('aria-label')).toBe('Page not opened');
        expect(line?.textContent).toContain(
            'This site tried to open example.com in your browser without a press',
        );
        // It is not a question: nothing on it opens the page.
        const buttons = line!.querySelectorAll('button');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].textContent).toBe('Close');
        act(() => buttons[0].click());
        expect(notice()).toBeNull();
    });

    test('a tab behind, a guest not attached, or junk says nothing', () => {
        renderNotice('tab-1', 7);
        refuse({ guestId: 8, hostname: 'example.com' });
        expect(notice()).toBeNull();
        refuse({ guestId: 7, hostname: '' });
        refuse({ guestId: '7', hostname: 'example.com' });
        refuse(null);
        expect(notice()).toBeNull();

        renderNotice('tab-1', null);
        refuse({ guestId: 7, hostname: 'example.com' });
        expect(notice()).toBeNull();
    });

    test('goes away on its own after the time to read it once', () => {
        vi.useFakeTimers();
        renderNotice('tab-1', 3);
        refuse({ guestId: 3, hostname: 'docs.example.org' });
        expect(notice()).not.toBeNull();
        act(() => vi.advanceTimersByTime(POPUP_NOTICE_SHOW_MS - 1));
        expect(notice()).not.toBeNull();
        act(() => vi.advanceTimersByTime(1));
        expect(notice()).toBeNull();
    });

    test('goes with the tab it was about', () => {
        renderNotice('tab-1', 3);
        refuse({ guestId: 3, hostname: 'example.com' });
        expect(notice()).not.toBeNull();
        renderNotice('tab-2', 3);
        expect(notice()).toBeNull();
        // Back on the first tab, the old line does not come back.
        renderNotice('tab-1', 3);
        expect(notice()).toBeNull();
    });

    test('a newer refusal replaces the line, and unmounting stops listening', () => {
        renderNotice('tab-1', 3);
        refuse({ guestId: 3, hostname: 'first.example' });
        refuse({ guestId: 3, hostname: 'second.example' });
        expect(notice()?.textContent).toContain('second.example');
        expect(notice()?.textContent).not.toContain('first.example');
        act(() => root.unmount());
        expect(h.removed).toEqual([AI_CHAT_POPUP_REFUSED_CHANNEL]);
        expect(h.listeners.has(AI_CHAT_POPUP_REFUSED_CHANNEL)).toBe(false);
        root = createRoot(container);
    });
});

describe('RenderAiChatClosedTabsComp', () => {
    const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);
    const MINUTE = 60_000;

    function genClosedTab(
        overrides: Partial<AiChatClosedTabType>,
    ): AiChatClosedTabType {
        return {
            id: 'closed-1',
            providerKey: 'chatgpt',
            title: '',
            pageTitle: '',
            lastUrl: null,
            closedAt: NOW,
            ...overrides,
        };
    }

    function renderList(closedTabs: AiChatClosedTabType[], canReopen = true) {
        const onReopen = vi.fn();
        const onForget = vi.fn();
        act(() =>
            root.render(
                <RenderAiChatClosedTabsComp
                    closedTabs={closedTabs}
                    canReopen={canReopen}
                    onReopen={onReopen}
                    onForget={onForget}
                />,
            ),
        );
        return { onReopen, onForget };
    }

    function items() {
        return Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                '.aichat-closed-item',
            ),
        );
    }

    beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    test('an empty list says what will appear there', () => {
        renderList([]);
        expect(
            container.querySelector('.aichat-closed-empty')?.textContent,
        ).toBe('Tabs you close show up here, so you can open them again.');
        expect(container.querySelector('.aichat-closed-list')).toBeNull();
    });

    test('names a tab by its own name, the page, the site, else "Chat"', () => {
        renderList([
            genClosedTab({ id: 'a', title: 'Typed', pageTitle: 'Page' }),
            genClosedTab({ id: 'b', pageTitle: 'From the site' }),
            genClosedTab({ id: 'c', providerKey: 'claude' }),
            genClosedTab({ id: 'd', providerKey: 'retired-site' }),
        ]);
        expect(
            items().map((item) => {
                return item.querySelector('.aichat-closed-name')?.textContent;
            }),
        ).toEqual(['Typed', 'From the site', 'Claude', 'Chat']);
        // A site this build no longer knows gets no badge and no host.
        const [, , claude, retired] = items();
        expect(claude.querySelector('.aichat-badge')?.textContent).toBe('Cl');
        expect(claude.querySelector('.aichat-closed-meta')?.textContent).toBe(
            'claude.ai · just now',
        );
        expect(retired.querySelector('.aichat-badge')).toBeNull();
        expect(retired.querySelector('.aichat-closed-meta')?.textContent).toBe(
            'just now',
        );
    });

    test('says how long ago, coarsely', () => {
        renderList([
            genClosedTab({ id: 'now', closedAt: NOW - 30_000 }),
            genClosedTab({ id: 'min', closedAt: NOW - 5 * MINUTE }),
            genClosedTab({ id: 'hour', closedAt: NOW - 3 * 60 * MINUTE }),
            genClosedTab({ id: 'day', closedAt: NOW - 25 * 60 * MINUTE }),
            genClosedTab({ id: 'days', closedAt: NOW - 3 * 24 * 60 * MINUTE }),
            genClosedTab({ id: 'unknown', closedAt: 0 }),
        ]);
        expect(
            items().map((item) => {
                return item.querySelector('.aichat-closed-meta')?.textContent;
            }),
        ).toEqual([
            'chatgpt.com · just now',
            'chatgpt.com · 5 min ago',
            'chatgpt.com · 3 h ago',
            'chatgpt.com · yesterday',
            'chatgpt.com · 3 days ago',
            // A tab with no time on it says only where it was.
            'chatgpt.com',
        ]);
    });

    test('a press reopens that tab; the link forgets the list', () => {
        const { onReopen, onForget } = renderList([
            genClosedTab({ id: 'first', pageTitle: 'Prayer' }),
            genClosedTab({ id: 'second', pageTitle: 'Notice' }),
        ]);
        const [, second] = items();
        expect(second.disabled).toBe(false);
        expect(second.title).toBe('Open “Notice” again');
        act(() => second.click());
        expect(onReopen).toHaveBeenCalledWith('second');
        expect(onForget).not.toHaveBeenCalled();
        const forget = container.querySelector<HTMLButtonElement>(
            '.aichat-closed-forget',
        )!;
        expect(forget.textContent).toBe('Clear this list');
        act(() => forget.click());
        expect(onForget).toHaveBeenCalledTimes(1);
    });

    test('a full strip cannot take one back, and says why', () => {
        const { onReopen } = renderList(
            [genClosedTab({ id: 'first', pageTitle: 'Prayer' })],
            false,
        );
        const [item] = items();
        expect(item.disabled).toBe(true);
        expect(item.title).toBe('Close a tab before opening another');
        act(() => item.click());
        expect(onReopen).not.toHaveBeenCalled();
    });
});
