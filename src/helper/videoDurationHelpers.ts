import CacheManager from '../others/CacheManager';
import { releaseMediaElement } from './mediaHelpers';

/**
 * How long a clip runs, read from its own metadata.
 *
 * This is what "wait until the video ends" is built on, and it is deliberately
 * NOT an `ended` listener on the element playing it: that element lives in the
 * screen's own window (and in the mini preview, and once per screen), so the
 * event would have to be relayed back across windows and a show with two
 * screens up would have two of them racing. A duration is one number, the same
 * in every window, and it costs one metadata read per clip.
 *
 * Cached only briefly: a show asks once as it schedules each clip, so a short
 * window is enough to stop a rescheduled tick probing the same file twice, and
 * nothing here may grow into a map of every video the user owns.
 */
const durationCache = new CacheManager<number>(10);

// A file that cannot be read must not be probed again every tick.
const UNREADABLE_DURATION = -1;

const METADATA_TIMEOUT_MILLIS = 10 * 1000;

function readDuration(src: string) {
    return new Promise<number>((resolve) => {
        const element = document.createElement('video');
        element.preload = 'metadata';
        element.muted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const finish = (duration: number) => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            element.onloadedmetadata = null;
            element.onerror = null;
            // A metadata read still builds a player, and Chromium hands out
            // only so many per frame -- see `releaseMediaElement`.
            releaseMediaElement(element);
            resolve(duration);
        };
        element.onloadedmetadata = () => {
            const { duration } = element;
            finish(
                Number.isFinite(duration) && duration > 0
                    ? // WHOLE seconds, rounded UP. This number is both the
                      // wait and what the seconds box shows the operator, and
                      // a clip reported as `188.035011` filled a 35px box with
                      // noise. Up rather than nearest so the wait never ends
                      // before the clip does and cuts its last frames.
                      Math.ceil(duration)
                    : UNREADABLE_DURATION,
            );
        };
        element.onerror = () => {
            finish(UNREADABLE_DURATION);
        };
        // A file being written, or one on a stick that went away, otherwise
        // leaves the element -- and the show waiting on it -- alive for good.
        timeoutId = setTimeout(() => {
            finish(UNREADABLE_DURATION);
        }, METADATA_TIMEOUT_MILLIS);
        element.src = src;
    });
}

/**
 * The clip's length in seconds, or null when it cannot be read.
 *
 * `src` is what a `<video>` can load -- the background layer stores exactly
 * that, and a caller holding a file path hands over
 * `FileSource.getInstance(filePath).src`.
 */
export async function getVideoDurationSeconds(src: string) {
    const cachedDuration = await durationCache.get(src);
    if (cachedDuration !== null) {
        return cachedDuration === UNREADABLE_DURATION ? null : cachedDuration;
    }
    const duration = await readDuration(src);
    await durationCache.set(src, duration);
    return duration === UNREADABLE_DURATION ? null : duration;
}
