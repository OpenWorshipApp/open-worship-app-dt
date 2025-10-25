import { useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import appProvider, { FontListType } from './appProvider';
import CacheManager from '../others/CacheManager';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

function showLoadingFontFail() {
    showSimpleToast('Loading Fonts', 'Fail to load font list');
}

const cache = new CacheManager<FontListType | null>(60 * 10); // 10 minutes
export function getFontFamilyMapByNodeFont() {
    const cached = cache.getSync('fontList');
    if (cached !== null) {
        return cached;
    }
    appProvider.messageUtils.sendData('main:app:get-font-list');
    const result = appProvider.messageUtils.sendDataSync(
        'main:app:get-font-list',
    ) as FontListType | null;
    cache.set('fontList', result);
    return result;
}

export function getFontFamilies() {
    const fontMap = getFontFamilyMapByNodeFont();
    if (fontMap === null) {
        return [];
    }
    return Object.keys(fontMap).map((key) => {
        return key.trim().toLowerCase();
    });
}

export function useFontList() {
    const [fontList, setFontList] = useState<FontListType | null>(null);
    useAppEffect(() => {
        if (fontList === null) {
            const fonts = getFontFamilyMapByNodeFont();
            if (fonts === null) {
                showLoadingFontFail();
            } else {
                setFontList(fonts);
            }
        }
    }, [fontList]);
    return fontList;
}

let fixing = false;
export async function fixMissingFontFamilies(fontFamilies: Set<string>) {
    if (fontFamilies.size === 0) {
        return;
    }
    if (fixing) {
        return;
    }
    fixing = true;

    const isConfirmed = await showAppConfirm(
        'Missing Fonts',
        `The document is using fonts that are not installed on your system:<br><br>${Array.from(
            fontFamilies,
        )
            .map((font) => `"${font}"`)
            .join(
                ', ',
            )}<br><br>Would you like to find and install from Google Fonts?`,
    );
    if (!isConfirmed) {
        fixing = false;
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
