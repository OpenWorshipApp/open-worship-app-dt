// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    copyToClipboardMock: vi.fn(),
    openResourceLinkUrlMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../context-menu/appContextMenuHelpers')
        >();
    return { ...original, showAppContextMenu: h.showAppContextMenuMock };
});

vi.mock('../server/appHelpers', () => ({
    copyToClipboard: h.copyToClipboardMock,
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));

vi.mock('./resourceLinksHelpers', () => ({
    openResourceLinkUrl: h.openResourceLinkUrlMock,
    toResourceLinkHostLabel: (url: string) =>
        new URL(url).hostname.replace(/^www\./, ''),
    toResourceLinksDroppedLabel: (count: number) =>
        `${count} ${count === 1 ? 'entry was not understood' : 'entries were not understood'}`,
}));

import ResourcesFileLinksComp from './ResourcesFileLinksComp';
import type { ResourceLinksResultType } from './resourceLinksHelpers';

describe('ResourcesFileLinksComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        h.copyToClipboardMock.mockReset();
        h.openResourceLinkUrlMock.mockReset();
        h.showAppContextMenuMock
            .mockReset()
            .mockImplementation((event: Event) => {
                event.preventDefault();
                event.stopPropagation();
            });
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    async function renderLinks(result: ResourceLinksResultType) {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<ResourcesFileLinksComp result={result} />);
        });
    }

    test('opens a link from its button and exposes its destination in the title', async () => {
        await renderLinks({
            links: [
                { title: 'Overview', url: 'https://www.example.com/watch' },
            ],
            droppedCount: 0,
            isTruncated: false,
            failureReason: null,
        });
        const button = container?.querySelector<HTMLButtonElement>(
            '.app-resources-link',
        );
        if (!button) {
            throw new Error('Missing resource link');
        }

        expect(button.title).toBe('Overview https://www.example.com/watch');
        expect(
            button.querySelector('.app-resources-link-host')?.textContent,
        ).toBe('example.com');
        expect(
            button
                .querySelector('.app-resources-link-host')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
        await act(async () => {
            button.click();
        });
        expect(h.openResourceLinkUrlMock).toHaveBeenCalledWith(
            'https://www.example.com/watch',
        );
    });

    test('the link menu can open or copy its address and warnings are counted', async () => {
        await renderLinks({
            links: [{ title: 'Study', url: 'https://example.com/study' }],
            droppedCount: 2,
            isTruncated: true,
            failureReason: null,
        });
        const button = container?.querySelector<HTMLButtonElement>(
            '.app-resources-link',
        );
        if (!button) {
            throw new Error('Missing resource link');
        }
        expect(container?.textContent).toContain(
            '2 entries were not understood',
        );
        expect(container?.textContent).toContain('Too many links');

        await act(async () => {
            button.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const items = h.showAppContextMenuMock.mock.calls.at(-1)?.[1] as Array<{
            menuElement: string;
            onSelect: () => void;
        }>;
        const copyItem = items.find(
            (item) => item.menuElement === 'Copy URL to Clipboard',
        );
        const openItem = items.find(
            (item) => item.menuElement === 'Open Link in Browser',
        );
        expect(copyItem).toBeDefined();
        expect(openItem).toBeDefined();
        copyItem?.onSelect();
        openItem?.onSelect();
        expect(h.copyToClipboardMock).toHaveBeenCalledWith(
            'https://example.com/study',
        );
        expect(h.openResourceLinkUrlMock).toHaveBeenCalledWith(
            'https://example.com/study',
        );
    });

    test('does not draw warnings when the list has no dropped or truncated entries', async () => {
        await renderLinks({
            links: [],
            droppedCount: 0,
            isTruncated: false,
            failureReason: null,
        });

        expect(container?.querySelector('.app-resources-note')).toBeNull();
        expect(container?.querySelector('.app-resources-link')).toBeNull();
    });
});
