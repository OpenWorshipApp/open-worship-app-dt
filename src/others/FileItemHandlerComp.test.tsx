// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    copyToClipboardMock,
    showFileOrDirExplorerMock,
    trashAllMaterialFilesMock,
    showAppConfirmMock,
    showAppContextMenuMock,
    useFileSourceRefreshEventsMock,
    useFileSourceIsOnScreenMock,
    appProviderMock,
    fileSourceInstances,
    getMockFileSource,
} = vi.hoisted(() => {
    const fileSourceInstances = new Map<string, any>();
    const getMockFileSource = (filePath: string) => {
        const existing = fileSourceInstances.get(filePath);
        if (existing) {
            return existing;
        }
        const fullName = filePath.split('/').pop() ?? filePath;
        const instance = {
            filePath,
            src: `src:${filePath}`,
            fullName,
            duplicate: vi.fn(),
            trash: vi.fn(async () => {}),
            fireSelectEvent: vi.fn(),
        };
        fileSourceInstances.set(filePath, instance);
        return instance;
    };
    return {
        copyToClipboardMock: vi.fn(),
        showFileOrDirExplorerMock: vi.fn(),
        trashAllMaterialFilesMock: vi.fn(async () => {}),
        showAppConfirmMock: vi.fn(async () => true),
        showAppContextMenuMock: vi.fn(),
        useFileSourceRefreshEventsMock: vi.fn(),
        useFileSourceIsOnScreenMock: vi.fn(() => false),
        appProviderMock: {
            isPagePresenter: false,
        },
        fileSourceInstances,
        getMockFileSource,
    };
});

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../server/appHelpers', () => ({
    copyToClipboard: copyToClipboardMock,
    showFileOrDirExplorer: showFileOrDirExplorerMock,
    trashAllMaterialFiles: trashAllMaterialFilesMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: getMockFileSource,
    },
}));

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceRefreshEvents: useFileSourceRefreshEventsMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal in File Explorer',
    RECEIVING_DROP_CLASSNAME: 'receiving-data-drop',
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../_screen/screenHelpers', () => ({
    useFileSourceIsOnScreen: useFileSourceIsOnScreenMock,
}));

vi.mock('./RenderRenamingComp', () => ({
    default: ({
        setIsRenaming,
    }: {
        setIsRenaming: (value: boolean) => void;
    }) => {
        return (
            <button
                className="mock-renaming"
                onClick={() => {
                    setIsRenaming(false);
                }}
            >
                renaming
            </button>
        );
    },
}));

vi.mock('./LoadingComp', () => ({
    default: () => <div className="mock-loading">loading</div>,
}));

vi.mock('./ItemColorNoteComp', () => ({
    default: () => <div className="mock-color-note">color-note</div>,
}));

vi.mock('./FileReadErrorComp', () => ({
    default: () => <div className="mock-file-read-error">file-error</div>,
}));

import FileItemHandlerComp, {
    genCommonMenu,
    genShowOnScreensContextMenu,
    genTrashContextMenu,
} from './FileItemHandlerComp';

describe('FileItemHandlerComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        fileSourceInstances.clear();
        appProviderMock.isPagePresenter = false;
        showAppConfirmMock.mockResolvedValue(true);
        useFileSourceIsOnScreenMock.mockReturnValue(false);
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

    async function render(element: ReactElement) {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(element);
        });
    }

    test('builds common and presenter screen menu items', () => {
        const onShow = vi.fn();
        const commonMenu = genCommonMenu('/docs/file.txt');

        commonMenu[0].onSelect?.(new MouseEvent('click'));
        commonMenu[1].onSelect?.(new MouseEvent('click'));

        expect(copyToClipboardMock).toHaveBeenCalledWith('/docs/file.txt');
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/docs/file.txt',
        );
        expect(genShowOnScreensContextMenu(onShow)).toEqual([]);

        appProviderMock.isPagePresenter = true;
        const screenMenu = genShowOnScreensContextMenu(onShow);
        screenMenu[0].onSelect?.(new MouseEvent('click'));

        expect(screenMenu[0].menuElement).toBe('Show on Screens');
        expect(onShow).toHaveBeenCalledTimes(1);
    });

    test('confirms before moving files to trash', async () => {
        const fileSource = getMockFileSource('/docs/trash.txt');
        const onTrashed = vi.fn();
        const trashMenu = genTrashContextMenu('/docs/trash.txt', onTrashed);

        await trashMenu[0].onSelect?.(new MouseEvent('click'));

        expect(showAppConfirmMock).toHaveBeenCalledWith(
            'Moving File to Trash',
            expect.stringContaining('trash.txt'),
            { confirmButtonLabel: 'Yes' },
        );
        expect(fileSource.trash).toHaveBeenCalledTimes(1);
        expect(trashAllMaterialFilesMock).toHaveBeenCalledWith(fileSource);
        expect(onTrashed).toHaveBeenCalledTimes(1);

        showAppConfirmMock.mockResolvedValue(false);
        await trashMenu[0].onSelect?.(new MouseEvent('click'));
        expect(fileSource.trash).toHaveBeenCalledTimes(1);
    });

    test('renders file items, handles click, opens menus, and switches to rename mode', async () => {
        const reload = vi.fn();
        const onClick = vi.fn();
        const preDelete = vi.fn();
        const fileData = {
            preDelete: vi.fn(),
        };
        const renderChild = vi.fn(() => <div className="child-body">body</div>);
        const extraItem = {
            menuElement: 'Extra',
            onSelect: vi.fn(),
        };
        useFileSourceIsOnScreenMock.mockReturnValue(true);

        await render(
            <FileItemHandlerComp
                fileData={fileData as any}
                reload={reload}
                index={0}
                filePath="/docs/item.txt"
                className="base-item"
                contextMenuItems={[extraItem]}
                onClick={onClick}
                renderChild={renderChild}
                preDelete={preDelete}
                userClassName="user-item"
                isSelected
            />,
        );

        const listItem = container?.querySelector('li');
        const fileSource = getMockFileSource('/docs/item.txt');
        expect(useFileSourceRefreshEventsMock).toHaveBeenCalledWith(['select']);
        expect(renderChild).toHaveBeenCalledWith(fileData);
        expect(listItem?.className).toContain('active');
        expect(listItem?.className).toContain('base-item');
        expect(listItem?.className).toContain('user-item');
        expect(listItem?.className).toContain('pointer');
        expect(container?.textContent).toContain('body');
        expect(container?.textContent).toContain('color-note');

        await act(async () => {
            listItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            listItem?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(fileSource.fireSelectEvent).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);

        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Extra',
            'Copy Path to Clipboard',
            'Reveal in File Explorer',
            'Duplicate',
            'Rename',
            'Reload',
            'Move to Trash',
        ]);

        menuItems[3].onSelect?.(new MouseEvent('click'));
        expect(fileSource.duplicate).toHaveBeenCalledTimes(1);

        await act(async () => {
            menuItems[4].onSelect?.(new MouseEvent('click'));
        });
        expect(container?.querySelector('.mock-renaming')).not.toBeNull();

        await act(async () => {
            container
                ?.querySelector('.mock-renaming')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(container?.querySelector('.mock-renaming')).toBeNull();

        menuItems[5].onSelect?.(new MouseEvent('click'));
        expect(reload).toHaveBeenCalledTimes(1);

        await menuItems[6].onSelect?.(new MouseEvent('click'));
        expect(fileData.preDelete).toHaveBeenCalledTimes(1);
        expect(preDelete).toHaveBeenCalledTimes(1);
        expect(fileSource.trash).toHaveBeenCalledTimes(1);
    });

    test('handles drag-over, drag-leave, and drop events', async () => {
        const onDrop = vi.fn();

        await render(
            <FileItemHandlerComp
                fileData={{ preDelete: vi.fn() } as any}
                reload={vi.fn()}
                index={1}
                filePath="/docs/drag.txt"
                onDrop={onDrop}
                renderChild={() => <div>drag</div>}
                isSelected={false}
            />,
        );

        const listItem = container?.querySelector('li');
        if (!(listItem instanceof HTMLLIElement)) {
            throw new Error('Missing list item');
        }

        await act(async () => {
            listItem.dispatchEvent(
                new Event('dragover', { bubbles: true, cancelable: true }),
            );
        });
        expect(listItem.classList.contains('receiving-data-drop')).toBe(true);

        await act(async () => {
            listItem.dispatchEvent(
                new Event('dragleave', { bubbles: true, cancelable: true }),
            );
        });
        expect(listItem.classList.contains('receiving-data-drop')).toBe(false);

        await act(async () => {
            listItem.dispatchEvent(
                new Event('drop', { bubbles: true, cancelable: true }),
            );
        });
        expect(onDrop).toHaveBeenCalledTimes(1);
        expect(listItem.classList.contains('receiving-data-drop')).toBe(false);
    });

    test('renders loading and read-error branches', async () => {
        await render(
            <div>
                <FileItemHandlerComp
                    fileData={undefined}
                    reload={vi.fn()}
                    index={0}
                    filePath="/docs/loading.txt"
                    renderChild={() => <div>never</div>}
                    isSelected={false}
                />
                <FileItemHandlerComp
                    fileData={null}
                    reload={vi.fn()}
                    index={1}
                    filePath="/docs/error.txt"
                    renderChild={() => <div>never</div>}
                    isSelected={false}
                    isDisabledColorNote
                />
            </div>,
        );

        expect(container?.textContent).toContain('loading');
        expect(container?.textContent).toContain('file-error');
    });
});
