import { useState } from 'react';

import { electronSendAsync } from '../server/appHelpers';
import { useAppEffectAsync } from './debuggerHelpers';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import CacheManager from '../others/CacheManager';
import { unlocking } from '../server/unlockingHelpers';

const webScreenshotCacheManager = new CacheManager<string>(60 /* 1 minute */);
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
