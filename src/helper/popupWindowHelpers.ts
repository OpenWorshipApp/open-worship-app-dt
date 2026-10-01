// Opening one of the app's popup windows, and nothing else.
//
// A leaf on purpose: the AI Chat window opens another of itself when a tab is
// dragged out of it, and `domHelpers.ts`, where this used to live, brings the
// context menu, the keyboard layers, `tran()` and a handful of module-scope
// listeners into any page that imports it (the rule in `.claude/CLAUDE.md`
// about startup helpers and mixed feature modules). `domHelpers.ts`
// re-exports all of it for the callers it already had.

import appProvider from '../server/appProvider';

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

/**
 * The AI Chat window: a company's own chat site (ChatGPT, Claude, Gemini...)
 * in a box beside the app, the way a browser's AI sidebar holds one. Opened
 * exactly as the chatbot is -- same size, same side, same glass -- so the two
 * read as one family; what is inside is `html/aichat.html` and a `<webview>`
 * guest that `electron/aiChatGuestHelpers.ts` keeps in its box.
 *
 * Unlike every other popup, each press opens ANOTHER window, up to a cap
 * (`electron/aiChatWindowHelpers.ts`) -- which is why the url carries a
 * fresh uuid rather than a fixed one the main process would find and focus.
 */
export function genAiChatWindowUuid() {
    return `aichat_${Date.now()}`;
}

/**
 * A tab dragged out of an AI Chat window opens its new window where it was
 * dropped (`place`) rather than beside the app, and under the uuid its tab
 * was handed to the main process by, so the new window can take it.
 */
export function openAiChatPage(
    uuid = genAiChatWindowUuid(),
    place?: Readonly<{ x: number; y: number }>,
) {
    return openPopupWindow(appProvider.aichatHomePage, uuid, uuid, {
        width: 460,
        height: 640,
        appGlassy: true,
        ...(place === undefined
            ? {
                  appAlignHorizontal: 'right',
                  appAlignVertical: 'center',
              }
            : { x: Math.round(place.x), y: Math.round(place.y) }),
        appFollowScale: true,
        appTopToMain: true,
    });
}
