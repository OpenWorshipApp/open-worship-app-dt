import { handleError } from './errorHelpers';

export function playMediaElement(mediaElement: HTMLMediaElement) {
    // `play()` rejects with AbortError when it is interrupted by `pause()`
    // or a new load (e.g. quick hover in/out on a video thumbnail). That
    // race is harmless and must not surface as an app error.
    // `Promise.resolve()` wraps engines where `play()` returns undefined.
    return Promise.resolve(mediaElement.play()).catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return;
        }
        handleError(error);
    });
}
