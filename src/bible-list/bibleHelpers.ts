import { createContext, use, useState } from 'react';

import BibleItem from './BibleItem';
import {
    checkIsBookAvailable,
    getVerses,
    keyToBook,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    extractBibleTitle,
    toInputText,
    toLocaleNumBible,
} from '../helper/bible-helpers/serverBibleHelpers2';
import Bible from './Bible';
import { showSimpleToast } from '../toast/toastHelpers';
import DirSource from '../helper/DirSource';
import FileSource from '../helper/FileSource';
import { addExtension } from '../server/fileHelpers';
import appProvider from '../server/appProvider';
import { BibleVerseList } from '../helper/bible-helpers/BibleDataReader';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import { genBibleItemCopyingContextMenu } from './bibleItemHelpers';
import { getAllScreenManagers } from '../_screen/managers/screenManagerHelpers';
import { bibleRenderHelper } from './bibleRenderHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { useScreenUpdateEvents } from '../_screen/managers/screenManagerHooks';

export const SelectedBibleKeyContext = createContext<string>('KJV');
export function useBibleKeyContext() {
    const bibleKey = use(SelectedBibleKeyContext);
    if (!bibleKey) {
        throw new Error('SelectedBibleKeyContext is not provided');
    }
    return bibleKey;
}

export async function genInputText(
    oldBibleKey: string,
    bibleKey: string,
    inputText: string,
) {
    const { result } = await extractBibleTitle(oldBibleKey, inputText);
    const { bookKey, chapter, bibleItem } = result;
    const target = bibleItem?.target;
    if (bookKey !== null && (await checkIsBookAvailable(bibleKey, bookKey))) {
        const newBook = await keyToBook(bibleKey, bookKey);
        return toInputText(
            bibleKey,
            newBook,
            chapter,
            target?.verseStart,
            target?.verseEnd,
        );
    }
    return inputText;
}

export async function saveBibleItem(bibleItem: BibleItem, onDone?: () => void) {
    if (appProvider.isPageEditor) {
        // TODO: Implement this, find canvasController
        // canvasController.addNewBibleItem(bibleItem);
        return null;
    }
    const savedBibleItem = await Bible.addBibleItemToDefault(bibleItem);
    if (savedBibleItem !== null) {
        showSimpleToast('Adding bible', 'Bible item is added');
        onDone?.();
        return savedBibleItem;
    } else {
        showSimpleToast('Adding bible', 'Fail to add bible to list');
    }
    return null;
}

export type ConsumeVerseType = {
    sVerse: number;
    eVerse: number;
    verses: BibleVerseList;
};
export async function genVerseList({
    bibleKey,
    bookKey,
    chapter,
}: {
    bibleKey: string;
    bookKey: string;
    chapter: number;
}) {
    const verses = await getVerses(bibleKey, bookKey, chapter);
    if (verses === null) {
        return null;
    }
    const verseNumbList = await Promise.all(
        Array.from({ length: Object.keys(verses).length }, (_, i) => {
            return toLocaleNumBible(bibleKey, i + 1);
        }),
    );
    const verseList = verseNumbList.map((verseNumSting, i) => {
        return [i + 1, verseNumSting];
    });
    return verseList.filter(([_, verseNumSting]) => {
        return verseNumSting !== null;
    }) as [number, string][];
}

export async function moveBibleItemTo(
    event: any,
    bible: Bible,
    bibleItem?: BibleItem,
) {
    const dirSource = await DirSource.getInstance(
        Bible.getDirSourceSettingName(),
    );
    const filePaths = await dirSource.getFilePaths('bible');
    const targetNames = (filePaths ?? [])
        .map((filePath) => {
            return FileSource.getInstance(filePath).name;
        })
        .filter((name) => {
            const fileSource = FileSource.getInstance(bible.filePath);
            return name !== fileSource.name;
        });
    if (targetNames.length === 0) {
        showSimpleToast('Move Bible Item', 'No other bibles found');
        return;
    }
    showAppContextMenu(
        event,
        targetNames.map((name) => {
            return {
                menuElement: name,
                onSelect: async () => {
                    const bibleFileSource = FileSource.getInstance(
                        bible.filePath,
                    );
                    const { basePath, dotExtension } = bibleFileSource;
                    const fileSource = FileSource.getInstance(
                        basePath,
                        addExtension(name, dotExtension),
                    );
                    const targetBible = await Bible.fromFilePath(
                        fileSource.filePath,
                    );
                    if (!targetBible) {
                        showSimpleToast(
                            'Move Bible Item',
                            'Target bible not found',
                        );
                        return;
                    }
                    targetBible.moveItemFrom(bible.filePath, bibleItem);
                },
            };
        }),
    );
}

export async function openBibleItemContextMenu(
    event: any,
    bibleItem: BibleItem,
    index: number,
    openBibleLookup: (() => void) | null,
    extraMenuItems: ContextMenuItemType[],
) {
    const bible = bibleItem.filePath
        ? await Bible.fromFilePath(bibleItem.filePath)
        : null;
    if (bible === null) {
        showSimpleToast('Open Bible Item Context Menu', 'Unable to get bible');
        return;
    }
    const menuItem: ContextMenuItemType[] = [
        ...genBibleItemCopyingContextMenu(bibleItem),
        ...(openBibleLookup !== null
            ? [
                  {
                      menuElement: '`Lookup',
                      onSelect: async () => {
                          const viewController =
                              new LookupBibleItemController();
                          viewController.applyTargetOrBibleKey(
                              viewController.selectedBibleItem,
                              {
                                  bibleKey: bibleItem.bibleKey,
                              },
                          );
                          await viewController.setLookupContentFromBibleItem(
                              bibleItem,
                          );
                          openBibleLookup();
                      },
                  },
              ]
            : []),
        {
            menuElement: '`Duplicate',
            onSelect: () => {
                bible.duplicate(index);
                bible.save();
            },
        },
        ...genShowOnScreensContextMenu((event) => {
            ScreenBibleManager.handleBibleItemSelecting(event, bibleItem, true);
        }),
        {
            menuElement: '`Move To',
            onSelect: (event1: any) => {
                moveBibleItemTo(event1, bible, bibleItem);
            },
        },
        {
            menuElement: '`Delete',
            onSelect: async () => {
                await bible.deleteBibleItem(bibleItem);
                if (bibleItem.filePath !== undefined) {
                    attachBackgroundManager.detachBackground(
                        bibleItem.filePath,
                        bibleItem.id,
                    );
                }
            },
        },
    ];
    if (index !== 0) {
        menuItem.push({
            menuElement: '`Move up',
            onSelect: () => {
                bible.swapItems(index, index - 1);
                bible.save();
            },
        });
    }
    if (index !== bible.itemsLength - 1) {
        menuItem.push({
            menuElement: '`Move down',
            onSelect: () => {
                bible.swapItems(index, index + 1);
                bible.save();
            },
        });
    }
    showAppContextMenu(event, [...extraMenuItems, ...menuItem]);
}

export async function getOnScreenBibleItems() {
    const allScreenManager = getAllScreenManagers();
    let titleList: string[] = [];
    for (const screenManager of allScreenManager) {
        for (const bibleItemDataList of Object.values(
            screenManager.screenBibleManager.screenViewData?.bibleItemData ??
                {},
        )) {
            if (Array.isArray(bibleItemDataList)) {
                for (const bibleItemData of bibleItemDataList) {
                    titleList.push(bibleItemData.title);
                }
            } else {
                titleList.push(
                    await bibleRenderHelper.toTitle(
                        bibleItemDataList.bibleKey,
                        bibleItemDataList.target,
                    ),
                );
            }
        }
    }
    titleList = Array.from(new Set(titleList));
    return titleList;
}

export async function checkIsBibleItemOnScreen(items: BibleItem[]) {
    const titleList = await getOnScreenBibleItems();
    for (const bibleItem of items) {
        if (titleList.includes(await bibleItem.toTitle())) {
            return true;
        }
    }
    return false;
}

export function useIsOnScreen(items: BibleItem[]) {
    const [isOnScreen, setIsOnScreen] = useState(false);
    useAppEffectAsync(async () => {
        setIsOnScreen(await checkIsBibleItemOnScreen(items));
    }, [items]);
    useScreenUpdateEvents(undefined, async () => {
        setIsOnScreen(await checkIsBibleItemOnScreen(items));
    });
    return isOnScreen;
}
