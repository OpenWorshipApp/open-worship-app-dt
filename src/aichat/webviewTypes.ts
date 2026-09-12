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
