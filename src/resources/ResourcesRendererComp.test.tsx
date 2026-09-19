// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkDirExistMock,
    getFolderListMock,
    scanResourceFilesMock,
    setFolderListMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    checkDirExistMock: vi.fn(),
    getFolderListMock: vi.fn(),
    scanResourceFilesMock: vi.fn(),
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
        setResourcesFolderList: setFolderListMock,
    };
});

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../server/fileHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../server/fileHelpers')>();
    return { ...original, fsCheckDirExist: checkDirExistMock };
});

// The folder boxes walk the disk on mount; this panel's own behaviour is what
// is under test, so the walk is stubbed out from under them.
vi.mock('./resourcesScanHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('./resourcesScanHelpers')>();
    return {
        ...original,
        scanResourceFiles: scanResourceFilesMock,
        invalidateResourcesScanCache: vi.fn(),
    };
});

// `tran` reads the locale out of the settings store, which otherwise walks all
// the way down to IPC. With nothing stored it short-circuits to English, which
// is what the assertions below read.
vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
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

describe('ResourcesRendererComp Others', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        getFolderListMock.mockReturnValue(['/a/songs']);
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
