import * as loggerHelpers from '../helper/loggerHelpers';
import BibleItem from '../bible-list/BibleItem';
import { BibleItemType } from '../bible-list/bibleItemHelpers';
import { screenManagerSettingNames } from '../helper/constants';
import { handleError } from '../helper/errorHelpers';
import { isValidJson } from '../helper/helpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { checkIsValidLocale } from '../lang';
import { createMouseEvent } from '../context-menu/appContextMenuHelpers';
import { BibleItemRenderingType } from './bibleScreenComps';
import {
    ScreenTransitionEffectType,
    TargetType,
} from './transitionEffectHelpers';
import { electronSendAsync, unlocking } from '../server/appHelpers';
import { getValidOnScreen } from './managers/screenManagerBaseHelpers';
import { VaryAppDocumentItemDataType } from '../app-document-list/appDocumentHelpers';
import appProvider from '../server/appProvider';
import {
    TO_THE_TOP_CLASSNAME,
    TO_THE_TOP_STYLE_STRING,
    applyToTheTop,
} from '../scrolling/scrollingHandlerHelpers';

export const bibleDataTypeList = ['bible-item', 'lyric'] as const;
export type BibleDataType = (typeof bibleDataTypeList)[number];
export type BibleItemDataType = {
    locale: string;
    type: BibleDataType;
    bibleItemData?: {
        renderedList: BibleItemRenderingType[];
        bibleItem: BibleItemType;
    };
    scroll: number;
    selectedKJVVerseKey: string | null;
};
export type BibleListType = {
    [key: string]: BibleItemDataType;
};

const _backgroundTypeList = ['color', 'image', 'video', 'sound'] as const;
export type BackgroundType = (typeof _backgroundTypeList)[number];
export type BackgroundSrcType = {
    type: BackgroundType;
    src: string;
    width?: number;
    height?: number;
};
export type BackgroundSrcListType = {
    [key: string]: BackgroundSrcType;
};

export type AlertDataType = {
    marqueeData: {
        text: string;
    } | null;
    countdownData: {
        dateTime: Date;
    } | null;
};
export type AlertSrcListType = {
    [key: string]: AlertDataType;
};

export type VaryAppDocumentItemScreenDataType = {
    filePath: string;
    itemJson: VaryAppDocumentItemDataType;
};
export type AppDocumentListType = {
    [key: string]: VaryAppDocumentItemScreenDataType;
};

export type BoundsType = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type DisplayType = {
    id: number;
    bounds: BoundsType;
};
export type AllDisplayType = {
    primaryDisplay: DisplayType;
    displays: DisplayType[];
};

export const screenTypeList = [
    'background',
    'vary-app-document',
    'bible-screen-view',
    'bible-screen-view-scroll',
    'bible-screen-view-text-style',
    'alert',
    'bible-screen-view-selected-index',
    'display-change',
    'visible',
    'init',
    'effect',
] as const;
export type ScreenType = (typeof screenTypeList)[number];
export type BasicScreenMessageType = {
    type: ScreenType;
    data: any;
};
export type ScreenMessageType = BasicScreenMessageType & {
    screenId: number;
};

const messageUtils = appProvider.messageUtils;

export function calMediaSizes(
    {
        parentWidth,
        parentHeight,
    }: {
        parentWidth: number;
        parentHeight: number;
    },
    {
        width,
        height,
    }: {
        width?: number;
        height?: number;
    },
) {
    if (width === undefined || height === undefined) {
        return {
            width: parentWidth,
            height: parentHeight,
            offsetH: 0,
            offsetV: 0,
        };
    }
    const scale = Math.max(parentWidth / width, parentHeight / height);
    const newWidth = width * scale;
    const newHeight = height * scale;
    const offsetH = (newWidth - parentWidth) / 2;
    const offsetV = (newHeight - parentHeight) / 2;
    return {
        width: newWidth,
        height: newHeight,
        offsetH,
        offsetV,
    };
}

type SetDisplayType = {
    screenId: number;
    displayId: number;
};
export function setDisplay({ screenId, displayId }: SetDisplayType) {
    messageUtils.sendData('main:app:set-screen-display', {
        screenId,
        displayId,
    });
}

export function getAllShowingScreenIds(): number[] {
    return messageUtils.sendDataSync('main:app:get-screens');
}
export function getAllDisplays(): AllDisplayType {
    return messageUtils.sendDataSync('main:app:get-displays');
}

type ShowScreenDataType = {
    screenId: number;
    displayId: number;
};
export function showScreen({ screenId, displayId }: SetDisplayType) {
    return electronSendAsync<void>('main:app:show-screen', {
        screenId,
        displayId,
    } as ShowScreenDataType);
}

export function hideScreen(screenId: number) {
    messageUtils.sendData('app:hide-screen', screenId);
}

export function hideAllScreens() {
    messageUtils.sendData('app:hide-all-screens');
}

export type PTEffectDataType = {
    target: TargetType;
    effect: ScreenTransitionEffectType;
};

export function genScreenMouseEvent(event?: any): MouseEvent {
    if (event) {
        return event;
    }
    const miniScreen = document.getElementsByClassName('mini-screen')[0];
    if (miniScreen !== undefined) {
        const rect = miniScreen.getBoundingClientRect();
        return createMouseEvent(rect.x, rect.y);
    }
    return createMouseEvent(0, 0);
}

export function getAlertDataListOnScreenSetting(): AlertSrcListType {
    const string = getSetting(screenManagerSettingNames.ALERT, '');
    try {
        if (!isValidJson(string, true)) {
            return {};
        }
        const json = JSON.parse(string);
        Object.values(json).forEach((item: any) => {
            const { countdownData } = item;
            if (
                !(
                    item.marqueeData === null ||
                    typeof item.marqueeData.text === 'string'
                ) ||
                !(
                    countdownData === null ||
                    typeof countdownData.dateTime === 'string'
                )
            ) {
                throw new Error('Invalid alert data');
            }
            if (countdownData?.dateTime) {
                countdownData.dateTime = new Date(countdownData.dateTime);
            }
        });
        return getValidOnScreen(json);
    } catch (error) {
        handleError(error);
    }
    return {};
}

export function getBackgroundSrcListOnScreenSetting(): BackgroundSrcListType {
    const str = getSetting(screenManagerSettingNames.BACKGROUND, '');
    if (isValidJson(str, true)) {
        const json = JSON.parse(str);
        const items = Object.values(json);
        if (
            items.every((item: any) => {
                return item.type && item.src;
            })
        ) {
            return getValidOnScreen(json);
        }
    }
    return {};
}

const validateBible = ({ renderedList, bibleItem }: any) => {
    BibleItem.validate(bibleItem);
    return (
        !Array.isArray(renderedList) ||
        renderedList.some(({ locale, bibleKey, title, verses }: any) => {
            return (
                !checkIsValidLocale(locale) ||
                typeof bibleKey !== 'string' ||
                typeof title !== 'string' ||
                !Array.isArray(verses) ||
                verses.some(({ num, text }: any) => {
                    return typeof num !== 'string' || typeof text !== 'string';
                })
            );
        })
    );
};

export function getBibleListOnScreenSetting(): BibleListType {
    const str = getSetting(screenManagerSettingNames.FULL_TEXT, '');
    try {
        if (!isValidJson(str, true)) {
            return {};
        }
        const json = JSON.parse(str);
        Object.values(json).forEach((item: any) => {
            if (
                !bibleDataTypeList.includes(item.type) ||
                (item.type === 'bible-item' &&
                    validateBible(item.bibleItemData))
            ) {
                loggerHelpers.error(item);
                throw new Error('Invalid bible-screen-view data');
            }
        });
        return getValidOnScreen(json);
    } catch (error) {
        unlocking(screenManagerSettingNames.FULL_TEXT, () => {
            setSetting(screenManagerSettingNames.FULL_TEXT, '');
        });
        handleError(error);
    }
    return {};
}

export function addToTheTop(div: HTMLDivElement) {
    const oldIcon = div.querySelector(`.${TO_THE_TOP_CLASSNAME}`);
    if (oldIcon) {
        const scrollCallback = (oldIcon as any)._scrollCallback;
        if (scrollCallback !== undefined) {
            div.removeEventListener('scroll', scrollCallback);
        }
        oldIcon.remove();
    }
    const style = document.createElement('style');
    style.innerHTML = TO_THE_TOP_STYLE_STRING;
    div.appendChild(style);
    const target = document.createElement('img');
    target.className = TO_THE_TOP_CLASSNAME;
    target.title = 'Scroll to the top';
    target.src = 'assets/arrow-up-circle.png';
    target.style.position = 'fixed';
    div.appendChild(target);
    applyToTheTop(target);
}
