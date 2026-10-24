// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileSelectionOptionType } from './droppingFileHelpers';

const h = vi.hoisted(() => ({
    paths: [] as string[] | null | undefined,
    menuOptions: null as any,
    showMenu: vi.fn(),
    selectedFiles: vi.fn(),
    listProps: null as any,
    drop: vi.fn(),
    isOnOwnFolder: false,
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get isOnOwnFolder() {
            return h.isOnOwnFolder;
        },
    },
}));

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
vi.mock('../helper/dirSourceHelpers', async () => {
    const react = await import('react');
    return {
        DirSourceContext: react.createContext(null),
        useFilePaths: () => h.paths,
    };
});
vi.mock('./fileListFilterHelpers', () => ({
    useFileListFilterData: () => ({
        filterText: '',
        isSearchShowing: false,
        sortData: { key: 'none', isAscending: true },
        filterTypeName: '',
    }),
}));
vi.mock('./FileListFilterComp', () => ({
    default: () => null,
    FileListFilterInputComp: () => createElement('input'),
}));
vi.mock('./droppingFileHelpers', () => ({
    genOnDragOver: () => vi.fn(),
    genOnDragLeave: () => vi.fn(),
    genOnDrop: () => h.drop,
    genDroppingFileOnContextMenu: (
        dir: { dirPath: string },
        options: unknown,
    ) => {
        h.menuOptions = options;
        return dir.dirPath ? h.showMenu : undefined;
    },
    handleFilesSelectionMenuItem: h.selectedFiles,
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: (x: number, y: number) =>
        new MouseEvent('click', { clientX: x, clientY: y }),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('./PathSelectorComp', () => ({
    default: ({ extraElements }: { extraElements: ReactNode }) =>
        createElement('div', { className: 'path-selector' }, extraElements),
}));
vi.mock('./RenderListComp', () => ({
    default: (props: unknown) => {
        h.listProps = props;
        return createElement('li', {}, 'Rows');
    },
}));
vi.mock('./NoDirSelectedComp', () => ({
    default: ({ defaultFolderName }: { defaultFolderName: string }) =>
        createElement('div', {}, `Choose ${defaultFolderName}`),
}));
vi.mock('./AskingNewNameComp', () => ({
    default: ({ applyName }: { applyName: (name: string | null) => void }) =>
        createElement(
            'li',
            {},
            createElement(
                'button',
                { type: 'button', onClick: () => applyName('New song') },
                'Apply name',
            ),
            createElement(
                'button',
                { type: 'button', onClick: () => applyName(null) },
                'Cancel name',
            ),
        ),
}));
vi.mock('./StickyAutoHideComp', () => ({
    default: ({ children }: { children: ReactNode }) =>
        createElement('div', {}, children),
}));
vi.mock('./EmptyFileListComp', () => ({
    default: () => createElement('li', {}, 'Empty directory'),
}));
vi.mock('../scrolling/ScrollingHandlerComp', () => ({
    default: () => null,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import FileListHandlerComp from './FileListHandlerComp';

let root: Root;
let container: HTMLDivElement;
let onNewFile: ReturnType<
    typeof vi.fn<
        (path: string, name: string, kind: string | null) => Promise<boolean>
    >
>;
let dirSource: { dirPath: string; settingName: string };

async function renderList(
    options: {
        header?: ReactNode;
        onNewFile?: typeof onNewFile;
        newFileKinds?: Array<{ key: string; title: string; iconName: string }>;
        defaultFolderName?: string;
        fileSelectionOption?: FileSelectionOptionType;
        genItemsAddingMenuItems?: (items: any[]) => any[];
    } = {},
) {
    await act(async () =>
        root.render(
            createElement(FileListHandlerComp, {
                className: 'songs-list',
                mimetypeName: 'appDocument',
                dirSource: dirSource as any,
                bodyHandler: (paths: string[]) => paths.join(','),
                ...options,
            }),
        ),
    );
}

function menuButton() {
    const button = container.querySelector<HTMLElement>(
        '[aria-label="More Options"]',
    );
    expect(button).not.toBeNull();
    return button!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.paths = [];
    h.menuOptions = null;
    h.showMenu.mockClear();
    h.selectedFiles.mockClear();
    h.drop.mockClear();
    h.listProps = null;
    h.isOnOwnFolder = false;
    onNewFile = vi
        .fn<
            (
                path: string,
                name: string,
                kind: string | null,
            ) => Promise<boolean>
        >()
        .mockResolvedValue(true);
    dirSource = { dirPath: '/library/songs', settingName: 'songs' };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('file list container', () => {
    it('names a headerless directory, offers its menu and renders empty status', async () => {
        await renderList({ onNewFile });
        const frame = container.querySelector<HTMLElement>('.songs-list')!;
        expect(frame.getAttribute('aria-label')).toBe('songs');
        expect(container.textContent).toContain('Empty directory');
        expect(h.listProps.filePaths).toEqual([]);
        await act(async () => menuButton().click());
        expect(h.showMenu).toHaveBeenCalledTimes(1);
        await act(async () =>
            frame.dispatchEvent(new Event('drop', { bubbles: true })),
        );
        expect(h.drop).toHaveBeenCalledTimes(1);
    });

    it('offers separate new-file kinds and passes the chosen kind to the creator', async () => {
        await renderList({
            header: 'Documents',
            onNewFile,
            newFileKinds: [
                { key: 'slide', title: 'New Slide', iconName: 'file' },
                { key: 'lyric', title: 'New Lyric', iconName: 'music' },
            ],
        });
        const frame = container.querySelector<HTMLElement>('.songs-list')!;
        expect(frame.getAttribute('aria-labelledby')).toBeTruthy();
        expect(container.querySelector('strong')?.textContent).toBe(
            'Documents',
        );
        expect(
            container
                .querySelector('.card-header')
                ?.querySelector('[aria-label="More Options"]'),
        ).not.toBeNull();
        const kinds = h.menuOptions.genNewFileMenuItems();
        expect(
            kinds.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual(['New Slide', 'New Lyric']);
        await act(async () => kinds[1].onSelect());
        expect(container.textContent).toContain('Apply name');
        await act(async () =>
            Array.from(container.querySelectorAll('button'))
                .find((button) => button.textContent === 'Apply name')!
                .click(),
        );
        expect(onNewFile).toHaveBeenCalledWith(
            '/library/songs',
            'New song',
            'lyric',
        );
        await act(async () =>
            Array.from(container.querySelectorAll('button'))
                .find((button) => button.textContent === 'Cancel name')!
                .click(),
        );
        expect(container.textContent).not.toContain('Apply name');
    });

    it('adds local-file and caller-specific menu entries and uses keyboard coordinates', async () => {
        const fileSelectionOption = {
            windowTitle: 'Choose files',
            extensions: ['md'],
            dirPath: '/library/songs',
        };
        await renderList({
            fileSelectionOption,
            genItemsAddingMenuItems: (items) => [
                ...items,
                { menuElement: 'Import archive' },
            ],
        });
        const items = h.menuOptions.genItemsAddingMenuItems();
        expect(
            items.map((item: { menuElement: string }) => item.menuElement),
        ).toEqual(['Add Local Files', 'Import archive']);
        await act(async () => items[0].onSelect());
        expect(h.selectedFiles).toHaveBeenCalledWith(fileSelectionOption);
        const button = menuButton();
        button.getBoundingClientRect = () =>
            ({ left: 25, bottom: 45 }) as DOMRect;
        await act(async () =>
            button.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                }),
            ),
        );
        expect(h.showMenu.mock.calls.at(-1)![0]).toMatchObject({
            clientX: 25,
            clientY: 45,
        });
    });

    it('offers folder selection when no directory is set', async () => {
        dirSource.dirPath = '';
        h.paths = null;
        await renderList({ defaultFolderName: 'Songs' });
        expect(container.textContent).toContain('Choose Songs');
        expect(container.textContent).not.toContain('Rows');
        expect(
            container.querySelector('[aria-label="More Options"]'),
        ).toBeNull();
        expect(container.querySelector('.path-selector')).not.toBeNull();
    });

    it('with no data folder, offers no folder picker of its own', async () => {
        dirSource.dirPath = '';
        h.paths = null;
        h.isOnOwnFolder = true;
        await renderList({ defaultFolderName: 'Songs' });
        // A folder picked here would have no data folder to be kept in.
        expect(container.querySelector('.path-selector')).toBeNull();
        expect(container.textContent).toContain('Choose Songs');
    });
});
