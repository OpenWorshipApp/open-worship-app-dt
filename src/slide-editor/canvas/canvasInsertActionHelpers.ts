import { tran } from '../../lang/langHelpers';
import { getMimetypeExtensions, selectFiles } from '../../server/fileHelpers';
import type CanvasController from './CanvasController';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { askForURL } from '../../background/downloadHelper';
import { getAllCameraDevices } from '../../helper/cameraHelpers';
import { getWindowDim } from '../../helper/helpers';

/**
 * The things a user can ADD to a slide, defined once.
 *
 * Both the canvas right-click menu and the app's **Insert** menu render this
 * list, so the two can never drift — the menu bar is there precisely to
 * advertise what the context menu offers, which only works if they agree.
 *
 * `event` is the canvas context-menu event, and is absent when the action comes
 * from the app menu bar (which has no pointer). Everything downstream treats
 * that as "center it on the slide" — see `CanvasController.getInsertPosition`.
 */
export type CanvasInsertActionType = {
    /** Stable id. Travels to the native menu as `clickData` and back. */
    key: string;
    /** Untranslated label; `tran`'d at render so both menus stay in sync. */
    label: string;
    /** Bootstrap icon name, context menu only — the native menu is text. */
    iconName: string;
    handle: (
        canvasController: CanvasController,
        event?: any,
    ) => void | Promise<void>;
};

async function handleInsertingMedias(
    canvasController: CanvasController,
    event?: any,
) {
    const imageExtensions = getMimetypeExtensions('image');
    const videoExtension = getMimetypeExtensions('video');
    const audioExtensions = getMimetypeExtensions('audio');
    const filePaths = await selectFiles([
        {
            name: tran('All Files'),
            extensions: [
                ...imageExtensions,
                ...videoExtension,
                ...audioExtensions,
            ],
        },
    ]);
    for (const filePath of filePaths) {
        canvasController
            .genNewMediaItemFromFilePath(filePath, event)
            .then((newCanvasItem) => {
                if (newCanvasItem) {
                    canvasController.addNewItems([newCanvasItem]);
                }
            });
    }
}

async function handleInsertingMediaLink(
    canvasController: CanvasController,
    event?: any,
) {
    const url = await askForURL(tran('Insert Media Link'), tran('Media URL:'));
    if (url === null) {
        return;
    }
    const newCanvasItem = await canvasController.genNewMediaItemFromLink(
        url,
        event,
    );
    if (newCanvasItem) {
        canvasController.addNewItems([newCanvasItem]);
    }
}

async function handleInsertingYouTube(
    canvasController: CanvasController,
    event?: any,
) {
    const url = await askForURL(tran('Insert YouTube'), tran('YouTube URL:'));
    if (url === null) {
        return;
    }
    const newCanvasItem = canvasController.genNewYouTubeItem(url, event);
    if (newCanvasItem) {
        canvasController.addNewItems([newCanvasItem]);
    }
}

async function handleInsertingWebsite(
    canvasController: CanvasController,
    event?: any,
) {
    const url = await askForURL(tran('Insert Website'), tran('Website URL:'));
    if (url === null) {
        return;
    }
    const newCanvasItem = canvasController.genNewWebsiteItem(url, event);
    if (newCanvasItem) {
        canvasController.addNewItems([newCanvasItem]);
    }
}

async function handleInsertingCamera(
    canvasController: CanvasController,
    event?: any,
) {
    // Enumerated on select, not when either menu is built: this asks for camera
    // access, and that must not fire on every right-click of the canvas nor
    // every time the editor mounts.
    const cameraList = await getAllCameraDevices();
    if (cameraList.length === 0) {
        showSimpleToast(tran('Insert Camera'), tran('No camera found'));
        return;
    }
    // There is no submenu support, so the device list is a second menu. From
    // the app menu bar there is no pointer to open it at, so it opens in the
    // middle of the window instead.
    let menuEvent = event;
    if (menuEvent === undefined || menuEvent === null) {
        const windowDim = getWindowDim();
        menuEvent = createMouseEvent(windowDim.width / 2, windowDim.height / 2);
    }
    showAppContextMenu(
        menuEvent,
        cameraList.map((camera, index) => {
            return {
                childBefore: genContextMenuItemIcon('camera-video'),
                menuElement: camera.label || `${tran('Camera')} ${index + 1}`,
                onSelect: () => {
                    const newCanvasItem = canvasController.genNewCameraItem(
                        camera,
                        event,
                    );
                    if (newCanvasItem) {
                        canvasController.addNewItems([newCanvasItem]);
                    }
                },
            };
        }),
    );
}

export const canvasInsertActionList: CanvasInsertActionType[] = [
    {
        key: 'text',
        label: 'New',
        iconName: 'plus-square',
        handle: (canvasController) => {
            canvasController.addNewTextItem();
        },
    },
    {
        key: 'medias',
        label: 'Insert Medias',
        iconName: 'film',
        handle: handleInsertingMedias,
    },
    {
        key: 'media-link',
        label: 'Insert Media Link',
        iconName: 'link-45deg',
        handle: handleInsertingMediaLink,
    },
    {
        key: 'youtube',
        label: 'Insert YouTube',
        iconName: 'youtube',
        handle: handleInsertingYouTube,
    },
    {
        key: 'website',
        label: 'Insert Website',
        iconName: 'globe',
        handle: handleInsertingWebsite,
    },
    {
        key: 'camera',
        label: 'Insert Camera',
        iconName: 'camera-video',
        handle: handleInsertingCamera,
    },
];

export function genCanvasInsertContextMenuItems(
    canvasController: CanvasController,
    event: any,
) {
    return canvasInsertActionList.map((action) => {
        return {
            childBefore: genContextMenuItemIcon(action.iconName),
            menuElement: tran(action.label),
            onSelect: () => {
                return action.handle(canvasController, event);
            },
        };
    });
}
