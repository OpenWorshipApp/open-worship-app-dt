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
import { askForURL } from '../../background/downloadHelper';
import { getMenuTitleRevealFile } from '../../helper/helpers';
import {
    copyToClipboard,
    downloadImageBase64Data,
    showFileOrDirExplorer,
} from '../../server/appHelpers';
import appProvider from '../../server/appProvider';

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
        {
            menuElement: tran('Insert YouTube'),
            onSelect: async () => {
                const url = await askForURL(
                    tran('Insert YouTube'),
                    tran('YouTube URL:'),
                );
                if (url === null) {
                    return;
                }
                const newCanvasItem = canvasController.genNewYouTubeItem(
                    url,
                    event,
                );
                if (newCanvasItem) {
                    canvasController.addNewItems([newCanvasItem]);
                }
            },
        },
        {
            menuElement: tran('Insert Website'),
            onSelect: async () => {
                const url = await askForURL(
                    tran('Insert Website'),
                    tran('Website URL:'),
                );
                if (url === null) {
                    return;
                }
                const newCanvasItem = canvasController.genNewWebsiteItem(
                    url,
                    event,
                );
                if (newCanvasItem) {
                    canvasController.addNewItems([newCanvasItem]);
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
    const isAbleForLookup =
        canvasItem.type === 'bible' && openBibleLookup !== null;
    // Only videos reference a resolvable on-disk file (images embed srcData,
    // YouTube/website items point at URLs), so reveal-in-file-manager applies
    // to video items alone.
    const isRevealable =
        canvasItem.type === 'video' &&
        typeof canvasItem.props.filePath === 'string';
    // YouTube and website items are backed by a URL; offer to open it in the
    // browser or copy it to the clipboard, the URL counterpart of revealing a
    // video's file.
    const hasUrl =
        (canvasItem.type === 'youtube' || canvasItem.type === 'website') &&
        typeof canvasItem.props.url === 'string';
    // Image items inline their pixels as base64 srcData rather than referencing
    // a file, so the file-oriented reveal doesn't apply; offer to save the
    // embedded image to disk instead.
    const isDownloadable =
        canvasItem.type === 'image' &&
        typeof canvasItem.props.srcData === 'string';
    const menuItems: ContextMenuItemType[] = [
        ...(isAbleForLookup
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
        ...(isRevealable
            ? [
                  {
                      menuElement: getMenuTitleRevealFile(),
                      onSelect: () => {
                          showFileOrDirExplorer(canvasItem.props.filePath);
                      },
                  },
              ]
            : []),
        ...(hasUrl
            ? [
                  {
                      menuElement: tran('Open URL'),
                      onSelect: () => {
                          appProvider.browserUtils.openExternalURL(
                              canvasItem.props.url,
                          );
                      },
                  },
                  {
                      menuElement: tran('Copy URL'),
                      onSelect: () => {
                          copyToClipboard(canvasItem.props.url);
                      },
                  },
              ]
            : []),
        ...(isDownloadable
            ? [
                  {
                      menuElement: tran('Download'),
                      onSelect: () => {
                          downloadImageBase64Data(canvasItem.props.srcData);
                      },
                  },
              ]
            : []),
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
