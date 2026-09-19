import { useState } from 'react';

import { useAppEffectAsync } from '../helper/appHooks';
import type { FontListType } from './appProvider';
import appProvider from './appProvider';
import CacheManager from '../others/CacheManager';
import { electronSendAsync } from './appHelpers';
import { unlocking } from './unlockingHelpers';

const cacheManager = new CacheManager<FontListType | null>(10);
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

// The typographic names of the standard weights. They are not run through
// `tran()`: like a font's own name they are what the font calls itself, and the
// Khmer dictionary's `Light` already means the light THEME.
const FONT_WEIGHT_NAME_MAP = new Map<string, string>([
    ['100', 'Thin'],
    ['200', 'Extra Light'],
    ['300', 'Light'],
    ['350', 'Semi Light'],
    ['400', 'Regular'],
    ['500', 'Medium'],
    ['600', 'Semi Bold'],
    ['700', 'Bold'],
    ['800', 'Extra Bold'],
    ['900', 'Black'],
    ['950', 'Extra Black'],
]);

// The weight picker used to store `--` for "no weight"; it stores nothing now.
export function toCleanFontWeight(fontWeight: string | null | undefined) {
    const cleanFontWeight = (fontWeight ?? '').trim();
    return cleanFontWeight === '--' ? '' : cleanFontWeight;
}

export function toFontWeightLabel(fontWeight: string) {
    const name = FONT_WEIGHT_NAME_MAP.get(fontWeight);
    return name === undefined ? fontWeight : `${fontWeight} ${name}`;
}

export function genFontWeightOptions(
    fontWeights: string[],
    fontWeight: string,
    // The caller translates it: this module is imported by every window, and
    // `tran` would drag the whole language layer in for one word.
    missingLabel = '(Missing)',
) {
    const options: [string, string][] = fontWeights.map((weight) => {
        return [weight, toFontWeightLabel(weight)];
    });
    if (fontWeight !== '' && !fontWeights.includes(fontWeight)) {
        // A `<select>` whose value matches no option shows its FIRST, which
        // would read as though the saved weight were the default.
        options.unshift([
            fontWeight,
            `${toFontWeightLabel(fontWeight)} ${missingLabel}`,
        ]);
    }
    return options;
}

export function getMissingFontSearchUrl(fontFamily: string) {
    return `https://www.google.com/search?q=font+download: "${fontFamily}"`;
}

export function searchMissingFontFamily(fontFamily: string) {
    appProvider.browserUtils.openExternalURL(
        getMissingFontSearchUrl(fontFamily),
    );
}
