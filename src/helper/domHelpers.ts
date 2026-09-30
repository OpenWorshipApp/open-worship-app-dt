import { askAiCaution } from './ai/aiCautionHelpers';
import { revealVirtualItem } from '../virtual-list/virtualRevealHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import KeyboardEventListener from '../event/KeyboardEventListener';
import type { RegisteredEventType } from '../event/EventHandler';
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
import appProvider from '../server/appProvider';

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

// One Escape listener per full-view element, released when the class goes
// away — the old per-mutation registration stacked listeners that each
// swallowed one later Escape press (context menus, modals) before dying.
const fullViewEscapeRegistry = new WeakMap<
    HTMLElement,
    RegisteredEventType<string, KeyboardEvent>[]
>();
export function handleFullWidgetView(element: Node, type: MutationType) {
    if (element instanceof HTMLElement === false) {
        return;
    }
    const registeredEvents = fullViewEscapeRegistry.get(element);
    const isFullView =
        type === 'attr-modified' &&
        element.classList.contains(APP_FULL_VIEW_CLASSNAME);
    if (!isFullView) {
        if (registeredEvents !== undefined) {
            KeyboardEventListener.unregisterEventListener(registeredEvents);
            fullViewEscapeRegistry.delete(element);
        }
        return;
    }
    if (registeredEvents !== undefined) {
        return;
    }
    const newRegisteredEvents = KeyboardEventListener.registerEventListener(
        [KeyboardEventListener.toEventMapperKey({ key: 'Escape' })],
        (event: KeyboardEvent) => {
            event.stopPropagation();
            event.preventDefault();
            KeyboardEventListener.unregisterEventListener(newRegisteredEvents);
            fullViewEscapeRegistry.delete(element);
            element.classList.remove(APP_FULL_VIEW_CLASSNAME);
        },
    );
    fullViewEscapeRegistry.set(element, newRegisteredEvents);
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

/**
 * The box that actually SCROLLS this element, or null when nothing does.
 *
 * Needed wherever "is it off the bottom?" is asked, because the element's own
 * container is often the full height of its content — a floating widget's body
 * scrolls it, not the list inside. `touchDragHelpers` has a sibling of this that
 * also answers for the horizontal axis and honours
 * `data-scroll-container-selector`; this one is the plain vertical question.
 */
export function findVerticalScrollingParent(element: HTMLElement) {
    let parentElement = element.parentElement;
    while (parentElement !== null) {
        if (
            parentElement.scrollHeight > parentElement.clientHeight &&
            /auto|scroll|overlay/.test(
                getComputedStyle(parentElement).overflowY,
            )
        ) {
            return parentElement;
        }
        parentElement = parentElement.parentElement;
    }
    return null;
}

export function handleActiveSelectedElementScrolling(target: Node) {
    if (target instanceof HTMLElement === false) {
        return;
    }
    if (checkIsDisabled(target)) {
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

export function handleAutoHide(targetDom: HTMLDivElement) {
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
    clearButton.style.left = '7px';
    Object.assign(clearButton.style, {
        bottom: '7px',
        position: 'absolute',
        width: '25px',
        textAlign: 'center',
        padding: '0px',
        boxShadow: '0px 0px 2px 1px rgba(0,0,0,0.3)',
    });
    // Named without the word "show" in it at all, and NOT `tran('Show')`,
    // which is what it used to be. There is one of these per auto-hide footer
    // -- Background, Bible previewer, presenting-flow preview, mini screen --
    // and "Show" is the most collided word in this app: `owa_click` ranks an
    // exact label above every looser fit, so an assistant asked to turn the
    // projector on matched this decoration four times over, beat the screen's
    // own "Toggle showing screen" control, and reported the screen was
    // showing because it had managed to press something. Dropping the word
    // is what makes that impossible rather than merely unlikely -- renaming
    // it to "Show Hidden Controls" first still won the bare word "Show" on a
    // whole-word match.
    clearButton.title = tran('Reveal Hidden Controls');
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
    const zoomFactor = appProvider.messageUtils.sendDataSync(
        'all:app:get-zoom-factor',
    );
    return zoomFactor !== 1;
}

// TODO: utilize native feature instead of app*
export type PopupWindowFeaturesType = {
    popup?: boolean;
    noopener?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    appFollowScale?: boolean;
    appAlignHorizontal?: 'left' | 'center' | 'right';
    appAlignVertical?: 'top' | 'center' | 'bottom';
    appScale?: number;
    appTopToMain?: boolean;
    appShowMenuBar?: boolean;
    appResize?: boolean;
    // Ask the OS compositor for a translucent backdrop behind this window --
    // frosted glass over whatever is under it, instead of a slab. Ignored
    // where the compositor cannot do it (`systemUtils.isGlassCapable`), so a
    // window that wants it must ALSO keep its own stylesheet readable when it
    // does not get it.
    appGlassy?: boolean;
    // Names of experimental Blink runtime features to enable for this window
    // only, e.g. `['CanvasDrawElement']`. Joined with `+` because the window
    // features string is itself `,`/`=` delimited.
    appBlinkFeatures?: string[];
};
const DEFAULT_FEATURES: PopupWindowFeaturesType = {
    popup: true,
};

function toFeatureString(features: PopupWindowFeaturesType) {
    const featureString = Object.entries(features)
        .filter(([_key, value]) => {
            return !Array.isArray(value) || value.length > 0;
        })
        .map(([key, value]) => {
            if (value === true) {
                return key;
            }
            if (value === false) {
                return `${key}=false`;
            }
            if (Array.isArray(value)) {
                return `${key}=${value.join('+')}`;
            }
            return `${key}=${value}`;
        })
        .join(',');
    return featureString;
}

/**
 * Whether THIS renderer is one of the app's popup windows.
 *
 * No `isPage*` flag can answer this: a reader popup and the main window on the
 * reader route look identical to them. The frame name is the discriminator —
 * `openPopupWindow` below stamps every popup with it, while the main window is
 * loaded with `loadURL` and so has no name at all.
 */
export function checkIsPopupWindow() {
    return window.name.startsWith(appProvider.POPUP_FRAME_NAME_PREFIX);
}

export function openPopupWindow(
    partialUrl: string,
    frameUUID: string,
    urlUUID: string,
    features?: PopupWindowFeaturesType,
) {
    if (partialUrl.startsWith('/')) {
        const urlObject = new URL(location.href);
        partialUrl = `${urlObject.protocol}//${urlObject.host}${partialUrl}`;
    }
    const target = `${appProvider.POPUP_FRAME_NAME_PREFIX}_${frameUUID}`;
    const urlObject = new URL(partialUrl);
    urlObject.searchParams.set('uuid', urlUUID);
    const allFeatures: PopupWindowFeaturesType = {
        ...DEFAULT_FEATURES,
        ...features,
    };
    if (allFeatures.appBlinkFeatures?.length) {
        // Blink runtime features are per renderer *process*, and a popup that
        // keeps its opener is put in the opener's process — where the feature
        // is off, so `enableBlinkFeatures` on the new window is ignored.
        // `noopener` forces a fresh process, at the cost of `window.open`
        // returning null.
        allFeatures.noopener = true;
    }
    return window.open(
        urlObject.toString(),
        target,
        toFeatureString(allFeatures),
    );
}

function openAboutPage() {
    return openPopupWindow(
        appProvider.aboutHomePage,
        `about_${Date.now()}`,
        'about',
        {
            width: 700,
            height: 555,
            appAlignHorizontal: 'center',
            appAlignVertical: 'center',
            appFollowScale: true,
            appTopToMain: true,
        },
    );
}
appProvider.messageUtils.listenForData('main:app:open-about-page', () => {
    openAboutPage();
});

export function openChatbotPage() {
    return openPopupWindow(
        appProvider.chatbotHomePage,
        `chatbot_${Date.now()}`,
        'chatbot',
        {
            width: 460,
            height: 640,
            // Beside the app rather than over it: the answers point at
            // controls in the window behind this one -- and the frosted
            // backdrop keeps that window half-visible THROUGH the help, so a
            // step that says "the button below the tabs" can be followed
            // without moving anything out of the way.
            appGlassy: true,
            appAlignHorizontal: 'right',
            appAlignVertical: 'center',
            appFollowScale: true,
            appTopToMain: true,
        },
    );
}
// Help -> App Help (Chatbot) in the native menu bar. It gets the same
// caution the 🤖 button and the Tools entry ask for, so the warning cannot be
// walked around by opening the window a different way.
appProvider.messageUtils.listenForData('main:app:open-chatbot-page', () => {
    void (async () => {
        if (await askAiCaution('assistant')) {
            openChatbotPage();
        }
    })();
});

/**
 * The AI Chat window: a company's own chat site (ChatGPT, Claude, Gemini...)
 * in a box beside the app, the way a browser's AI sidebar holds one. Opened
 * exactly as the chatbot is -- same size, same side, same glass -- so the two
 * read as one family; what is inside is `html/aichat.html` and a `<webview>`
 * guest that `electron/aiChatGuestHelpers.ts` keeps in its box.
 */
export function openAiChatPage() {
    return openPopupWindow(
        appProvider.aichatHomePage,
        `aichat_${Date.now()}`,
        'aichat',
        {
            width: 460,
            height: 640,
            appGlassy: true,
            appAlignHorizontal: 'right',
            appAlignVertical: 'center',
            appFollowScale: true,
            appTopToMain: true,
        },
    );
}
// Help -> AI Chat, same as above.
appProvider.messageUtils.listenForData('main:app:open-aichat-page', () => {
    void (async () => {
        if (await askAiCaution('aichat')) {
            openAiChatPage();
        }
    })();
});

// The chatbot's walkthrough card lives in THIS window and rings the control
// each step is about -- but the help window it was asked from is a separate
// OS window on top of this one, and whatever it covers cannot be seen or
// pressed. So the card says when a walkthrough starts and ends, and the main
// process steps that window aside for the length of it.
//
// Relayed rather than handled here: only the main process can move a window,
// and the card is a dependency-free expression injected into the page, so a
// DOM event is the only thing it is allowed to reach us with.
document.addEventListener('owa-guide-running', (event) => {
    const { isRunning } = (event as CustomEvent).detail ?? {};
    appProvider.messageUtils.sendData('all:app:guide-running', {
        isRunning: isRunning === true,
    });
});

// The same card, stuck: a step it cannot press for the user. It used to
// apologise and stop there. Now it asks the chat window that started the
// walkthrough — which can look at the real window through its tools and
// rewrite the guide from this step — and shows what comes back on the card
// itself, so a volunteer following steps in the app never has to go and find
// the help window to be helped.
//
// Relayed both ways for the same reason as the running signal: the card is a
// dependency-free expression injected into the page, and the chat window is a
// different renderer that only the main process can reach.
document.addEventListener('owa-guide-help', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    appProvider.messageUtils.sendData('all:app:guide-help', detail);
});
appProvider.messageUtils.listenForData(
    'main:app:guide-help-answer',
    (_event, data: { token?: number; text?: string }) => {
        document.dispatchEvent(
            new CustomEvent('owa-guide-help-answer', { detail: data ?? {} }),
        );
    },
);

// `owa_lyric_file` / `owa_slide_file`: an agent asking to look at or write one
// of the user's own documents.
//
// Relayed rather than handled inline for the same reason as the guide events
// above — the tool's only way in is a dependency-free page expression, which
// may not `import()` an app module — and the worker is imported LAZILY here so
// that nothing in the song/slide graph loads in every window just in case
// somebody asks (memory: `app-document-helpers-lyric-cycle` is the cycle a
// static import would close).
document.addEventListener('owa-agent-file', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const { token } = detail;
    const reply = (result: unknown) => {
        document.dispatchEvent(
            new CustomEvent('owa-agent-file-answer', {
                detail: { token, result },
            }),
        );
    };
    import('./agentFileHelpers')
        .then(async ({ handleAgentFileRequest }) => {
            reply(await handleAgentFileRequest(detail));
        })
        .catch((error) => {
            reply({
                isError: true,
                reason: String(error?.message ?? error),
            });
        });
});

// `owa_list_screens`: an agent asking what is ON each presentation screen --
// the slide, the verse, the background, the foreground widgets, the lock.
//
// Same relay, same reason, and the same lazy import: the screen managers pull
// the whole presenting graph behind them, and a help question about the
// projector must not make every window carry it. Without this the tool could
// say only whether a screen was showing, and a model handed "showing" for a
// screen with a verse on it told a volunteer it was blank (2026-09-09).
document.addEventListener('owa-agent-screens', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const { token } = detail;
    const reply = (result: unknown) => {
        document.dispatchEvent(
            new CustomEvent('owa-agent-screens-answer', {
                detail: { token, result },
            }),
        );
    };
    import('./agentScreenHelpers')
        .then(({ describeScreensForAgent }) => {
            reply(describeScreensForAgent());
        })
        .catch((error) => {
            reply({
                isError: true,
                reason: String(error?.message ?? error),
            });
        });
});

// `owa_app_state`: an agent asking what the user is in the MIDDLE of on the
// Presenter page -- the selected document, its slides, which is on a screen,
// which is next, and the words each card answers to.
//
// Same relay, same lazy import: the selected document pulls in the document
// graph and the screen managers. Without this the tool knew the projector and
// nothing before it: asked which song was selected, the assistant named the
// one on the screen (2026-09-09), and asked for the next slide it dumped
// every control in the window looking for a card that had no name.
document.addEventListener('owa-agent-presenter', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const { token } = detail;
    const reply = (result: unknown) => {
        document.dispatchEvent(
            new CustomEvent('owa-agent-presenter-answer', {
                detail: { token, result },
            }),
        );
    };
    import('./agentPresenterHelpers')
        .then(async ({ describePresenterForAgent }) => {
            reply(await describePresenterForAgent());
        })
        .catch((error) => {
            reply({
                isError: true,
                reason: String(error?.message ?? error),
            });
        });
});

// `owa_present_bible`: an agent asked to put a Bible passage on the projector
// by its reference -- "John 3:16" -- or to read what that reference is.
//
// Same relay, same lazy import: the resolver pulls in the bible graph and
// the screen managers. Without it the assistant could only describe the
// Bible Lookup's picker, and the "do it for me" under that answer stopped at
// the step where a person types the book's first letters (2026-09-10).
document.addEventListener('owa-agent-bible', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const { token } = detail;
    const reply = (result: unknown) => {
        document.dispatchEvent(
            new CustomEvent('owa-agent-bible-answer', {
                detail: { token, result },
            }),
        );
    };
    import('./agentBibleHelpers')
        .then(async ({ handleAgentBibleRequest }) => {
            reply(await handleAgentBibleRequest(detail));
        })
        .catch((error) => {
            reply({
                isError: true,
                reason: String(error?.message ?? error),
            });
        });
});

// `owa_bible_item`, `owa_bible_note` and `owa_undo`: an agent asking to look at
// or change the user's saved Bible passages and notes, or to put back a change
// an agent made.
//
// ONE relay for the three, keyed by `domain`, with the same lazy import as
// every relay here -- a worker loads only when its tool is called. The map is
// the whole routing, and a domain not in it (checked as an OWN key, so
// `constructor` is not one) is answered rather than guessed at.
const AGENT_DATA_WORKER_MAP: Record<
    string,
    () => Promise<(detail: any) => Promise<unknown>>
> = {
    'bible-item': async () => {
        return (await import('./agentBibleListHelpers'))
            .handleAgentBibleListRequest;
    },
    note: async () => {
        return (await import('./agentNoteHelpers')).handleAgentNoteRequest;
    },
    undo: async () => {
        return (await import('./agentBackupHelpers')).handleAgentUndoRequest;
    },
};

document.addEventListener('owa-agent-data', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const { token } = detail;
    const reply = (result: unknown) => {
        document.dispatchEvent(
            new CustomEvent('owa-agent-data-answer', {
                detail: { token, result },
            }),
        );
    };
    const domain = String(detail.domain);
    if (!Object.hasOwn(AGENT_DATA_WORKER_MAP, domain)) {
        reply({
            isError: true,
            reason: `Unknown kind of data "${domain}".`,
        });
        return;
    }
    AGENT_DATA_WORKER_MAP[domain]()
        .then(async (handleRequest) => {
            reply(await handleRequest(detail));
        })
        .catch((error) => {
            reply({
                isError: true,
                reason: String(error?.message ?? error),
            });
        });
});

// `owa_foreground`: an agent asked to start or stop a foreground extra -- a
// countdown, a clock, a scrolling message -- on the ticked screens, or to read
// which are on.
//
// Same relay, same lazy import: the worker pulls in the screen managers.
// Without it "start a 5 minute countdown" was eight rounds of the assistant
// hunting the Foreground tab's boxes, and the "yes" under it ran out of rounds
// with nothing started (2026-09-11).
document.addEventListener('owa-agent-foreground', (event) => {
    const detail = (event as CustomEvent).detail ?? {};
    const { token } = detail;
    const reply = (result: unknown) => {
        document.dispatchEvent(
            new CustomEvent('owa-agent-foreground-answer', {
                detail: { token, result },
            }),
        );
    };
    import('./agentForegroundHelpers')
        .then(async ({ handleAgentForegroundRequest }) => {
            reply(await handleAgentForegroundRequest(detail));
        })
        .catch((error) => {
            reply({
                isError: true,
                reason: String(error?.message ?? error),
            });
        });
});

function toURLObject(urlOrPathname: string) {
    return new URL(urlOrPathname, globalThis.location.href);
}
// Preserve the caller's URL shape: an absolute input serializes back to an
// absolute URL, a relative path back to a "pathname?search#hash" string.
function serializeURL(urlObject: URL, urlOrPathname: string) {
    return URL.canParse(urlOrPathname)
        ? urlObject.toString()
        : urlObject.pathname + urlObject.search + urlObject.hash;
}

export function getParamKeyValue(urlOrPathname: string, key: string) {
    return toURLObject(urlOrPathname).searchParams.get(key);
}
export function setParamKeyValue(
    urlOrPathname: string,
    key: string,
    value: string,
) {
    const urlObject = toURLObject(urlOrPathname);
    urlObject.searchParams.set(key, value);
    return serializeURL(urlObject, urlOrPathname);
}
export function getParamIdNum(urlOrPathname: string) {
    const id = getParamKeyValue(urlOrPathname, 'id');
    const idNum = Number.parseInt(id ?? '');
    if (Number.isNaN(idNum)) {
        return null;
    }
    return idNum;
}
export function setParamIdNum(urlOrPathname: string, idNum: number) {
    return setParamKeyValue(urlOrPathname, 'id', idNum.toString());
}
export function getParamFileFullName(urlOrPathname: string) {
    return getParamKeyValue(urlOrPathname, 'file');
}
export function setParamFileFullName(
    urlOrPathname: string,
    fileFullName: string,
) {
    return setParamKeyValue(urlOrPathname, 'file', fileFullName);
}

export function checkIsDisabled(element: Element) {
    const isDisabled = Array.from(element.classList).some((className) =>
        className.includes('disabled'),
    );
    if (isDisabled) {
        return true;
    }
    if (element.parentElement === null) {
        return false;
    }
    return checkIsDisabled(element.parentElement);
}

export function escapeSelectorValue(value: string) {
    return (globalThis.CSS?.escape ?? ((raw: string) => raw))(value);
}

const APP_NOTIFY_ELEMENT_HIGHLIGHT_CLASSNAME = 'app-notify-element-highlight';
export async function notifyElementHighlight(
    elementGetter: () => Element | null,
    {
        moveToView,
        shouldSkipHighlighting = false,
        type,
        revealKey,
    }: {
        moveToView?: (element: Element) => void;
        shouldSkipHighlighting?: boolean;
        type?: 'success' | 'warning' | 'danger';
        /**
         * The item's key in a windowed list (a file path, a slide id). A row
         * that is scrolled away has no DOM at all, so the poll below would
         * never find it: ask the list to bring it into range first -- and
         * again on each poll until one holds it, since the list may only mount
         * once its panel opens.
         */
        revealKey?: string;
    } = {},
) {
    // Asked on EVERY turn, not once it has been answered: a list whose rows
    // are not all one height aims at where it currently believes the row to
    // be, and the screenful the first scroll draws is measured for real a
    // moment later, moving everything after it. Asking again is what closes
    // that gap -- and asking for a row already in view does nothing at all.
    const reveal = () => {
        if (revealKey !== undefined) {
            revealVirtualItem(revealKey);
        }
    };
    reveal();
    let element = elementGetter();
    let i = 0;
    while (element === null) {
        reveal();
        element = elementGetter();
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
        if (i > 30) {
            return;
        }
        i++;
    }
    moveToView ??= bringDomToNearestView;
    moveToView(element);
    if (shouldSkipHighlighting) {
        return;
    }
    const targetClassName =
        APP_NOTIFY_ELEMENT_HIGHLIGHT_CLASSNAME +
        (type === undefined ? '-success' : `-${type}`);
    const classList = element.classList;
    classList.remove(targetClassName);
    setTimeout(() => {
        classList.add(targetClassName);
    }, 100);
    setTimeout(() => {
        classList.remove(targetClassName);
    }, 2e3 + 200);
}
