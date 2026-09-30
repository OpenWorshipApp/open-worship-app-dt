import { useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { captureVideoFrameDataUrl } from '../helper/mediaHelpers';

/**
 * The still a video tile shows when nobody is hovering it.
 *
 * A tile used to hold a live `<video>` just to paint one frame, which is a
 * whole media player -- decoder, demuxer, frame pool -- per file in the
 * folder. One frame, captured once and drawn as a picture, costs none of
 * that, so a folder of a thousand videos scrolls like a folder of a thousand
 * images and only the tile under the mouse ever has a player.
 *
 * The cache is deliberately small and short-lived: a thumbnail-sized JPEG is
 * ~10-20 KB, and this app runs on machines where a cache that quietly grows
 * is the bug. Past `MAX_POSTER_COUNT` the least recently used one goes, and
 * anything untouched for `MAX_POSTER_AGE` goes on the next sweep.
 */
const POSTER_MAX_WIDTH = 320;
const POSTER_QUALITY = 0.7;
const MAX_POSTER_COUNT = 150;
const MAX_POSTER_AGE = 10 * 60 * 1000;
// Three at a time fills a screenful in a couple of seconds without three
// dozen players existing at once; the pause between them keeps the main
// thread free for the scroll that is probably still happening.
const MAX_POSTER_WORKER_COUNT = 3;
const POSTER_IDLE_TIMEOUT = 60;

type PosterEntryType = {
    // `null` is a video whose frame could not be read -- remembered so it is
    // not retried on every scroll past it.
    dataUrl: string | null;
    lastUsedAt: number;
};

const posterMap = new Map<string, PosterEntryType>();
const listenerMap = new Map<string, Set<(dataUrl: string | null) => void>>();
// A Set keeps insertion order, so it is the FIFO queue with O(1) has/delete.
const pendingSet = new Set<string>();
let workerCount = 0;

function sweepPosterMap() {
    const now = Date.now();
    for (const [src, entry] of posterMap) {
        if (now - entry.lastUsedAt > MAX_POSTER_AGE) {
            posterMap.delete(src);
        }
    }
    while (posterMap.size > MAX_POSTER_COUNT) {
        // Map iterates in insertion order and a read re-inserts, so the first
        // key is the least recently used one.
        const [oldestSrc] = posterMap.keys();
        posterMap.delete(oldestSrc);
    }
}

function readPosterEntry(src: string) {
    const entry = posterMap.get(src);
    if (entry === undefined) {
        return undefined;
    }
    entry.lastUsedAt = Date.now();
    posterMap.delete(src);
    posterMap.set(src, entry);
    return entry.dataUrl;
}

function writePosterEntry(src: string, dataUrl: string | null) {
    posterMap.set(src, { dataUrl, lastUsedAt: Date.now() });
    sweepPosterMap();
}

/**
 * Yields between captures so a screenful of them cannot hold the main thread,
 * but never waits for ever: a window that is not on screen runs no idle
 * callbacks at all, and the queue used to stop after its first still.
 */
function waitForIdle() {
    return new Promise((resolve) => {
        let isDone = false;
        const finish = () => {
            if (isDone) {
                return;
            }
            isDone = true;
            resolve(null);
        };
        const idleCallback = (
            globalThis as typeof globalThis & {
                requestIdleCallback?: (
                    handler: () => void,
                    options?: { timeout: number },
                ) => void;
            }
        ).requestIdleCallback;
        idleCallback?.(finish, { timeout: POSTER_IDLE_TIMEOUT });
        setTimeout(finish, POSTER_IDLE_TIMEOUT);
    });
}

/**
 * A few at a time, and never for a tile that has scrolled away in the
 * meantime: capturing a frame spins up a player of its own, and doing that
 * for a whole screenful at once is the stutter this was meant to remove.
 */
async function workPendingPosters() {
    if (workerCount >= MAX_POSTER_WORKER_COUNT) {
        return;
    }
    workerCount += 1;
    try {
        while (pendingSet.size > 0) {
            const [src] = pendingSet;
            pendingSet.delete(src);
            const dataUrl = await captureVideoFrameDataUrl(src, {
                maxWidth: POSTER_MAX_WIDTH,
                quality: POSTER_QUALITY,
            });
            writePosterEntry(src, dataUrl);
            for (const listener of listenerMap.get(src) ?? []) {
                listener(dataUrl);
            }
            await waitForIdle();
        }
    } finally {
        workerCount -= 1;
    }
}

function requestPoster(
    src: string,
    listener: (dataUrl: string | null) => void,
) {
    let listenerSet = listenerMap.get(src);
    if (listenerSet === undefined) {
        listenerSet = new Set();
        listenerMap.set(src, listenerSet);
    }
    listenerSet.add(listener);
    pendingSet.add(src);
    workPendingPosters();
    return () => {
        const currentSet = listenerMap.get(src);
        if (currentSet === undefined) {
            return;
        }
        currentSet.delete(listener);
        if (currentSet.size === 0) {
            listenerMap.delete(src);
            // Scrolled away while it queued -- nobody is waiting for it.
            pendingSet.delete(src);
        }
    };
}

/** The tile's still, or null until there is one (or if there can never be). */
export function useVideoPoster(src: string) {
    const [posterDataUrl, setPosterDataUrl] = useState<string | null>(() => {
        return readPosterEntry(src) ?? null;
    });
    useAppEffect(() => {
        const cachedDataUrl = readPosterEntry(src);
        if (cachedDataUrl !== undefined) {
            setPosterDataUrl(cachedDataUrl);
            return;
        }
        setPosterDataUrl(null);
        return requestPoster(src, setPosterDataUrl);
    }, [src]);
    return posterDataUrl;
}
