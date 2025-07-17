import {
    keyToBook,
    getVerses,
    getBibleInfo,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    bibleObj,
    getKJVChapterCount,
    getKJVKeyValue,
} from '../helper/bible-helpers/serverBibleHelpers';
import {
    getBibleLocale,
    toLocaleNumBible,
} from '../helper/bible-helpers/serverBibleHelpers2';
import { getLangAsync } from '../lang/langHelpers';
import CacheManager from '../others/CacheManager';
import { unlocking } from '../server/unlockingHelpers';

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
    isNewLine: boolean;
    bibleKey: string;
    kjvBibleVersesKey: string;
    bibleVersesKey: string;
};

const titleCache = new CacheManager<string>(60); // 1 minute
const compiledVerseListCache = new CacheManager<CompiledVerseType[]>(60); // 1 minute
class BibleRenderHelper {
    toKJVBibleVersesKey(bibleTarget: BibleTargetType) {
        const { bookKey: book, chapter, verseStart, verseEnd } = bibleTarget;
        const txtV = `${verseStart}${
            verseStart !== verseEnd ? '-' + verseEnd : ''
        }`;
        return `${book} ${chapter}:${txtV}`;
    }
    toBibleVersesKey(bibleKey: string, bibleTarget: BibleTargetType) {
        return `(${bibleKey}) ${this.toKJVBibleVersesKey(bibleTarget)}`;
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
            (await keyToBook(bibleKey, bookKey)) || getKJVKeyValue()[bookKey]
        );
    }
    async toTitle(bibleKey: string, target: BibleTargetType) {
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
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
                verseStart !== verseEnd ? '-' + verseEndLocale : ''
            }`;
            const ensuredBookKey = await this.toLocaleBook(bibleKey, bookKey);
            const title = `${ensuredBookKey} ${chapterLocale}:${txtV}`;
            await titleCache.set(bibleVersesKey, title);
            return title;
        });
    }

    async toVerseTextList(bibleKey: string, target: BibleTargetType) {
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
        );
        return unlocking(bibleVersesKey, async () => {
            const { bookKey, chapter, verseStart, verseEnd } = target;
            const verses = await getVerses(bibleKey, bookKey, chapter);
            if (!verses) {
                return null;
            }
            const locale = await getBibleLocale(bibleKey);
            const langData = await getLangAsync(locale);
            const compiledVersesList: CompiledVerseType[] = [];
            for (let i = verseStart; i <= verseEnd; i++) {
                const localNum = await toLocaleNumBible(bibleKey, i);
                let isNewLine = i == 1;
                if (langData !== null && i > 1) {
                    isNewLine = langData.checkShouldNewLine(
                        verses[(i - 1).toString()] ?? '??',
                    );
                }
                const iString = i.toString();
                compiledVersesList.push({
                    verse: i,
                    localeVerse: localNum ?? iString,
                    text: verses[iString] ?? '??',
                    isNewLine,
                    bibleKey,
                    kjvBibleVersesKey: this.toKJVBibleVersesKey({
                        bookKey: bookKey,
                        chapter,
                        verseStart: i,
                        verseEnd: i,
                    }),
                    bibleVersesKey: this.toBibleVersesKey(bibleKey, {
                        bookKey: bookKey,
                        chapter,
                        verseStart: i,
                        verseEnd: i,
                    }),
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
        const booksOrder = bibleObj.booksOrder;
        const bookIndex = booksOrder.findIndex(
            (bookKey1) => bookKey1 === bookKey,
        );
        let nextBookIndex = bookIndex;
        let nextChapter = chapter + (isNext ? 1 : -1);
        if (nextChapter < 1 || nextChapter > getKJVChapterCount(bookKey)) {
            const bookLength = booksOrder.length;
            nextBookIndex =
                (bookLength + nextBookIndex + (isNext ? 1 : -1)) % bookLength;
            nextChapter = isNext
                ? 1
                : getKJVChapterCount(booksOrder[nextBookIndex]);
        }
        const verses = await getVerses(bibleKey, bookKey, nextChapter);
        return {
            bookKey: booksOrder[nextBookIndex],
            chapter: nextChapter,
            verseStart: 1,
            verseEnd: verses ? Object.keys(verses).length : 1,
        };
    }
    async toText(bibleKey: string, target: BibleTargetType) {
        const verseTextList = await this.toVerseTextList(bibleKey, target);
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
