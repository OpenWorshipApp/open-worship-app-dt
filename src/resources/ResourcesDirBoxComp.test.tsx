// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    scanResourceFilesMock,
    invalidateMock,
    isShowingState,
    showAppContextMenuMock,
    checkIsInResourcesDataDirMock,
    selectFilesMock,
    copyFilesMock,
    copiedMessageMock,
    setSettingBooleanMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    scanResourceFilesMock: vi.fn(),
    invalidateMock: vi.fn(),
    isShowingState: { value: true },
    showAppContextMenuMock: vi.fn(),
    checkIsInResourcesDataDirMock: vi.fn(),
    selectFilesMock: vi.fn(),
    copyFilesMock: vi.fn(),
    copiedMessageMock: vi.fn(),
    setSettingBooleanMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', async (importOriginal) => {
    const original =
        await importOriginal<
            typeof import('../context-menu/appContextMenuHelpers')
        >();
    return { ...original, showAppContextMenu: showAppContextMenuMock };
});

vi.mock('./resourcesCopyHelpers', () => ({
    checkIsInResourcesDataDir: checkIsInResourcesDataDirMock,
    copyFilesIntoResourcesFolder: copyFilesMock,
    // The wording is proved in that module's own tests; what this file has to
    // prove is WHAT the box hands it -- above all `isNoneListed`, which only
    // the live view can work out.
    toResourcesFilesCopiedMessage: copiedMessageMock,
    ResourcesCopyError: class ResourcesCopyError extends Error {
        readonly messageKey: string;
        constructor(messageKey: string) {
            super(messageKey);
            this.messageKey = messageKey;
        }
    },
}));

vi.mock('../server/fileHelpers', async (importOriginal) => {
    // Partial: the box splits paths with the real helpers; only the dialog is
    // stubbed, since a test must never open one.
    const original =
        await importOriginal<typeof import('../server/fileHelpers')>();
    return { ...original, selectFiles: selectFilesMock };
});

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));

vi.mock('../helper/appHooks', async (importOriginal) => {
    // Partial: `useAppCurrentRef` must survive -- every handler in the
    // component leans on it, and stubbing the whole module would strip it.
    const original =
        await importOriginal<typeof import('../helper/appHooks')>();
    return { ...original, useAppEffect: useEffect };
});

vi.mock('../helper/settingHelpers', async (importOriginal) => {
    const original =
        await importOriginal<typeof import('../helper/settingHelpers')>();
    return {
        ...original,
        useStateSettingBoolean: () => [
            isShowingState.value,
            setSettingBooleanMock,
        ],
    };
});

vi.mock('./resourcesScanHelpers', async (importOriginal) => {
    // Partial: the row below splits a name and tags the book-level ones with
    // the REAL helpers, so those stay as shipped -- only the disk walk and the
    // icon table are stubbed.
    const original =
        await importOriginal<typeof import('./resourcesScanHelpers')>();
    return {
        ...original,
        scanResourceFiles: scanResourceFilesMock,
        invalidateResourcesScanCache: invalidateMock,
        toResourceIcon: () => ['file-earmark-pdf', '#bd0b02'],
    };
});

function genScanResult(overrides: any = {}) {
    return {
        filePaths: [],
        searchedFilePaths: [],
        isTruncated: false,
        isSearchTruncated: false,
        otherFilePaths: [],
        isOthersTruncated: false,
        ...overrides,
    };
}

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
        systemUtils: { isDev: false, isMac: true },
        messageUtils: { sendDataSync: () => null, listenForData: () => {} },
        pathUtils: {
            basename: (filePath: string) =>
                filePath.slice(filePath.lastIndexOf('/') + 1),
            dirname: (filePath: string) =>
                filePath.slice(0, filePath.lastIndexOf('/')) || '/',
        },
    },
}));

import ResourcesDirBoxComp from './ResourcesDirBoxComp';

const PSA_1 = [{ bookKey: 'PSA', chapter: 1 }];

describe('ResourcesDirBoxComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        isShowingState.value = true;
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({ filePaths: ['/a/songs/PSA.1.pdf'] }),
        );
        selectFilesMock.mockReset();
        copyFilesMock.mockReset();
        copiedMessageMock.mockReset();
        copiedMessageMock.mockReturnValue('copied');
        setSettingBooleanMock.mockReset();
        showSimpleToastMock.mockReset();
        invalidateMock.mockClear();
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

    async function renderBox(
        searchText = '',
        isOthersShowing = false,
        onCopyFolderToDataDir = vi.fn(),
    ) {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <ResourcesDirBoxComp
                    dirPath="/a/songs"
                    targets={PSA_1}
                    searchText={searchText}
                    isOthersShowing={isOthersShowing}
                    onAddFolder={vi.fn()}
                    onCopyFolderToDataDir={onCopyFolderToDataDir}
                    onRemoveFolder={vi.fn()}
                />,
            );
        });
        // The scan settles a microtask later; let its `setState` land.
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
    }

    test('a collapsed folder never touches the disk', async () => {
        isShowingState.value = false;
        await renderBox();
        // The whole reason "scan only when expanded" is free: the body is not
        // rendered at all, so its effect never mounts.
        expect(scanResourceFilesMock).not.toHaveBeenCalled();
        expect(
            container?.querySelector('[title="/a/songs/PSA.1.pdf"]'),
        ).toBeNull();
    });

    test('an expanded folder scans once and lists what it found', async () => {
        await renderBox();
        expect(scanResourceFilesMock).toHaveBeenCalledTimes(1);
        expect(scanResourceFilesMock).toHaveBeenCalledWith(
            '/a/songs',
            PSA_1,
            '',
            false,
            expect.any(Function),
        );
        // The full path, so two matches in two subfolders can be told apart.
        expect(
            container?.querySelector('[title="/a/songs/PSA.1.pdf"]'),
        ).not.toBeNull();
        // Filed under the pattern it answered to.
        expect(container?.textContent).toContain('PSA.1.*');
    });

    test('files each match under its own chapter, book-level ones once', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({
                filePaths: [
                    '/a/songs/PSA.0.pdf',
                    '/a/songs/PSA.1.pdf',
                    '/a/songs/PSA.2.pdf',
                ],
            }),
        );
        const targets = [
            { bookKey: 'PSA', chapter: 1 },
            { bookKey: 'PSA', chapter: 2 },
        ];
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <ResourcesDirBoxComp
                    dirPath="/a/songs"
                    targets={targets}
                    searchText=""
                    isOthersShowing={false}
                    onAddFolder={vi.fn()}
                    onCopyFolderToDataDir={vi.fn()}
                    onRemoveFolder={vi.fn()}
                />,
            );
        });
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
        const text = container?.textContent ?? '';
        // Pane order, then the book-level run after every chapter.
        expect(text.indexOf('PSA.1.*')).toBeLessThan(text.indexOf('PSA.2.*'));
        expect(text.indexOf('PSA.2.*')).toBeLessThan(text.indexOf('PSA.0.*'));
        expect(
            container?.querySelectorAll('[title="/a/songs/PSA.0.pdf"]'),
        ).toHaveLength(1);
    });

    test('says so when nothing matched', async () => {
        scanResourceFilesMock.mockResolvedValue(genScanResult());
        await renderBox();
        expect(container?.textContent).toContain('No matching files');
    });

    test('surfaces a truncated scan instead of showing a short list', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({
                filePaths: ['/a/songs/PSA.1.pdf'],
                isTruncated: true,
            }),
        );
        await renderBox();
        expect(container?.textContent).toContain('Too many folders to search');
    });

    test('passes the search text down and appends what it found', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({
                filePaths: ['/a/songs/PSA.1.pdf'],
                searchedFilePaths: ['/a/songs/abc.docx'],
            }),
        );
        await renderBox('abc');
        expect(scanResourceFilesMock).toHaveBeenCalledWith(
            '/a/songs',
            PSA_1,
            'abc',
            false,
            expect.any(Function),
        );
        expect(
            container?.querySelector('[title="/a/songs/abc.docx"]'),
        ).not.toBeNull();
        // Labelled, so the tail cannot be misread as more verse matches.
        expect(container?.textContent).toContain('*abc*');
    });

    test('search hits alone are not "no matching files"', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({ searchedFilePaths: ['/a/songs/abc.docx'] }),
        );
        await renderBox('abc');
        expect(container?.textContent).not.toContain('No matching files');
    });

    test('says when the searched half was capped', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({
                searchedFilePaths: ['/a/songs/abc.docx'],
                isSearchTruncated: true,
            }),
        );
        await renderBox('abc');
        expect(container?.textContent).toContain('Too many matching files');
    });

    test.each([
        ['ENOENT', 'Folder not found'],
        ['ENOTDIR', 'Folder not found'],
        ['EACCES', 'Cannot read folder'],
    ])('a %s root renders "%s"', async (code, message) => {
        scanResourceFilesMock.mockRejectedValue(
            Object.assign(new Error('nope'), { code }),
        );
        await renderBox();
        expect(container?.textContent).toContain(message);
    });

    test('passes Others down and lists the other files last, labelled', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({
                filePaths: ['/a/songs/PSA.1.pdf'],
                searchedFilePaths: ['/a/songs/abc.docx'],
                otherFilePaths: ['/a/songs/Jesus-family-line.jpeg'],
            }),
        );
        await renderBox('abc', true);
        expect(scanResourceFilesMock).toHaveBeenCalledWith(
            '/a/songs',
            PSA_1,
            'abc',
            true,
            expect.any(Function),
        );
        const text = container?.textContent ?? '';
        // After the chapter's files AND after what was just typed for.
        expect(text.indexOf('*abc*')).toBeGreaterThan(text.indexOf('PSA.1.*'));
        expect(text.indexOf('Others')).toBeGreaterThan(text.indexOf('*abc*'));
        const row = container?.querySelector(
            '[title="/a/songs/Jesus-family-line.jpeg"]',
        );
        expect(row).not.toBeNull();
        // Matched for no book, so it is tagged as no book's introduction.
        expect(row?.textContent).not.toContain('Introduction');
    });

    test('other files alone are not "no matching files"', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({ otherFilePaths: ['/a/songs/map.png'] }),
        );
        await renderBox('', true);
        expect(container?.textContent).not.toContain('No matching files');
    });

    test('says when the other files were capped', async () => {
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({
                otherFilePaths: ['/a/songs/map.png'],
                isOthersTruncated: true,
            }),
        );
        await renderBox('', true);
        expect(container?.textContent).toContain('Too many other files');
    });

    function openFolderMenu() {
        showAppContextMenuMock.mockClear();
        const header = container?.querySelector('.app-resources-group-header');
        act(() => {
            header?.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        const menuItems: any[] = showAppContextMenuMock.mock.calls[0][1];
        return menuItems;
    }

    test('offers to copy the folder into the data directory', async () => {
        checkIsInResourcesDataDirMock.mockReturnValue(false);
        const onCopyFolderToDataDir = vi.fn();
        await renderBox('', false, onCopyFolderToDataDir);
        const menuItems = openFolderMenu();
        const copyItem = menuItems.find((item) => {
            return item.menuElement === 'Copy to Data Directory';
        });
        expect(copyItem).toBeDefined();
        // Beside Reveal, above the red Remove.
        expect(menuItems.indexOf(copyItem)).toBe(menuItems.length - 2);
        copyItem.onSelect();
        expect(onCopyFolderToDataDir).toHaveBeenCalledWith('/a/songs');
    });

    test('does not offer to copy a folder that already is a copy', async () => {
        checkIsInResourcesDataDirMock.mockReturnValue(true);
        await renderBox();
        const labels = openFolderMenu().map((item) => item.menuElement);
        expect(labels).not.toContain('Copy to Data Directory');
        expect(labels).toContain('Remove Folder');
    });

    async function pickAddFiles() {
        const addFilesItem = openFolderMenu().find((item) => {
            return item.menuElement === 'Add Files';
        });
        expect(addFilesItem).toBeDefined();
        await act(async () => {
            await addFilesItem.onSelect();
        });
    }

    test('Add Files copies the picked files into THIS folder', async () => {
        selectFilesMock.mockResolvedValue(['/downloads/PSA.1.pdf']);
        copyFilesMock.mockResolvedValue({
            copiedFilePaths: ['/a/songs/PSA.1.pdf'],
            skippedCount: 0,
            error: null,
        });
        await renderBox();
        await pickAddFiles();
        expect(copyFilesMock).toHaveBeenCalledWith('/a/songs', [
            '/downloads/PSA.1.pdf',
        ]);
        // The cached walk is what the box draws from, so it goes first.
        expect(invalidateMock).toHaveBeenCalledWith('/a/songs');
        expect(scanResourceFilesMock).toHaveBeenCalledTimes(2);
        // Opened, so a folder that was collapsed still shows what went in.
        expect(setSettingBooleanMock).toHaveBeenCalledWith(true);
        expect(showSimpleToastMock).toHaveBeenCalledWith('Add Files', 'copied');
    });

    test('a copied file the list cannot draw is reported as such', async () => {
        selectFilesMock.mockResolvedValue(['/downloads/notes.docx']);
        copyFilesMock.mockResolvedValue({
            copiedFilePaths: ['/a/songs/notes.docx'],
            skippedCount: 0,
            error: null,
        });
        // Others off, the reader on Psalm 1: the file is on the shelf and
        // nothing on screen would ever show it.
        await renderBox();
        await pickAddFiles();
        expect(copiedMessageMock.mock.calls[0][1]).toEqual({
            isNoneListed: true,
            isOthersShowing: false,
        });
        // The same file with Others ticked IS drawn, so nothing is said.
        copiedMessageMock.mockClear();
        await act(async () => {
            root?.unmount();
        });
        root = null;
        await renderBox('', true);
        await pickAddFiles();
        expect(copiedMessageMock.mock.calls[0][1]).toEqual({
            isNoneListed: false,
            isOthersShowing: true,
        });
    });

    test('a cancelled dialog copies nothing and says nothing', async () => {
        selectFilesMock.mockResolvedValue([]);
        await renderBox();
        await pickAddFiles();
        expect(copyFilesMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).not.toHaveBeenCalled();
        expect(scanResourceFilesMock).toHaveBeenCalledTimes(1);
    });

    test('a refusal is said in words, and nothing is re-scanned', async () => {
        selectFilesMock.mockResolvedValue(['/downloads/PSA.1.pdf']);
        const { ResourcesCopyError } = await import('./resourcesCopyHelpers');
        copyFilesMock.mockRejectedValue(
            new ResourcesCopyError('Folder not found'),
        );
        await renderBox();
        await pickAddFiles();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Add Files',
            'Folder not found',
        );
        expect(scanResourceFilesMock).toHaveBeenCalledTimes(1);
    });

    test('unmounting mid-scan asks the walk itself to stop', async () => {
        let checkShouldStop = () => false;
        scanResourceFilesMock.mockImplementation(
            (
                _dirPath: string,
                _targets: unknown,
                _searchText: string,
                _isOthersShowing: boolean,
                shouldStop: () => boolean,
            ) => {
                checkShouldStop = shouldStop;
                return new Promise(() => {});
            },
        );
        await renderBox();
        expect(checkShouldStop()).toBe(false);
        await act(async () => {
            root?.unmount();
        });
        root = null;
        // Not merely "ignore the result": the walk must stop READING, or a
        // 1500-directory scan runs on after the user has moved away.
        expect(checkShouldStop()).toBe(true);
    });
});
