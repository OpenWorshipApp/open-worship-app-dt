import { useMemo } from 'react';

import * as loggerHelpers from '../helper/loggerHelpers';
import BibleItem from '../bible-list/BibleItem';
import { screenManagerSettingNames } from '../helper/constants';
import { handleError } from '../helper/errorHelpers';
import { parseJsonSafely } from '../helper/helpers';
import { setSetting } from '../helper/settingHelpers';
import { genDerivedSettingReader } from '../helper/derivedSettingHelpers';
import { checkIsValidLocale, tran } from '../lang/langHelpers';
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
import { useAppCurrentRef, useAppStateAsync } from '../helper/appHooks';
import { useScreenUpdateEvents } from './managers/screenManagerHooks';
import type {
    ImageScaleType,
    ForegroundSrcListType,
    BackgroundSrcListType,
    BibleListType,
    SetDisplayType,
} from './screenTypeHelpers';
import { bibleDataTypeList } from './screenTypeHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

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
    loggerHelpers.appLog(scaleType);
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

// All three on-screen readers below are memoized on their raw setting strings
// (plus the screen-list setting, which `getValidOnScreen` filters against).
// They are read from React render bodies and from `checkIsAnythingOnScreen`,
// which asks all four at once — un-memoized that was eight full `JSON.parse`
// passes per presenting flow row per screen event. Each getter still returns a COPY,
// because the persist paths read the map, add or delete their own screen's key
// and write the whole thing back.
const readForegroundDataListOnScreen =
    genDerivedSettingReader<ForegroundSrcListType>(
        [
            screenManagerSettingNames.FOREGROUND,
            screenManagerSettingNames.MANAGERS,
        ],
        ([string]) => {
            try {
                const json = parseJsonSafely(string, true);
                if (json === null) {
                    return {};
                }
                return getValidOnScreen(json);
            } catch (error) {
                handleError(error);
            }
            return {};
        },
    );

export function getForegroundDataListOnScreenSetting(): ForegroundSrcListType {
    return { ...readForegroundDataListOnScreen() };
}

const readBackgroundSrcListOnScreen =
    genDerivedSettingReader<BackgroundSrcListType>(
        [
            screenManagerSettingNames.BACKGROUND,
            screenManagerSettingNames.MANAGERS,
        ],
        ([str]) => {
            const json = parseJsonSafely(str, true);
            if (json !== null) {
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
        },
    );

export function getBackgroundSrcListOnScreenSetting(): BackgroundSrcListType {
    return { ...readBackgroundSrcListOnScreen() };
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

const readBibleListOnScreen = genDerivedSettingReader<BibleListType>(
    [screenManagerSettingNames.FULL_TEXT, screenManagerSettingNames.MANAGERS],
    ([str]) => {
        try {
            const json = parseJsonSafely(str, true);
            if (json === null) {
                return {};
            }
            for (const item of Object.values(json)) {
                if (
                    !bibleDataTypeList.includes((item as any).type) ||
                    ((item as any).type === 'bible-item' &&
                        validateBible((item as any).bibleItemData))
                ) {
                    loggerHelpers.appError(item);
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
    },
);

export function getBibleListOnScreenSetting(): BibleListType {
    return { ...readBibleListOnScreen() };
}

function genCircleUpSVG(width = 16) {
    return `
<svg
    width="${width}"
    height="${width}"
    fill="currentColor"
    class="bi bi-arrow-up-circle"
    viewBox="0 0 16 16"
    version="1.1"
    id="svg1"
    sodipodi:docname="arrow-up-circle.svg"
    inkscape:export-filename="arrow-up-circle.png"
    inkscape:export-xdpi="450"
    inkscape:export-ydpi="450"
    inkscape:version="1.4 (e7c3feb1, 2024-10-09)"
    xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
    xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:svg="http://www.w3.org/2000/svg">
<defs
    id="defs1" />
<sodipodi:namedview
    id="namedview1"
    pagecolor="#999999"
    bordercolor="#666666"
    borderopacity="1.0"
    inkscape:showpageshadow="2"
    inkscape:pageopacity="0.0"
    inkscape:pagecheckerboard="0"
    inkscape:deskcolor="#d1d1d1"
    inkscape:zoom="36.681164"
    inkscape:cx="5.1525082"
    inkscape:cy="8.2058464"
    inkscape:window-width="1920"
    inkscape:window-height="979"
    inkscape:window-x="1920"
    inkscape:window-y="25"
    inkscape:window-maximized="1"
    inkscape:current-layer="svg1" />
<path
    fill-rule="evenodd"
    d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8m15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-7.5 3.5a.5.5 0 0 1-1 0V5.707L5.354 7.854a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 5.707z"
    id="path1"
    style="fill:#77777777" />
<circle
    cx="8"
    cy="8"
    r="7"
    id="circle2"
    style="fill:none;stroke:#77777777;stroke-width:1" />
</svg>
    `;
}

// Built once at module level as a static data URI; a per-render
// `URL.createObjectURL` blob would pin memory on every verse change unless
// revoked.
let toTheTopImageDataUrl: string | null = null;
function getToTheTopImageDataUrl() {
    toTheTopImageDataUrl ??=
        'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(genCircleUpSVG(70));
    return toTheTopImageDataUrl;
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
    target.title = tran('Scroll to the top');
    target.src = getToTheTopImageDataUrl();
    target.style.position = 'fixed';
    target.style.bottom = '80px';
    div.appendChild(target);
    applyToTheTop(target);
}

function genChevronDoubleDownSVG(width = 16) {
    return `
<svg
   width="${width}"
   height="${width}"
   fill="currentColor"
   class="bi bi-chevron-double-down"
   viewBox="0 0 16 16"
   version="1.1"
   id="svg2"
   sodipodi:docname="chevron-double-down.svg"
   inkscape:export-filename="chevron-double-down.png"
   inkscape:export-xdpi="450"
   inkscape:export-ydpi="450"
   inkscape:version="1.4 (e7c3feb1, 2024-10-09)"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <defs
     id="defs2" />
  <sodipodi:namedview
     id="namedview2"
     pagecolor="#888888"
     bordercolor="#666666"
     borderopacity="1.0"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:zoom="51.875"
     inkscape:cx="8.0096386"
     inkscape:cy="8"
     inkscape:window-width="1920"
     inkscape:window-height="979"
     inkscape:window-x="1920"
     inkscape:window-y="25"
     inkscape:window-maximized="1"
     inkscape:current-layer="svg2" />
  <path
     fill-rule="evenodd"
     d="M1.646 6.646a.5.5 0 0 1 .708 0L8 12.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"
     id="path1"
     style="fill:#777777" />
  <path
     fill-rule="evenodd"
     d="M1.646 2.646a.5.5 0 0 1 .708 0L8 8.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"
     id="path2"
     style="fill:#999999" />
</svg>
    `;
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
    target.title = tran('Play to bottom');
    const svgString = genChevronDoubleDownSVG(70);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    target.src = url;
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
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    // Callers rebuild the array every render, so identity says nothing — the
    // joined paths are what "same subject" means here.
    const filePathsKey = filePaths.join('|');
    const filePathsKeyRef = useAppCurrentRef(filePathsKey);
    const [isOnScreen, setIsOnScreen] = useAppStateAsync(async () => {
        if (filePaths.length === 0) {
            return false;
        }
        const isOnScreen = await checkIsOnScreen(filePaths);
        onUpdate?.(isOnScreen);
        return isOnScreen;
    }, [filePathsKey]);
    useScreenUpdateEvents(undefined, () => {
        attemptTimeout(async () => {
            const isOnScreen = await checkIsOnScreen(filePaths);
            // Answered for the paths held when the event fired. Being re-fed
            // different ones mid-check re-runs the guarded read above, so this
            // answer is not just stale — `onUpdate` would leak it out of the
            // hook to a caller now asking about another file.
            if (filePathsKey !== filePathsKeyRef.current) {
                return;
            }
            onUpdate?.(isOnScreen);
            setIsOnScreen(isOnScreen);
        });
    });
    return isOnScreen ?? false;
}

export function genVideoIDFromSrc(src: string) {
    const md5 = appProvider.systemUtils.generateMD5(src);
    return `video-${md5}`;
}

// Each stage gets its own accent, worn by BOTH its chip and the border around
// its preview pane — with several stages side by side that is the only quick
// way to tell which pane belongs to which chip. Fixed hexes rather than theme
// variables: these have to stay distinguishable from each other in light and
// dark alike, which the semantic bootstrap colours do not guarantee.
const STAGE_ACCENT_COLOR_LIST = [
    '#4dabf7',
    '#51cf66',
    '#ffa94d',
    '#cc5de8',
    '#ff6b6b',
    '#22b8cf',
    '#fcc419',
    '#f783ac',
];

export function getStageAccentColor(stage: number) {
    const index = Math.abs(stage) % STAGE_ACCENT_COLOR_LIST.length;
    return STAGE_ACCENT_COLOR_LIST[index];
}
