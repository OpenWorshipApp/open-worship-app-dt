import type { WebContents, WebFrameMain } from 'electron';

// The virtual display compositor windows, by their page's WebContents. A leaf
// on purpose: the AI Chat guest guard and the display-media handler ask it
// whether a page is one of these, and neither may import the service.
//
// Being registered is the ONLY thing that exempts a page from the AI Chat
// guard's `<webview>` refusal, and it is decided here by the WebContents the
// main process created -- never by a URL a page could carry.
const hostIds = new Set<number>();
const audioTargets = new Map<number, WebFrameMain>();

export function markVirtualDisplayHost(contents: WebContents) {
    const id = contents.id;
    hostIds.add(id);
    contents.once('destroyed', () => {
        hostIds.delete(id);
        audioTargets.delete(id);
    });
}

// A destroyed host leaves the set on its `destroyed` event.
export function checkIsVirtualDisplayHost(contents?: WebContents | null) {
    return !!contents && hostIds.has(contents.id);
}

// A screen page inside a compositor: a `<webview>` guest whose embedder is a
// registered host.
export function checkIsVirtualDisplayGuest(contents?: WebContents | null) {
    return !!contents && checkIsVirtualDisplayHost(contents.hostWebContents);
}

// The next display-media request from `host` captures this guest's audio.
// Chromium's capture of the compositor's own tab does not carry its guests'
// sound, so each screen's audio is asked for on its own.
export function setVirtualDisplayAudioTarget(
    host: WebContents,
    frame: WebFrameMain | null,
) {
    if (frame === null) {
        audioTargets.delete(host.id);
    } else {
        audioTargets.set(host.id, frame);
    }
}

export function takeVirtualDisplayAudioTarget(host: WebContents) {
    const frame = audioTargets.get(host.id) ?? null;
    audioTargets.delete(host.id);
    return frame;
}
