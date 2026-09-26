import { useState } from 'react';

import { electronSendAsync } from '../server/appHelpers';
import { useAppEffect, useAppEffectAsync } from './appHooks';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import CacheManager from '../others/CacheManager';

// Loaded on demand, and only ever for a `file:` url. The screen managers
// import THIS module lazily to keep its chain out of a screen window's
// initial load (`screenWebsiteHelpers`), and a static import of the whole
// file/mime layer here would put that straight back for everyone.
async function importFileHelpers() {
    return await import('../server/fileHelpers');
}

/**
 * TWO caches, one budget, and the difference between them is whether the
 * page can be PROVEN not to have changed.
 *
 * A capture is far and away the most expensive thing in this module: a hidden
 * BrowserWindow, a page load and a three-second sleep, two at a time. A
 * remote page can change with nothing here to observe it, so its shot has to
 * expire — that is what the ten seconds below are for, and they stay.
 *
 * A LOCAL FILE is not like that. Its key carries the md5 of its own bytes
 * (`genScreenshotCacheKey`), so an entry that is still in the cache is still
 * correct, and expiring it buys nothing but another hidden window and another
 * three seconds — paid again on every tab switch, every panel re-open and
 * every scroll that remounts a tile, on the machines that can least afford
 * it. So a file's shot is bounded by BYTES and evicted oldest-first, never by
 * time. The ceiling is the same `MAX_CACHED_SCREENSHOT_CHARS` it always was,
 * shared by both caches: this holds no more memory than before, it just stops
 * throwing away work it can prove is still good.
 */
const REMOTE_SHOT_EXPIRATION_SECOND = 10;
const webScreenshotCacheManager = new CacheManager<string>(
    REMOTE_SHOT_EXPIRATION_SECOND,
);
const fileScreenshotCacheManager = new CacheManager<string>(null);
// A key lives in exactly one of them, so "ask both" is how anything holding
// only a key (the budget sweep, a refresh) reaches the right one.
const screenshotCacheManagerList = [
    webScreenshotCacheManager,
    fileScreenshotCacheManager,
];

// Hashing costs a read of the file, and a panel of tiles asks about the same
// few files at once. The md5 is memoised against what a STAT can see — size
// and mtime — so a cache hit costs one stat instead of a read, and the memo
// expires like everything else here rather than growing.
const fileMd5CacheManager = new CacheManager<string>(10);

/**
 * The md5 of the file a `file:` url names, or null when the url is not a file
 * or there is nothing there to read.
 *
 * mtime is only the MEMO, never the identity: a file restored from a backup or
 * copied back into place gets a new mtime with the same bytes, and re-rendering
 * a page nobody changed is the cost this whole thing exists to avoid.
 */
async function getCaptureFileMd5(url: string) {
    if (!url.startsWith('file:') || !URL.canParse(url)) {
        return null;
    }
    const { fsGetFileStamp, getFileMD5, toFilePathFromFileUrl } =
        await importFileHelpers();
    const filePath = toFilePathFromFileUrl(url);
    const fileStamp = await fsGetFileStamp(filePath);
    if (fileStamp === null) {
        return null;
    }
    const stampKey = `${filePath}-${fileStamp.size}-${fileStamp.modifiedAt}`;
    const cachedMd5 = fileMd5CacheManager.getSync(stampKey);
    if (cachedMd5 !== null) {
        return cachedMd5;
    }
    const md5 = await getFileMD5(filePath);
    if (md5 === null) {
        return null;
    }
    fileMd5CacheManager.setSync(stampKey, md5);
    return md5;
}

/**
 * Which cache this capture belongs in, and under what key.
 *
 * The url stays FIRST in both shapes: `refreshWebCapturing` finds every
 * size/delay variant of a page by that prefix, and a file's old md5 has to be
 * reachable the same way.
 */
async function genScreenshotCacheKey(
    url: string,
    width: number,
    height: number,
    delay: number,
) {
    const md5 = await getCaptureFileMd5(url);
    const sizeKey = `${width}-${height}-${delay}`;
    if (md5 === null) {
        return {
            key: `${url}-${sizeKey}`,
            cacheManager: webScreenshotCacheManager,
            md5: null,
        };
    }
    return {
        key: `${url}-${md5}-${sizeKey}`,
        cacheManager: fileScreenshotCacheManager,
        md5,
    };
}

function checkHasCachedScreenshot(key: string) {
    return screenshotCacheManagerList.some((cacheManager) => {
        return cacheManager.hasSync(key);
    });
}

// Budgeted by TOTAL SIZE, not by entry count. A count cap of 3 was the thrash
// trigger once website canvas items started capturing too: a document with 5
// website boxes would evict each other forever, and every eviction re-spawns a
// hidden BrowserWindow that loads the page and sleeps for seconds. Screenshots
// also vary hugely in size (a canvas item captures at its own box size, a
// background at the display bounds), so entries are not interchangeable units.
//
// 6M chars is ~12MB at UTF-16 — the same ceiling the old 3-entry cap already
// allowed for three full-resolution shots, but it now holds ~10-15 of the
// smaller box-sized ones instead of 3.
const MAX_CACHED_SCREENSHOT_CHARS = 6e6;
// Insertion-ordered, so iterating yields oldest-written first. Kept beside the
// cache because `CacheManager` exposes no way to enumerate its keys.
const cachedScreenshotSizeMap = new Map<string, number>();

async function capCachedScreenshots(key: string, imageData: string | null) {
    // Re-insert so the freshest write moves to the end of the eviction order.
    cachedScreenshotSizeMap.delete(key);
    cachedScreenshotSizeMap.set(key, imageData?.length ?? 0);
    // The cache expires entries on its OWN 5s sweep (`CacheManager` holds a 60s
    // TTL), which this ledger never hears about. Without pruning, the budget
    // keeps charging for screenshots that are already gone — so a cache well
    // under the cap reports itself full and evicts live entries — and the map
    // only ever shrinks while evicting, so with many small shots it grows
    // without bound. `hasSync` is the cache's own expiry check.
    for (const cachedKey of Array.from(cachedScreenshotSizeMap.keys())) {
        if (cachedKey !== key && !checkHasCachedScreenshot(cachedKey)) {
            cachedScreenshotSizeMap.delete(cachedKey);
        }
    }
    let totalSize = 0;
    for (const size of cachedScreenshotSizeMap.values()) {
        totalSize += size;
    }
    for (const [oldestKey, size] of cachedScreenshotSizeMap) {
        if (totalSize <= MAX_CACHED_SCREENSHOT_CHARS) {
            break;
        }
        // Never evict the entry that was just written: the caller is about to
        // use it, and dropping it would re-capture immediately.
        if (oldestKey === key) {
            continue;
        }
        cachedScreenshotSizeMap.delete(oldestKey);
        totalSize -= size;
        await deleteCachedScreenshot(oldestKey);
    }
}

async function deleteCachedScreenshot(key: string) {
    for (const cacheManager of screenshotCacheManagerList) {
        await cacheManager.delete(key);
    }
}

/**
 * Every shot of this url taken of bytes it no longer has.
 *
 * Kept by MD5, not by key: one file is legitimately cached at several sizes
 * at once — the editor canvas, the Canvas Items list and a slide thumbnail
 * each ask for their own box — and dropping the siblings of the size being
 * captured would make those surfaces evict each other forever, which is the
 * thrash `genWebsiteCaptureSize` exists to avoid.
 */
function dropStaleCachedScreenshots(url: string, md5: string) {
    const urlPrefix = `${url}-`;
    const livePrefix = `${url}-${md5}-`;
    for (const key of Array.from(cachedScreenshotSizeMap.keys())) {
        if (!key.startsWith(urlPrefix) || key.startsWith(livePrefix)) {
            continue;
        }
        cachedScreenshotSizeMap.delete(key);
        for (const cacheManager of screenshotCacheManagerList) {
            cacheManager.deleteSync(key);
        }
    }
}

// Capturing is EXPENSIVE: each one opens a hidden BrowserWindow, loads the
// page, sleeps seconds, then screenshots. `unlocking` below dedups callers
// asking for the SAME key, but a slide list mounting N distinct website items
// would otherwise run N hidden Chromium windows at once. Cap how many are ever
// in flight.
//
// Deliberately NOT `unlocking` with a shared key: its waiters poll every 100ms
// and after 600 attempts (60s) it gives up, logs an error and runs the callback
// CONCURRENTLY with the lock holder anyway — a queue of multi-second captures
// blows straight through that. This hands the slot over directly instead, so
// there is no polling and no escape hatch.
const MAX_CONCURRENT_CAPTURES = 2;
let runningCaptureCount = 0;
const captureWaiterList: (() => void)[] = [];

async function acquireCaptureSlot() {
    if (runningCaptureCount < MAX_CONCURRENT_CAPTURES) {
        runningCaptureCount++;
        return;
    }
    await new Promise<void>((resolve) => {
        captureWaiterList.push(resolve);
    });
    // The releaser transferred its slot rather than freeing it, so the count is
    // already correct — incrementing here would over-subscribe.
}

function releaseCaptureSlot() {
    const waiter = captureWaiterList.shift();
    if (waiter !== undefined) {
        waiter();
        return;
    }
    runningCaptureCount--;
}

// A remote screenshot never self-invalidates: a clock or a scoreboard page
// stays frozen until the TTL lapses AND the component remounts.
// `refreshWebCapturing` is how the UI forces a re-capture; every mounted
// `useWebCapturing` for that url re-runs. A local file needs it only to get
// the tiles on screen redrawn — its edited bytes already key elsewhere.
const captureRefreshListenerMap = new Map<string, Set<() => void>>();

// Keys whose in-flight capture was invalidated by `refreshWebCapturing` before
// it finished. What it eventually returns is the very content the refresh was
// asked to replace, so it must not be written to the cache.
const staleCaptureKeySet = new Set<string>();

export function refreshWebCapturing(src: string) {
    // Every size/delay variant of this url has to go, not just the default one.
    const keyPrefix = `${src}-`;
    for (const key of Array.from(cachedScreenshotSizeMap.keys())) {
        if (key.startsWith(keyPrefix)) {
            cachedScreenshotSizeMap.delete(key);
            for (const cacheManager of screenshotCacheManagerList) {
                cacheManager.deleteSync(key);
            }
        }
    }
    // A capture that is STILL RUNNING was started before this refresh, and the
    // re-render below would simply be handed that same promise — so Refresh
    // Preview during a capture used to return exactly what it was asked to
    // replace. Dropping the entry makes the next asker start a new capture, and
    // the mark stops the abandoned one re-caching the old shot behind it.
    for (const key of Array.from(inFlightCaptureMap.keys())) {
        if (key.startsWith(keyPrefix)) {
            inFlightCaptureMap.delete(key);
            staleCaptureKeySet.add(key);
        }
    }
    const listenerSet = captureRefreshListenerMap.get(src);
    if (listenerSet === undefined) {
        return;
    }
    // Copy: a listener may unsubscribe itself while being notified.
    for (const listener of Array.from(listenerSet)) {
        listener();
    }
}

// Same-key dedup, WITHOUT `unlocking`. `unlocking`'s waiters poll every 100ms
// and warn at 50 attempts (5s): when several components ask for the SAME web
// shot at once (a background thumbnail, the mini-screen preview, the live
// preview window), the in-flight capture is itself a `delay`-ms render (up to
// 3s) that may also be queued behind the 2-slot concurrency cap, so every
// duplicate waiter blows past 5s and spams the warning. Sharing one in-flight
// promise per key resolves them all together with no polling — the same
// slot-handoff philosophy `acquireCaptureSlot` already uses.
const inFlightCaptureMap = new Map<string, Promise<string | null>>();

export async function captureWebScreenShot(
    url: string,
    {
        width,
        height,
        delay = 1000,
    }: {
        width: number;
        height: number;
        delay?: number;
    },
) {
    const { key, cacheManager, md5 } = await genScreenshotCacheKey(
        url,
        width,
        height,
        delay,
    );
    // Cache-first, before any slot/coalescing: an already-captured shot must
    // never wait behind an unrelated in-flight capture.
    if (await cacheManager.has(key)) {
        return await cacheManager.get(key);
    }
    const inFlight = inFlightCaptureMap.get(key);
    if (inFlight !== undefined) {
        return await inFlight;
    }
    if (md5 !== null) {
        // A miss on a file usually means its bytes MOVED, so whatever is still
        // held under an older md5 is a picture of a page that no longer
        // exists. Only on the miss, so a hit still costs nothing — and it
        // keeps the shared byte budget for pages somebody can still be shown.
        dropStaleCachedScreenshots(url, md5);
    }
    const capturePromise = (async () => {
        await acquireCaptureSlot();
        let imageData: string | null;
        try {
            imageData = await electronSendAsync<string>(
                'main:app:capture-web-screen-shot',
                {
                    url,
                    width,
                    height,
                    delay,
                },
            );
        } finally {
            releaseCaptureSlot();
        }
        if (staleCaptureKeySet.delete(key)) {
            // Refreshed away mid-flight; a newer capture owns this key now.
            return imageData;
        }
        await cacheManager.set(key, imageData);
        await capCachedScreenshots(key, imageData);
        return imageData;
    })();
    inFlightCaptureMap.set(key, capturePromise);
    try {
        return await capturePromise;
    } finally {
        // Only while the slot is still OURS: a `refreshWebCapturing` mid-flight
        // drops this entry, and a newer capture may already have taken it —
        // clearing that one would let a third caller start yet another.
        if (inFlightCaptureMap.get(key) === capturePromise) {
            inFlightCaptureMap.delete(key);
        }
    }
}

export function useWebCapturing(
    src: string,
    {
        width,
        height,
        // Lets a caller hold off until the thing is actually on screen (see
        // `BoxEditorNormalViewWebsiteModeComp`'s IntersectionObserver). A
        // 50-slide document must only ever capture the few thumbnails scrolled
        // into view.
        isEnabled = true,
    }: { width?: number; height?: number; isEnabled?: boolean } = {},
) {
    const [imageData, setImageData] = useState<string | null | undefined>();
    const [refreshCount, setRefreshCount] = useState(0);
    useAppEffect(() => {
        if (!isEnabled) {
            return;
        }
        const listener = () => {
            setRefreshCount((oldCount) => {
                return oldCount + 1;
            });
        };
        let listenerSet = captureRefreshListenerMap.get(src);
        if (listenerSet === undefined) {
            listenerSet = new Set();
            captureRefreshListenerMap.set(src, listenerSet);
        }
        listenerSet.add(listener);
        return () => {
            listenerSet.delete(listener);
            if (listenerSet.size === 0) {
                captureRefreshListenerMap.delete(src);
            }
        };
    }, [src, isEnabled]);
    useAppEffectAsync(
        async (contextMethods) => {
            contextMethods.setImageData(undefined);
            if (!isEnabled) {
                return;
            }
            // `getDefaultScreenDisplay` is a BLOCKING sync IPC to the main
            // process, so only reach for it when a dimension is actually
            // missing — a caller that knows its own size (every canvas item
            // does) must not pay for it once per mount.
            const screenDisplay =
                width === undefined || height === undefined
                    ? getDefaultScreenDisplay()
                    : null;
            const imageData = await captureWebScreenShot(src, {
                width: width ?? screenDisplay!.bounds.width,
                height: height ?? screenDisplay!.bounds.height,
                delay: 3000,
            });
            contextMethods.setImageData(imageData);
        },
        [src, width, height, isEnabled, refreshCount],
        { setImageData },
    );
    return imageData;
}
