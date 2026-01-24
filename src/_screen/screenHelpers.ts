import * as loggerHelpers from '../helper/loggerHelpers';
import BibleItem from '../bible-list/BibleItem';
import { screenManagerSettingNames } from '../helper/constants';
import { handleError } from '../helper/errorHelpers';
import { isValidJson } from '../helper/helpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { checkIsValidLocale } from '../lang/langHelpers';
import { createMouseEvent } from '../context-menu/appContextMenuHelpers';
import { electronSendAsync } from '../server/appHelpers';
import { getValidOnScreen } from './managers/screenManagerBaseHelpers';
import appProvider from '../server/appProvider';
import {
    PLAY_TO_BOTTOM_CLASSNAME,
    TO_THE_TOP_CLASSNAME,
    TO_THE_TOP_STYLE_STRING,
    applyPlayToBottom,
    applyToTheTop,
} from '../scrolling/scrollingHandlerHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { useScreenUpdateEvents } from './managers/screenManagerHooks';
import type {
    ImageScaleType,
    AllDisplayType,
    ForegroundSrcListType,
    BackgroundSrcListType,
    BibleListType,
    SetDisplayType,
} from './screenTypeHelpers';
import { bibleDataTypeList } from './screenTypeHelpers';
import { checkIsDarkMode } from '../others/initHelpers';

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
    scaleType?: ImageScaleType,
) {
    if (width === undefined || height === undefined || scaleType === 'fill') {
        return {
            width: parentWidth,
            height: parentHeight,
            offsetH: 0,
            offsetV: 0,
        };
    }
    if (scaleType === 'fit') {
        const ratio = Math.min(parentWidth / width, parentHeight / height);
        const newWidth = width * ratio;
        const newHeight = height * ratio;
        return {
            width: newWidth,
            height: newHeight,
            offsetH: (parentWidth - newWidth) / 2,
            offsetV: (parentHeight - newHeight) / 2,
        };
    }
    loggerHelpers.log(scaleType);
    const scale = Math.max(parentWidth / width, parentHeight / height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);
    const offsetH = (parentWidth - newWidth) / 2;
    const offsetV = (parentHeight - newHeight) / 2;
    return {
        width: newWidth,
        height: newHeight,
        offsetH,
        offsetV,
    };
}

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

export function showScreen({ screenId, displayId }: SetDisplayType) {
    return electronSendAsync<void>('main:app:show-screen', {
        screenId,
        displayId,
    });
}

export function hideScreen(screenId: number) {
    messageUtils.sendData('app:hide-screen', screenId);
}

export function hideAllScreens() {
    messageUtils.sendData('app:hide-all-screens');
}

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

export function getForegroundDataListOnScreenSetting(): ForegroundSrcListType {
    const string = getSetting(screenManagerSettingNames.FOREGROUND) ?? '';
    try {
        if (!isValidJson(string, true)) {
            return {};
        }
        const json = JSON.parse(string);
        return getValidOnScreen(json);
    } catch (error) {
        handleError(error);
    }
    return {};
}

export function getBackgroundSrcListOnScreenSetting(): BackgroundSrcListType {
    const str = getSetting(screenManagerSettingNames.BACKGROUND) ?? '';
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
    const str = getSetting(screenManagerSettingNames.FULL_TEXT) ?? '';
    try {
        if (!isValidJson(str, true)) {
            return {};
        }
        const json = JSON.parse(str);
        for (const item of Object.values(json)) {
            if (
                !bibleDataTypeList.includes((item as any).type) ||
                ((item as any).type === 'bible-item' &&
                    validateBible((item as any).bibleItemData))
            ) {
                loggerHelpers.error(item);
                throw new Error('Invalid bible-screen-view data');
            }
        }
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
    if (oldIcon !== null) {
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
    const isDarkMode = checkIsDarkMode();
    target.src = `assets/arrow-up-circle${isDarkMode ? '-dark' : '-light'}.png`;
    target.style.position = 'fixed';
    target.style.bottom = '80px';
    div.appendChild(target);
    applyToTheTop(target);
}

export function addPlayToBottom(div: HTMLDivElement) {
    const oldIcon = div.querySelector(`.${PLAY_TO_BOTTOM_CLASSNAME}`);
    if (oldIcon !== null) {
        return;
    }
    const style = document.createElement('style');
    style.innerHTML = TO_THE_TOP_STYLE_STRING;
    div.appendChild(style);
    const target = document.createElement('img');
    target.className = PLAY_TO_BOTTOM_CLASSNAME;
    target.title = 'Play to bottom';
    const isDarkMode = checkIsDarkMode();
    target.src = `assets/chevron-double-down${isDarkMode ? '-dark' : '-light'}.png`;
    target.style.position = 'fixed';
    target.style.bottom = '0px';
    div.appendChild(target);
    applyPlayToBottom(target);
}

export function useFileSourceIsOnScreen(
    filePaths: string[],
    checkIsOnScreen: (filePaths: string[]) => Promise<boolean>,
    onUpdate?: (isOnScreen: boolean) => void,
) {
    const [isOnScreen, setIsOnScreen] = useAppStateAsync(async () => {
        const isOnScreen = await checkIsOnScreen(filePaths);
        onUpdate?.(isOnScreen);
        return isOnScreen;
    }, [filePaths]);
    useScreenUpdateEvents(undefined, async () => {
        const isOnScreen = await checkIsOnScreen(filePaths);
        onUpdate?.(isOnScreen);
        setIsOnScreen(isOnScreen);
    });
    return isOnScreen ?? false;
}
