import { tran } from '../../lang/langHelpers';
import { getMimetypeExtensions, selectFiles } from '../../server/fileHelpers';
import type CanvasItem from './CanvasItem';
import type CanvasController from './CanvasController';
import { showSimpleToast } from '../../toast/toastHelpers';
import Canvas from './Canvas';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import {
    checkIsImagesInClipboard,
    readImagesFromClipboard,
} from '../../server/appHelpers';
import {
    lookupBibleItemProps,
    readBibleItemFromClipboard,
} from './canvasBibleItemHelpers';
import type { CanvasItemBiblePropsType } from './CanvasItemBibleItem';

export async function showCanvasContextMenu(
    event: any,
    canvasController: CanvasController,
) {
    // The menu waits for these, so read the clipboard forms in parallel.
    const [isClipboardHasImage, clipboardBibleItem, copiedCanvasItems] =
        await Promise.all([
            checkIsImagesInClipboard(),
            readBibleItemFromClipboard(),
            Canvas.getCopiedCanvasItems(),
        ]);
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
            onSelect: async () => {
                const imageExtensions = getMimetypeExtensions('image');
                const videoExtension = getMimetypeExtensions('video');
                const filePaths = await selectFiles([
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
        ...(clipboardBibleItem !== null
            ? [
                  {
                      menuElement: tran('Paste Bible Item'),
                      onSelect: () => {
                          canvasController.addNewBibleItem(
                              clipboardBibleItem,
                              event,
                          );
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
    isSelected: boolean,
    // Absent on pages without the bible lookup popup.
    openBibleLookup: (() => void) | null = null,
) {
    const isLocked = canvasItem.props.locked === true;
    const isEditable = !isLocked && canvasItem.type === 'text';
    const isLookupable =
        canvasItem.type === 'bible' && openBibleLookup !== null;
    const menuItems: ContextMenuItemType[] = [
        ...(isLookupable
            ? [
                  {
                      menuElement: tran('Lookup'),
                      onSelect: () => {
                          lookupBibleItemProps(
                              canvasItem.props as CanvasItemBiblePropsType,
                              openBibleLookup,
                          );
                      },
                  },
              ]
            : []),
        {
            menuElement: tran(isLocked ? 'Unlock' : 'Lock'),
            onSelect: () => {
                canvasController.editCanvasItemById(
                    canvasItem.id,
                    (latestCanvasItem) => {
                        latestCanvasItem.applyProps({ locked: !isLocked });
                    },
                );
            },
        },
        {
            menuElement: tran('Copy'),
            keyboardShortcut: isSelected
                ? {
                      mControlKey: ['Meta'],
                      wControlKey: ['Ctrl'],
                      lControlKey: ['Ctrl'],
                      key: 'c',
                  }
                : undefined,
            onSelect: () => {
                Canvas.setCopiedItems([canvasItem]);
                showSimpleToast(tran('Copied'), tran('Canvas item copied'));
            },
        },
        {
            menuElement: tran('Duplicate'),
            keyboardShortcut: isSelected
                ? {
                      mControlKey: ['Meta', 'Shift'],
                      wControlKey: ['Ctrl', 'Shift'],
                      lControlKey: ['Ctrl', 'Shift'],
                      key: 'd',
                  }
                : undefined,
            onSelect: () => {
                canvasController.duplicateItems([canvasItem]);
            },
        },
        ...(isEditable
            ? [
                  {
                      menuElement: tran('Edit'),
                      onSelect: () => {
                          handleCanvasItemEditing();
                      },
                  },
              ]
            : []),
        ...(isLocked
            ? []
            : [
                  {
                      menuElement: tran('Delete'),
                      keyboardShortcut: isSelected
                          ? {
                                key: 'Delete',
                            }
                          : undefined,
                      onSelect: () => {
                          canvasController.deleteItems([canvasItem]);
                      },
                  },
              ]),
    ];
    showAppContextMenu(event, menuItems);
}
