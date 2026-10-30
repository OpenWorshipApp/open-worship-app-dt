// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The rendered song: the SHARED `OpenLyric` is mounted into this body's own
// element, and the body carries the song's menu (Reload, Edit). The real
// `lyricContextMenuHelpers` builds the Reload row.
const h = vi.hoisted(() => ({
    lyricManager: null as any,
    showAppContextMenu: vi.fn(),
    openEditor: vi.fn(),
}));

vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening }: { onOpening: (event: any) => void }) =>
        createElement('button', { id: 'dots', onClick: onOpening }),
}));
vi.mock('./LyricManager', () => ({
    useLyricManagerContext: () => h.lyricManager,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('./lyricEditorHelpers', () => ({
    openPopupLyricEditorWindow: h.openEditor,
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    genEditSlideContextMenuItem: (onSelect: () => void) => ({
        menuElement: 'Edit',
        onSelect,
    }),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import LyricRenderPreviewBodyComp from './LyricRenderPreviewBodyComp';

function genLyricManager() {
    return {
        lyric: { filePath: '/songs/grace.owl' },
        openLyricPreviewer: {
            container: null as HTMLElement | null,
            mount: vi.fn(),
            reload: vi.fn(),
        },
    };
}

let container: HTMLDivElement;
let root: Root;

async function renderBody() {
    await act(async () => {
        root.render(createElement(LyricRenderPreviewBodyComp));
    });
}

function getSongElement() {
    return container.querySelector<HTMLElement>(
        '.app-lyric-render-preview-body',
    )!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.lyricManager = genLyricManager();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('LyricRenderPreviewBodyComp', () => {
    test('mounts the shared previewer into its own element', async () => {
        await renderBody();
        const openLyric = h.lyricManager.openLyricPreviewer;
        expect(openLyric.container).toBe(getSongElement());
        expect(openLyric.mount).toHaveBeenCalledTimes(1);
    });

    test('hands the previewer its element back on unmount', async () => {
        await renderBody();
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        expect(h.lyricManager.openLyricPreviewer.container).toBeNull();
    });

    test('a right-click offers Reload and Edit for this song', async () => {
        await renderBody();
        const event = new MouseEvent('contextmenu', { bubbles: true });
        await act(async () => {
            getSongElement().dispatchEvent(event);
        });

        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        const [, items] = h.showAppContextMenu.mock.calls[0];
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Reload',
            'Edit',
        ]);
        items[0].onSelect();
        expect(h.lyricManager.openLyricPreviewer.reload).toHaveBeenCalled();
        items[1].onSelect();
        expect(h.openEditor).toHaveBeenCalledWith(h.lyricManager.lyric);
    });

    test('the sticky dots open the same menu', async () => {
        await renderBody();
        await act(async () => {
            container.querySelector<HTMLButtonElement>('#dots')!.click();
        });
        const [, items] = h.showAppContextMenu.mock.calls[0];
        expect(items).toHaveLength(2);
    });

    test('the menu acts on the song the context holds now', async () => {
        await renderBody();
        const nextManager = genLyricManager();
        h.lyricManager = nextManager;
        await renderBody();
        await act(async () => {
            container.querySelector<HTMLButtonElement>('#dots')!.click();
        });
        const [, items] = h.showAppContextMenu.mock.calls[0];
        items[1].onSelect();
        expect(h.openEditor).toHaveBeenCalledWith(nextManager.lyric);
    });
});
