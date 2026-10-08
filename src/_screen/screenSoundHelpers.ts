import appProvider from '../server/appProvider';

// Which window plays a screen's sound.
//
// Normally the presenter's mini screen copy: it holds the controls, and the
// projected page is a muted follower kept in step by time messages. A screen
// on a virtual display turns that round -- its page is what the display
// streams, sound included, so the page plays it and the presenter's copy stays
// silent while still driving play, pause, time and volume.
//
// A leaf: callers hand in their screen manager, which already knows where the
// screen is (`ScreenManagerBase.isOnVirtualDisplay`).
type ScreenPlaceType = { isOnVirtualDisplay: boolean };

// Whether a slide's media, a background video's sound or a YouTube embed
// should be heard in THIS window for that screen.
export function checkIsSoundHere(screen: ScreenPlaceType) {
    return appProvider.isPageScreen
        ? screen.isOnVirtualDisplay
        : !screen.isOnVirtualDisplay;
}

// A foreground clip whose Sound is on plays in both windows on a real
// monitor; for a screen on a virtual display the presenter's copy is the one
// to keep quiet.
export function checkIsPresenterCopySilenced(screen: ScreenPlaceType) {
    return !appProvider.isPageScreen && screen.isOnVirtualDisplay;
}
