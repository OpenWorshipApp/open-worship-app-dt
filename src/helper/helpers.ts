import { useState } from 'react';

import { useAppEffect } from './debuggerHelpers';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { AppDocumentSourceAbs } from './AppEditableDocumentSourceAbs';
import { trace } from './loggerHelpers';
import appProvider from '../server/appProvider';
import {
    pathJoin,
    fsCheckFileExist,
    fsDeleteFile,
    fsCopyFilePathToPath,
} from '../server/fileHelpers';

export type MutationType = 'added' | 'attr-modified' | 'removed';

export const APP_FULL_VIEW_CLASSNAME = 'app-full-view';
export const APP_AUTO_HIDE_CLASSNAME = 'app-auto-hide';
export const RECEIVING_DROP_CLASSNAME = 'receiving-data-drop';
export const HIGHLIGHT_SELECTED_CLASSNAME = 'app-highlight-selected';

export const BIBLE_VERSE_TEXT_TITLE =
    'Click to highlight, double click or ' + 'Alt + click to bring to view';

export function getRandomUUID() {
    return (
        Math.random().toString(36).substring(2) +
        new Date().getTime().toString(36)
    );
}

export function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.round(Math.random() * 16)];
    }
    return color;
}
export const cloneJson = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
};

// https://stackoverflow.com/a/41698614/17066360
export function isVisible(elem: any) {
    const style = getComputedStyle(elem);
    if (style.display === 'none') {
        return false;
    }
    if (style.visibility !== 'visible') {
        return false;
    }
    if (parseInt(style.opacity) < 0.1) {
        return false;
    }
    if (
        elem.offsetWidth +
            elem.offsetHeight +
            elem.getBoundingClientRect().height +
            elem.getBoundingClientRect().width ===
        0
    ) {
        return false;
    }
    const elemCenter = {
        x: elem.getBoundingClientRect().left + elem.offsetWidth / 2,
        y: elem.getBoundingClientRect().top + elem.offsetHeight / 2,
    };
    if (elemCenter.x < 0) {
        return false;
    }
    const { documentElement } = document;
    if (elemCenter.x > (documentElement.clientWidth || window.innerWidth)) {
        return false;
    }
    if (elemCenter.y < 0) {
        return false;
    }
    if (elemCenter.y > (documentElement.clientHeight || window.innerHeight)) {
        return false;
    }
    let pointContainer = document.elementFromPoint(elemCenter.x, elemCenter.y);
    do {
        if (pointContainer === elem) {
            return true;
        }
        pointContainer = pointContainer?.parentNode as any;
    } while (pointContainer);
    return false;
}

export function getRotationDeg(str: string) {
    const match = RegExp(/rotate\((.+)deg\)/).exec(str);
    return match ? parseInt(match[1]) : 0;
}
export const removePX = (str: string) => {
    return parseInt(str.replace('px', ''));
};

export function genRandomString(length: number = 5) {
    let result = '';
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(
            Math.round(Math.random() * charactersLength),
        );
    }
    return result;
}

export function getWindowDim() {
    const { documentElement } = document;
    const width =
        window.innerWidth ||
        documentElement.clientWidth ||
        document.body.clientWidth;
    const height =
        window.innerHeight ||
        documentElement.clientHeight ||
        document.body.clientHeight;
    return { width, height };
}

export function useReadFileToData<T extends AppDocumentSourceAbs>(
    filePath: string | null,
) {
    const [data, setData] = useState<T | null | undefined>(null);
    useAppEffect(() => {
        if (filePath !== null) {
            const fileSource = FileSource.getInstance(filePath);
            fileSource.readFileJsonData().then((itemSource: any) => {
                setData(itemSource);
            });
        }
    }, [filePath]);
    return data;
}

export function getImageDim(src: string) {
    return new Promise<[number, number]>((resolve, reject) => {
        const img = document.createElement('img');
        img.src = src;
        img.onload = () => {
            resolve([img.naturalWidth, img.naturalHeight]);
        };
        img.onerror = () => {
            reject(new Error('Fail to load image:' + src));
        };
    });
}

export function getVideoDim(src: string) {
    return new Promise<[number, number]>((resolve, reject) => {
        const video = document.createElement('video');
        video.addEventListener(
            'loadedmetadata',
            () => {
                resolve([video.videoWidth, video.videoHeight]);
            },
            false,
        );
        video.onerror = () => {
            reject(new Error('Fail to load video:' + src));
        };
        video.src = src;
    });
}

export function toMaxId(ids: number[]) {
    if (ids.length === 0) {
        return 0;
    }
    return Math.max(...ids);
}

export function isValidJson(json: any, isSilent: boolean = false) {
    if (!json) {
        return false;
    }
    try {
        return JSON.parse(json);
    } catch (error) {
        handleError(error);
        if (!isSilent && json === '') {
            trace('Invalid Json:', json);
        }
        return false;
    }
}

export function isColor(strColor: string) {
    const s = new Option().style;
    s.color = strColor;
    return !!s.color;
}

export function freezeObject(obj: any) {
    if (!['object', 'array'].includes(typeof obj)) {
        return;
    }
    Object.freeze(obj);
    if (Array.isArray(obj)) {
        obj.forEach((item) => {
            freezeObject(item);
        });
    } else if (obj instanceof Object) {
        for (const key in obj) {
            freezeObject(obj[key]);
        }
    }
}

export function getHTMLChild<T extends HTMLElement>(
    parent: HTMLElement,
    tag: string,
) {
    const child = parent.querySelector(tag);
    if (!child) {
        throw new Error('Invalid child');
    }
    return child as T;
}

export function checkIsSameArrays(arr1: any, arr2: any) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
        return false;
    }
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (!checkIsSameObjects(arr1[i], arr2[i])) {
            return false;
        }
    }
    return true;
}

export function checkIsSameObjects(json1: any, json2: any) {
    if (!(json1 instanceof Object && json2 instanceof Object)) {
        return false;
    }
    for (const [key, value1] of Object.entries(json1)) {
        const value2 = json2[key];
        if (Array.isArray(value1)) {
            if (!checkIsSameArrays(value1, value2)) {
                return false;
            }
        } else if (value1 instanceof Object) {
            if (!checkIsSameObjects(value1, value2)) {
                return false;
            }
        } else if (value1 !== value2) {
            return false;
        }
    }
    return true;
}

export function checkIsSameValues(value1: any, value2: any) {
    if (Array.isArray(value1)) {
        return checkIsSameArrays(value1, value2);
    }
    if (value1 instanceof Object) {
        return checkIsSameObjects(value1, value2);
    }
    return value1 === value2;
}

export const menuTitleRevealFile = `Reveal in ${
    appProvider.systemUtils.isMac ? 'Finder' : 'File Explorer'
}`;

export function genTimeoutAttempt(timeMilliseconds: number = 1e3) {
    let timeoutId: any = null;
    let lastSchedule = Date.now() - timeMilliseconds - 1;
    return function (func: () => void, isImmediate: boolean = false) {
        if (Date.now() - lastSchedule > timeMilliseconds) {
            isImmediate = true;
        }
        lastSchedule = Date.now();
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (isImmediate) {
            func();
            return;
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            func();
        }, timeMilliseconds);
    };
}

export function downloadFile(
    url: string,
    filename: string,
    type: string,
    destinationPath: string,
    isOverwrite = true,
) {
    return new Promise<string>((resolve, reject) => {
        fetch(url)
            .then((response) => response.blob())
            .then(async (blob) => {
                const file = new File([blob], filename, { type });
                const dllPath = pathJoin(destinationPath, filename);

                if (isOverwrite && (await fsCheckFileExist(dllPath))) {
                    await fsDeleteFile(dllPath);
                }
                if (!(await fsCheckFileExist(dllPath))) {
                    await fsCopyFilePathToPath(file, destinationPath, filename);
                }
                resolve(dllPath);
            })
            .catch(reject);
    });
}

export function cumulativeOffset(element: HTMLElement | null) {
    let top = 0;
    let left = 0;
    do {
        if (!element) {
            break;
        }
        top += element.offsetTop ?? 0;
        left += element.offsetLeft ?? 0;
        element = element.offsetParent as HTMLElement;
    } while (element);
    return { top, left };
}

// TODO: this function does not work for async function
export function useAppPromise<T>(
    promise: Promise<T>,
    onError?: (error: any) => void,
) {
    const [state, setState] = useState<T | null | undefined>(undefined);
    useAppEffect(() => {
        if (state !== undefined) {
            return;
        }
        const timeOut = setTimeout(() => {
            if (state === undefined) {
                onError?.(
                    new Error('Promise timeout, please check your network'),
                );
                setState(null);
            }
        }, 5000); // 5 seconds
        promise
            .then((data) => {
                setState(data);
                clearTimeout(timeOut);
            })
            .catch((error) => {
                onError?.(error);
                setState(null);
                clearTimeout(timeOut);
            });
    }, [state, promise]);

    return state;
}

export function changeDragEventStyle(
    event: React.DragEvent<HTMLElement>,
    key: string,
    value: string,
) {
    ((event.currentTarget?.style ?? {}) as any)[key] = value;
}

export function stopDraggingState(event: any) {
    event.preventDefault();
    event.stopPropagation();
    changeDragEventStyle(event, 'opacity', '1');
}

export function bringDomToView(dom: Element, block: ScrollLogicalPosition) {
    dom.scrollIntoView({
        behavior: 'smooth',
        block,
    });
}

export function bringDomToNearestView(dom: Element) {
    bringDomToView(dom, 'nearest');
}

export function bringDomToTopView(dom: Element) {
    bringDomToView(dom, 'start');
}

export function bringDomToCenterView(dom: Element) {
    bringDomToView(dom, 'center');
}

export function bringDomToBottomView(dom: Element) {
    bringDomToView(dom, 'end');
}

function getVisibleDim(
    container: HTMLElement,
    target: HTMLElement,
    threshold: number,
) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const containerTop = containerRect.top + threshold;
    const containerBottom = containerRect.bottom - threshold;
    const targetTop = targetRect.top + threshold;
    const targetBottom = targetRect.bottom - threshold;
    return {
        targetTop,
        containerTop,
        targetBottom,
        containerBottom,
    };
}

export function checkIsVerticalPartialInvisible(
    container: HTMLElement,
    target: HTMLElement,
    threshold: number = 0,
) {
    const { targetTop, containerTop, targetBottom, containerBottom } =
        getVisibleDim(container, target, threshold);
    // targetTop < containerTop
    // or targetBottom > containerBottom
    return targetTop < containerTop || targetBottom > containerBottom;
}

export function checkIsVerticalPartialVisible(
    container: HTMLElement,
    target: HTMLElement,
    threshold: number = 0,
) {
    const { targetTop, containerTop, targetBottom, containerBottom } =
        getVisibleDim(container, target, threshold);
    // containerTop <= targetTop < containerBottom
    // or containerTop < targetBottom <= containerBottom
    return (
        (targetTop >= containerTop && targetTop < containerBottom) ||
        (targetBottom > containerTop && targetBottom <= containerBottom)
    );
}
