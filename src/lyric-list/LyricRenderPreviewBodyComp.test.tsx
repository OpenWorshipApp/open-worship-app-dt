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
    isPagePresenter: true,
    // Each render's props, so a test can tell what the row drives.
    editingMenuProps: [] as any[],
    // What the real menu renders while the song has no history: nothing.
    isEditingMenuEmpty: false,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return h.isPagePresenter;
        },
    },
}));
vi.mock('../editing-manager/editingHelpers', () => ({
    FileEditingMenuComp: (props: any) => {
        h.editingMenuProps.push(props);
        return h.isEditingMenuEmpty
            ? null
            : createElement('div', { className: 'editing-menu' });
    },
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
    h.isPagePresenter = true;
    h.editingMenuProps = [];
    h.isEditingMenuEmpty = false;
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

    test('a re-render leaves the mounted song alone', async () => {
        await renderBody();
        await renderBody();
        await renderBody();
        const openLyric = h.lyricManager.openLyricPreviewer;
        expect(openLyric.container).toBe(getSongElement());
        expect(openLyric.mount).toHaveBeenCalledTimes(1);
    });

    test('never starts a mount while another is still running', async () => {
        // The real `mount()` appends the song's root at once and only counts
        // as mounted later; two of them overlapping left a root behind, and
        // the song was drawn twice from then on.
        const openLyric = h.lyricManager.openLyricPreviewer;
        let runningCount = 0;
        let maxRunningCount = 0;
        const finishList: (() => void)[] = [];
        openLyric.mount.mockImplementation(async () => {
            runningCount++;
            maxRunningCount = Math.max(maxRunningCount, runningCount);
            await new Promise<void>((resolve) => {
                finishList.push(resolve);
            });
            runningCount--;
        });
        // Closed and opened again before the first mount has finished.
        await renderBody();
        act(() => {
            root.unmount();
        });
        root = createRoot(container);
        await renderBody();
        while (finishList.length > 0) {
            await act(async () => {
                finishList.shift()!();
            });
        }
        expect(openLyric.mount).toHaveBeenCalledTimes(2);
        expect(maxRunningCount).toBe(1);
        expect(openLyric.container).toBe(getSongElement());
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

    describe('history row (Undo / Redo / Discard changed / Save)', () => {
        function getRow() {
            return container.querySelector(
                '.app-lyric-render-preview-editing-menu',
            );
        }

        test('on the Presenter it sits above the scrolled words, driving the song', async () => {
            await renderBody();
            const row = getRow()!;
            expect(row.querySelector('.editing-menu')).not.toBeNull();
            // Outside the scroll area, so scrolling the song never takes it
            // away; the words and the sticky dots are in the next sibling.
            const scrollArea = row.nextElementSibling!;
            expect(scrollArea.contains(getSongElement())).toBe(true);
            expect(scrollArea.querySelector('#dots')).not.toBeNull();
            expect(row.contains(getSongElement())).toBe(false);
            const props = h.editingMenuProps.at(-1);
            expect(props.editableDocument).toBe(h.lyricManager.lyric);
            // The Stage Previewer owns the song's global Ctrl+S: a second
            // registration would save twice.
            expect(props.isSaveShortcutGlobal).toBeFalsy();
        });

        test('the row drives the song the context holds now', async () => {
            await renderBody();
            const nextManager = genLyricManager();
            h.lyricManager = nextManager;
            await renderBody();
            expect(h.editingMenuProps.at(-1).editableDocument).toBe(
                nextManager.lyric,
            );
        });

        test('with no history the row is left empty, for CSS to hide', async () => {
            h.isEditingMenuEmpty = true;
            await renderBody();
            expect(getRow()!.childElementCount).toBe(0);
        });

        test('off the Presenter there is no row', async () => {
            h.isPagePresenter = false;
            await renderBody();
            expect(getRow()).toBeNull();
            expect(h.editingMenuProps).toEqual([]);
            // The song is still mounted and its menu still there.
            expect(h.lyricManager.openLyricPreviewer.container).toBe(
                getSongElement(),
            );
            expect(container.querySelector('#dots')).not.toBeNull();
        });

        test('a right-click on the row is not the song menu', async () => {
            await renderBody();
            await act(async () => {
                getRow()!.dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                );
            });
            expect(h.showAppContextMenu).not.toHaveBeenCalled();
        });
    });
});
