import { useState } from 'react';

import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { FontListType } from './appProvider';
import appProvider from './appProvider';
import CacheManager from '../others/CacheManager';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import FileSource from '../helper/FileSource';
import { electronSendAsync } from './appHelpers';
import { unlocking } from './unlockingHelpers';

const cacheManager = new CacheManager<FontListType | null>(60 * 10); // 10 minutes
export async function getFontFamilyMapByNodeFont() {
    return await unlocking('getFontFamilyMapByNodeFont', async () => {
        const cachedFontList = await cacheManager.get('fontList');
        if (cachedFontList !== null) {
            return cachedFontList;
        }
        appProvider.messageUtils.sendData('main:app:get-font-list');
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

const handledFontFamilies = new Set<string>();
export async function fixMissingFontFamilies(
    fontFamilies: Set<string>,
    filePath: string,
) {
    fontFamilies = new Set(
        Array.from(fontFamilies).filter((fontFamily) => {
            return !handledFontFamilies.has(fontFamily);
        }),
    );
    if (fontFamilies.size === 0) {
        return;
    }
    for (const fontFamily of fontFamilies) {
        handledFontFamilies.add(fontFamily);
    }
    const fileSource = FileSource.getInstance(filePath);
    const isConfirmed = await showAppConfirm(
        `Missing Fonts in "${fileSource.name}"`,
        `The document is using fonts that are not installed on your system:<br><br>${Array.from(
            fontFamilies,
        )
            .map((font) => `"${font}"`)
            .join(
                ', ',
            )}<br><br>Would you like to find and install from Google Fonts?`,
        {
            confirmButtonLabel: 'Yes',
        },
    );
    if (!isConfirmed) {
        return;
    }
    showSimpleToast(
        'Opening Google Fonts',
        'Please install the missing fonts from the opened pages. and restart the app after installation.',
    );
    for (const fontFamily of fontFamilies) {
        appProvider.browserUtils.openExternalURL(
            `https://fonts.google.com/specimen/${encodeURIComponent(fontFamily)}`,
        );
    }
}
