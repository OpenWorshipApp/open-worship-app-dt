// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Same shape as `VaryAppDocumentFileComp.test.tsx`: the row is a
// `FileItemHandlerComp`, so that is stubbed to record the props the lyric row
// hands it, and every one of those props is then exercised.
const h = vi.hoisted(() => ({
    props: null as any,
    selectedPath: null as string | null,
    canSave: false,
    isShowingPreviewer: false,
    isLyricMissing: false,
    fileUpdate: null as null | (() => void),
    fileUpdateFilePath: null as string | null,
    lyrics: new Map<string, any>(),
    lyricAppDocuments: new Map<string, any>(),
    setSelected: vi.fn(),
    showVaryAppDocument: vi.fn(),
    checkIsOnScreen: vi.fn(),
    openEditor: vi.fn(),
    exportAppDocument: vi.fn(),
    dragStart: vi.fn(),
    handleError: vi.fn(),
    openLongText: vi.fn(),
    openFloating: vi.fn(),
    closeFloating: vi.fn(),
    genFloatingMenu: vi.fn(),
    getFileSource: vi.fn(),
}));

function genLyric(filePath: string) {
    return {
        filePath,
        fileSource: { fireUpdateEvent: vi.fn() },
    };
}

vi.mock('./Lyric', () => ({
    default: {
        getInstance: (filePath: string) => {
            if (h.isLyricMissing) {
                return null;
            }
            if (!h.lyrics.has(filePath)) {
                h.lyrics.set(filePath, genLyric(filePath));
            }
            return h.lyrics.get(filePath);
        },
    },
}));
vi.mock('./LyricAppDocument', () => ({
    default: {
        getInstance: (filePath: string) => {
            if (!h.lyricAppDocuments.has(filePath)) {
                h.lyricAppDocuments.set(filePath, { kind: 'lyric', filePath });
            }
            return h.lyricAppDocuments.get(filePath);
        },
    },
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    default: (props: any) => {
        h.props = props;
        return createElement(
            'div',
            { 'data-selected': String(props.isSelected) },
            props.fileData ? props.renderChild(props.fileData) : 'Loading',
        );
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getFileSource },
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: { showVaryAppDocument: h.showVaryAppDocument },
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
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        _events: unknown,
        callback: () => void,
        _deps: unknown,
        filePath: string,
    ) => {
        h.fileUpdate = callback;
        h.fileUpdateFilePath = filePath;
    },
}));
vi.mock('../editing-manager/editingHelpers', () => ({
    useEditingHistoryStatus: () => ({ canSave: h.canSave }),
}));
vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        SelectedVaryAppDocumentContext: createContext(null),
        useSelectedAppDocumentSetterContext: () => h.setSelected,
        checkIsVaryAppDocumentFilePathOnScreen: h.checkIsOnScreen,
    };
});
vi.mock('./lyricEditorHelpers', () => ({
    openPopupLyricEditorWindow: h.openEditor,
}));
vi.mock('../app-document-presenter/presenterRendererHelpers', () => ({
    getIsShowingVaryAppDocumentPreviewer: () => h.isShowingPreviewer,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleAppDocumentDragStart: h.dragStart,
}));
vi.mock('../app-document-list/appDocumentArchiveHelpers', () => ({
    exportAppDocument: h.exportAppDocument,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../app-document-list/appDocumentPreviewFloatingHelpers', () => ({
    checkHandleOpenSlidesPreviewClicking: h.openFloating,
    closeAppDocumentPreviewFloating: h.closeFloating,
    genOpenSlidesPreviewContextMenu: h.genFloatingMenu,
}));
vi.mock('../presenter-foreground/foregroundLongTextOpenHelpers', () => ({
    openLyricInLongTextShow: h.openLongText,
}));

import LyricFileComp from './LyricFileComp';
import { SelectedVaryAppDocumentContext } from '../app-document-list/appDocumentHelpers';

const FILE_PATH = 'C:/songs/amazing-grace.owl';

let container: HTMLDivElement;
let root: Root;

type MenuItemType = { menuElement: any; onSelect: () => unknown };

async function renderRow() {
    await act(async () => {
        root.render(
            createElement(
                SelectedVaryAppDocumentContext,
                {
                    value: {
                        selectedVaryAppDocument:
                            h.selectedPath === null
                                ? null
                                : { filePath: h.selectedPath },
                    } as any,
                },
                createElement(LyricFileComp, {
                    index: 2,
                    filePath: FILE_PATH,
                }),
            ),
        );
    });
}

function getMenuItem(label: string): MenuItemType {
    const item = h.props.contextMenuItems.find((menuItem: MenuItemType) => {
        const { menuElement } = menuItem;
        return (
            menuElement === label || menuElement?.props?.children?.[0] === label
        );
    });
    expect(item, `no menu item "${label}"`).toBeDefined();
    return item;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.props = null;
    h.selectedPath = null;
    h.canSave = false;
    h.isShowingPreviewer = false;
    h.isLyricMissing = false;
    h.fileUpdate = null;
    h.lyrics.clear();
    h.lyricAppDocuments.clear();
    h.setSelected.mockResolvedValue(true);
    h.openFloating.mockReturnValue(false);
    h.genFloatingMenu.mockReturnValue({ menuElement: 'Open slide preview' });
    h.getFileSource.mockImplementation((filePath: string) => ({
        name: filePath.split('/').at(-1),
    }));
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

describe('the row', () => {
    test('loads its lyric and shows its name, marked as a lyric', async () => {
        await renderRow();
        expect(h.props.fileData).toBe(h.lyrics.get(FILE_PATH));
        expect(h.props.index).toBe(2);
        expect(h.props.filePath).toBe(FILE_PATH);
        expect(container.textContent).toBe('amazing-grace.owl');
        expect(
            container.querySelector('.bi-music-note')!.getAttribute('title'),
        ).toBe('Lyric');
        expect(h.fileUpdateFilePath).toBe(FILE_PATH);
    });

    test('an unsaved lyric carries the red star', async () => {
        h.canSave = true;
        await renderRow();
        expect(container.textContent).toBe('amazing-grace.owl*');
    });

    test('is selected exactly when the selected document is this file', async () => {
        await renderRow();
        expect(h.props.isSelected).toBe(false);
        h.selectedPath = FILE_PATH;
        await renderRow();
        expect(h.props.isSelected).toBe(true);
        expect(h.genFloatingMenu).toHaveBeenLastCalledWith(FILE_PATH, true);
    });

    test('a file update reads the lyric again', async () => {
        await renderRow();
        const replacement = genLyric(FILE_PATH);
        h.lyrics.set(FILE_PATH, replacement);
        await act(async () => {
            h.fileUpdate!();
        });
        expect(h.props.fileData).toBe(replacement);
    });

    test('reload fires the lyric file update', async () => {
        await renderRow();
        h.props.reload();
        expect(
            h.lyrics.get(FILE_PATH).fileSource.fireUpdateEvent,
        ).toHaveBeenCalledTimes(1);
    });

    test('asks whether its document is on a screen', async () => {
        h.checkIsOnScreen.mockResolvedValue(true);
        await renderRow();
        await expect(h.props.checkIsOnScreen(FILE_PATH)).resolves.toBe(true);
        expect(h.checkIsOnScreen).toHaveBeenCalledWith(FILE_PATH);
    });

    test('drags as a plain document reference', async () => {
        await renderRow();
        const event = { type: 'dragstart' };
        h.props.onDragStart(event);
        expect(h.dragStart).toHaveBeenCalledWith(event, FILE_PATH);
    });
});

describe('clicking', () => {
    test('selects the song as a document and shows the previewer', async () => {
        await renderRow();
        const event = { type: 'click' };
        await act(async () => {
            await h.props.onClick(event);
        });
        expect(h.openFloating).toHaveBeenCalledWith(event, FILE_PATH, false);
        expect(h.setSelected).toHaveBeenCalledWith(
            h.lyricAppDocuments.get(FILE_PATH),
        );
        expect(h.showVaryAppDocument).toHaveBeenCalledWith(
            h.lyricAppDocuments.get(FILE_PATH),
        );
    });

    test('a refused selection does not force the previewer open', async () => {
        h.setSelected.mockResolvedValue(false);
        await renderRow();
        await act(async () => {
            await h.props.onClick({});
        });
        expect(h.showVaryAppDocument).not.toHaveBeenCalled();
    });

    test('a previewer already showing is left as it is', async () => {
        h.isShowingPreviewer = true;
        await renderRow();
        await act(async () => {
            await h.props.onClick({});
        });
        expect(h.setSelected).toHaveBeenCalledTimes(1);
        expect(h.showVaryAppDocument).not.toHaveBeenCalled();
    });

    test('a row whose lyric could not be read selects nothing', async () => {
        h.isLyricMissing = true;
        await renderRow();
        expect(h.props.fileData).toBeNull();
        expect(h.props.contextMenuItems).toEqual([]);
        await act(async () => {
            await h.props.onClick({});
        });
        expect(h.setSelected).not.toHaveBeenCalled();
    });

    test('the slides-preview shortcut takes the click over', async () => {
        h.openFloating.mockReturnValue(true);
        await renderRow();
        await act(async () => {
            await h.props.onClick({ altKey: true });
        });
        expect(h.setSelected).not.toHaveBeenCalled();
    });
});

describe('context menu', () => {
    test('leads with the slides preview, then the song actions', async () => {
        await renderRow();
        expect(
            h.props.contextMenuItems.map((item: MenuItemType) => {
                return typeof item.menuElement === 'string'
                    ? item.menuElement
                    : item.menuElement.props.children[0];
            }),
        ).toEqual(['Open slide preview', 'Long Text Show', 'Edit', 'Export']);
    });

    test('Edit opens the lyric editor and Export exports the file', async () => {
        await renderRow();
        getMenuItem('Edit').onSelect();
        expect(h.openEditor).toHaveBeenCalledWith(h.lyrics.get(FILE_PATH));
        getMenuItem('Export').onSelect();
        expect(h.exportAppDocument).toHaveBeenCalledWith(FILE_PATH);
    });

    test('Long Text Show opens the song there, fetched on demand', async () => {
        await renderRow();
        await getMenuItem('Long Text Show').onSelect();
        expect(h.openLongText).toHaveBeenCalledWith(FILE_PATH);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a Long Text Show that fails is handled, not thrown', async () => {
        const error = new Error('no panel');
        h.openLongText.mockImplementation(() => {
            throw error;
        });
        await renderRow();
        await getMenuItem('Long Text Show').onSelect();
        expect(h.handleError).toHaveBeenCalledWith(error);
    });
});

describe('renaming', () => {
    test('closes the old preview and moves a selection to the new file', async () => {
        h.selectedPath = FILE_PATH;
        await renderRow();
        await h.props.renamedCallback({ filePath: 'C:/songs/renamed.owl' });
        expect(h.closeFloating).toHaveBeenCalledWith(FILE_PATH);
        expect(h.setSelected).toHaveBeenCalledWith(
            h.lyricAppDocuments.get('C:/songs/renamed.owl'),
            { isForce: true },
        );
    });

    test('a row that is not selected leaves the selection alone', async () => {
        await renderRow();
        await h.props.renamedCallback({ filePath: 'C:/songs/renamed.owl' });
        expect(h.closeFloating).toHaveBeenCalledWith(FILE_PATH);
        expect(h.setSelected).not.toHaveBeenCalled();
    });
});
