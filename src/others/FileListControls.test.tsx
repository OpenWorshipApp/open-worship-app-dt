// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileListFilterDataType } from './fileListFilterHelpers';

const h = vi.hoisted(() => ({
    menu: vi.fn(),
    visiblePaths: [] as string[],
    colorNotes: new Map<string, string>(),
    refresh: vi.fn(),
}));

vi.mock('../server/fileHelpers', () => ({
    pathBasename: (path: string) => path.split('/').at(-1) ?? '',
    getFileDotExtension: (name: string) =>
        name.includes('.') ? `.${name.split('.').at(-1)}` : '',
}));
vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        getSetting: () => null,
        useStateSettingString: (_name: string, fallback: string) =>
            react.useState(fallback),
        useStateSettingBoolean: (_name: string, fallback: boolean) =>
            react.useState(fallback),
    };
});
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/colorNoteHelpers', () => ({
    genFilePathColorMap: (filePaths: string[]) => {
        const map: Record<string, string[]> = { unknown: [] };
        for (const path of filePaths) {
            const color = h.colorNotes.get(path) ?? 'unknown';
            (map[color] ??= []).push(path);
        }
        return map;
    },
    genColorNoteDataList: (map: Record<string, string[]>) => [
        ...Object.keys(map)
            .filter((color) => color !== 'unknown')
            .sort(),
        'unknown',
    ],
    genColorBar: (color: string) => createElement('span', {}, color),
}));
vi.mock('../_screen/screenHelpers', () => ({
    useFileSourceIsOnScreen: (paths: string[]) => {
        h.visiblePaths = paths;
    },
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.menu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./LoadingComp', () => ({
    default: () => createElement('span', {}, 'Loading'),
}));
vi.mock('./NoDirSelectedComp', () => ({
    GotoSettingDirectoryPathComp: () =>
        createElement('span', {}, 'Choose directory'),
}));

import FileListFilterIconsComp, {
    FileListFilterInputComp,
} from './FileListFilterComp';
import RenderListComp from './RenderListComp';

let root: Root;
let container: HTMLDivElement;
let filterData: FileListFilterDataType;

function defaultFilterData(): FileListFilterDataType {
    return {
        filterText: '',
        setFilterText: vi.fn(),
        isSearchShowing: false,
        setIsSearchShowing: vi.fn(),
        sortData: { key: 'none', isAscending: true },
        setSortData: vi.fn(),
        filterTypeName: '',
        setFilterTypeName: vi.fn(),
    };
}

function changeInputValue(input: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderIcons(paths: string[]) {
    await act(async () =>
        root.render(
            createElement(FileListFilterIconsComp, {
                filePaths: paths,
                filterData,
            }),
        ),
    );
}

async function renderList(
    paths: string[] | null | undefined,
    options: { disableColorNoteGrouping?: boolean } = {},
) {
    await act(async () =>
        root.render(
            createElement(RenderListComp, {
                dirSource: {
                    settingName: 'documents',
                    fireRefreshEvent: h.refresh,
                } as any,
                filePaths: paths,
                filterData,
                bodyHandler: (visible: string[], color?: string) =>
                    createElement(
                        'div',
                        { 'data-color': color ?? '' },
                        visible.join(','),
                    ),
                setIsOnScreen: vi.fn(),
                sortFilePaths: (visible: string[]) => [...visible].sort(),
                ...options,
            }),
        ),
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.menu.mockClear();
    h.refresh.mockClear();
    h.colorNotes.clear();
    h.visiblePaths = [];
    filterData = defaultFilterData();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('file list controls', () => {
    it('hides filters for one file and exposes sort and type choices for two types', async () => {
        await renderIcons(['/docs/a.md']);
        expect(container.querySelector('[title="Filter by name"]')).toBeNull();
        await renderIcons(['/docs/a.md', '/docs/b.pdf']);
        expect(
            container.querySelector('[title="Filter by name"]'),
        ).not.toBeNull();
        await act(async () =>
            container.querySelector<HTMLElement>('[title="Sort"]')!.click(),
        );
        const sortItems = h.menu.mock.calls.at(-1)![1];
        expect(
            sortItems.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual([
            'Default',
            'Name (A to Z)',
            'Name (Z to A)',
            'Type (A to Z)',
            'Type (Z to A)',
        ]);
        await act(async () => sortItems[2].onSelect());
        expect(filterData.setSortData).toHaveBeenCalledWith({
            key: 'name',
            isAscending: false,
        });
        await act(async () =>
            container
                .querySelector<HTMLElement>('[title="Filter by Type"]')!
                .click(),
        );
        const typeItems = h.menu.mock.calls.at(-1)![1];
        expect(
            typeItems.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual(['All Types', 'MD', 'PDF']);
        await act(async () => typeItems[2].onSelect());
        expect(filterData.setFilterTypeName).toHaveBeenCalledWith('PDF');
    });

    it('makes the header icons named buttons the keyboard can press', async () => {
        await renderIcons(['/docs/a.md', '/docs/b.pdf']);
        const sortIcon =
            container.querySelector<HTMLElement>('[title="Sort"]')!;
        // Were role-less divs: out of the accessibility tree, and no Tab stop.
        expect(sortIcon.getAttribute('role')).toBe('button');
        expect(sortIcon.getAttribute('aria-label')).toBe('Sort');
        expect(sortIcon.getAttribute('aria-haspopup')).toBe('menu');
        expect(sortIcon.tabIndex).toBe(0);
        const searchIcon = container.querySelector<HTMLElement>(
            '[title="Filter by name"]',
        )!;
        expect(searchIcon.getAttribute('aria-pressed')).toBe('false');
        const menuCallCount = h.menu.mock.calls.length;
        await act(async () => {
            sortIcon.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.menu.mock.calls.length).toBe(menuCallCount + 1);
    });

    it('clears the name filter when search is hidden and debounces typing', async () => {
        filterData.isSearchShowing = true;
        await renderIcons(['/docs/a.md', '/docs/b.md']);
        await act(async () =>
            container
                .querySelector<HTMLElement>('[title="Filter by name"]')!
                .click(),
        );
        expect(filterData.setIsSearchShowing).toHaveBeenCalledWith(false);
        expect(filterData.setFilterText).toHaveBeenCalledWith('');
        await act(async () =>
            root.render(createElement(FileListFilterInputComp, { filterData })),
        );
        const input = container.querySelector('input')!;
        await act(async () => changeInputValue(input, 'first'));
        await act(async () => changeInputValue(input, 'last'));
        await act(async () => vi.advanceTimersByTime(299));
        expect(filterData.setFilterText).toHaveBeenCalledTimes(1);
        await act(async () => vi.advanceTimersByTime(1));
        expect(filterData.setFilterText).toHaveBeenLastCalledWith('last');
        await act(async () =>
            input.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Escape',
                    bubbles: true,
                }),
            ),
        );
        expect(filterData.setIsSearchShowing).toHaveBeenLastCalledWith(false);
        expect(filterData.setFilterText).toHaveBeenLastCalledWith('');
    });

    it('shows loading, read failure with retry, and an empty directory distinctly', async () => {
        await renderList(undefined);
        expect(container.textContent).toBe('Loading');
        await renderList(null);
        expect(container.textContent).toContain('Fail to Get File List');
        await act(async () =>
            container.querySelector<HTMLButtonElement>('button')!.click(),
        );
        expect(h.refresh).toHaveBeenCalledTimes(1);
        await renderList([]);
        expect(container.textContent).toBe('');
    });

    it('says a missing folder is not found, naming it, instead of empty', async () => {
        await act(async () =>
            root.render(
                createElement(RenderListComp, {
                    dirSource: {
                        settingName: 'documents',
                        dirPath: '/gone/documents',
                        isDirPathValid: false,
                        fireRefreshEvent: h.refresh,
                    } as any,
                    filePaths: null,
                    filterData,
                    bodyHandler: () => null,
                    setIsOnScreen: vi.fn(),
                }),
            ),
        );
        // Read "This folder is empty" and offered to make documents in it.
        expect(container.textContent).toContain('Folder not found');
        expect(container.textContent).toContain('/gone/documents');
        expect(container.textContent).not.toContain('Fail to Get File List');
    });

    it('filters and sorts the shown rows while checking the full directory on screen', async () => {
        filterData.filterText = 'song';
        filterData.sortData = { key: 'name', isAscending: false };
        const paths = ['/docs/song-a.md', '/docs/notes.pdf', '/docs/song-z.md'];
        await renderList(paths, { disableColorNoteGrouping: true });
        expect(h.visiblePaths).toEqual(paths);
        expect(container.textContent).toBe('/docs/song-z.md,/docs/song-a.md');
        filterData.filterText = 'missing';
        await renderList(paths, { disableColorNoteGrouping: true });
        expect(container.textContent).toBe('No matching files');
    });

    it('groups color notes and stops rendering a collapsed group', async () => {
        h.colorNotes.set('/docs/blue.md', 'blue');
        await renderList(['/docs/blue.md', '/docs/ordinary.md']);
        expect(container.textContent).toContain('/docs/blue.md');
        expect(container.textContent).toContain('/docs/ordinary.md');
        const blue = Array.from(
            container.querySelectorAll<HTMLElement>('div'),
        ).find((element) => element.textContent?.startsWith('blue1'))!;
        expect(blue).not.toBeNull();
        await act(async () => blue.click());
        expect(container.textContent).not.toContain('/docs/blue.md');
        expect(container.textContent).toContain('/docs/ordinary.md');
    });
});
