import { CSSProperties } from 'react';

import {
    keyToBook,
    getVerses,
    getBibleInfo,
    getBibleInfoIsRtl,
    toVerseKeyFormat,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    kjvBibleInfo,
    getKJVChapterCount,
    getKJVBookKeyValue,
} from '../helper/bible-helpers/bibleLogicHelpers1';
import {
    checkShouldNewLine,
    checkShouldNewLineKJV,
    getLangFromBibleKey,
    toLocaleNumBible,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import CacheManager from '../others/CacheManager';
import { unlocking } from '../server/unlockingHelpers';
import {
    getCustomVerseText,
    getNewLineTitlesHtmlText,
} from '../helper/bible-helpers/bibleLogicHelpers3';

export type BibleTargetType = {
    bookKey: string;
    chapter: number;
    verseStart: number;
    verseEnd: number;
};

export type CompiledVerseType = {
    verse: number;
    localeVerse: string;
    text: string;
    customText: string | null;
    isNewLine: boolean;
    isKJVNewLine: boolean;
    newLineTitlesHtmlText: string | null;
    bibleKey: string;
    bookKey: string;
    chapter: number;
    kjvBibleVersesKey: string;
    bibleVersesKey: string;
    isFirst: boolean;
    isLast: boolean;
    isRtl: boolean;
    style: CSSProperties;
};

const titleCache = new CacheManager<string>(60); // 1 minute
const compiledVerseListCache = new CacheManager<CompiledVerseType[]>(60); // 1 minute
class BibleRenderHelper {
    toKJVBibleVersesKey(
        bibleTarget: BibleTargetType,
        endBibleTarget?: BibleTargetType,
    ) {
        const { bookKey: book, chapter, verseStart, verseEnd } = bibleTarget;
        let txtV = `${verseStart}${
            verseStart === verseEnd ? '' : '-' + verseEnd
        }`;
        if (endBibleTarget != undefined) {
            const { chapter: endChapter, verseEnd: endVerseEnd } =
                endBibleTarget;
            txtV = txtV.split('-')[0];
            txtV += `-${endChapter}:${endVerseEnd}`;
        }
        return toVerseKeyFormat(book, chapter, txtV);
    }
    toBibleVersesKey(
        bibleKey: string,
        bibleTarget: BibleTargetType,
        endBibleTarget?: BibleTargetType,
    ) {
        return `(${bibleKey}) ${this.toKJVBibleVersesKey(bibleTarget, endBibleTarget)}`;
    }
    fromKJVBibleVersesKey(kjvBibleVersesKey: string) {
        const arr = kjvBibleVersesKey.split(':');
        const [bookKey, chapter] = arr[0].split(' ');
        const [verseStart, verseEnd] = arr[1].split('-');
        return {
            bookKey,
            chapter: Number(chapter),
            verseStart: Number(verseStart),
            verseEnd: verseEnd ? Number(verseEnd) : Number(verseStart),
        };
    }
    fromBibleVerseKey(bibleVersesKey: string) {
        const arr = bibleVersesKey.split(') ');
        const bibleKey = arr[0].slice(1);
        return {
            bibleKey,
            ...this.fromKJVBibleVersesKey(arr[1]),
        };
    }

    toTitleQueueKey(bibleVersesKey: string) {
        return `title > ${bibleVersesKey}`;
    }
    toVerseTextListQueueKey(bibleVersesKey: string) {
        return `text > ${bibleVersesKey}`;
    }
    async toLocaleBook(bibleKey: string, bookKey: string) {
        return (
            (await keyToBook(bibleKey, bookKey)) ||
            getKJVBookKeyValue()[bookKey]
        );
    }
    async toTitle(
        bibleKey: string,
        target: BibleTargetType,
        endTarget?: BibleTargetType,
    ) {
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
            endTarget,
        );
        return await unlocking(bibleVersesKey, async () => {
            const cachedTitle = await titleCache.get(bibleVersesKey);
            if (cachedTitle !== null) {
                return cachedTitle;
            }
            const { bookKey, chapter, verseStart, verseEnd } = target;
            const chapterLocale = await toLocaleNumBible(bibleKey, chapter);
            const verseStartLocale = await toLocaleNumBible(
                bibleKey,
                verseStart,
            );
            const verseEndLocale = await toLocaleNumBible(bibleKey, verseEnd);
            const txtV = `${verseStartLocale}${
                verseStart === verseEnd ? '' : '-' + verseEndLocale
            }`;
            const ensuredBookKey = await this.toLocaleBook(bibleKey, bookKey);
            let title = toVerseKeyFormat(
                ensuredBookKey,
                chapterLocale ?? '-1',
                txtV,
            );
            if (endTarget !== undefined) {
                const endChapterLocale = await toLocaleNumBible(
                    bibleKey,
                    endTarget.chapter,
                );
                const endVerseEndLocale = await toLocaleNumBible(
                    bibleKey,
                    endTarget.verseEnd,
                );
                if (endChapterLocale && endVerseEndLocale) {
                    title = title.split('-')[0];
                    title += `-${endChapterLocale}:${endVerseEndLocale}`;
                }
            }
            await titleCache.set(bibleVersesKey, title);
            return title;
        });
    }

    async getVerseTextExtra(
        bibleKey: string,
        bookKey: string,
        chapter: number,
        verse: number,
        isSkipExtra: boolean,
    ) {
        if (isSkipExtra) {
            return {
                customText: null,
                isNewLine: false,
                isKJVNewLine: false,
                newLineTitlesHtmlText: null,
            };
        }
        const isNewLine =
            verse == 1 ||
            (await checkShouldNewLine(bibleKey, bookKey, chapter, verse));
        const isKJVNewLine = await checkShouldNewLineKJV(
            bibleKey,
            bookKey,
            chapter,
            verse,
        );
        const newLineTitlesHtmlText = await getNewLineTitlesHtmlText(
            bibleKey,
            bookKey,
            chapter,
            verse,
        );
        const customText = await getCustomVerseText(
            bibleKey,
            bookKey,
            chapter,
            verse,
        );
        return {
            customText,
            isNewLine,
            isKJVNewLine,
            newLineTitlesHtmlText,
        };
    }

    async toVerseTextList(
        bibleKey: string,
        target: BibleTargetType,
        isSkipExtra = false,
    ) {
        const isRtl = await getBibleInfoIsRtl(bibleKey);
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
        );
        const langData = await getLangFromBibleKey(bibleKey);
        return unlocking(bibleVersesKey, async () => {
            const { bookKey, chapter, verseStart, verseEnd } = target;
            const verses = await getVerses(bibleKey, bookKey, chapter);
            if (!verses) {
                return null;
            }
            const compiledVersesList: CompiledVerseType[] = [];
            for (let i = verseStart; i <= verseEnd; i++) {
                const extra = await this.getVerseTextExtra(
                    bibleKey,
                    bookKey,
                    chapter,
                    i,
                    isSkipExtra,
                );
                const localNum = await toLocaleNumBible(bibleKey, i);
                const iString = i.toString();
                const genTarget = (verse: number) => {
                    return {
                        bookKey,
                        chapter,
                        verseStart: verse,
                        verseEnd: verse,
                    };
                };
                const kjvBibleVersesKey = this.toKJVBibleVersesKey(
                    genTarget(i),
                );
                const bibleVersesKey = this.toBibleVersesKey(
                    bibleKey,
                    genTarget(i),
                );
                const isFirst = i === verseStart;
                const isLast = i === verseEnd;
                compiledVersesList.push({
                    verse: i,
                    localeVerse: localNum ?? iString,
                    text: verses[iString] ?? '??',
                    bibleKey,
                    bookKey,
                    chapter,
                    kjvBibleVersesKey,
                    bibleVersesKey,
                    isFirst,
                    isLast,
                    isRtl,
                    style:
                        langData === null
                            ? {}
                            : { fontFamily: langData.fontFamily },
                    ...extra,
                });
            }
            await compiledVerseListCache.set(
                bibleVersesKey,
                compiledVersesList,
            );
            return compiledVersesList;
        });
    }
    async getJumpingChapter(
        bibleKey: string,
        target: BibleTargetType,
        isNext: boolean,
    ): Promise<BibleTargetType | null> {
        const { bookKey, chapter } = target;
        const bibleInfo = await getBibleInfo(bibleKey);
        if (bibleInfo === null) {
            return null;
        }
        const bookKeysOrder = kjvBibleInfo.bookKeysOrder;
        const bookIndex = bookKeysOrder.indexOf(bookKey);
        let nextBookIndex = bookIndex;
        let nextChapter = chapter + (isNext ? 1 : -1);
        if (nextChapter < 1 || nextChapter > getKJVChapterCount(bookKey)) {
            const bookLength = bookKeysOrder.length;
            nextBookIndex =
                (bookLength + nextBookIndex + (isNext ? 1 : -1)) % bookLength;
            nextChapter = isNext
                ? 1
                : getKJVChapterCount(bookKeysOrder[nextBookIndex]);
        }
        const verses = await getVerses(bibleKey, bookKey, nextChapter);
        return {
            bookKey: bookKeysOrder[nextBookIndex],
            chapter: nextChapter,
            verseStart: 1,
            verseEnd: verses ? Object.keys(verses).length : 1,
        };
    }
    async toText(
        bibleKey: string,
        target: BibleTargetType,
        isSkipExtra = false,
    ) {
        const verseTextList = await this.toVerseTextList(
            bibleKey,
            target,
            isSkipExtra,
        );
        if (verseTextList === null) {
            const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
                bibleKey,
                target,
            );
            return `😟Unable to render text for ${bibleVersesKey}`;
        }
        return verseTextList
            .map(({ localeVerse, text }) => {
                return `(${localeVerse}): ${text}`;
            })
            .join(' ');
    }
}

export const bibleRenderHelper = new BibleRenderHelper();
