import { getMimetypeExtensions, selectFiles } from '../../server/fileHelpers';
import CanvasItem from './CanvasItem';
import CanvasController from './CanvasController';
import { showSimpleToast } from '../../toast/toastHelpers';
import Canvas from './Canvas';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import {
    checkIsImagesInClipboard,
    readImagesFromClipboard,
} from '../../server/appHelpers';

export async function showCanvasContextMenu(
    event: any,
    canvasController: CanvasController,
) {
    const isClipboardHasImage = await checkIsImagesInClipboard();
    const copiedCanvasItems = await Canvas.getCopiedCanvasItems();
    showAppContextMenu(event, [
        {
            menuElement: 'New',
            onSelect: () => {
                canvasController.addNewTextItem();
            },
        },
        ...(copiedCanvasItems.length > 0
            ? [
                  {
                      menuElement: 'Paste',
                      onSelect: () => {
                          for (const copiedCanvasItem of copiedCanvasItems) {
                              canvasController.addNewItem(copiedCanvasItem);
                          }
                      },
                  },
              ]
            : []),
        {
            menuElement: 'Insert Medias',
            onSelect: () => {
                const imageExtensions = getMimetypeExtensions('image');
                const videoExtension = getMimetypeExtensions('video');
                const filePaths = selectFiles([
                    {
                        name: 'All Files',
                        extensions: [...imageExtensions, ...videoExtension],
                    },
                ]);
                filePaths.forEach((filePath) => {
                    canvasController
                        .genNewMediaItemFromFilePath(filePath, event)
                        .then((newCanvasItem) => {
                            if (newCanvasItem) {
                                canvasController.addNewItem(newCanvasItem);
                            }
                        });
                });
            },
        },
        ...(isClipboardHasImage
            ? [
                  {
                      menuElement: '`Paste Image',
                      onSelect: async () => {
                          for await (const blob of readImagesFromClipboard()) {
                              const newCanvasItem =
                                  await canvasController.genNewImageItemFromBlob(
                                      blob,
                                      event,
                                  );
                              if (!newCanvasItem) {
                                  return;
                              }
                              canvasController.addNewItem(newCanvasItem);
                          }
                      },
                  },
              ]
            : []),
    ]);
}

export function showCanvasItemContextMenu(
    event: any,
    canvasController: CanvasController,
    canvasItem: CanvasItem<any>,
    handleCanvasItemEditing: () => void,
) {
    showAppContextMenu(event, [
        {
            menuElement: 'Copy',
            onSelect: () => {
                navigator.clipboard.writeText(canvasItem.clipboardSerialize());
                showSimpleToast('Copied', 'Canvas item copied');
            },
        },
        {
            menuElement: 'Duplicate',
            onSelect: () => {
                canvasController.duplicate(canvasItem);
            },
        },
        {
            menuElement: 'Edit',
            onSelect: () => {
                handleCanvasItemEditing();
            },
        },
        {
            menuElement: 'Delete',
            onSelect: () => {
                canvasController.deleteItem(canvasItem);
            },
        },
    ]);
}
