import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkIsImagesInClipboardMock,
    getCopiedCanvasItemsMock,
    getMimetypeExtensionsMock,
    readImagesFromClipboardMock,
    selectFilesMock,
    setCopiedItemsMock,
    showAppContextMenuMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    checkIsImagesInClipboardMock: vi.fn(),
    getCopiedCanvasItemsMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
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
        selectFilesMock.mockResolvedValue(['/slides/one.png', '/slides/two.mp4']);
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
        expect(canvasController.genNewMediaItemFromFilePath).toHaveBeenCalledWith(
            '/slides/one.png',
            event,
        );
        expect(canvasController.genNewMediaItemFromFilePath).toHaveBeenCalledWith(
            '/slides/two.mp4',
            event,
        );
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
        const textCanvasItem = { type: 'text' };
        const imageCanvasItem = { type: 'image' };
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

        expect(selectedItemMenuItems.map((item: any) => item.menuElement)).toEqual(
            ['Copy', 'Duplicate', 'Edit', 'Delete'],
        );
        expect(selectedItemMenu[2]).toEqual({
            style: {
                minWidth: '70px',
            },
        });

        selectedItemMenuItems[0].onSelect();
        expect(setCopiedItemsMock).toHaveBeenCalledWith([textCanvasItem]);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copied',
            'Canvas item copied',
        );

        selectedItemMenuItems[1].onSelect();
        expect(canvasController.duplicateItems).toHaveBeenCalledWith([
            textCanvasItem,
        ]);

        selectedItemMenuItems[2].onSelect();
        expect(handleCanvasItemEditing).toHaveBeenCalledTimes(1);

        selectedItemMenuItems[3].onSelect();
        expect(canvasController.deleteItems).toHaveBeenCalledWith([
            textCanvasItem,
        ]);
        expect(selectedItemMenuItems[0].keyboardShortcut).toEqual(
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
        ).toEqual(['Copy', 'Duplicate', 'Delete']);
        expect(unselectedItemMenuItems[0].keyboardShortcut).toBeUndefined();
        expect(unselectedItemMenuItems[1].keyboardShortcut).toBeUndefined();
        expect(unselectedItemMenuItems[2].keyboardShortcut).toBeUndefined();
    });
});
