import { useState } from 'react';

import { decrypt, bible_ref } from '../_owa-crypto';
import { handleError } from '../helper/errorHelpers';
import { toBibleFileName } from '../helper/bible-helpers/bibleLogicHelpers1';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { appApiFetch } from '../helper/networkHelpers';
import CacheManager from '../others/CacheManager';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import BibleItem from '../bible-list/BibleItem';
import { unlocking } from '../server/unlockingHelpers';
import { getLangCode } from '../lang/langHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleLogicHelpers2';
import {
    CrossReferenceType,
    validateCrossReference,
} from '../helper/ai/bibleCrossRefHelpers';
import { getBibleModelInfo } from '../helper/bible-helpers/bibleModelHelpers';

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
const bibleCrossRefCache = new CacheManager<BibleCrossRefType[][]>(60); // 1 minute
export async function getBibleCrossRef(
    bibleTitle: string,
    forceRefresh = false,
) {
    return unlocking(`bible-refs/${bibleTitle}`, async () => {
        if (!forceRefresh) {
            const cachedData = await bibleCrossRefCache.get(bibleTitle);
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
                await bibleCrossRefCache.set(bibleTitle, data);
                return data;
            }
        } catch (error) {
            console.error('Error parsing JSON: for key', bibleTitle);
            handleError(error);
        }
        return null;
    });
}

const bibleCrossRefAICache = new CacheManager<CrossReferenceType[]>(60); // 1 minute
export async function getBibleCrossRefAI(
    {
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
    },
    forceRefresh = false,
) {
    const key = `${aiType}/${langCode}/${bookKey}/${chapter}/${verse}.json`;
    return unlocking(key, async () => {
        if (!forceRefresh) {
            const cachedData = await bibleCrossRefAICache.get(key);
            if (cachedData !== null) {
                return cachedData;
            }
        }
        const jsonText = await downloadBibleCrossRefAI(key);
        if (jsonText === null) {
            return null;
        }
        try {
            const data = JSON.parse(jsonText);
            if (validateCrossReference(data).valid === false) {
                return null;
            }
            await bibleCrossRefAICache.set(key, data);
            return data as CrossReferenceType[];
        } catch (error) {
            console.error('Error parsing JSON: for key', key);
            handleError(error);
        }
        return null;
    });
}

// TODO: subject to remove
export function useGettingBibleCrossRef(
    bookKey: string,
    chapter: number,
    verseNum: number,
) {
    const key = `${toBibleFileName(bookKey, chapter)}.${verseNum}`;
    const [bibleCrossRef, setBibleCrossRef] = useState<
        BibleCrossRefType[][] | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            const data = await getBibleCrossRef(key);
            methodContext.setBibleCrossRef(data);
        },
        [bookKey, chapter],
        { setBibleCrossRef },
    );
    return {
        bibleCrossRef,
        refresh: () => {
            setBibleCrossRef(undefined);
            getBibleCrossRef(key, true).then((data) => {
                setBibleCrossRef(data);
            });
        },
    };
}

async function fetchBibleCrossRefAI(
    aiType: string,
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verseNum: number,
    forceRefresh = false,
) {
    const locale = await getBibleLocale(bibleKey);
    const langCode = getLangCode(locale) ?? 'en';
    const params = {
        aiType,
        langCode,
        bookKey,
        chapter,
        verse: verseNum,
    };
    let data = await getBibleCrossRefAI(params, forceRefresh);
    if (data === null && langCode !== 'en') {
        data = await getBibleCrossRefAI(
            {
                ...params,
                langCode: 'en',
            },
            forceRefresh,
        );
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
        [bibleKey, bookKey, chapter, verseNum],
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
                true,
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
        htmlText: bibleText.substring(0, 150) + '...',
        bibleItem,
        bibleText,
    };
}
