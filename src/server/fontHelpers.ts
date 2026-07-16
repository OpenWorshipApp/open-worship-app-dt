import { useState } from 'react';

import { useAppEffectAsync } from '../helper/appHooks';
import type { FontListType } from './appProvider';
import appProvider from './appProvider';
import CacheManager from '../others/CacheManager';
import { electronSendAsync } from './appHelpers';
import { unlocking } from './unlockingHelpers';

const cacheManager = new CacheManager<FontListType | null>(60 * 10); // 10 minutes
export async function getFontFamilyMapByNodeFont() {
    return await unlocking('getFontFamilyMapByNodeFont', async () => {
        const cachedFontList = await cacheManager.get('fontList');
        if (cachedFontList !== null) {
            return cachedFontList;
        }
        const result = await electronSendAsync<FontListType | null>(
            'main:app:get-font-list',
        );
        await cacheManager.set('fontList', result);
        return result;
    });
}

export async function getFontFamilies() {
    const fontMap = await getFontFamilyMapByNodeFont();
    if (fontMap === null) {
        return [];
    }
    return Object.keys(fontMap).map((key) => {
        return key.trim().toLowerCase();
    });
}

export function useFontList() {
    const [fontList, setFontList] = useState<FontListType | null | undefined>(
        undefined,
    );
    useAppEffectAsync(
        async (contextMethods) => {
            if (fontList !== undefined) {
                return;
            }
            const fonts = await getFontFamilyMapByNodeFont();
            contextMethods.setFontList(fonts);
        },
        [fontList],
        { setFontList },
    );
    return fontList;
}

export function getMissingFontSearchUrl(fontFamily: string) {
    return `https://www.google.com/search?q=font+download: "${fontFamily}"`;
}

export function searchMissingFontFamily(fontFamily: string) {
    appProvider.browserUtils.openExternalURL(
        getMissingFontSearchUrl(fontFamily),
    );
}
