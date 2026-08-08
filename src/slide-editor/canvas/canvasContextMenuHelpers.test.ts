import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    askForURLMock,
    checkIsImagesInClipboardMock,
    copyToClipboardMock,
    downloadImageBase64DataMock,
    getCopiedCanvasItemsMock,
    getMimetypeExtensionsMock,
    lookupBibleItemPropsMock,
    openExternalURLMock,
    readBibleItemFromClipboardMock,
    readImagesFromClipboardMock,
    selectFilesMock,
    setCopiedItemsMock,
    showAppContextMenuMock,
    showFileOrDirExplorerMock,
    showSimpleToastMock,
    getAllCameraDevicesMock,
    refreshWebCapturingMock,
} = vi.hoisted(() => ({
    askForURLMock: vi.fn(),
    checkIsImagesInClipboardMock: vi.fn(),
    copyToClipboardMock: vi.fn(),
    downloadImageBase64DataMock: vi.fn(),
    getCopiedCanvasItemsMock: vi.fn(),
    getMimetypeExtensionsMock: vi.fn(),
    lookupBibleItemPropsMock: vi.fn(),
    openExternalURLMock: vi.fn(),
    readBibleItemFromClipboardMock: vi.fn(),
    readImagesFromClipboardMock: vi.fn(),
    selectFilesMock: vi.fn(),
    setCopiedItemsMock: vi.fn(),
    showAppContextMenuMock: vi.fn(),
    showFileOrDirExplorerMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    getAllCameraDevicesMock: vi.fn(),
    refreshWebCapturingMock: vi.fn(),
}));

vi.mock('../../helper/cameraHelpers', () => ({
    getAllCameraDevices: getAllCameraDevicesMock,
}));

vi.mock('../../background/downloadHelper', () => ({
    askForURL: askForURLMock,
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
    showFileOrDirExplorer: showFileOrDirExplorerMock,
    copyToClipboard: copyToClipboardMock,
    downloadImageBase64Data: downloadImageBase64DataMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        browserUtils: {
            openExternalURL: openExternalURLMock,
        },
        // `appHooks` reads this at MODULE LOAD (reached here through
        // `capturingHelpers`, which owns `refreshWebCapturing`), so a mock
        // without it fails the whole suite while importing.
        systemUtils: { isDev: false },
    },
}));

vi.mock('../../helper/capturingHelpers', () => ({
    refreshWebCapturing: refreshWebCapturingMock,
}));

vi.mock('../../helper/helpers', () => ({
    getMenuTitleRevealFile: () => 'Reveal in File Explorer',
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
            if (type === 'image') {
                return ['png', 'jpg'];
            }
            return type === 'audio' ? ['mp3'] : ['mp4'];
        });
        selectFilesMock.mockResolvedValue([]);
        getAllCameraDevicesMock.mockResolvedValue([]);
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
            // The insert actions come first as one shared block (they are
            // rendered from the same list the app's Insert menu uses), then the
            // clipboard-conditional entries.
            'New',
            'Insert Medias',
            'Insert Media Link',
            'Insert YouTube',
            'Insert Website',
            'Insert Camera',
            'Paste',
            'Paste Image',
        ]);

        // Looked up by label, not index: the insert block is shared with the
        // app's Insert menu, so its length moves whenever an insertable type is
        // added.
        const menuByLabel = new Map<string, any>(
            menuItems.map((item: any) => [item.menuElement, item]),
        );

        menuByLabel.get('New').onSelect();
        expect(canvasController.addNewTextItem).toHaveBeenCalledTimes(1);

        menuByLabel.get('Paste').onSelect();
        expect(canvasController.addNewItems).toHaveBeenNthCalledWith(1, [
            copiedCanvasItems[0],
        ]);
        expect(canvasController.addNewItems).toHaveBeenNthCalledWith(2, [
            copiedCanvasItems[1],
        ]);

        await menuByLabel.get('Insert Medias').onSelect();
        await flushPromises();
        expect(selectFilesMock).toHaveBeenCalledWith([
            {
                name: 'All Files',
                extensions: ['png', 'jpg', 'mp4', 'mp3'],
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

        await menuByLabel.get('Paste Image').onSelect();
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

    test('inserts a camera item through a device submenu', async () => {
        const cameraItem = { id: 30, type: 'camera' };
        const canvasController = {
            addNewTextItem: vi.fn(),
            addNewItems: vi.fn(),
            genNewCameraItem: vi.fn().mockReturnValue(cameraItem),
        };
        const event = { clientX: 10, clientY: 20 };
        const camera = { deviceId: 'device-1', label: 'HD Webcam' };

        // No camera on the machine: a toast, and no second menu.
        await showCanvasContextMenu(event, canvasController as any);
        const firstMenu = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        const insertCamera = firstMenu.find((item: any) => {
            return item.menuElement === 'Insert Camera';
        });
        await insertCamera.onSelect();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Insert Camera',
            'No camera found',
        );
        expect(showAppContextMenuMock).toHaveBeenCalledTimes(1);

        // With a device present, the list becomes a second menu.
        getAllCameraDevicesMock.mockResolvedValue([camera]);
        await insertCamera.onSelect();
        expect(showAppContextMenuMock).toHaveBeenCalledTimes(2);
        const deviceMenu = showAppContextMenuMock.mock.calls[1][1];
        expect(deviceMenu.map((item: any) => item.menuElement)).toEqual([
            'HD Webcam',
        ]);

        deviceMenu[0].onSelect();
        expect(canvasController.genNewCameraItem).toHaveBeenCalledWith(
            camera,
            event,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([cameraItem]);
    });

    test('inserts YouTube, website and media-link items from a URL prompt', async () => {
        const youtubeItem = { id: 20, type: 'youtube' };
        const websiteItem = { id: 21, type: 'website' };
        const mediaLinkItem = { id: 22, type: 'audio' };
        const canvasController = {
            addNewTextItem: vi.fn(),
            addNewItems: vi.fn(),
            genNewMediaItemFromFilePath: vi.fn(),
            genNewImageItemFromFile: vi.fn(),
            genNewYouTubeItem: vi.fn().mockReturnValue(youtubeItem),
            genNewWebsiteItem: vi.fn().mockReturnValue(websiteItem),
            genNewMediaItemFromLink: vi.fn().mockResolvedValue(mediaLinkItem),
        };
        const event = { clientX: 10, clientY: 20 };

        await showCanvasContextMenu(event, canvasController as any);
        const menuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        const menuByLabel = new Map(
            menuItems.map((item: any) => [item.menuElement, item]),
        );

        // A cancelled prompt inserts nothing.
        askForURLMock.mockResolvedValueOnce(null);
        await (menuByLabel.get('Insert YouTube') as any).onSelect();
        expect(canvasController.genNewYouTubeItem).not.toHaveBeenCalled();
        expect(canvasController.addNewItems).not.toHaveBeenCalled();

        askForURLMock.mockResolvedValueOnce(
            'https://www.youtube.com/watch?v=abc123',
        );
        await (menuByLabel.get('Insert YouTube') as any).onSelect();
        expect(askForURLMock).toHaveBeenCalledWith(
            'Insert YouTube',
            'YouTube URL:',
        );
        expect(canvasController.genNewYouTubeItem).toHaveBeenCalledWith(
            'https://www.youtube.com/watch?v=abc123',
            event,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            youtubeItem,
        ]);

        askForURLMock.mockResolvedValueOnce('https://example.com');
        await (menuByLabel.get('Insert Website') as any).onSelect();
        expect(askForURLMock).toHaveBeenCalledWith(
            'Insert Website',
            'Website URL:',
        );
        expect(canvasController.genNewWebsiteItem).toHaveBeenCalledWith(
            'https://example.com',
            event,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            websiteItem,
        ]);

        // A media link takes the same prompt-then-insert shape; a cancelled
        // prompt must not reach the controller.
        canvasController.addNewItems.mockClear();
        askForURLMock.mockResolvedValueOnce(null);
        await (menuByLabel.get('Insert Media Link') as any).onSelect();
        expect(canvasController.genNewMediaItemFromLink).not.toHaveBeenCalled();
        expect(canvasController.addNewItems).not.toHaveBeenCalled();

        const audioUrl =
            'https://www.openworship.app/shared/audios/Doxology 21&22.mp3';
        askForURLMock.mockResolvedValueOnce(audioUrl);
        await (menuByLabel.get('Insert Media Link') as any).onSelect();
        expect(askForURLMock).toHaveBeenCalledWith(
            'Insert Media Link',
            'Media URL:',
        );
        expect(canvasController.genNewMediaItemFromLink).toHaveBeenCalledWith(
            audioUrl,
            event,
        );
        expect(canvasController.addNewItems).toHaveBeenCalledWith([
            mediaLinkItem,
        ]);

        // A link the controller refuses (it toasts on its own) adds nothing.
        canvasController.addNewItems.mockClear();
        canvasController.genNewMediaItemFromLink.mockResolvedValueOnce(
            undefined,
        );
        askForURLMock.mockResolvedValueOnce('https://a.com/handout.pdf');
        await (menuByLabel.get('Insert Media Link') as any).onSelect();
        expect(canvasController.addNewItems).not.toHaveBeenCalled();
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
            'Insert Media Link',
            'Insert YouTube',
            'Insert Website',
            'Insert Camera',
            'Paste Bible Item',
        ]);

        menuItems[menuItems.length - 1].onSelect();
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

    test('offers reveal-in-file-manager only for video items with a file path', () => {
        const handleCanvasItemEditing = vi.fn();

        // A video item exposes the reveal action wired to its file path.
        const videoCanvasItem = {
            type: 'video',
            props: { filePath: '/media/clip.mp4' },
        };
        showCanvasItemContextMenu(
            {},
            {} as any,
            videoCanvasItem as any,
            handleCanvasItemEditing,
            false,
        );
        const videoMenuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        expect(videoMenuItems.map((item: any) => item.menuElement)).toEqual([
            'Lock',
            'Copy',
            'Duplicate',
            'Reveal in File Explorer',
            'Delete',
        ]);

        const revealItem = videoMenuItems.find(
            (item: any) => item.menuElement === 'Reveal in File Explorer',
        );
        revealItem.onSelect();
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/media/clip.mp4',
        );

        // A locked video still keeps the reveal action available.
        showCanvasItemContextMenu(
            {},
            {} as any,
            {
                type: 'video',
                props: { filePath: '/media/clip.mp4', locked: true },
            } as any,
            handleCanvasItemEditing,
            false,
        );
        expect(
            (showAppContextMenuMock.mock.calls[1]?.[1] ?? []).map(
                (item: any) => item.menuElement,
            ),
        ).toEqual(['Unlock', 'Copy', 'Duplicate', 'Reveal in File Explorer']);

        // Non-video items never show the reveal action.
        showCanvasItemContextMenu(
            {},
            {} as any,
            { type: 'image', props: {} } as any,
            handleCanvasItemEditing,
            false,
        );
        expect(
            (showAppContextMenuMock.mock.calls[2]?.[1] ?? []).map(
                (item: any) => item.menuElement,
            ),
        ).not.toContain('Reveal in File Explorer');
    });

    test('offers open/copy URL for youtube and website items', () => {
        const handleCanvasItemEditing = vi.fn();

        for (const [index, type] of ['youtube', 'website'].entries()) {
            const urlCanvasItem = {
                type,
                props: { url: `https://example.com/${type}` },
            };
            showCanvasItemContextMenu(
                {},
                {} as any,
                urlCanvasItem as any,
                handleCanvasItemEditing,
                false,
            );
            const menuItems =
                showAppContextMenuMock.mock.calls[index]?.[1] ?? [];
            expect(menuItems.map((item: any) => item.menuElement)).toEqual([
                'Lock',
                'Copy',
                'Duplicate',
                'Open URL',
                'Copy URL',
                // A website renders as a screenshot that never self-
                // invalidates, so only it gets a way to force a re-capture. A
                // youtube item shares the `url` prop but renders a real embed.
                ...(type === 'website' ? ['Refresh Preview'] : []),
                'Delete',
            ]);

            const menuByLabel = new Map<string, any>(
                menuItems.map((item: any) => [item.menuElement, item]),
            );
            menuByLabel.get('Open URL').onSelect();
            expect(openExternalURLMock).toHaveBeenLastCalledWith(
                `https://example.com/${type}`,
            );
            menuByLabel.get('Copy URL').onSelect();
            expect(copyToClipboardMock).toHaveBeenLastCalledWith(
                `https://example.com/${type}`,
            );
            if (type === 'website') {
                menuByLabel.get('Refresh Preview').onSelect();
                expect(refreshWebCapturingMock).toHaveBeenLastCalledWith(
                    `https://example.com/${type}`,
                );
            }
        }

        // Items without a URL never show the URL actions.
        showCanvasItemContextMenu(
            {},
            {} as any,
            { type: 'video', props: { filePath: '/media/clip.mp4' } } as any,
            handleCanvasItemEditing,
            false,
        );
        const videoLabels = (
            showAppContextMenuMock.mock.calls[2]?.[1] ?? []
        ).map((item: any) => item.menuElement);
        expect(videoLabels).not.toContain('Open URL');
        expect(videoLabels).not.toContain('Copy URL');
        expect(videoLabels).not.toContain('Refresh Preview');
    });

    test('offers download for image items with embedded data', () => {
        const handleCanvasItemEditing = vi.fn();

        // An image item exposes a download action wired to its embedded data.
        showCanvasItemContextMenu(
            {},
            {} as any,
            {
                type: 'image',
                props: { srcData: 'data:image/png;base64,AAAA' },
            } as any,
            handleCanvasItemEditing,
            false,
        );
        const imageMenuItems = showAppContextMenuMock.mock.calls[0]?.[1] ?? [];
        expect(imageMenuItems.map((item: any) => item.menuElement)).toEqual([
            'Lock',
            'Copy',
            'Duplicate',
            'Download',
            'Delete',
        ]);

        imageMenuItems
            .find((item: any) => item.menuElement === 'Download')
            .onSelect();
        expect(downloadImageBase64DataMock).toHaveBeenCalledWith(
            'data:image/png;base64,AAAA',
        );

        // An image without embedded data offers no download action.
        showCanvasItemContextMenu(
            {},
            {} as any,
            { type: 'image', props: {} } as any,
            handleCanvasItemEditing,
            false,
        );
        expect(
            (showAppContextMenuMock.mock.calls[1]?.[1] ?? []).map(
                (item: any) => item.menuElement,
            ),
        ).not.toContain('Download');
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
            'Insert Media Link',
            'Insert YouTube',
            'Insert Website',
            'Insert Camera',
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
