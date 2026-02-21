import { tran } from '../../lang/langHelpers';
import { getMimetypeExtensions, selectFiles } from '../../server/fileHelpers';
import type CanvasItem from './CanvasItem';
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
            menuElement: tran('New'),
            onSelect: () => {
                canvasController.addNewTextItem();
            },
        },
        ...(copiedCanvasItems.length > 0
            ? [
                  {
                      menuElement: tran('Paste'),
                      onSelect: () => {
                          for (const copiedCanvasItem of copiedCanvasItems) {
                              canvasController.addNewItems([copiedCanvasItem]);
                          }
                      },
                  },
              ]
            : []),
        {
            menuElement: tran('Insert Medias'),
            onSelect: () => {
                const imageExtensions = getMimetypeExtensions('image');
                const videoExtension = getMimetypeExtensions('video');
                const filePaths = selectFiles([
                    {
                        name: tran('All Files'),
                        extensions: [...imageExtensions, ...videoExtension],
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
            },
        },
        ...(isClipboardHasImage
            ? [
                  {
                      menuElement: tran('Paste Image'),
                      onSelect: async () => {
                          for await (const blob of readImagesFromClipboard()) {
                              const newCanvasItem =
                                  await canvasController.genNewImageItemFromFile(
                                      blob,
                                      event,
                                  );
                              if (!newCanvasItem) {
                                  return;
                              }
                              canvasController.addNewItems([newCanvasItem]);
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
            menuElement: tran('Copy'),
            onSelect: () => {
                Canvas.setCopiedItems([canvasItem]);
                showSimpleToast(tran('Copied'), tran('Canvas item copied'));
            },
        },
        {
            menuElement: tran('Duplicate'),
            onSelect: () => {
                canvasController.duplicateItems([canvasItem]);
            },
        },
        {
            menuElement: tran('Edit'),
            onSelect: () => {
                handleCanvasItemEditing();
            },
        },
        {
            menuElement: tran('Delete'),
            onSelect: () => {
                canvasController.deleteItems([canvasItem]);
            },
        },
    ]);
}
