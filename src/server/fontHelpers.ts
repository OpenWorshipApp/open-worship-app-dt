import { useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import appProvider, { FontListType } from './appProvider';
import CacheManager from '../others/CacheManager';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import FileSource from '../helper/FileSource';

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
