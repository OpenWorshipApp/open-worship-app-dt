// The `<webview>` element, as much of it as this window uses.
//
// React's own types already know the tag (`HTMLWebViewElement`, with `src`,
// `partition` and `allowpopups` on it); what they do not carry are the
// methods Electron puts on the element, and pulling `electron.d.ts` into the
// renderer's typecheck for those would bring its global augmentations with
// it. So the handful of members the AI Chat window touches are named here.

export type AiChatGuestElementType = HTMLWebViewElement & {
    src: string;
    getURL: () => string;
    getTitle: () => string;
    reload: () => void;
    goBack: () => void;
    canGoBack: () => boolean;
    // The id the main process knows this guest by, which is how a
    // microphone ask is matched to the tab it came from.
    getWebContentsId: () => number;
    // The language's face handed to the page (`aiChatGuestFontHelpers`):
    // a script that adds fonts from bytes, and one style rule.
    executeJavaScript: (code: string) => Promise<unknown>;
    insertCSS: (css: string) => Promise<string>;
};

// Electron's guest events are plain DOM events carrying extra fields; only
// the ones read here are named.
export type AiChatGuestEventType = Event & {
    title?: string;
    url?: string;
    errorCode?: number;
    errorDescription?: string;
    validatedURL?: string;
    isMainFrame?: boolean;
};
