import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import KeyboardEventListener from '../event/KeyboardEventListener';
import { tran } from '../lang/langHelpers';
import { pasteTextToInput } from '../server/appHelpers';
import type { MutationType } from './helpers';
import {
    APP_FULL_VIEW_CLASSNAME,
    APP_AUTO_HIDE_CLASSNAME,
    bringDomToNearestView,
    checkIsVerticalPartialInvisible,
    bringDomToCenterView,
    checkIsVerticalAtBottom,
} from './helpers';

const callBackListeners = new Set<
    (element: Node, type: MutationType) => void
>();
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
                for (const callback of callBackListeners) {
                    callback(node, 'added');
                }
            }
            for (const node of mutation.removedNodes) {
                for (const callback of callBackListeners) {
                    callback(node, 'removed');
                }
            }
        } else if (mutation.type === 'attributes') {
            for (const callback of callBackListeners) {
                callback(mutation.target, 'attr-modified');
            }
        }
    }
});
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
});
export function addDomChangeEventListener(
    callback: (element: Node, type: MutationType) => void,
) {
    callBackListeners.add(callback);
}
export function removeDomChangeEventListener(
    callback: (element: Node, type: MutationType) => void,
) {
    callBackListeners.delete(callback);
}

export function handleFullWidgetView(element: Node, type: MutationType) {
    if (
        type !== 'attr-modified' ||
        element instanceof HTMLElement === false ||
        !element.classList.contains(APP_FULL_VIEW_CLASSNAME)
    ) {
        return;
    }
    const registeredEvents = KeyboardEventListener.registerEventListener(
        [KeyboardEventListener.toEventMapperKey({ key: 'Escape' })],
        (event: KeyboardEvent) => {
            event.stopPropagation();
            event.preventDefault();
            KeyboardEventListener.unregisterEventListener(registeredEvents);
            element.classList.remove(APP_FULL_VIEW_CLASSNAME);
        },
    );
}

export function handleClassNameAction<T extends HTMLElement>(
    className: string,
    handle: (target: T) => void,
    element: Node,
    type: MutationType,
) {
    if (
        type !== 'attr-modified' ||
        element instanceof HTMLElement === false ||
        !element.classList.contains(className)
    ) {
        return;
    }
    handle(element as T);
}

export function handleActiveSelectedElementScrolling(target: Node) {
    if (target instanceof HTMLElement === false) {
        return;
    }
    const scrollContainerSelector = target.dataset.scrollContainerSelector;
    const container = scrollContainerSelector
        ? document.querySelector(scrollContainerSelector)
        : null;
    if (container instanceof HTMLElement) {
        const isPartialInvisible = checkIsVerticalPartialInvisible(
            container,
            target,
        );
        if (isPartialInvisible) {
            const isAtBottom = checkIsVerticalAtBottom(container, target);
            if (isAtBottom) {
                bringDomToCenterView(target);
                return;
            }
        }
    }
    bringDomToNearestView(target);
}

export function handleAutoHide(
    targetDom: HTMLDivElement,
    isLeftAligned = true,
) {
    const parentElement = targetDom.parentElement;
    if (parentElement === null) {
        return;
    }
    for (const el of parentElement.querySelectorAll('.auto-hide-button')) {
        el.remove();
    }
    targetDom.classList.add(APP_AUTO_HIDE_CLASSNAME);
    const clearButton = document.createElement('i');
    clearButton.className =
        'auto-hide-button bi bi-three-dots' +
        ' app-caught-hover-pointer app-round-icon';
    if (isLeftAligned) {
        clearButton.style.left = '5px';
    } else {
        clearButton.style.right = '5px';
    }
    clearButton.style.bottom = '5px';
    clearButton.style.position = 'absolute';
    clearButton.title = tran('Show');
    let timeoutId: any = null;
    const mouseEnterListener = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
    };
    const mouseLeaveListener = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            clearButton.style.display = 'block';
            targetDom.classList.remove('auto-hide-show');
            targetDom.removeEventListener('mouseleave', mouseLeaveListener);
            targetDom.removeEventListener('mouseenter', mouseEnterListener);
        }, 2000);
    };
    clearButton.onclick = () => {
        clearButton.style.display = 'none';
        targetDom.classList.add('auto-hide-show');
        targetDom.addEventListener('mouseleave', mouseLeaveListener);
        targetDom.addEventListener('mouseenter', mouseEnterListener);
    };
    parentElement.appendChild(clearButton);
}

export class HoverMotionHandler {
    map: WeakMap<HTMLElement, ResizeObserver>;
    static readonly topClassname = 'app-top-hover-motion';
    static readonly lowDisplayClassname = 'app-low-hover-display';
    static readonly lowVisibleClassname = 'app-low-hover-visible';
    forceShowClassname = 'force-show';
    constructor() {
        this.map = new WeakMap<HTMLElement, ResizeObserver>();
    }
    findParent(element: HTMLElement) {
        let parent = element.parentElement;
        while (parent !== null) {
            if (parent.className.includes(HoverMotionHandler.topClassname)) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return null;
    }

    checkParentWidth(
        parentElement: HTMLElement,
        element: HTMLElement,
        minWidth: number,
    ) {
        if (parentElement.offsetWidth <= minWidth) {
            element.classList.remove(this.forceShowClassname);
        } else {
            element.classList.add(this.forceShowClassname);
        }
    }

    init(element: HTMLElement) {
        if (this.map.has(element)) {
            return;
        }
        const parentElement = this.findParent(element);
        const minWidthString = element.dataset.minParentWidth;
        if (parentElement === null || minWidthString === undefined) {
            return;
        }
        const minWidth = Number.parseInt(minWidthString);
        const checkIt = this.checkParentWidth.bind(
            this,
            parentElement,
            element,
            minWidth,
        );
        const resizeObserver = new ResizeObserver(checkIt);
        resizeObserver.observe(parentElement);
        checkIt();
        this.map.set(element, resizeObserver);
    }
    listenForHoverMotion(element: Node) {
        if (element instanceof HTMLElement === false) {
            return;
        }
        for (const childElement of element.querySelectorAll(
            '[data-min-parent-width]',
        )) {
            if (
                childElement instanceof HTMLElement &&
                childElement.className.includes(
                    HoverMotionHandler.lowDisplayClassname,
                )
            ) {
                this.init(childElement);
            }
        }
    }
}

export class InputContextMenuHandler {
    init(inputElement: HTMLInputElement): void {
        inputElement.oncontextmenu = async (event: MouseEvent) => {
            const copiedText = (await navigator.clipboard.readText()).trim();
            const contextMenuItems: ContextMenuItemType[] = [];
            if (copiedText) {
                contextMenuItems.push({
                    childBefore: genContextMenuItemIcon('clipboard'),
                    menuElement: tran('Paste'),
                    onSelect: () => {
                        pasteTextToInput(inputElement, copiedText);
                    },
                });
            }
            if (inputElement.value.length > 0) {
                contextMenuItems.push({
                    childBefore: genContextMenuItemIcon('x'),
                    menuElement: tran('Clear'),
                    onSelect: () => {
                        pasteTextToInput(inputElement, '');
                    },
                });
            }
            if (contextMenuItems.length === 0) {
                return;
            }
            showAppContextMenu(event, contextMenuItems);
        };
    }
    listenForInputContextMenu(element: Node): void {
        if (element instanceof HTMLElement === false) {
            return;
        }
        const inputElements = element.querySelectorAll(
            'input[type="text"], input[type="search"], ' +
                'input[type="email"], input[type="password"],' +
                ' input[type="number"], input[type="tel"]',
        );
        for (const childElement of inputElements) {
            this.init(childElement as HTMLInputElement);
        }
    }
}

export async function removeDomTitle(element: Node, eventType: MutationType) {
    if (!(element instanceof HTMLElement)) {
        return;
    }
    if (element.title) {
        element.title = '';
    }
    if (eventType === 'added') {
        for (const child of Array.from(element.children)) {
            removeDomTitle(child, eventType);
        }
    }
}

export function checkIsZoomed() {
    return window.outerWidth / window.innerWidth !== 1;
}

const WINDOW_FEATURES =
    'popup,top=0,left=0,width=400,height=400,scrollbars=yes,' +
    'toolbar=no,location=no,status=no,menubar=no';

export function openPopupEditorWindow(pathName: string) {
    return window.open(pathName, 'popup_window', WINDOW_FEATURES);
}

export function getParamFileFullName() {
    const fileFullName = new URLSearchParams(globalThis.location.search).get(
        'file',
    );
    return fileFullName;
}
