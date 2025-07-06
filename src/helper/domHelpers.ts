import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import KeyboardEventListener from '../event/KeyboardEventListener';
import { pasteTextToInput } from '../server/appHelpers';
import {
    MutationType,
    APP_FULL_VIEW_CLASSNAME,
    APP_AUTO_HIDE_CLASSNAME,
} from './helpers';

const callBackListeners = new Set<
    (element: Node, type: MutationType) => void
>();
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                for (const callback of callBackListeners) {
                    callback(node, 'added');
                }
            });
            mutation.removedNodes.forEach((node) => {
                for (const callback of callBackListeners) {
                    callback(node, 'removed');
                }
            });
        } else if (mutation.type === 'attributes') {
            for (const callback of callBackListeners) {
                callback(mutation.target, 'attr-modified');
            }
        }
    });
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

export function handleClassNameAction<T>(
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

export function handleAutoHide(
    targetDom: HTMLDivElement,
    isLeftAligned = true,
) {
    const parentElement = targetDom.parentElement;
    if (parentElement === null) {
        return;
    }
    parentElement.querySelectorAll('.auto-hide-button').forEach((el) => {
        el.remove();
    });
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
    clearButton.title = '`Show';
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
    static readonly lowClassname = 'app-low-hover-display';
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
        const minWidth = parseInt(minWidthString);
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
        element
            .querySelectorAll('[data-min-parent-width]')
            .forEach((childElement) => {
                if (
                    childElement instanceof HTMLElement &&
                    childElement.className.includes(
                        HoverMotionHandler.lowClassname,
                    )
                ) {
                    this.init(childElement);
                }
            });
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
                    menuElement: '`Paste',
                    onSelect: () => {
                        pasteTextToInput(inputElement, copiedText);
                    },
                });
            }
            if (inputElement.value.length > 0) {
                contextMenuItems.push({
                    childBefore: genContextMenuItemIcon('x'),
                    menuElement: '`Clear',
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
        element
            .querySelectorAll(
                'input[type="text"], input[type="search"], ' +
                    'input[type="email"], input[type="password"],' +
                    ' input[type="number"], input[type="tel"]',
            )
            .forEach((childElement) => {
                this.init(childElement as HTMLInputElement);
            });
    }
}
