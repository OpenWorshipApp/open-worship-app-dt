import { tran } from '../../lang/langHelpers';
import type CanvasItem from './CanvasItem';
import type CanvasController from './CanvasController';
import { showSimpleToast } from '../../toast/toastHelpers';
import Canvas from './Canvas';
import {
    type ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import {
    checkIsImagesInClipboard,
    readImagesFromClipboard,
} from '../../server/appHelpers';
import {
    lookupBibleItemProps,
    readBibleItemFromClipboard,
} from './canvasBibleItemHelpers';
import type { CanvasItemBiblePropsType } from './CanvasItemBibleItem';
import { getMenuTitleRevealFile } from '../../helper/helpers';
import {
    copyToClipboard,
    downloadImageBase64Data,
    showFileOrDirExplorer,
} from '../../server/appHelpers';
import appProvider from '../../server/appProvider';
import { checkIsFilePathCanvasItemType } from './canvasHelpers';
import { checkIsRemoteMediaSource } from '../../helper/mediaSourceHelpers';
import { genCanvasInsertContextMenuItems } from './canvasInsertActionHelpers';

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
        // Everything a user can ADD, shared verbatim with the app's Insert
        // menu so the two never drift.
        ...genCanvasInsertContextMenuItems(canvasController, event),
        ...(copiedCanvasItems.length > 0
            ? [
                  {
                      childBefore: genContextMenuItemIcon('clipboard'),
                      menuElement: tran('Paste'),
                      onSelect: () => {
                          for (const copiedCanvasItem of copiedCanvasItems) {
                              canvasController.addNewItems([copiedCanvasItem]);
                          }
                      },
                  },
              ]
            : []),
        ...(isClipboardHasImage
            ? [
                  {
                      childBefore: genContextMenuItemIcon('card-image'),
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
                      childBefore: genContextMenuItemIcon('book'),
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
    // Video and audio items name their source: a path to a local file or a
    // remote link. Image items instead hold their source in `srcData`, which is
    // either inlined base64 pixels or — when the image was inserted from a link
    // — that link.
    const mediaSource =
        canvasItem.type === 'image'
            ? canvasItem.props.srcData
            : checkIsFilePathCanvasItemType(canvasItem.type)
              ? canvasItem.props.filePath
              : null;
    const isLocalFileSource =
        typeof mediaSource === 'string' &&
        mediaSource !== '' &&
        !checkIsRemoteMediaSource(mediaSource);
    // Reveal-in-file-manager needs a resolvable path on disk, so it applies to
    // local video/audio sources alone.
    const isRevealable =
        isLocalFileSource && checkIsFilePathCanvasItemType(canvasItem.type);
    // YouTube and website items are backed by a URL, and so is any media item
    // inserted from a link; offer to open it in the browser or copy it to the
    // clipboard, the URL counterpart of revealing a video's file.
    const itemUrl =
        (canvasItem.type === 'youtube' || canvasItem.type === 'website') &&
        typeof canvasItem.props.url === 'string'
            ? canvasItem.props.url
            : typeof mediaSource === 'string' &&
                checkIsRemoteMediaSource(mediaSource)
              ? mediaSource
              : null;
    const hasUrl = itemUrl !== null;
    // An inlined image carries its pixels rather than referencing a file, so
    // the file-oriented reveal doesn't apply; offer to save it to disk instead.
    // A linked image has nothing to write out — it is offered its URL above.
    const isDownloadable = canvasItem.type === 'image' && isLocalFileSource;
    const menuItems: ContextMenuItemType[] = [
        ...(isAbleForLookup
            ? [
                  {
                      childBefore: genContextMenuItemIcon('search'),
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
            childBefore: genContextMenuItemIcon(isLocked ? 'unlock' : 'lock'),
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
            childBefore: genContextMenuItemIcon('copy'),
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
            childBefore: genContextMenuItemIcon('files'),
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
                      childBefore: genContextMenuItemIcon('folder2-open'),
                      menuElement: getMenuTitleRevealFile(),
                      onSelect: () => {
                          showFileOrDirExplorer(mediaSource as string);
                      },
                  },
              ]
            : []),
        ...(hasUrl
            ? [
                  {
                      childBefore: genContextMenuItemIcon('box-arrow-up-right'),
                      menuElement: tran('Open URL'),
                      onSelect: () => {
                          appProvider.browserUtils.openExternalURL(itemUrl);
                      },
                  },
                  {
                      childBefore: genContextMenuItemIcon('clipboard'),
                      menuElement: tran('Copy URL'),
                      onSelect: () => {
                          copyToClipboard(itemUrl);
                      },
                  },
              ]
            : []),
        ...(isDownloadable
            ? [
                  {
                      childBefore: genContextMenuItemIcon('download'),
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
                      childBefore: genContextMenuItemIcon('pencil-square'),
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
                      childBefore: genContextMenuItemIcon('trash3', {
                          color: 'var(--bs-danger)',
                      }),
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
