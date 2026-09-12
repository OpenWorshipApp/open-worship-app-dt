import { useState } from 'react';

import { decrypt, bible_ref } from '../_owa-crypto';
import { handleError } from '../helper/errorHelpers';
import { useAppEffectAsync } from '../helper/appHooks';
import { appApiFetch } from '../helper/networkHelpers';
import { globalCacheManager10Seconds } from '../others/CacheManager';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import BibleItem from '../bible-list/BibleItem';
import { unlocking } from '../server/unlockingHelpers';
import {
    DEFAULT_LANG_CODE,
    DEFAULT_LOCALE,
    getLangCode,
    getLocalBibleCrossRef,
    supportedLocales,
} from '../lang/langHelpers';
import type { CrossReferenceType } from '../helper/ai/bibleCrossRefHelpers';
import { validateCrossReference } from '../helper/ai/bibleCrossRefHelpers';
import { getBibleModelInfo } from '../helper/bible-helpers/bibleModelHelpers';
import { appLog, appError as logError } from '../helper/loggerHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';

export type RawBibleCrossRefListType = string[][];
export type BibleCrossRefType = {
    text: string;
    isS: boolean;
    isFN: boolean;
    isStar: boolean;
    isTitle: boolean;
    isLXXDSS: boolean;
};

// TODO: subject to remove
async function downloadBibleCrossRef(key: string) {
    try {
        const content = await appApiFetch(`bible-refs/${key}`);
        return await content.text();
    } catch (error) {
        handleError(error);
    }
    return null;
}

async function downloadBibleCrossRefAI(key: string) {
    try {
        const content = await appApiFetch(`bcr/${key}`);
        return await content.text();
    } catch (error) {
        handleError(error);
    }
    return null;
}

function transform(bibleRef: RawBibleCrossRefListType): BibleCrossRefType[][] {
    return bibleRef.map((row) => {
        return row.map((item) => {
            const encoded = bible_ref(item);
            const { text } = JSON.parse(encoded);
            return fromBibleCrossRefText(text);
        });
    });
}

// TODO: subject to remove
export async function getBibleCrossRef(
    bibleTitle: string,
    forceRefresh = false,
) {
    const key = `bible-refs/${bibleTitle}`;
    return unlocking(key, async () => {
        if (!forceRefresh) {
            const cachedData = await globalCacheManager10Seconds.get(key);
            if (cachedData !== null) {
                return cachedData;
            }
        }
        const encryptedText = await downloadBibleCrossRef(bibleTitle);
        if (encryptedText === null) {
            return null;
        }
        const text = decrypt(encryptedText);
        try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
                const data = transform(json);
                await globalCacheManager10Seconds.set(key, data);
                return data;
            }
        } catch (error) {
            logError('Error parsing JSON: for key', bibleTitle);
            handleError(error);
        }
        return null;
    });
}

export async function getBibleCrossRefAI({
    aiType,
    langCode,
    bookKey,
    chapter,
    verse,
}: {
    aiType: string;
    langCode: string;
    bookKey: string;
    chapter: number;
    verse: number;
}) {
    const key = `${aiType}/${langCode}/${bookKey}/${chapter}/${verse}.json`;
    return unlocking(key, async () => {
        const jsonText = await downloadBibleCrossRefAI(key);
        if (jsonText === null) {
            return null;
        }
        try {
            const data = JSON.parse(jsonText);
            if (validateCrossReference(data).valid === false) {
                return null;
            }
            return data as CrossReferenceType[];
        } catch (error) {
            logError('Error parsing JSON: for key', key);
            handleError(error);
        }
        return null;
    });
}

async function fetchBibleCrossRefAI(
    aiType: string,
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    let locale = await getBibleLocale(bibleKey);
    if (supportedLocales.includes(locale) === false) {
        locale = DEFAULT_LOCALE;
    }

    const localData = await getLocalBibleCrossRef(locale, {
        bookKey,
        chapter,
        verse: verseNum,
    });
    if (localData !== null) {
        return localData;
    }

    appLog('No local cross ref found for, fetching online', {
        locale,
        bookKey,
        chapter,
        verseNum,
    });
    const langCode = getLangCode(locale) ?? DEFAULT_LANG_CODE;
    const params = {
        aiType,
        langCode,
        bookKey,
        chapter,
        verse: verseNum,
    };
    let data = await getBibleCrossRefAI(params);
    if (data === null && langCode !== DEFAULT_LANG_CODE) {
        data = await getBibleCrossRefAI({
            ...params,
            langCode: DEFAULT_LANG_CODE,
        });
    }
    return data;
}
export function useGettingBibleCrossRefAI(
    aiType: string,
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const [bibleCrossRef, setBibleCrossRef] = useState<
        CrossReferenceType[] | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            const data = await fetchBibleCrossRefAI(
                aiType,
                bibleKey,
                bookKey,
                chapter,
                verseNum,
            );
            methodContext.setBibleCrossRef(data);
        },
        [aiType, bibleKey, bookKey, chapter, verseNum],
        { setBibleCrossRef },
    );
    return {
        bibleCrossRef,
        refresh: () => {
            setBibleCrossRef(undefined);
            fetchBibleCrossRefAI(
                aiType,
                bibleKey,
                bookKey,
                chapter,
                verseNum,
            ).then((data) => {
                setBibleCrossRef(data);
            });
        },
    };
}

function takeIsS(text: string) {
    // "S GEN 1:1"
    const isS = text.startsWith('S ');
    text = text.replace(/^S\s/, '').trim();
    return { isS, text, extraText: isS ? 'S ' : '' };
}

function takeIsFN(text: string) {
    // "fn GEN 1:1"
    const isFN = text.includes('fn');
    text = text.replaceAll(/(\s?['"]fn['"]\s?)/g, '').trim();
    return { isFN, text, extraText: isFN ? " 'fn'" : '' };
}

function takeIsStar(text: string) {
    // "GEN 1:1 *"
    const isStar = text.includes('*');
    text = text.replaceAll(/(\s?\*\s?)/g, '').trim();
    return { isStar, text, extraText: isStar ? ' *' : '' };
}

function takeIsTitle(text: string) {
    // "Title GEN 1:1"
    const isTitle = text.includes('Title');
    text = text.replaceAll(/(\s?Title\s?)/g, '').trim();
    return { isTitle, text, extraText: isTitle ? ' Title' : '' };
}

function takeIsLXXDSS(text: string) {
    // "GEN 1:1 (LXX and DSS)"
    const isLXXDSS = text.includes('(LXX and DSS)');
    text = text.replaceAll(/(\s?\(LXX and DSS\)\s?)/g, '').trim();
    return { isLXXDSS, text, extraText: isLXXDSS ? ' (LXX and DSS)' : '' };
}

export function fromBibleCrossRefText(text: string): BibleCrossRefType {
    const tokeIsS = takeIsS(text);
    text = tokeIsS.text;
    const tokeIsFN = takeIsFN(text);
    text = tokeIsFN.text;
    const tokeIsStar = takeIsStar(text);
    text = tokeIsStar.text;
    const tokeIsTitle = takeIsTitle(text);
    text = tokeIsTitle.text;
    const tokeIsLXXDSS = takeIsLXXDSS(text);
    text = tokeIsLXXDSS.text;
    return {
        text,
        isS: tokeIsS.isS,
        isFN: tokeIsFN.isFN,
        isStar: tokeIsStar.isStar,
        isTitle: tokeIsTitle.isTitle,
        isLXXDSS: tokeIsLXXDSS.isLXXDSS,
    };
}

// The preview of a verse shown under a cross reference. Cut to a word, and
// marked as cut only when it actually was: `substring(150) + '...'` appended an
// ellipsis to every verse whether or not anything had been removed, so a short
// one ended "living soul...." -- four dots promising a rest of the verse that
// did not exist. Cutting here rather than in CSS is deliberate; the panel can
// hold a hundred of these and the tail is memory nobody reads.
const PREVIEW_MAX_LENGTH = 150;
function toPreviewText(text: string) {
    if (text.length <= PREVIEW_MAX_LENGTH) {
        return text;
    }
    const cut = text.substring(0, PREVIEW_MAX_LENGTH);
    const lastSpaceIndex = cut.lastIndexOf(' ');
    const head = lastSpaceIndex > 0 ? cut.substring(0, lastSpaceIndex) : cut;
    return head.replace(/[\s,;:]+$/, '') + '\u2026';
}

export async function breakItem(bibleKey: string, bibleVerseKey: string) {
    const extracted = bibleRenderHelper.fromKJVBibleVersesKey(bibleVerseKey);
    const bibleModelInfo = getBibleModelInfo();
    const bookKeysOrder = bibleModelInfo.bookKeysOrder;
    if (!bookKeysOrder.includes(extracted.bookKey)) {
        return null;
    }
    const bibleItem = BibleItem.fromJson({
        id: -1,
        bibleKey,
        target: {
            bookKey: extracted.bookKey,
            chapter: extracted.chapter,
            verseStart: extracted.verseStart,
            verseEnd: extracted.verseEnd,
        },
        metadata: {},
    });
    await bibleItem.toTitle();
    const bibleText = await bibleItem.toText();
    return {
        htmlText: toPreviewText(bibleText),
        bibleItem,
        bibleText,
    };
}
