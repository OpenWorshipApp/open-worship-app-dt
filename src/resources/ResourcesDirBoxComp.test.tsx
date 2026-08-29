// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { scanResourceFilesMock, invalidateMock, isShowingState } = vi.hoisted(
    () => ({
        scanResourceFilesMock: vi.fn(),
        invalidateMock: vi.fn(),
        isShowingState: { value: true },
    }),
);

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
        useStateSettingBoolean: () => [isShowingState.value, vi.fn()],
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

describe('ResourcesDirBoxComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        isShowingState.value = true;
        scanResourceFilesMock.mockResolvedValue(
            genScanResult({ filePaths: ['/a/songs/PSA.1.pdf'] }),
        );
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

    async function renderBox(searchText = '') {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <ResourcesDirBoxComp
                    dirPath="/a/songs"
                    bookKey="PSA"
                    chapter={1}
                    searchText={searchText}
                    onAddFolder={vi.fn()}
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
            'PSA',
            1,
            '',
            expect.any(Function),
        );
        // The full path, so two matches in two subfolders can be told apart.
        expect(
            container?.querySelector('[title="/a/songs/PSA.1.pdf"]'),
        ).not.toBeNull();
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
            'PSA',
            1,
            'abc',
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

    test('unmounting mid-scan asks the walk itself to stop', async () => {
        let checkShouldStop = () => false;
        scanResourceFilesMock.mockImplementation(
            (
                _dirPath: string,
                _bookKey: string,
                _chapter: number,
                _searchText: string,
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
