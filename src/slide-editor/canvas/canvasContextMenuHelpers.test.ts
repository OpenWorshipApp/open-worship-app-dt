import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkIsImagesInClipboardMock,
    getCopiedCanvasItemsMock,
    getMimetypeExtensionsMock,
    lookupBibleItemPropsMock,
    readBibleItemFromClipboardMock,
    readImagesFromClipboardMock,
    selectFilesMock,
    setCopiedItemsMock,
    showAppContextMenuMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    checkIsImagesInClipboardMock: vi.fn(),
    getCopiedCanvasItemsMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    lookupBibleItemPropsMock: vi.fn(),
    readBibleItemFromClipboardMock: vi.fn(),
    readImagesFromClipboardMock: vi.fn(),
    selectFilesMock: vi.fn(),
    setCopiedItemsMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../../server/fileHelpers', () => ({
    getMimetypeExtensions: getMimetypeExtensionsMock,
    selectFiles: selectFilesMock,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../../server/appHelpers', () => ({
    checkIsImagesInClipboard: checkIsImagesInClipboardMock,
    readImagesFromClipboard: readImagesFromClipboardMock,
}));

vi.mock('./canvasBibleItemHelpers', () => ({
    lookupBibleItemProps: lookupBibleItemPropsMock,
    readBibleItemFromClipboard: readBibleItemFromClipboardMock,
}));

vi.mock('./Canvas', () => ({
    default: {
        getCopiedCanvasItems: getCopiedCanvasItemsMock,
        setCopiedItems: setCopiedItemsMock,
    },
}));

import {
    showCanvasContextMenu,
    showCanvasItemContextMenu,
} from './canvasContextMenuHelpers';

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('canvasContextMenuHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCopiedCanvasItemsMock.mockResolvedValue([]);
        checkIsImagesInClipboardMock.mockResolvedValue(false);
        readBibleItemFromClipboardMock.mockResolvedValue(null);
        getMimetypeExtensionsMock.mockImplementation((type: string) => {
            return type === 'image' ? ['png', 'jpg'] : ['mp4'];
        });
        selectFilesMock.mockResolvedValue([]);
    });

    test('shows the canvas context menu and executes paste and media actions', async () => {
        const copiedCanvasItems = [{ id: 1 }, { id: 2 }];
        const blob1 = new Blob(['image-1']);
        const blob2 = new Blob(['image-2']);
        const addedCanvasItem = { id: 10, type: 'image' };
        const pastedImageItem = { id: 11, type: 'image' };
        const canvasController = {
            addNewTextItem: vi.fn(),
            addNewItems: vi.fn(),
            genNewMediaItemFromFilePath: vi
                .fn()
                .mockResolvedValueOnce(addedCanvasItem)
                .mockResolvedValueOnce(null),
            genNewImageItemFromFile: vi
                .fn()
                .mockResolvedValueOnce(pastedImageItem)
                .mockResolvedValueOnce(null),
            duplicateItems: vi.fn(),
            deleteItems: vi.fn(),
        };
        const event = { clientX: 10, clientY: 20 };

        getCopiedCanvasItemsMock.mockResolvedValue(copiedCanvasItems);
        checkIsImagesInClipboardMock.mockResolvedValue(true);
        selectFilesMock.mockResolvedValue([
            '/slides/one.png',
            '/slides/two.mp4',
        ]);
        readImagesFromClipboardMock.mockReturnValue(
            (async function* () {
                yield blob1;
                yield blob2;
            })(),
        );

        await showCanvasContextMenu(event, canvasController as any);

        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];

        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'New',
            'Paste',
            'Insert Medias',
            'Paste Image',
        ]);

        menuItems[0].onSelect();
        expect(canvasController.addNewTextItem).toHaveBeenCalledTimes(1);

        menuItems[1].onSelect();
        expect(canvasController.addNewItems).toHaveBeenNthCalledWith(1, [
            copiedCanvasItems[0],
        ]);
        expect(canvasController.addNewItems).toHaveBeenNthCalledWith(2, [
            copiedCanvasItems[1],
        ]);

        await menuItems[2].onSelect();
        await flushPromises();
        expect(selectFilesMock).toHaveBeenCalledWith([
            {
                name: 'All Files',
                extensions: ['png', 'jpg', 'mp4'],
            },
        ]);
        expect(
            canvasController.genNewMediaItemFromFilePath,
        ).toHaveBeenCalledWith('/slides/one.png', event);
        expect(
            canvasController.genNewMediaItemFromFilePath,
        ).toHaveBeenCalledWith('/slides/two.mp4', event);
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            addedCanvasItem,
        ]);

        await menuItems[3].onSelect();
        expect(canvasController.genNewImageItemFromFile).toHaveBeenCalledWith(
            blob1,
            event,
        );
        expect(canvasController.genNewImageItemFromFile).toHaveBeenCalledWith(
            blob2,
            event,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            pastedImageItem,
        ]);
    });

    test('adds a bible item at the cursor when the clipboard holds a bible item text', async () => {
        const bibleItem = { bibleKey: 'KJV' };
        const event = { clientX: 10, clientY: 20 };
        const canvasController = {
            addNewTextItem: vi.fn(),
            addNewItems: vi.fn(),
            addNewBibleItem: vi.fn(),
            genNewMediaItemFromFilePath: vi.fn(),
            genNewImageItemFromFile: vi.fn(),
        };
        readBibleItemFromClipboardMock.mockResolvedValue(bibleItem);

        await showCanvasContextMenu(event, canvasController as any);

        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'New',
            'Insert Medias',
            'Paste Bible Item',
        ]);

        menuItems[2].onSelect();
        expect(canvasController.addNewBibleItem).toHaveBeenCalledWith(
            bibleItem,
            event,
        );
    });

    test('offers Lookup only for a bible item on a page with the lookup popup', () => {
        const bibleCanvasItem = {
            type: 'bible',
            props: { bibleKeys: ['KJV'] },
        };
        const openBibleLookup = vi.fn();
        const handleCanvasItemEditing = vi.fn();

        showCanvasItemContextMenu(
            {},
            {} as any,
            bibleCanvasItem as any,
            handleCanvasItemEditing,
            true,
            openBibleLookup,
        );
        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        expect(menuItems.map((item: any) => item.menuElement)).toEqual([
            'Lookup',
            'Lock',
            'Copy',
            'Duplicate',
            'Delete',
        ]);

        menuItems[0].onSelect();
        expect(lookupBibleItemPropsMock).toHaveBeenCalledWith(
            bibleCanvasItem.props,
            openBibleLookup,
        );

        // No lookup popup on this page.
        showCanvasItemContextMenu(
            {},
            {} as any,
            bibleCanvasItem as any,
            handleCanvasItemEditing,
            true,
        );
        expect(
            (showAppContextMenuMock.mock.calls[1]?.[1] ?? []).map(
                (item: any) => item.menuElement,
            ),
        ).toEqual(['Lock', 'Copy', 'Duplicate', 'Delete']);

        // Not a bible item.
        showCanvasItemContextMenu(
            {},
            {} as any,
            { type: 'text', props: {} } as any,
            handleCanvasItemEditing,
            true,
            openBibleLookup,
        );
        expect(
            (showAppContextMenuMock.mock.calls[2]?.[1] ?? []).map(
                (item: any) => item.menuElement,
            ),
        ).toEqual(['Lock', 'Copy', 'Duplicate', 'Edit', 'Delete']);
    });

    test('locks and unlocks a canvas item and hides destructive actions', () => {
        const editCanvasItemById = vi.fn();
        const canvasController = { editCanvasItemById };
        const handleCanvasItemEditing = vi.fn();

        // Unlocked item offers Lock.
        showCanvasItemContextMenu(
            {},
            canvasController as any,
            { id: 7, type: 'text', props: {} } as any,
            handleCanvasItemEditing,
            true,
        );
        const unlockedMenuItems = showAppContextMenuMock.mock.calls[0]?.[1];
        expect(unlockedMenuItems.map((item: any) => item.menuElement)).toEqual([
            'Lock',
            'Copy',
            'Duplicate',
            'Edit',
            'Delete',
        ]);

        unlockedMenuItems[0].onSelect();
        expect(editCanvasItemById).toHaveBeenCalledWith(
            7,
            expect.any(Function),
        );
        const lockMutator = editCanvasItemById.mock.calls[0][1];
        const lockedTarget = { applyProps: vi.fn() };
        lockMutator(lockedTarget);
        expect(lockedTarget.applyProps).toHaveBeenCalledWith({ locked: true });

        // Locked item offers Unlock and hides Edit and Delete.
        showCanvasItemContextMenu(
            {},
            canvasController as any,
            { id: 7, type: 'text', props: { locked: true } } as any,
            handleCanvasItemEditing,
            true,
        );
        const lockedMenuItems = showAppContextMenuMock.mock.calls[1]?.[1];
        expect(lockedMenuItems.map((item: any) => item.menuElement)).toEqual([
            'Unlock',
            'Copy',
            'Duplicate',
        ]);

        lockedMenuItems[0].onSelect();
        const unlockMutator = editCanvasItemById.mock.calls[1][1];
        const unlockedTarget = { applyProps: vi.fn() };
        unlockMutator(unlockedTarget);
        expect(unlockedTarget.applyProps).toHaveBeenCalledWith({
            locked: false,
        });
    });

    test('omits unavailable canvas actions and builds item menus with the right handlers', async () => {
        const canvasController = {
            addNewTextItem: vi.fn(),
            addNewItems: vi.fn(),
            genNewMediaItemFromFilePath: vi.fn(),
            genNewImageItemFromFile: vi.fn(),
            duplicateItems: vi.fn(),
            deleteItems: vi.fn(),
        };
        const handleCanvasItemEditing = vi.fn();
        const textCanvasItem = { type: 'text', props: {} };
        const imageCanvasItem = { type: 'image', props: {} };
        const event = { button: 2 };

        await showCanvasContextMenu(event, canvasController as any);
        const baseMenuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        expect(baseMenuItems.map((item: any) => item.menuElement)).toEqual([
            'New',
            'Insert Medias',
        ]);

        showCanvasItemContextMenu(
            event,
            canvasController as any,
            textCanvasItem as any,
            handleCanvasItemEditing,
            true,
        );
        const selectedItemMenu = showAppContextMenuMock.mock.calls[1] ?? [];
        const selectedItemMenuItems = selectedItemMenu[1] ?? [];

        expect(
            selectedItemMenuItems.map((item: any) => item.menuElement),
        ).toEqual(['Lock', 'Copy', 'Duplicate', 'Edit', 'Delete']);
        expect(selectedItemMenu[2]).toBeUndefined();

        selectedItemMenuItems[1].onSelect();
        expect(setCopiedItemsMock).toHaveBeenCalledWith([textCanvasItem]);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copied',
            'Canvas item copied',
        );

        selectedItemMenuItems[2].onSelect();
        expect(canvasController.duplicateItems).toHaveBeenCalledWith([
            textCanvasItem,
        ]);

        selectedItemMenuItems[3].onSelect();
        expect(handleCanvasItemEditing).toHaveBeenCalledTimes(1);

        selectedItemMenuItems[4].onSelect();
        expect(canvasController.deleteItems).toHaveBeenCalledWith([
            textCanvasItem,
        ]);
        expect(selectedItemMenuItems[1].keyboardShortcut).toEqual(
            expect.objectContaining({
                key: 'c',
            }),
        );

        showCanvasItemContextMenu(
            event,
            canvasController as any,
            imageCanvasItem as any,
            handleCanvasItemEditing,
            false,
        );
        const unselectedItemMenuItems =
            showAppContextMenuMock.mock.calls[2]?.[1] ?? [];

        expect(
            unselectedItemMenuItems.map((item: any) => item.menuElement),
        ).toEqual(['Lock', 'Copy', 'Duplicate', 'Delete']);
        expect(unselectedItemMenuItems[1].keyboardShortcut).toBeUndefined();
        expect(unselectedItemMenuItems[2].keyboardShortcut).toBeUndefined();
        expect(unselectedItemMenuItems[3].keyboardShortcut).toBeUndefined();
    });
});
