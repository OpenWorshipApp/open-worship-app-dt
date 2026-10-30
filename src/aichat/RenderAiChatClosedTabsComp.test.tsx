// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import RenderAiChatClosedTabsComp from './RenderAiChatClosedTabsComp';
import type { AiChatClosedTabType } from './aiChatSessionHelpers';

const NOW = new Date('2026-10-28T12:00:00Z').getTime();
const MINUTE = 60_000;

let host: HTMLDivElement;
let root: Root;

function genClosedTab(
    overrides: Partial<AiChatClosedTabType>,
): AiChatClosedTabType {
    return {
        id: 'closed-1',
        providerKey: 'claude',
        title: '',
        pageTitle: '',
        lastUrl: null,
        closedAt: NOW - 30 * 1000,
        ...overrides,
    };
}

function render(
    closedTabs: AiChatClosedTabType[],
    canReopen = true,
    onReopen = vi.fn(),
    onForget = vi.fn(),
) {
    act(() => {
        root.render(
            <RenderAiChatClosedTabsComp
                closedTabs={closedTabs}
                canReopen={canReopen}
                onReopen={onReopen}
                onForget={onForget}
            />,
        );
    });
    return { onReopen, onForget };
}

function items() {
    return [...host.querySelectorAll<HTMLButtonElement>('.aichat-closed-item')];
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('recently closed AI Chat tabs', () => {
    test('says where closed tabs will appear when there are none', () => {
        render([]);

        expect(host.querySelector('.aichat-closed-empty')?.textContent).toBe(
            'Tabs you close show up here, so you can open them again.',
        );
        expect(items()).toHaveLength(0);
    });

    test('names each tab by what the user called it, then the page, then the site, with how long ago', () => {
        render([
            genClosedTab({ id: 'a', title: 'Sermon notes' }),
            genClosedTab({
                id: 'b',
                pageTitle: 'Claude page',
                closedAt: NOW - 5 * MINUTE,
            }),
            genClosedTab({
                id: 'c',
                providerKey: 'chatgpt',
                closedAt: NOW - 3 * 60 * MINUTE,
            }),
            genClosedTab({
                id: 'd',
                providerKey: 'gone-site',
                closedAt: NOW - 25 * 60 * MINUTE,
            }),
            genClosedTab({
                id: 'e',
                closedAt: NOW - 3 * 24 * 60 * MINUTE,
            }),
            genClosedTab({ id: 'f', closedAt: 0 }),
        ]);

        const names = items().map(
            (item) => item.querySelector('.aichat-closed-name')?.textContent,
        );
        expect(names).toEqual([
            'Sermon notes',
            'Claude page',
            'ChatGPT',
            'Chat',
            'Claude',
            'Claude',
        ]);
        const metas = items().map(
            (item) => item.querySelector('.aichat-closed-meta')?.textContent,
        );
        expect(metas).toEqual([
            'claude.ai · just now',
            'claude.ai · 5 min ago',
            'chatgpt.com · 3 h ago',
            // A site no longer offered has no badge and no host.
            'yesterday',
            'claude.ai · 3 days ago',
            'claude.ai',
        ]);
        expect(items()[3].querySelector('.aichat-badge')).toBeNull();
        expect(items()[2].querySelector('.aichat-badge')?.textContent).toBe(
            'GPT',
        );
    });

    test('reopens the pressed tab and clears the list on request', () => {
        const { onReopen, onForget } = render([
            genClosedTab({ id: 'a', title: 'Sermon notes' }),
        ]);

        expect(items()[0].title).toBe('Open “Sermon notes” again');
        act(() => {
            items()[0].click();
        });
        expect(onReopen).toHaveBeenCalledWith('a');

        act(() => {
            host.querySelector<HTMLButtonElement>(
                '.aichat-closed-forget',
            )!.click();
        });
        expect(onForget).toHaveBeenCalledOnce();
    });

    test('holds every reopen while the window has no room for another tab', () => {
        const { onReopen } = render(
            [genClosedTab({ id: 'a', title: 'Sermon notes' })],
            false,
        );

        expect(items()[0].disabled).toBe(true);
        expect(items()[0].title).toBe('Close a tab before opening another');
        act(() => {
            items()[0].click();
        });
        expect(onReopen).not.toHaveBeenCalled();
    });
});
