// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkDirExistMock,
    contextMenuMock,
    copyFolderMock,
    copyRefusalKeyMock,
    getFolderListMock,
    getResourcesDataDirPathMock,
    handleErrorMock,
    hideProgressBarMock,
    invalidateScanCacheMock,
    listDirentsMock,
    promptAddFoldersMock,
    removeFolderSettingsMock,
    scanResourceFilesMock,
    showAppConfirmMock,
    showProgressBarMock,
    setFolderListMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    checkDirExistMock: vi.fn(),
    contextMenuMock: vi.fn(),
    copyFolderMock: vi.fn(),
    copyRefusalKeyMock: vi.fn(),
    getFolderListMock: vi.fn(),
    getResourcesDataDirPathMock: vi.fn(),
    handleErrorMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    invalidateScanCacheMock: vi.fn(),
    listDirentsMock: vi.fn(),
    promptAddFoldersMock: vi.fn(),
    removeFolderSettingsMock: vi.fn(),
    scanResourceFilesMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    setFolderListMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../helper/appHooks', async (importOriginal) => {
    // Partial: `useAppCurrentRef` must survive -- every handler in the panel
    // leans on it, and stubbing the whole module would strip it.
    const original =
        await importOriginal<typeof import('../helper/appHooks')>();
    return { ...original, useAppEffect: useEffect };
});

vi.mock('./resourcesFolderHelpers', async (importOriginal) => {
    // Partial: the merge rules under test stay as shipped -- only the two
    // ends that reach the settings store are stubbed.
    const original =
        await importOriginal<typeof import('./resourcesFolderHelpers')>();
    return {
        ...original,
        getResourcesFolderList: getFolderListMock,
        promptAddResourcesFolders: promptAddFoldersMock,
        removeResourcesFolderSettings: removeFolderSettingsMock,
        setResourcesFolderList: setFolderListMock,
    };
});

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../context-menu/appContextMenuHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../context-menu/appContextMenuHelpers')
        >();
    return { ...original, showAppContextMenu: contextMenuMock };
});

vi.mock('../popup-widget/popupWidgetHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../popup-widget/popupWidgetHelpers')
        >();
    return { ...original, showAppConfirm: showAppConfirmMock };
});

vi.mock('../progress-bar/progressBarHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../progress-bar/progressBarHelpers')
        >();
    return {
        ...original,
        hideProgressBar: hideProgressBarMock,
        showProgressBar: showProgressBarMock,
    };
});

vi.mock('../helper/errorHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../helper/errorHelpers')>();
    return { ...original, handleError: handleErrorMock };
});

vi.mock('../server/fileHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../server/fileHelpers')>();
    return {
        ...original,
        fsCheckDirExist: checkDirExistMock,
        // Only ever `<data dir>/resources` here: the folder boxes' own walk is
        // stubbed below, so this is the panel's one read of the data folder.
        fsListDirents: listDirentsMock,
    };
});

// The folder boxes walk the disk on mount; this panel's own behaviour is what
// is under test, so the walk is stubbed out from under them.
vi.mock('./resourcesScanHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./resourcesScanHelpers')>();
    return {
        ...original,
        scanResourceFiles: scanResourceFilesMock,
        invalidateResourcesScanCache: invalidateScanCacheMock,
    };
});

vi.mock('./resourcesCopyHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./resourcesCopyHelpers')>();
    return {
        ...original,
        copyResourcesFolderToDataDir: copyFolderMock,
        getResourcesDataDirPath: getResourcesDataDirPathMock,
        getResourcesFolderCopyRefusalKey: copyRefusalKeyMock,
    };
});

// `tran` reads the locale out of the settings store, which otherwise walks all
// the way down to IPC. With nothing stored it short-circuits to English, which
// is what the assertions below read.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorageDirPath: '/data',
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false, isMac: true, isLinux: false },
        messageUtils: { sendDataSync: () => null, listenForData: () => {} },
        pathUtils: {
            sep: '/',
            basename: (filePath: string) =>
                filePath.slice(filePath.lastIndexOf('/') + 1),
            dirname: (filePath: string) =>
                filePath.slice(0, filePath.lastIndexOf('/')) || '/',
            resolve: (...paths: string[]) => {
                const joined = paths.join('/');
                return joined.endsWith('/') ? joined.slice(0, -1) : joined;
            },
            join: (...paths: string[]) => paths.join('/'),
        },
    },
}));

import ResourcesRendererComp from './ResourcesRendererComp';

const PSA_1 = [{ bookKey: 'PSA', chapter: 1 }];

/**
 * A drop event shaped the way a real one arrives.
 *
 * `dataTransfer` is fabricated rather than constructed: jsdom's own
 * `DataTransfer` cannot be filled with files, and the paths come from
 * `appFilePath`, which the electron preload stamps onto every dropped `File`.
 */
function genDragEvent(
    type: string,
    {
        paths = [],
        kind = 'file',
        relatedTarget = null,
    }: { paths?: string[]; kind?: string; relatedTarget?: Node | null } = {},
) {
    const event: any = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = {
        items: paths.map(() => {
            return { kind };
        }),
        files: paths.map((filePath) => {
            return { appFilePath: filePath };
        }),
        dropEffect: 'none',
    };
    if (relatedTarget !== null) {
        Object.defineProperty(event, 'relatedTarget', {
            value: relatedTarget,
        });
    }
    return event;
}

describe('ResourcesRendererComp folder dropping', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getFolderListMock.mockReturnValue([]);
        setFolderListMock.mockReset();
        showSimpleToastMock.mockReset();
        checkDirExistMock.mockReset();
        checkDirExistMock.mockResolvedValue(true);
        listDirentsMock.mockReset();
        listDirentsMock.mockResolvedValue([]);
        scanResourceFilesMock.mockResolvedValue({
            filePaths: [],
            searchedFilePaths: [],
            isTruncated: false,
            isSearchTruncated: false,
            otherFilePaths: [],
            isOthersTruncated: false,
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

    async function renderPanel() {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<ResourcesRendererComp targets={PSA_1} />);
        });
    }

    function getPanel() {
        const panel = container?.querySelector('.app-resources');
        if (!panel) {
            throw new Error('Missing panel');
        }
        return panel as HTMLElement;
    }

    async function dispatch(event: Event, target: Element = getPanel()) {
        await act(async () => {
            target.dispatchEvent(event);
        });
        // The drop plan settles a `stat` later; let its `setState` land.
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    test('an empty panel says dropping is a way in, beside the button', async () => {
        await renderPanel();
        // The one screen a user with no folders reaches: a way in nobody can
        // see is a way in nobody has.
        const text = getPanel().textContent ?? '';
        expect(text).toContain('Add Folder');
        expect(text).toContain('Drop folders here');
    });

    test('a dropped folder is added to the list and saved', async () => {
        await renderPanel();
        await dispatch(genDragEvent('drop', { paths: ['/a/songs'] }));

        expect(setFolderListMock).toHaveBeenCalledWith(['/a/songs']);
        // Drawn, not only stored: the folder appearing IS the feedback, which
        // is why the handler raises no toast on success.
        expect(getPanel().textContent).toContain('songs');
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('a file drop says what to drop instead, and shelves nothing', async () => {
        checkDirExistMock.mockResolvedValue(false);
        await renderPanel();
        await dispatch(genDragEvent('drop', { paths: ['/a/songs/one.pdf'] }));

        expect(setFolderListMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Add Folder',
            'Drop a folder, not a file',
        );
    });

    test('a folder already listed says so rather than changing nothing', async () => {
        getFolderListMock.mockReturnValue(['/a/songs']);
        await renderPanel();
        await dispatch(genDragEvent('drop', { paths: ['/a/songs'] }));

        expect(setFolderListMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Add Folder',
            'Folder is already added',
        );
    });

    test('dragging files over the panel claims the drop and lights it up', async () => {
        await renderPanel();
        const event = genDragEvent('dragover', { paths: ['/a/songs'] });
        await dispatch(event);

        // Without `preventDefault` the browser never fires `drop` at all --
        // the whole feature dies silently, with nothing else to notice it.
        expect(event.defaultPrevented).toBe(true);
        expect((event as any).dataTransfer.dropEffect).toBe('copy');
        expect(getPanel().className).toContain('is-dropping');
        expect(getPanel().textContent).toContain('Drop folders here');
    });

    test("the app's own drags are left alone", async () => {
        await renderPanel();
        const event = genDragEvent('dragover', {
            paths: ['/a/songs'],
            kind: 'string',
        });
        await dispatch(event);

        // A verse or a slide being dragged past must not have its drop stolen
        // by this panel.
        expect(event.defaultPrevented).toBe(false);
        expect(getPanel().className).not.toContain('is-dropping');
    });

    test('an empty drop is accepted and makes no folder or toast', async () => {
        await renderPanel();
        const event = genDragEvent('drop');
        await dispatch(event);

        expect(event.defaultPrevented).toBe(true);
        expect(setFolderListMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('crossing onto a child is not leaving the panel', async () => {
        getFolderListMock.mockReturnValue(['/a/songs']);
        await renderPanel();
        await dispatch(genDragEvent('dragover', { paths: ['/b/notes'] }));
        const child = getPanel().querySelector('.app-resources-group-header');
        if (!child) {
            throw new Error('Missing folder header to cross onto');
        }

        await dispatch(
            genDragEvent('dragleave', { relatedTarget: child }),
            child,
        );
        expect(getPanel().className).toContain('is-dropping');

        // Leaving the window entirely arrives with no related target at all.
        await dispatch(genDragEvent('dragleave'));
        expect(getPanel().className).not.toContain('is-dropping');
    });
});

describe('ResourcesRendererComp folder actions', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getFolderListMock.mockReset().mockReturnValue([]);
        setFolderListMock.mockReset();
        promptAddFoldersMock.mockReset().mockResolvedValue(null);
        removeFolderSettingsMock.mockReset().mockResolvedValue(undefined);
        copyFolderMock.mockReset();
        copyRefusalKeyMock.mockReset().mockReturnValue(null);
        getResourcesDataDirPathMock
            .mockReset()
            .mockReturnValue('/data/resources');
        contextMenuMock.mockReset().mockImplementation((event: Event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        showAppConfirmMock.mockReset().mockResolvedValue(true);
        showProgressBarMock.mockReset();
        hideProgressBarMock.mockReset();
        handleErrorMock.mockReset();
        invalidateScanCacheMock.mockReset();
        showSimpleToastMock.mockReset();
        checkDirExistMock.mockReset().mockResolvedValue(true);
        listDirentsMock.mockReset().mockResolvedValue([]);
        scanResourceFilesMock.mockReset().mockResolvedValue({
            filePaths: [],
            searchedFilePaths: [],
            isTruncated: false,
            isSearchTruncated: false,
            otherFilePaths: [],
            isOthersTruncated: false,
        });
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        vi.useRealTimers();
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    async function renderPanel() {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<ResourcesRendererComp targets={PSA_1} />);
        });
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    function getPanel() {
        const panel = container?.querySelector('.app-resources');
        if (!panel) {
            throw new Error('Missing panel');
        }
        return panel as HTMLElement;
    }

    function openMenu(target: Element) {
        contextMenuMock.mockClear();
        act(() => {
            target.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const call = contextMenuMock.mock.calls.at(-1);
        if (!call) {
            throw new Error('Context menu was not opened');
        }
        return call[1] as Array<{
            menuElement: string;
            onSelect: () => unknown;
        }>;
    }

    async function selectMenuItem(
        items: Array<{ menuElement: string; onSelect: () => unknown }>,
        label: string,
    ) {
        const item = items.find((candidate) => candidate.menuElement === label);
        if (!item) {
            throw new Error(
                `Missing menu item: ${label}; got ${items.map((candidate) => String(candidate.menuElement)).join(', ')}`,
            );
        }
        await act(async () => {
            item.onSelect();
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    test('the visible Add Folder button saves the picker result', async () => {
        promptAddFoldersMock.mockResolvedValue(['/a/songs']);
        await renderPanel();
        const addButton =
            container?.querySelector<HTMLButtonElement>('.btn-outline-info');
        if (!addButton) {
            throw new Error('Missing Add Folder button');
        }

        await act(async () => {
            addButton.click();
            await Promise.resolve();
        });

        expect(promptAddFoldersMock).toHaveBeenCalledWith([]);
        expect(setFolderListMock).toHaveBeenCalledWith(['/a/songs']);
        expect(
            getPanel().querySelector('.app-resources-group-header'),
        ).not.toBeNull();
    });

    test('cancelling Add Folder leaves the saved and drawn list alone', async () => {
        promptAddFoldersMock.mockResolvedValue(null);
        await renderPanel();
        container
            ?.querySelector<HTMLButtonElement>('.btn-outline-info')
            ?.click();
        await act(async () => {
            await Promise.resolve();
        });

        expect(setFolderListMock).not.toHaveBeenCalled();
        expect(
            getPanel().querySelector('.app-resources-group-header'),
        ).toBeNull();
    });

    test('the folder menu removes only after confirmation and clears its scan state', async () => {
        getFolderListMock.mockReturnValue(['/a/<songs>']);
        await renderPanel();
        const header = getPanel().querySelector('.app-resources-group-header');
        if (!header) {
            throw new Error('Missing folder header');
        }

        const items = openMenu(header);
        await selectMenuItem(items, 'Remove Folder');

        expect(showAppConfirmMock).toHaveBeenCalledWith(
            'Remove Folder',
            'Remove "/a/&lt;songs&gt;"?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(setFolderListMock).toHaveBeenCalledWith([]);
        expect(invalidateScanCacheMock).toHaveBeenCalledWith('/a/<songs>');
        expect(removeFolderSettingsMock).toHaveBeenCalledWith('/a/<songs>');
        expect(
            getPanel().querySelector('.app-resources-group-header'),
        ).toBeNull();
    });

    test('declining Remove Folder preserves the shelf', async () => {
        getFolderListMock.mockReturnValue(['/a/songs']);
        showAppConfirmMock.mockResolvedValue(false);
        await renderPanel();
        const header = getPanel().querySelector('.app-resources-group-header');
        if (!header) {
            throw new Error('Missing folder header');
        }

        await selectMenuItem(openMenu(header), 'Remove Folder');

        expect(setFolderListMock).not.toHaveBeenCalled();
        expect(invalidateScanCacheMock).not.toHaveBeenCalled();
        expect(removeFolderSettingsMock).not.toHaveBeenCalled();
        expect(
            getPanel().querySelector('.app-resources-group-header'),
        ).not.toBeNull();
    });

    test('copying a folder confirms, swaps it in place, then clears the old cache', async () => {
        getFolderListMock.mockReturnValue(['/a/first', '/a/songs', '/a/last']);
        copyFolderMock.mockResolvedValue({
            destinationDirPath: '/data/resources/songs',
        });
        await renderPanel();
        const header = Array.from(
            getPanel().querySelectorAll('.app-resources-group-header'),
        ).find((element) => element.getAttribute('title') === '/a/songs');
        if (!header) {
            throw new Error('Missing songs folder header');
        }

        await selectMenuItem(openMenu(header), 'Copy to Data Directory');

        expect(showAppConfirmMock).toHaveBeenCalledWith(
            'Copy to Data Directory',
            expect.stringContaining('/a/songs'),
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(copyFolderMock).toHaveBeenCalledWith('/a/songs');
        expect(setFolderListMock).toHaveBeenCalledWith([
            '/a/first',
            '/data/resources/songs',
            '/a/last',
        ]);
        expect(invalidateScanCacheMock).toHaveBeenCalledWith('/a/songs');
        expect(removeFolderSettingsMock).toHaveBeenCalledWith('/a/songs');
        expect(showProgressBarMock).toHaveBeenCalledWith(
            'Copy to Data Directory: /a/songs',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith(
            'Copy to Data Directory: /a/songs',
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copy to Data Directory',
            '/data/resources/songs',
        );
    });

    test('a copy refused by its path is explained before asking for confirmation', async () => {
        getFolderListMock.mockReturnValue(['/a/songs']);
        copyRefusalKeyMock.mockReturnValue(
            'Folder is already in the data directory',
        );
        await renderPanel();
        const header = getPanel().querySelector('.app-resources-group-header');
        if (!header) {
            throw new Error('Missing folder header');
        }

        await selectMenuItem(openMenu(header), 'Copy to Data Directory');

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copy to Data Directory',
            'Folder is already in the data directory',
        );
        expect(showAppConfirmMock).not.toHaveBeenCalled();
        expect(copyFolderMock).not.toHaveBeenCalled();
    });

    test('copy refusal errors are shown and progress is always hidden', async () => {
        const { ResourcesCopyError } = await import('./resourcesCopyHelpers');
        getFolderListMock.mockReturnValue(['/a/songs']);
        copyFolderMock.mockRejectedValue(
            new ResourcesCopyError('Folder not found'),
        );
        await renderPanel();
        const header = getPanel().querySelector('.app-resources-group-header');
        if (!header) {
            throw new Error('Missing folder header');
        }

        await selectMenuItem(openMenu(header), 'Copy to Data Directory');

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copy to Data Directory',
            'Folder not found',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith(
            'Copy to Data Directory: /a/songs',
        );
    });

    test('unexpected copy errors are logged and shown to the user', async () => {
        getFolderListMock.mockReturnValue(['/a/songs']);
        copyFolderMock.mockRejectedValue(new Error('disk failed'));
        await renderPanel();
        const header = getPanel().querySelector('.app-resources-group-header');
        if (!header) {
            throw new Error('Missing folder header');
        }

        await selectMenuItem(openMenu(header), 'Copy to Data Directory');

        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copy to Data Directory',
            'Cannot copy folder: disk failed',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith(
            'Copy to Data Directory: /a/songs',
        );
    });

    test('Reload refreshes the folder list and invalidates every scan', async () => {
        getFolderListMock
            .mockReturnValueOnce([])
            .mockReturnValueOnce(['/another/library']);
        await renderPanel();
        const moreButton = getPanel().querySelector<HTMLButtonElement>(
            'button[aria-label="More Options"]',
        );
        if (!moreButton) {
            throw new Error('Missing More Options button');
        }
        act(() => {
            moreButton.click();
        });
        const items = contextMenuMock.mock.calls.at(-1)?.[1] as Array<{
            menuElement: string;
            onSelect: () => unknown;
        }>;
        await selectMenuItem(items, 'Reload');

        expect(getFolderListMock).toHaveBeenCalledTimes(2);
        expect(invalidateScanCacheMock).toHaveBeenCalledWith();
        expect(
            getPanel()
                .querySelector('.app-resources-group-header')
                ?.getAttribute('title'),
        ).toBe('/another/library');
    });

    test('search waits for typing to pause, then clearing its toggle removes search hits', async () => {
        getFolderListMock.mockReturnValue(['/a/songs']);
        vi.useFakeTimers();
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<ResourcesRendererComp targets={PSA_1} />);
        });

        const searchButton = getPanel().querySelector<HTMLButtonElement>(
            'button[aria-label="Search file name"]',
        );
        if (!searchButton) {
            throw new Error('Missing search button');
        }
        await act(async () => {
            searchButton.click();
        });
        const searchInput = getPanel().querySelector<HTMLInputElement>(
            '.app-resources-search input',
        );
        if (!searchInput) {
            throw new Error('Missing search input');
        }
        await act(async () => {
            const setValue = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )?.set;
            setValue?.call(searchInput, 'family');
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });

        expect(scanResourceFilesMock).toHaveBeenLastCalledWith(
            '/a/songs',
            PSA_1,
            '',
            false,
            expect.any(Function),
        );
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(scanResourceFilesMock).toHaveBeenLastCalledWith(
            '/a/songs',
            PSA_1,
            'family',
            false,
            expect.any(Function),
        );

        await act(async () => {
            searchButton.click();
        });
        expect(getPanel().querySelector('.app-resources-search')).toBeNull();
        expect(scanResourceFilesMock).toHaveBeenLastCalledWith(
            '/a/songs',
            PSA_1,
            '',
            false,
            expect.any(Function),
        );
    });
});

describe('ResourcesRendererComp Others', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getFolderListMock.mockReturnValue(['/a/songs']);
        listDirentsMock.mockReset();
        listDirentsMock.mockResolvedValue([]);
        scanResourceFilesMock.mockResolvedValue({
            filePaths: [],
            searchedFilePaths: [],
            isTruncated: false,
            isSearchTruncated: false,
            otherFilePaths: ['/a/songs/Jesus-family-line.jpeg'],
            isOthersTruncated: false,
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

    async function settle() {
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    test('ticking Others asks every folder for the other files too', async () => {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<ResourcesRendererComp targets={PSA_1} />);
        });
        await settle();
        // Off by default: the panel is for the chapter being read.
        expect(scanResourceFilesMock).toHaveBeenLastCalledWith(
            '/a/songs',
            PSA_1,
            '',
            false,
            expect.any(Function),
        );
        const checkbox = container?.querySelector<HTMLInputElement>(
            '.app-resources-others input[type="checkbox"]',
        );
        if (!checkbox) {
            throw new Error('Missing Others checkbox');
        }
        // Named by its own word, so a screen reader and a search both find it.
        expect(checkbox.closest('label')?.textContent).toBe('Others');
        expect(checkbox.checked).toBe(false);

        await act(async () => {
            checkbox.click();
        });
        await settle();
        expect(checkbox.checked).toBe(true);
        expect(scanResourceFilesMock).toHaveBeenLastCalledWith(
            '/a/songs',
            PSA_1,
            '',
            true,
            expect.any(Function),
        );
        expect(
            container?.querySelector(
                '[title="/a/songs/Jesus-family-line.jpeg"]',
            ),
        ).not.toBeNull();
    });
});

describe('ResourcesRendererComp data directory folders', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    function genDirent(name: string, isDirectory = true) {
        return { name, isFile: !isDirectory, isDirectory };
    }

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getFolderListMock.mockReturnValue([]);
        setFolderListMock.mockReset();
        showSimpleToastMock.mockReset();
        listDirentsMock.mockReset();
        // Out of order, with the two things that must never be offered: a
        // copy still being written, and a plain file.
        listDirentsMock.mockResolvedValue([
            genDirent('YouTube'),
            genDirent('.copying-1-notes'),
            genDirent('readme.txt', false),
            genDirent('pdf'),
        ]);
        scanResourceFilesMock.mockResolvedValue({
            filePaths: [],
            searchedFilePaths: [],
            isTruncated: false,
            isSearchTruncated: false,
            otherFilePaths: [],
            isOthersTruncated: false,
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

    async function renderPanel() {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<ResourcesRendererComp targets={PSA_1} />);
        });
        // The data folder is read in an effect; let its `setState` land.
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    function getOfferedNames() {
        return Array.from(
            container?.querySelectorAll('.app-resources-suggestion') ?? [],
        ).map((button) => {
            return button.textContent;
        });
    }

    test('an empty panel offers the folders already in the data directory', async () => {
        await renderPanel();

        expect(listDirentsMock).toHaveBeenCalledWith('/data/resources');
        expect(container?.textContent).toContain('In the data directory');
        // Sorted by name, folders only, nothing hidden.
        expect(getOfferedNames()).toEqual(['pdf', 'YouTube']);
        // The way in by hand is still there beside them.
        expect(container?.textContent).toContain('Add Folder');
    });

    test('one press shelves the folder and takes it off the offer', async () => {
        await renderPanel();
        const button = container?.querySelector<HTMLButtonElement>(
            '[title="Add Folder: /data/resources/pdf"]',
        );
        if (!button) {
            throw new Error('Missing pdf suggestion');
        }

        await act(async () => {
            button.click();
        });

        expect(setFolderListMock).toHaveBeenCalledWith(['/data/resources/pdf']);
        // Drawn as a box at once -- no picker, no toast.
        expect(
            container
                ?.querySelector('.app-resources-group-header')
                ?.getAttribute('title'),
        ).toBe('/data/resources/pdf');
        expect(showSimpleToastMock).not.toHaveBeenCalled();
        expect(getOfferedNames()).toEqual(['YouTube']);
    });

    test('a folder already on the list is not offered', async () => {
        getFolderListMock.mockReturnValue(['/data/resources/YouTube']);
        await renderPanel();

        expect(getOfferedNames()).toEqual(['pdf']);
    });

    test('nothing is drawn once the list already covers every folder there', async () => {
        // `resources` itself on the list already scans both of them.
        getFolderListMock.mockReturnValue(['/data/resources']);
        await renderPanel();

        expect(
            container?.querySelector('.app-resources-suggestions'),
        ).toBeNull();
        expect(container?.textContent).not.toContain('In the data directory');
    });

    test('a data directory with no resources folder offers nothing', async () => {
        listDirentsMock.mockRejectedValue(
            Object.assign(new Error('missing'), { code: 'ENOENT' }),
        );
        await renderPanel();

        expect(
            container?.querySelector('.app-resources-suggestions'),
        ).toBeNull();
        expect(container?.textContent).toContain('Add Folder');
    });
});
