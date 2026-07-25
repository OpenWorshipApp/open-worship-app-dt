import { useState } from 'react';

import { electronSendAsync } from '../server/appHelpers';
import { useAppEffectAsync } from './appHooks';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import CacheManager from '../others/CacheManager';
import { unlocking } from '../server/unlockingHelpers';

const webScreenshotCacheManager = new CacheManager<string>(60 /* 1 minute */);
// Full-resolution base64 screenshots are several MB each; keep only the few
// most recent ones so the cache stays bounded on low-spec machines.
const MAX_CACHED_SCREENSHOTS = 3;
const cachedScreenshotKeys: string[] = [];
async function capCachedScreenshots(key: string) {
    const keyIndex = cachedScreenshotKeys.indexOf(key);
    if (keyIndex !== -1) {
        cachedScreenshotKeys.splice(keyIndex, 1);
    }
    cachedScreenshotKeys.push(key);
    while (cachedScreenshotKeys.length > MAX_CACHED_SCREENSHOTS) {
        const oldestKey = cachedScreenshotKeys.shift();
        if (oldestKey !== undefined) {
            await webScreenshotCacheManager.delete(oldestKey);
        }
    }
}
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
    const key = `${url}-${width}-${height}-${delay}`;
    return await unlocking(key, async () => {
        if (await webScreenshotCacheManager.has(key)) {
            const cachedData = await webScreenshotCacheManager.get(key);
            return cachedData;
        }
        const imageData = await electronSendAsync<string>(
            'main:app:capture-web-screen-shot',
            {
                url,
                width,
                height,
                delay,
            },
        );
        await webScreenshotCacheManager.set(key, imageData);
        await capCachedScreenshots(key);
        return imageData;
    });
}
export function useWebCapturing(
    src: string,
    { width, height }: { width?: number; height?: number } = {},
) {
    const [imageData, setImageData] = useState<string | null | undefined>();
    useAppEffectAsync(
        async (contextMethods) => {
            contextMethods.setImageData(undefined);
            const screenDisplay = getDefaultScreenDisplay();
            const imageData = await captureWebScreenShot(src, {
                width: width ?? screenDisplay.bounds.width,
                height: height ?? screenDisplay.bounds.height,
                delay: 3000,
            });
            contextMethods.setImageData(imageData);
        },
        [src, width, height],
        { setImageData },
    );
    return imageData;
}
