import { useState } from 'react';

import { decrypt, bible_ref } from '../_owa-crypto';
import { handleError } from '../helper/errorHelpers';
import {
    kjvBibleInfo,
    toBibleFileName,
} from '../helper/bible-helpers/serverBibleHelpers';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { appApiFetch } from '../helper/networkHelpers';
import CacheManager from '../others/CacheManager';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import BibleItem from '../bible-list/BibleItem';
import { unlocking } from '../server/unlockingHelpers';

export type RawBibleCrossRefListType = string[][];
export type BibleCrossRefType = {
    text: string;
    isS: boolean;
    isFN: boolean;
    isStar: boolean;
    isTitle: boolean;
    isLXXDSS: boolean;
};

async function downloadBibleCrossRef(key: string) {
    try {
        const content = await appApiFetch(`bible-refs/${key}`);
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

const cache = new CacheManager<BibleCrossRefType[][]>(60); // 1 minute
export async function getBibleCrossRef(key: string, forceRefresh = false) {
    return unlocking(`bible-refs/${key}`, async () => {
        if (!forceRefresh) {
            const cachedData = await cache.get(key);
            if (cachedData !== null) {
                return cachedData;
            }
        }
        const encryptedText = await downloadBibleCrossRef(key);
        if (encryptedText === null) {
            return null;
        }
        const text = decrypt(encryptedText);
        try {
            const json = JSON.parse(text);
            if (Array.isArray(json)) {
                const data = transform(json);
                await cache.set(key, data);
                return data;
            }
        } catch (error) {
            console.error('Error parsing JSON: for key', key);
            handleError(error);
        }
        return null;
    });
}

export function useGetBibleCrossRef(
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

function takeIsS(text: string) {
    // "S GEN 1:1"
    const isS = text.startsWith('S ');
    text = text.replace(/^S\s/, '').trim();
    return { isS, text, extraText: isS ? 'S ' : '' };
}

function takeIsFN(text: string) {
    // "fn GEN 1:1"
    const isFN = text.includes('fn');
    text = text.replace(/(\s?['"]fn['"]\s?)/g, '').trim();
    return { isFN, text, extraText: isFN ? " 'fn'" : '' };
}

function takeIsStar(text: string) {
    // "GEN 1:1 *"
    const isStar = text.includes('*');
    text = text.replace(/(\s?\*\s?)/g, '').trim();
    return { isStar, text, extraText: isStar ? ' *' : '' };
}

function takeIsTitle(text: string) {
    // "Title GEN 1:1"
    const isTitle = text.includes('Title');
    text = text.replace(/(\s?Title\s?)/g, '').trim();
    return { isTitle, text, extraText: isTitle ? ' Title' : '' };
}

function takeIsLXXDSS(text: string) {
    // "GEN 1:1 (LXX and DSS)"
    const isLXXDSS = text.includes('(LXX and DSS)');
    text = text.replace(/(\s?\(LXX and DSS\)\s?)/g, '').trim();
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
    const bookKeysOrder = kjvBibleInfo.bookKeysOrder;
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
