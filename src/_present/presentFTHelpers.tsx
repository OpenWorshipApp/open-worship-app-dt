import BibleItem, { BibleItemType } from '../bible-list/BibleItem';
import { getSetting, setSetting } from '../helper/settingHelper';
import { checkIsValidate } from '../lang';
import { createMouseEvent, showAppContextMenu } from '../others/AppContextMenu';
import bibleHelper from '../server/bible-helpers/bibleHelpers';
import appProviderPresent from './appProviderPresent';
import fullTextPresentHelper, {
    BibleRenderedType,
    LyricRenderedType,
} from './fullTextPresentHelper';
import PresentFTManager from './PresentFTManager';
import PresentManager from './PresentManager';

const ftDataTypeList = [
    'bible', 'lyric',
] as const;
export type FfDataType = typeof ftDataTypeList[number];
export type FTItemDataType = {
    type: FfDataType,
    bibleData?: {
        renderedList: BibleRenderedType[],
        bibleItem: BibleItemType,
    },
    lyricData?: {
        renderedList: LyricRenderedType[],
    },
    scroll: number,
    selectedIndex: number | null,
};
export type FTListType = {
    [key: string]: FTItemDataType;
};

export type PresentFTManagerEventType = 'update' | 'text-style';

export const settingName = 'present-ft-';

export function getFTList(): FTListType {
    const str = getSetting(`${settingName}-ft-data`, '{}');
    if (str !== '') {
        try {
            const json = JSON.parse(str);
            const validateBible = ({ renderedList, bibleItem }: any) => {
                BibleItem.validate(bibleItem);
                return !Array.isArray(renderedList)
                    || renderedList.some(({
                        locale, bibleName, title, verses,
                    }: any) => {
                        return !checkIsValidate(locale)
                            || typeof bibleName !== 'string'
                            || typeof title !== 'string'
                            || !Array.isArray(verses)
                            || verses.some(({ num, text }: any) => {
                                return typeof num !== 'string'
                                    || typeof text !== 'string';
                            });
                    });
            };
            const validateLyric = ({ renderedList }: any) => {
                return !Array.isArray(renderedList)
                    || renderedList.some(({
                        locale, title, items,
                    }: any) => {
                        return !checkIsValidate(locale)
                            || typeof title !== 'string'
                            || !Array.isArray(items)
                            || items.some(({ text }: any) => {
                                return typeof text !== 'string';
                            });
                    });
            };
            Object.values(json).forEach((item: any) => {
                if (!ftDataTypeList.includes(item.type)
                    || (item.type === 'bible' && validateBible(item.bibleData))
                    || (item.type === 'lyric' && validateLyric(item.lyricData))) {
                    console.log(item);
                    throw new Error('Invalid full-text data');
                }
            });
            return json;
        } catch (error) {
            appProviderPresent.appUtils
                .handleError(error);
        }
    }
    return {};
}
export function setFTList(ftList: FTListType) {
    const str = JSON.stringify(ftList);
    setSetting(`${settingName}-ft-data`, str);
}

function onSelectIndex(presentFTManager: PresentFTManager,
    selectedIndex: number | null) {
    presentFTManager.selectedIndex = selectedIndex;
    presentFTManager.sendSyncSelectedIndex();
}
async function onBibleSelect(presentFTManager: PresentFTManager,
    event: any, index: number, ftItemData: FTItemDataType) {
    const bibleRenderedList = ftItemData.bibleData?.renderedList as BibleRenderedType[];
    const bibleItemingList = bibleRenderedList.map(({ bibleName }) => {
        return bibleName;
    });
    const bibleList = await bibleHelper.getBibleListWithStatus();
    const bibleListFiltered = bibleList.filter(([bibleName]) => {
        return !bibleItemingList.includes(bibleName);
    });
    const bibleItemJson = ftItemData.bibleData?.bibleItem as BibleItemType;
    const applyBibleItems = async (newBibleNames: string[]) => {
        const newBibleItems = newBibleNames.map((bibleName1) => {
            const bibleItem = BibleItem.fromJson(bibleItemJson);
            bibleItem.bibleName = bibleName1;
            return bibleItem;
        });
        const newFtItemData = await bibleItemToFtData(newBibleItems);
        presentFTManager.ftItemData = newFtItemData;
    };
    showAppContextMenu(event,
        [
            ...bibleRenderedList.length > 1 ? [{
                title: 'Remove(' + bibleRenderedList[index].bibleName + ')',
                onClick: async () => {
                    bibleItemingList.splice(index, 1);
                    applyBibleItems(bibleItemingList);
                },
                otherChild: (<i className='bi bi-x-lg'
                    style={{ color: 'red' }} />),
            }] : [],
            ...bibleListFiltered.length > 0 ? [{
                title: 'Ship Click to Add',
                disabled: true,
            }] : [],
            ...bibleListFiltered.map(([bibleName, isAvailable]) => {
                return {
                    title: bibleName,
                    disabled: !isAvailable,
                    onClick: async (event1: any) => {
                        if (event1.shiftKey) {
                            bibleItemingList.push(bibleName);
                        } else {
                            bibleItemingList[index] = bibleName;
                        }
                        applyBibleItems(bibleItemingList);
                    },
                };
            }),
        ]);
}

export function renderPFTManager(presentFTManager: PresentFTManager) {
    if (presentFTManager.div === null) {
        return;
    }
    const ftItemData = presentFTManager.ftItemData;
    if (ftItemData === null) {
        if (presentFTManager.div.lastChild !== null) {
            const targetDiv = presentFTManager.div.lastChild as HTMLDivElement;
            targetDiv.remove();
        }
        return;
    }
    if (ftItemData.bibleData !== undefined) {
        const newTable = fullTextPresentHelper.genHtmlFTItem(
            ftItemData.bibleData.renderedList, PresentFTManager.isLineSync);
        fullTextPresentHelper.registerHighlight(newTable, {
            onSelectIndex: (selectedIndex) => {
                onSelectIndex(presentFTManager, selectedIndex);
            },
            onBibleSelect: async (event: any, index) => {
                onBibleSelect(presentFTManager, event, index, ftItemData);
            },
        });
        const divHaftScale = document.createElement('div');
        divHaftScale.appendChild(newTable);
        const parentWidth = presentFTManager.presentManager.width;
        const parentHeight = presentFTManager.presentManager.height;
        const { bounds } = PresentManager.getDisplayByPresentId(presentFTManager.presentId);
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
        Array.from(presentFTManager.div.children).forEach((child) => {
            child.remove();
        });
        presentFTManager.div.appendChild(divContainer);
        presentFTManager.renderScroll(true);
        presentFTManager.renderSelectedIndex();
    }
}

export async function bibleItemToFtData(bibleItems: BibleItem[]) {
    const bibleRenderedList = await fullTextPresentHelper.genRenderList(bibleItems);
    return {
        type: 'bible',
        bibleData: {
            renderedList: bibleRenderedList,
            bibleItem: bibleItems[0].toJson(),
        },
        scroll: 0,
        selectedIndex: null,
    } as FTItemDataType;
}

export function genMouseEvent(event: any): MouseEvent {
    if (event !== null) {
        return event;
    }
    const miniPresentScreen = document.getElementsByClassName('mini-present-screen')[0];
    if (miniPresentScreen !== undefined) {
        const rect = miniPresentScreen.getBoundingClientRect();
        return createMouseEvent(rect.x, rect.y);
    }
    return createMouseEvent(0, 0);
}
