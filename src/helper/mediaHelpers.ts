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

/**
 * Hands a media element's player back NOW. Taking the element out of the
 * document does not do it -- a media element keeps its player until the
 * garbage collector gets to it, and Chromium refuses to create any more once
 * a frame holds a thousand. `removeAttribute('src')` alone does nothing
 * either: only the load algorithm `load()` runs shuts the player down, and a
 * leftover `<source>` child would just be re-selected by it.
 */
export function releaseMediaElement(mediaElement: HTMLMediaElement) {
    try {
        mediaElement.pause();
        mediaElement.removeAttribute('src');
        mediaElement.load();
    } catch (error) {
        handleError(error);
    }
}

/**
 * Releases the player only if the element really left the document.
 *
 * A ref callback's cleanup does NOT only mean "going away": React re-attaches
 * refs (StrictMode does it on every mount in dev), and releasing the element
 * React is about to reuse strips the `src` React still believes it set -- the
 * element then sits at `networkState: 0` for ever and the video never plays.
 * Checked after the commit, by which time a real unmount has detached it.
 */
export function releaseMediaElementWhenDetached(
    mediaElement: HTMLMediaElement,
) {
    setTimeout(() => {
        if (mediaElement.isConnected) {
            return;
        }
        releaseMediaElement(mediaElement);
    }, 0);
}

const FRAME_CAPTURE_TIMEOUT = 10_000;

/**
 * A still of a video's first frame, as a data URL. A `<video>` never paints
 * into a printed PDF or a PPTX export, and a folder of video tiles must not
 * each hold a player just to show one frame -- so the frame is taken once,
 * here, by a throwaway element that is released immediately afterwards.
 *
 * `maxWidth` scales the still down on the way out: a thumbnail wants ~15 KB,
 * not the ~250 KB a full-size 1080p frame encodes to, and the bytes are held
 * in memory by every caller that caches one.
 */
export function captureVideoFrameDataUrl(
    src: string,
    { maxWidth, quality = 0.9 }: { maxWidth?: number; quality?: number } = {},
) {
    return new Promise<string | null>((resolve) => {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'auto';
        const finish = (dataUrl: string | null) => {
            clearTimeout(timeoutId);
            releaseMediaElement(video);
            resolve(dataUrl);
        };
        const timeoutId = setTimeout(() => {
            finish(null);
        }, FRAME_CAPTURE_TIMEOUT);
        video.addEventListener(
            'error',
            () => {
                finish(null);
            },
            { once: true },
        );
        video.addEventListener(
            'loadeddata',
            () => {
                const canvas = document.createElement('canvas');
                const scale =
                    maxWidth === undefined || video.videoWidth <= maxWidth
                        ? 1
                        : maxWidth / video.videoWidth;
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                const context = canvas.getContext('2d');
                if (context === null || canvas.width === 0) {
                    finish(null);
                    return;
                }
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                try {
                    finish(canvas.toDataURL('image/jpeg', quality));
                } catch (error) {
                    handleError(error);
                    finish(null);
                }
            },
            { once: true },
        );
        video.src = src;
    });
}
