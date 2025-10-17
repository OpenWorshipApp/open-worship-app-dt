import './AppContextMenuComp.scss';

import { ReactElement, useState, ReactNode, CSSProperties } from 'react';

import KeyboardEventListener, {
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { getWindowDim } from '../helper/helpers';
import WindowEventListener from '../event/WindowEventListener';
import { useAppEffect } from '../helper/debuggerHelpers';
import { OptionalPromise } from '../helper/typeHelpers';
import { genSelectedTextContextMenus } from '../helper/textSelectionHelpers';

export type ContextMenuEventType = MouseEvent;
export type ContextMenuItemType = {
    id?: string;
    menuElement: ReactNode | string;
    title?: string;
    onSelect?: (
        event: MouseEvent | KeyboardEvent,
        data?: any,
    ) => OptionalPromise<void>;
    disabled?: boolean;
    childBefore?: ReactElement;
    childAfter?: ReactElement;
    style?: CSSProperties;
};
export type OptionsType = {
    maxHeigh?: number;
    coord?: { x: number; y: number };
    style?: CSSProperties;
    noKeystroke?: boolean;
    applyOnTab?: boolean;
    shouldHandleSelectedText?: boolean;
    extraSelectedTextContextMenuItems?: ContextMenuItemType[];
};

export type PropsType = {
    event: MouseEvent;
    items: ContextMenuItemType[];
    onClose: () => void;
    options?: OptionsType;
};

export function createMouseEvent(clientX: number, clientY: number) {
    return new MouseEvent('click', {
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
        view: window,
    });
}

export const setPositionMenu = (
    menu: HTMLElement,
    event: MouseEvent,
    options?: OptionsType,
) => {
    if (menu !== null) {
        Object.assign(menu.style, {
            display: 'block',
            left: '',
            right: '',
            top: '',
            bottom: '',
        });
        event.preventDefault();
        event.stopPropagation();
        const x = options?.coord?.x ?? event.clientX;
        const y = options?.coord?.y ?? event.clientY;
        const rect = menu.getBoundingClientRect();
        const windowDim = getWindowDim();
        let maxWidth;
        let maxHeight;
        if (x > windowDim.width / 2 && x + rect.width > windowDim.width) {
            menu.style.right = `${windowDim.width - x}px`;
            maxWidth = x;
        } else {
            menu.style.left = `${x}px`;
            maxWidth = windowDim.width - x;
        }
        if (y > windowDim.height / 2 && y + rect.height > windowDim.height) {
            menu.style.bottom = `${windowDim.height - y}px`;
            maxHeight = y;
        } else {
            menu.style.top = `${y}px`;
            maxHeight = windowDim.height - y;
        }
        menu.style.maxWidth = `${Math.min(maxWidth, 210)}px`;
        menu.style.maxHeight = `${maxHeight}px`;
        if (options?.maxHeigh) {
            menu.style.maxHeight = `${options.maxHeigh}px`;
        }
        menu.scrollTop = 0;
        if (options?.style) {
            Object.assign(menu.style, options.style);
        }
    }
};

export const contextControl: {
    setDataDelegator: ((data: PropsType | null) => void) | null;
} = {
    setDataDelegator: null,
};

export type AppContextMenuControlType = {
    promiseDone: Promise<void>;
    closeMenu: () => void;
};

export function showAppContextMenu(
    event: MouseEvent,
    items: ContextMenuItemType[],
    options?: OptionsType,
): AppContextMenuControlType {
    event.stopPropagation();
    if (options?.shouldHandleSelectedText) {
        items = genSelectedTextContextMenus(
            options.extraSelectedTextContextMenuItems,
        ).concat(items);
    }
    if (!items.length) {
        return {
            promiseDone: Promise.resolve(),
            closeMenu: () => {},
        };
    }
    const closeMenu = () => {
        contextControl.setDataDelegator?.(null);
    };
    const promise = new Promise<void>((resolve) => {
        const onClose = () => {
            closeMenu();
            KeyboardEventListener.unregisterEventListener(escEvent);
            resolve();
        };
        contextControl.setDataDelegator?.({
            event,
            items,
            onClose,
            options,
        });
        const eventName = KeyboardEventListener.toEventMapperKey({
            key: 'Escape',
        });
        const escEvent = KeyboardEventListener.registerEventListener(
            [eventName],
            onClose,
        );
    });
    return { promiseDone: promise, closeMenu };
}

export const APP_CONTEXT_MENU_ID = 'app-context-menu-container';
export const APP_CONTEXT_MENU_CLASS = 'app-context-menu';
export const APP_CONTEXT_MENU_ITEM_CLASS = 'app-context-menu-item';
export const highlightClass = 'app-border-whiter-round';

function getMenuContainer() {
    const tableDiv = document.querySelector(
        `#${APP_CONTEXT_MENU_ID} .${APP_CONTEXT_MENU_CLASS}`,
    );
    return tableDiv;
}

function getDomItems() {
    const allChildren = Array.from<HTMLDivElement>(
        document.querySelectorAll(
            `#${APP_CONTEXT_MENU_ID} .${APP_CONTEXT_MENU_ITEM_CLASS}`,
        ),
    );
    const index =
        allChildren.findIndex((item) => {
            return item.classList.contains(highlightClass);
        }) ?? -1;
    return { index, allChildren, selectedItem: allChildren[index] ?? null };
}
function appKeyUpDown(isUp: boolean) {
    const domData = getDomItems();
    const { allChildren } = domData;
    let { index } = domData;
    index += (isUp ? -1 : 1) + allChildren.length;
    index %= allChildren.length;
    allChildren.forEach((item) => {
        item.classList.remove(highlightClass);
    });
    allChildren[index].classList.add(highlightClass);
    setTimeout(() => {
        allChildren[index].scrollIntoView({
            block: 'nearest',
        });
        const tableDiv = getMenuContainer();
        (tableDiv as any)?.focus();
    }, 100);
}
function checkKeyUpDown(event: any, data: PropsType) {
    const apply = (item: ContextMenuItemType) => {
        stopEvent();
        contextControl.setDataDelegator?.(null);
        if (item.disabled) {
            return;
        }
        item.onSelect?.(event);
    };
    const stopEvent = () => {
        event.preventDefault();
        event.stopPropagation();
    };
    const { items, options } = data;
    if (options?.applyOnTab && ['Tab'].includes(event.key)) {
        const itemData = getDomItems();
        let index = itemData.index;
        if (index === -1) {
            index = 0;
        }
        const item = items[index];
        if (item !== undefined) {
            apply(item);
        }
        return;
    }
    if (['Enter'].includes(event.key)) {
        const menuContainer = getMenuContainer();
        if (menuContainer !== document.activeElement) {
            return;
        }
        const { index } = getDomItems();
        if (items[index] !== undefined) {
            apply(items[index]);
        }
        return;
    }
    stopEvent();
    const isUp = event.key === 'ArrowUp';
    appKeyUpDown(isUp);
}

export const escapeChars = [
    'enter',
    'escape',
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    'backspace',
    'tab',
    'insert',
    'delete',
    'home',
    'end',
    'pageup',
    'pagedown',
    'f1',
    'f2',
    'f3',
    'f4',
    'f5',
    'f6',
    'f7',
    'f8',
    'f9',
    'f10',
    'f11',
    'f12',
    'printscreen',
    'scrolllock',
    'pausebreak',
    'numlock',
    'capslock',
    'contextmenu',
];
let oldElement: HTMLElement | null = null;
function listener(event: KeyboardEvent) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }
    const key = event.key.toLowerCase();
    if (!key || escapeChars.includes(key)) {
        return;
    }
    const { allChildren } = getDomItems();
    const targetElements = allChildren.filter((element) => {
        return element.textContent?.toLowerCase().startsWith(key);
    });
    let index = targetElements.indexOf(oldElement as any);
    index = (index + 1 + targetElements.length) % targetElements.length;
    const foundElement = targetElements[index];
    if (foundElement === undefined) {
        return;
    }
    foundElement.scrollIntoView();
    oldElement = foundElement;
}

export function useAppContextMenuData() {
    const [data, setData] = useState<PropsType | null>(null);
    const setData1 = (newData: PropsType | null) => {
        WindowEventListener.fireEvent({
            widget: 'context-menu',
            state: newData === null ? 'close' : 'open',
        });
        setData(newData);
    };
    useAppEffect(() => {
        contextControl.setDataDelegator = (newData) => {
            setData1(newData);
        };
        if (data === null) {
            return;
        }
        const shouldKeystroke = !data.options?.noKeystroke;
        if (shouldKeystroke) {
            document.addEventListener('keydown', listener);
        }
        return () => {
            if (shouldKeystroke) {
                document.removeEventListener('keydown', listener);
            }
            contextControl.setDataDelegator = null;
        };
    }, [data]);
    useKeyboardRegistering(
        [
            { key: 'ArrowUp' },
            { key: 'ArrowDown' },
            { key: 'Tab' },
            { key: 'Enter' },
        ],
        (event) => {
            if (data === null) {
                return;
            }
            checkKeyUpDown(event, data);
        },
        [data],
    );
    return data;
}
