import BibleItem from '../bible-list/BibleItem';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { DEFAULT_LANG_CODE, tran } from '../lang/langHelpers';
import type { BibleItemRenderingType } from './bibleScreenComps';
import bibleScreenHelper from './bibleScreenHelpers';
import type ScreenLongTextManager from './managers/ScreenLongTextManager';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { addPlayToBottom, addToTheTop } from './screenHelpers';
import { getDisplayByScreenId } from './managers/screenHelpers';
import type { BibleItemType } from '../bible-list/bibleItemHelpers';
import { cloneJson } from '../helper/helpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { genContextMenuBibleKeys } from '../bible-lookup/BibleKeySelectionComp';
import type { BibleItemDataType } from './screenTypeHelpers';
import {
    checkIsLongTextData,
    getBibleItemData,
    toLongTextColumns,
} from './screenLongTextTypeHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';
import type { ScrollPercentageType } from './managers/screenScrollSyncHelpers';
import {
    alignScreenBibleColumns,
    followScreenBibleHost,
    getScreenBibleColumns,
    wireScreenBibleColumns,
} from './screenBibleColumnHelpers';
import appProvider from '../server/appProvider';
import {
    BIBLE_SHOWN_CHAPTER_COUNT,
    checkIsCrossChapterTarget,
    getTargetChapterCount,
} from '../helper/bible-helpers/bibleTargetHelpers';

// `selected` is a long text's alone: the row its panel lights a button for.
// A Bible verse is marked far more often (the Reader follows it) and nothing
// outside the layer draws that mark, so it fires nothing.
export type ScreenLongTextManagerEventType =
    'update' | 'text-style' | 'selected';

export const SCREEN_BIBLE_SETTING_PREFIX = 'screen-bible-';

export function onSelectKey(
    screenLongTextManager: ScreenLongTextManager,
    selectedKJVVerseKey: string | null,
    isToTop: boolean,
) {
    screenLongTextManager.isToTop = isToTop;
    screenLongTextManager.selectedKJVVerseKey = selectedKJVVerseKey;
    screenLongTextManager.sendSyncSelectedIndex(isToTop ? 'top' : null);
}

async function applyBibleItems(
    screenLongTextManager: ScreenLongTextManager,
    bibleItemData: BibleItemDataType,
    newBibleKeys: string[],
) {
    const bibleItemJson = bibleItemData.bibleItemData?.bibleItem;
    if (bibleItemJson === undefined) {
        showAppAlert(
            tran('Fail to get bible item data'),
            'We were sorry, but we are unable to get bible item data at ' +
                'the moment please try again later',
        );
        return;
    }
    // Another version of the SAME passage: as many chapters as were shown.
    const newScreenViewItemData = await bibleItemJsonToScreenViewData(
        bibleItemJson,
        newBibleKeys,
        bibleItemData.shownChapterCount,
    );
    screenLongTextManager.screenViewData = newScreenViewItemData;
}

async function onBibleSelect(
    screenLongTextManager: ScreenLongTextManager,
    event: any,
    index: number,
    bibleItemData: BibleItemDataType,
) {
    const bibleRenderingList = bibleItemData.bibleItemData
        ?.renderedList as BibleItemRenderingType[];
    const excludeBibleKeys = bibleRenderingList.map(({ bibleKey }) => {
        return bibleKey;
    });
    const handleBibleKeySelection = async (event1: any, bibleKey: string) => {
        if (event1.shiftKey) {
            excludeBibleKeys.push(bibleKey);
        } else {
            excludeBibleKeys[index] = bibleKey;
        }
        applyBibleItems(screenLongTextManager, bibleItemData, excludeBibleKeys);
    };
    const bibleKeyMenuItems = await genContextMenuBibleKeys(
        handleBibleKeySelection,
        excludeBibleKeys,
    );
    if (bibleKeyMenuItems === null) {
        return;
    }
    const menuItems: ContextMenuItemType[] = [
        ...(bibleRenderingList.length > 1
            ? [
                  {
                      childBefore: genContextMenuItemIcon('x-lg', {
                          color: 'red',
                      }),
                      title: tran('Remove'),
                      menuElement: (
                          <span
                              style={{ color: 'red' }}
                              data-bible-key-ff={
                                  bibleRenderingList[index].bibleKey
                              }
                          >
                              {bibleRenderingList[index].bibleKey}
                          </span>
                      ),
                      onSelect: async () => {
                          excludeBibleKeys.splice(index, 1);
                          applyBibleItems(
                              screenLongTextManager,
                              bibleItemData,
                              excludeBibleKeys,
                          );
                      },
                  },
                  {
                      menuElement: elementDivider,
                  },
              ]
            : []),
        {
            childBefore: genContextMenuItemIcon('lightbulb'),
            menuElement: <span>{tran('Shift Click to Add')}</span>,
            disabled: true,
        },
        {
            menuElement: elementDivider,
        },
        ...bibleKeyMenuItems,
    ];
    showAppContextMenu(event, menuItems);
}

/**
 * The `...` label of a passage with chapters still to show, or `undefined`.
 * Only ever in the window that holds the operator's view: the projector
 * draws the chapters it is given and nothing to press.
 */
function genMoreChapterLabel(screenViewData: BibleItemDataType) {
    // A screen's data comes back from a setting file: tolerate it partial.
    const target = screenViewData.bibleItemData?.bibleItem?.target;
    if (appProvider.isPageScreen || target === undefined) {
        return undefined;
    }
    const shownChapterCount =
        screenViewData.shownChapterCount ?? BIBLE_SHOWN_CHAPTER_COUNT;
    if (shownChapterCount >= getTargetChapterCount(target)) {
        return undefined;
    }
    return tran('Show the next chapter');
}

// The content is laid out at the display's size and scaled to the box it is
// shown in: `parent*` is that box, `width` x `height` the layout.
function genScaledContainer(
    content: Element,
    {
        parentWidth,
        parentHeight,
        width,
        height,
    }: {
        parentWidth: number;
        parentHeight: number;
        width: number;
        height: number;
    },
) {
    const divHaftScale = document.createElement('div');
    divHaftScale.appendChild(content);
    Object.assign(divHaftScale.style, {
        width: `${width}px`,
        height: `${height}px`,
        transform: 'translate(-50%, -50%)',
    });
    const scale = parentWidth / width;
    const divContainer = document.createElement('div');
    divContainer.appendChild(divHaftScale);
    Object.assign(divContainer.style, {
        position: 'absolute',
        width: `${parentWidth}px`,
        height: `${parentHeight}px`,
        transform: `scale(${scale},${scale}) translate(50%, 50%)`,
    });
    return divContainer;
}

export async function renderScreenLongTextManager(
    screenLongTextManager: ScreenLongTextManager,
) {
    const { div } = screenLongTextManager;
    if (div === null) {
        return;
    }
    const sendScroll = (
        domSelector: string,
        scroll: ScrollPercentageType,
        isFromWheel: boolean,
    ) => {
        screenLongTextManager.sendSyncScrollPercentage(
            domSelector,
            scroll,
            isFromWheel,
        );
    };
    const screenViewData = screenLongTextManager.screenViewData;
    const clearDiv = () => {
        if (div.lastChild !== null) {
            for (const child of Array.from(div.children)) {
                child.remove();
            }
        }
        wireScreenBibleColumns(div, [], sendScroll);
        div.style.pointerEvents = 'none';
    };
    if (screenViewData === null) {
        clearDiv();
        return;
    }
    div.style.pointerEvents = 'auto';
    let newDiv: HTMLDivElement | null = null;
    const bibleItemData = getBibleItemData(screenViewData);
    if (checkIsLongTextData(screenViewData)) {
        // Row by row whatever this screen's Line Sync says: the languages
        // of one text are read side by side, section for section. Decided
        // by what it IS, because the setting is each page's own copy and a
        // showing screen would not hear it change.
        newDiv = await bibleScreenHelper.genHtmlFromLongTextColumns(
            toLongTextColumns(screenViewData),
            { isLineSync: true, isLongText: true },
        );
    } else if (bibleItemData !== undefined) {
        newDiv = await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
            bibleItemData.renderedList,
            screenLongTextManager.isLineSync,
            screenViewData.type === 'bible-item'
                ? genMoreChapterLabel(screenViewData)
                : undefined,
        );
    }
    if (newDiv === null) {
        // Something this build cannot draw (a kind a newer one sent): an
        // empty layer, not the passage that was up before it.
        clearDiv();
        return;
    }
    bibleScreenHelper.registerHighlight(newDiv, {
        onSelectKey: (selectedKJVVerseKey, isToTop) => {
            onSelectKey(screenLongTextManager, selectedKJVVerseKey, isToTop);
        },
        // Only a Bible's header chip is wired (`div.bible-name`); a long
        // text's is a language code and opens nothing.
        onBibleSelect: (event: any, index) => {
            if (screenViewData.type === 'bible-item') {
                onBibleSelect(
                    screenLongTextManager,
                    event,
                    index,
                    screenViewData,
                );
            }
        },
        onShowMoreChapter: () => {
            screenLongTextManager.showMoreBibleChapter();
        },
    });
    const { screenManagerBase } = screenLongTextManager;
    const parentWidth = screenManagerBase.width;
    const parentHeight = screenManagerBase.height;
    const { bounds } = getDisplayByScreenId(screenLongTextManager.screenId);
    const width = bounds.width;
    const height = bounds.height;
    // Several Bibles, not row by row: every column scrolls by itself, so
    // each is scaled inside its own scroller.
    const columns = getScreenBibleColumns(newDiv);
    let content: HTMLElement = newDiv;
    if (columns.length > 1) {
        for (const column of columns) {
            const table = column.firstElementChild;
            if (table !== null) {
                column.appendChild(
                    genScaledContainer(table, {
                        parentWidth: parentWidth / columns.length,
                        parentHeight,
                        width: width / columns.length,
                        height,
                    }),
                );
            }
        }
    } else {
        content = genScaledContainer(newDiv, {
            parentWidth,
            parentHeight,
            width,
            height,
        });
    }
    for (const child of Array.from(div.children)) {
        child.remove();
    }
    div.appendChild(content);
    // The host column, or `div` itself when everything scrolls as one.
    const scroller = wireScreenBibleColumns(
        div,
        columns,
        sendScroll,
        toLongTextColumns(screenViewData).length,
    );
    screenLongTextManager.renderSelectedIndex();
    scroller.scrollTop =
        screenLongTextManager.scroll *
        (scroller.scrollHeight - scroller.clientHeight);
    alignScreenBibleColumns(div);
    addToTheTop(scroller);
    addPlayToBottom(scroller, (scrollTop, isPlaying) => {
        screenLongTextManager.sendAutoScrollPosition(
            scroller,
            scrollTop,
            isPlaying,
        );
        followScreenBibleHost(div);
    });
}

export async function bibleItemToScreenViewData(
    bibleItems: BibleItem[],
    shownChapterCount = BIBLE_SHOWN_CHAPTER_COUNT,
): Promise<BibleItemDataType> {
    const bibleRenderingList = await bibleScreenHelper.genBibleItemRenderList(
        bibleItems,
        shownChapterCount,
    );
    const bibleKey = bibleItems[0].bibleKey || null;
    const locale =
        bibleKey === null ? DEFAULT_LANG_CODE : await getBibleLocale(bibleKey);
    const isCrossChapter = checkIsCrossChapterTarget(bibleItems[0].target);
    return {
        type: 'bible-item',
        locale,
        bibleItemData: {
            renderedList: bibleRenderingList,
            bibleItem: bibleItems[0].toJson(),
        },
        scroll: 0,
        selectedKJVVerseKey: null,
        ...(isCrossChapter ? { shownChapterCount } : {}),
    };
}

export async function bibleItemJsonToScreenViewData(
    bibleItemJson: BibleItemType,
    bibleKeys: string[],
    shownChapterCount?: number,
) {
    const newBibleKeys = cloneJson(bibleKeys);
    if (newBibleKeys.length === 0) {
        return await bibleItemToScreenViewData(
            [BibleItem.fromJson(bibleItemJson)],
            shownChapterCount,
        );
    }
    const newBibleItems = newBibleKeys.map((bibleKey1) => {
        const bibleItem = BibleItem.fromJson(bibleItemJson);
        bibleItem.bibleKey = bibleKey1;
        return bibleItem;
    });
    return await bibleItemToScreenViewData(newBibleItems, shownChapterCount);
}
