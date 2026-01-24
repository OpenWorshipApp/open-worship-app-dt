import BibleItem from '../bible-list/BibleItem';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { tran } from '../lang/langHelpers';
import type { BibleItemRenderingType } from './bibleScreenComps';
import bibleScreenHelper from './bibleScreenHelpers';
import type ScreenBibleManager from './managers/ScreenBibleManager';
import { showAppAlert } from '../popup-widget/popupWidgetHelpers';
import { addPlayToBottom, addToTheTop } from './screenHelpers';
import { getDisplayByScreenId } from './managers/screenHelpers';
import type { BibleItemType } from '../bible-list/bibleItemHelpers';
import { cloneJson } from '../helper/helpers';
import { elementDivider } from '../context-menu/AppContextMenuComp';
import { genContextMenuBibleKeys } from '../bible-lookup/BibleSelectionComp';
import type { BibleItemDataType } from './screenTypeHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleLogicHelpers2';

export type ScreenBibleManagerEventType = 'update' | 'text-style';

export const SCREEN_BIBLE_SETTING_PREFIX = 'screen-bible-';

export function onSelectKey(
    screenBibleManager: ScreenBibleManager,
    selectedKJVVerseKey: string | null,
    isToTop: boolean,
) {
    screenBibleManager.isToTop = isToTop;
    screenBibleManager.selectedKJVVerseKey = selectedKJVVerseKey;
    screenBibleManager.sendSyncSelectedIndex();
}

async function applyBibleItems(
    screenBibleManager: ScreenBibleManager,
    bibleItemData: BibleItemDataType,
    newBibleKeys: string[],
) {
    const bibleItemJson = bibleItemData.bibleItemData?.bibleItem;
    if (bibleItemJson === undefined) {
        showAppAlert(
            'Fail to get bible item data',
            'We were sorry, but we are unable to get bible item data at ' +
                'the moment please try again later',
        );
        return;
    }
    const newScreenViewItemData = await bibleItemJsonToScreenViewData(
        bibleItemJson,
        newBibleKeys,
    );
    screenBibleManager.screenViewData = newScreenViewItemData;
}

async function onBibleSelect(
    screenBibleManager: ScreenBibleManager,
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
        applyBibleItems(screenBibleManager, bibleItemData, excludeBibleKeys);
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
                      childBefore: (
                          <i className="bi bi-x-lg" style={{ color: 'red' }} />
                      ),
                      title: tran('Remove'),
                      menuElement: (
                          <span
                              style={{ color: 'red' }}
                              data-bible-key={
                                  bibleRenderingList[index].bibleKey
                              }
                          >
                              {bibleRenderingList[index].bibleKey}
                          </span>
                      ),
                      onSelect: async () => {
                          excludeBibleKeys.splice(index, 1);
                          applyBibleItems(
                              screenBibleManager,
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
            childBefore: (
                <i
                    className="bi bi-lightbulb"
                    style={{
                        color: 'var(--bs-info-text-emphasis)',
                    }}
                />
            ),
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

export async function renderScreenBibleManager(
    screenBibleManager: ScreenBibleManager,
) {
    const { div } = screenBibleManager;
    if (div === null) {
        return;
    }
    const screenViewData = screenBibleManager.screenViewData;
    if (screenViewData === null) {
        if (div.lastChild !== null) {
            for (const child of Array.from(div.children)) {
                child.remove();
            }
        }
        div.style.pointerEvents = 'none';
        return;
    }
    div.style.pointerEvents = 'auto';
    let newDiv: HTMLDivElement | null = null;
    if (
        screenViewData.type === 'bible-item' &&
        screenViewData.bibleItemData !== undefined
    ) {
        newDiv = await bibleScreenHelper.genHtmlFromScreenViewBibleItem(
            screenViewData.bibleItemData.renderedList,
            screenBibleManager.isLineSync,
        );
    }
    if (newDiv === null) {
        return;
    }
    bibleScreenHelper.registerHighlight(newDiv, {
        onSelectKey: (selectedKJVVerseKey, isToTop) => {
            onSelectKey(screenBibleManager, selectedKJVVerseKey, isToTop);
        },
        onBibleSelect: (event: any, index) => {
            onBibleSelect(screenBibleManager, event, index, screenViewData);
        },
    });
    const divHaftScale = document.createElement('div');
    divHaftScale.appendChild(newDiv);
    const { screenManagerBase } = screenBibleManager;
    const parentWidth = screenManagerBase.width;
    const parentHeight = screenManagerBase.height;
    const { bounds } = getDisplayByScreenId(screenBibleManager.screenId);
    const width = bounds.width;
    const height = bounds.height;
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
    for (const child of Array.from(div.children)) {
        child.remove();
    }
    div.appendChild(divContainer);
    screenBibleManager.renderScroll(true);
    screenBibleManager.renderSelectedIndex();
    addToTheTop(div);
    addPlayToBottom(div);
}

export async function bibleItemToScreenViewData(
    bibleItems: BibleItem[],
): Promise<BibleItemDataType> {
    const bibleRenderingList =
        await bibleScreenHelper.genBibleItemRenderList(bibleItems);
    const bibleKey = bibleItems[0].bibleKey || null;
    const locale = bibleKey === null ? 'en' : await getBibleLocale(bibleKey);
    return {
        type: 'bible-item',
        locale,
        bibleItemData: {
            renderedList: bibleRenderingList,
            bibleItem: bibleItems[0].toJson(),
        },
        scroll: 0,
        selectedKJVVerseKey: null,
    };
}

export async function bibleItemJsonToScreenViewData(
    bibleItemJson: BibleItemType,
    bibleKeys: string[],
) {
    const newBibleKeys = cloneJson(bibleKeys);
    if (newBibleKeys.length === 0) {
        return await bibleItemToScreenViewData([
            BibleItem.fromJson(bibleItemJson),
        ]);
    }
    const newBibleItems = newBibleKeys.map((bibleKey1) => {
        const bibleItem = BibleItem.fromJson(bibleItemJson);
        bibleItem.bibleKey = bibleKey1;
        return bibleItem;
    });
    return await bibleItemToScreenViewData(newBibleItems);
}
