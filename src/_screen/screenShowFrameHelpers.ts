import type { CSSProperties } from 'react';

import type {
    ScreenMessageType,
    ScreenShowPayloadType,
    StyleAnimType,
} from './screenTypeHelpers';
import appProvider from '../server/appProvider';
import { checkIsScreenShowSourceId } from './screenShowGraphHelpers';

/**
 * Screen Show: screen N's CONTENT drawn inside screen M, whether or not N's own
 * window is up.
 *
 * N is drawn by the app's own screen page, `vd-screen.html`, in an iframe of
 * this window (same origin, so it can be handed what it needs), at N's own size
 * and scaled into the overlay's box. Its own realm is the point: a second set
 * of N's managers in THIS realm would take over N's in the presenter (every
 * manager is cached by screen id), and N's page brings its own styles, fonts
 * and DOM ids with it. The page runs on a stand-in provider
 * (`screenShowFrameProvider`) whose data comes from here.
 *
 * Where the data comes from: the presenter holds N's live state, so in the
 * presenter it is read straight from N's managers; every other window is sent
 * it by the presenter as `screen-show` messages (`ScreenManager`) -- a snapshot
 * when the overlay goes up or the window loads, then each change of N as it
 * happens -- and keeps the latest here until a frame asks.
 *
 * Never heard: the copy is muted (`isScreenShowFrame`), N's own window or the
 * presenter plays N's sound. And never nested: a Screen Show inside the copy
 * draws nothing (`checkIsScreenShowFrame`).
 *
 * Light on purpose: `ScreenManager` imports it, so the settings and camera
 * readers the page needs are handed in by the caller.
 */

export const SCREEN_SHOW_FRAME_PAGE = 'vd-screen.html';
export const SCREEN_SHOW_FRAME_PARAM = 'screenShow';
const HOSTS_KEY = '__owaScreenShowFrameHosts';
// How long a source's state is kept after the last copy of it is taken down,
// so the copy put up again in its place (its Properties changed) finds it.
const STATE_RELEASE_MS = 3000;

export function checkIsScreenShowFrame() {
    return appProvider.screenUtils?.getContext()?.isScreenShowFrame === true;
}

export type ScreenShowFrameStateType = {
    stage: number;
    fontCss: string;
    isWindows: boolean;
    messages: ScreenMessageType[];
};

/** What the copy's page is handed: see `screenShowFrameProvider`. */
export type ScreenShowFrameHostType = {
    sourceScreenId: number;
    baseProvider: unknown;
    getSetting: (key: string) => string | null;
    getState: () => ScreenShowFrameStateType;
    listen: (listener: (messages: ScreenMessageType[]) => void) => () => void;
    requestSnapshot: () => void;
    resolveResource: (filePath: string) => string;
    askCameraAccess: () => Promise<boolean>;
};

type SourceStateType = {
    width: number;
    height: number;
    stage: number;
    // The latest message of each kind that IS state; what changes in steps
    // (a video's time, a scroll, a drawn stroke) is passed on, never kept.
    messages: Map<string, ScreenMessageType>;
    releaseTimeoutId: ReturnType<typeof setTimeout> | null;
};
type PayloadListenerType = (payload: ScreenShowPayloadType) => void;

const sourceStateMap = new Map<number, SourceStateType>();
const listenerMap = new Map<number, Set<PayloadListenerType>>();

function toStateKey(message: ScreenMessageType) {
    switch (message.type) {
        case 'background':
        case 'vary-app-document':
        case 'bible-screen-view':
        case 'bible-screen-view-text-style':
        case 'foreground':
        case 'focus':
            return message.type;
        case 'effect':
            return `effect:${message.data?.target}`;
        case 'draw':
            return message.data?.action === 'sync' ? 'draw' : null;
        default:
            return null;
    }
}

function checkIsPayload(payload: any): payload is ScreenShowPayloadType {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        checkIsScreenShowSourceId(payload.sourceScreenId) &&
        Array.isArray(payload.messages) &&
        payload.width > 0 &&
        payload.height > 0
    );
}

/**
 * Screen N's state, arriving in this window. Kept only from a snapshot on, so
 * a change that came before any snapshot never stands in for the whole state.
 */
export function receiveScreenShowPayload(payload: unknown) {
    if (!checkIsPayload(payload)) {
        return;
    }
    const { sourceScreenId } = payload;
    let state = sourceStateMap.get(sourceScreenId);
    if (payload.isSnapshot) {
        if (state === undefined) {
            state = {
                width: payload.width,
                height: payload.height,
                stage: payload.stage,
                messages: new Map(),
                releaseTimeoutId: null,
            };
            sourceStateMap.set(sourceScreenId, state);
            // Kept only while something here draws it.
            if ((listenerMap.get(sourceScreenId)?.size ?? 0) === 0) {
                scheduleStateRelease(sourceScreenId);
            }
        } else {
            state.messages.clear();
        }
    }
    if (state !== undefined) {
        state.width = payload.width;
        state.height = payload.height;
        state.stage = payload.stage;
        for (const message of payload.messages) {
            const key = toStateKey(message);
            if (key !== null) {
                state.messages.set(key, message);
            }
        }
    }
    for (const listener of listenerMap.get(sourceScreenId) ?? []) {
        listener(payload);
    }
}

function scheduleStateRelease(sourceScreenId: number) {
    const state = sourceStateMap.get(sourceScreenId);
    if (state === undefined || state.releaseTimeoutId !== null) {
        return;
    }
    state.releaseTimeoutId = setTimeout(() => {
        if (
            sourceStateMap.get(sourceScreenId) === state &&
            (listenerMap.get(sourceScreenId)?.size ?? 0) === 0
        ) {
            sourceStateMap.delete(sourceScreenId);
        } else {
            state.releaseTimeoutId = null;
        }
    }, STATE_RELEASE_MS);
}

function addPayloadListener(
    sourceScreenId: number,
    listener: PayloadListenerType,
) {
    let set = listenerMap.get(sourceScreenId);
    if (set === undefined) {
        set = new Set();
        listenerMap.set(sourceScreenId, set);
    }
    set.add(listener);
    const state = sourceStateMap.get(sourceScreenId);
    if (state?.releaseTimeoutId) {
        clearTimeout(state.releaseTimeoutId);
        state.releaseTimeoutId = null;
    }
    return () => {
        set.delete(listener);
        if (set.size === 0) {
            listenerMap.delete(sourceScreenId);
            scheduleStateRelease(sourceScreenId);
        }
    };
}

export function checkHasScreenShowFrame(sourceScreenId: number) {
    return (listenerMap.get(sourceScreenId)?.size ?? 0) > 0;
}

function getCachedSnapshot(
    sourceScreenId: number,
): ScreenShowPayloadType | null {
    const state = sourceStateMap.get(sourceScreenId);
    if (state === undefined) {
        return null;
    }
    return {
        sourceScreenId,
        width: state.width,
        height: state.height,
        stage: state.stage,
        isSnapshot: true,
        messages: Array.from(state.messages.values()),
    };
}

// The `@font-face` rules this window has: the copy is another document, and
// the screen fonts the presenter registered do not reach it otherwise.
function collectFontCss() {
    const fontCss: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
        try {
            for (const rule of Array.from(sheet.cssRules)) {
                if (rule instanceof CSSFontFaceRule) {
                    fontCss.push(
                        rule.cssText.replace(
                            /url\(([^)]+)\)/g,
                            (_match, value: string) => {
                                const url = value
                                    .trim()
                                    .replace(/^['"]|['"]$/g, '');
                                const href = new URL(
                                    url,
                                    sheet.href ?? location.href,
                                ).href;
                                return `url("${href}")`;
                            },
                        ),
                    );
                }
            }
        } catch {
            // A cross-origin stylesheet cannot be read.
        }
    }
    return fontCss.join('\n');
}

function getHosts(): Map<string, ScreenShowFrameHostType> {
    const target = globalThis as any;
    target[HOSTS_KEY] ??= new Map();
    return target[HOSTS_KEY];
}

function genFrameKey() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export type ScreenShowFrameMountType = {
    dispose: () => Promise<void>;
};

/**
 * Draw screen `sourceScreenId`'s content into `parentContainer`.
 *
 * `getSnapshot` answers N's whole state at once: in the presenter, from N's
 * managers; elsewhere the state kept from the presenter's `screen-show`
 * messages is used. The handle is returned at once; nothing is drawn until
 * N's size is known.
 */
export function mountScreenShowFrame({
    sourceScreenId,
    ownScreenId,
    parentContainer,
    extraStyle = {},
    animData,
    getSnapshot,
    getSetting,
    askCameraAccess,
}: {
    sourceScreenId: number;
    ownScreenId: number;
    parentContainer: HTMLElement;
    extraStyle?: CSSProperties;
    animData?: StyleAnimType;
    getSnapshot?: () => ScreenShowPayloadType | null;
    getSetting: (key: string) => string | null;
    askCameraAccess: () => Promise<boolean>;
}): ScreenShowFrameMountType {
    // A screen never shows itself, and a copy never draws a copy.
    if (sourceScreenId === ownScreenId || checkIsScreenShowFrame()) {
        return { dispose: async () => {} };
    }
    const readSnapshot = () => {
        return getSnapshot?.() ?? getCachedSnapshot(sourceScreenId);
    };
    const key = genFrameKey();
    let isDisposed = false;
    let size: { width: number; height: number } | null = null;
    let box: HTMLDivElement | null = null;
    let iframe: HTMLIFrameElement | null = null;
    let frameListener: ((messages: ScreenMessageType[]) => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const applyScale = () => {
        if (box === null || iframe === null || size === null) {
            return;
        }
        const scale = box.clientWidth / size.width;
        iframe.style.transform = `scale(${scale})`;
    };
    const putUp = (width: number, height: number) => {
        if (isDisposed) {
            return;
        }
        if (box !== null && iframe !== null && size !== null) {
            if (size.width === width && size.height === height) {
                return;
            }
            // N's display changed: the page draws at its window's size and
            // reloads itself when that changes.
            size = { width, height };
            box.style.aspectRatio = `${width} / ${height}`;
            iframe.style.width = `${width}px`;
            iframe.style.height = `${height}px`;
            applyScale();
            return;
        }
        size = { width, height };
        box = document.createElement('div');
        Object.assign(box.style, extraStyle, {
            // A screen is see-through by nature: where N draws nothing, M
            // shows. Never a backing, whatever the datum carries -- one placed
            // or saved in a run sheet before the panel dropped the text
            // overlays' tinted, blurred one still holds it.
            backgroundColor: 'transparent',
            backgroundImage: 'none',
            backdropFilter: 'none',
            aspectRatio: `${width} / ${height}`,
            overflow: 'hidden',
            pointerEvents: 'none',
        } satisfies CSSProperties);
        iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        Object.assign(iframe.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: `${width}px`,
            height: `${height}px`,
            border: '0',
            transformOrigin: '0 0',
            pointerEvents: 'none',
            background: 'transparent',
            // Where N draws nothing, M shows through. Chromium paints an
            // iframe OPAQUE (white) when its colour scheme differs from the
            // element's -- and the presenter's dark theme gives the element
            // `dark` -- so both sides say `normal` (`screenShowFrameProvider`).
            colorScheme: 'normal',
        } satisfies CSSProperties);
        // `relative` only when the overlay's own style left it unplaced: the
        // copy is laid out inside the box.
        if (!box.style.position) {
            box.style.position = 'relative';
        }
        const url = new URL(SCREEN_SHOW_FRAME_PAGE, globalThis.location.href);
        url.search = new URLSearchParams({
            screenId: String(sourceScreenId),
            [SCREEN_SHOW_FRAME_PARAM]: key,
        }).toString();
        iframe.src = url.href;
        box.appendChild(iframe);
        resizeObserver = new ResizeObserver(applyScale);
        resizeObserver.observe(box);
        if (animData === undefined) {
            parentContainer.appendChild(box);
        } else {
            void animData.animIn(box, parentContainer);
        }
        applyScale();
    };

    const host: ScreenShowFrameHostType = {
        sourceScreenId,
        baseProvider: appProvider,
        getSetting,
        getState: () => {
            const snapshot = readSnapshot();
            return {
                stage: snapshot?.stage ?? 0,
                fontCss:
                    appProvider.screenUtils?.getContext()?.fontCss ??
                    collectFontCss(),
                isWindows: appProvider.systemUtils.isWindows,
                messages: snapshot?.messages ?? [],
            };
        },
        listen: (listener) => {
            frameListener = listener;
            return () => {
                if (frameListener === listener) {
                    frameListener = null;
                }
            };
        },
        requestSnapshot: () => {
            const snapshot = readSnapshot();
            if (snapshot !== null) {
                frameListener?.(snapshot.messages);
            }
        },
        resolveResource: (filePath) => {
            return appProvider.browserUtils.pathToFileURL(filePath);
        },
        askCameraAccess,
    };
    getHosts().set(key, host);
    const stopListening = addPayloadListener(sourceScreenId, (payload) => {
        putUp(payload.width, payload.height);
        frameListener?.(payload.messages);
    });
    const snapshot = readSnapshot();
    if (snapshot !== null) {
        putUp(snapshot.width, snapshot.height);
    }

    return {
        dispose: async () => {
            if (isDisposed) {
                return;
            }
            isDisposed = true;
            stopListening();
            getHosts().delete(key);
            resizeObserver?.disconnect();
            resizeObserver = null;
            frameListener = null;
            const currentBox = box;
            box = null;
            if (currentBox !== null) {
                if (animData !== undefined) {
                    await animData.animOut(currentBox);
                }
                currentBox.remove();
            }
            iframe = null;
        },
    };
}
