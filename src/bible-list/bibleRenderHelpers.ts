import type { CSSProperties } from 'react';

import {
    keyToBook,
    getVerses,
    getBibleInfo,
    getBibleInfoIsRtl,
    toVerseFullKeyFormat,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    getModelChapterCount,
    getModelKeyBookMap,
} from '../helper/bible-helpers/bibleLogicHelpers1';
import {
    checkShouldNewLine,
    checkShouldNewLineModel,
    toLocaleNumBible,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import CacheManager from '../others/CacheManager';
import {
    toVerseListText,
    type BibleVerseNumberStyleType,
} from './bibleVerseTextHelpers';
import { unlocking } from '../server/unlockingHelpers';
import {
    getCustomVerseText,
    getNewLineTitlesHtmlText,
} from '../helper/bible-helpers/bibleLogicHelpers3';
import { getBibleModelInfo } from '../helper/bible-helpers/bibleModelHelpers';
import { type LocaleType } from '../lang/langHelpers';
import { getLangDataFromBibleKey } from '../helper/bible-helpers/bibleStyleHelpers';
import type { BibleTargetType } from '../helper/bible-helpers/bibleTargetHelpers';
import {
    checkIsCrossChapterTarget,
    getTargetChapterEnd,
    normalizeBibleTarget,
    toSingleChapterTarget,
    toTargetChapterSliceList,
} from '../helper/bible-helpers/bibleTargetHelpers';

export type { BibleTargetType } from '../helper/bible-helpers/bibleTargetHelpers';

export type CompiledVerseType = {
    verse: number;
    localeVerse: string;
    text: string;
    customText: string | null;
    isNewLine: boolean;
    isModelNewLine: boolean;
    newLineTitlesHtmlText: string | null;
    bibleKey: string;
    bookKey: string;
    chapter: number;
    kjvBibleVersesKey: string;
    bibleVersesKey: string;
    // The first and last verse of the WHOLE passage, across its chapters.
    isFirst: boolean;
    isLast: boolean;
    // The first verse of a chapter in a passage crossing chapters: where a
    // chapter divider goes. Never true in a one-chapter passage.
    isChapterStart: boolean;
    localeChapter: string;
    isRtl: boolean;
    style: CSSProperties;
    locale: LocaleType;
};

// A chapter's own title within a passage crossing chapters, `John 2:1-25`:
// the header of that chapter's text when the passage is copied.
export type BibleTextSectionType = {
    chapter: number;
    localeChapter: string;
    title: string;
    text: string;
};

// `JHN 1:2-3:4`, `JHN 3:16-18`, `JHN 3:16`
const KJV_VERSES_KEY_REGEX = /^(\S+) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/;

// `PSA 56:title`: a psalm's heading, as the cross-reference data writes it
// (16 of the ~1.47M targets in each shipped bundle). The KJV prints the
// superscription unnumbered just before verse 1, so verse 1 is where such a
// reference points.
const KJV_PSALM_TITLE_KEY_REGEX = /^PSA (\d+):title$/;

// A chapter or verse number a passage can hold. `\d+` alone lets through 0
// and a run of digits that is past `Number.MAX_SAFE_INTEGER`.
function checkIsVerseNumber(value: number) {
    return Number.isSafeInteger(value) && value >= 1;
}

const titleCache = new CacheManager<string>(10);
class BibleRenderHelper {
    toKJVBibleVersesKey(bibleTarget: BibleTargetType) {
        const { bookKey: book, chapter, verseStart, verseEnd } = bibleTarget;
        const chapterEnd = checkIsCrossChapterTarget(bibleTarget)
            ? getTargetChapterEnd(bibleTarget)
            : null;
        return toVerseFullKeyFormat(
            book,
            chapter,
            verseStart,
            verseEnd,
            chapterEnd,
        );
    }
    toBibleVersesKey(bibleKey: string, bibleTarget: BibleTargetType) {
        return `(${bibleKey}) ${this.toKJVBibleVersesKey(bibleTarget)}`;
    }
    fromKJVBibleVersesKey(kjvBibleVersesKey: string): BibleTargetType {
        const match = KJV_VERSES_KEY_REGEX.exec(kjvBibleVersesKey.trim());
        if (match !== null) {
            const [, bookKey, chapter, verseStart, chapterEnd, verseEnd] =
                match;
            return normalizeBibleTarget({
                bookKey,
                chapter: Number(chapter),
                verseStart: Number(verseStart),
                verseEnd: Number(verseEnd ?? verseStart),
                chapterEnd:
                    chapterEnd === undefined ? undefined : Number(chapterEnd),
            });
        }
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
    /**
     * A KJV key as a passage, or null when it names none: for keys that come
     * from DATA rather than from this app, which are not always well formed.
     * `fromKJVBibleVersesKey` reads whatever it is given, and the AI cross
     * references hold `PSA 56:title` and fragments such as `PSA 119:ющ` —
     * read leniently those were `Number('title')`, NaN, a row titled
     * `Psalm 56:` whose press opened "Record not found".
     *
     * Accepts what `KJV_VERSES_KEY_REGEX` accepts, plus a psalm heading read
     * as its verse 1. Null for anything else, for a number that is not a
     * chapter or verse, and for a range that runs backwards (`JHN 3:18-16`,
     * `JHN 3:1-2:4`).
     */
    parseKJVBibleVersesKey(kjvBibleVersesKey: string): BibleTargetType | null {
        const key = kjvBibleVersesKey.trim();
        const titleMatch = KJV_PSALM_TITLE_KEY_REGEX.exec(key);
        if (titleMatch !== null) {
            const chapter = Number(titleMatch[1]);
            return checkIsVerseNumber(chapter)
                ? toSingleChapterTarget('PSA', chapter, 1, 1)
                : null;
        }
        const match = KJV_VERSES_KEY_REGEX.exec(key);
        if (match === null) {
            return null;
        }
        const [, bookKey, chapterText, verseStartText, chapterEndText] = match;
        const verseEndText = match[5] ?? verseStartText;
        const chapter = Number(chapterText);
        const verseStart = Number(verseStartText);
        const verseEnd = Number(verseEndText);
        const chapterEnd =
            chapterEndText === undefined ? chapter : Number(chapterEndText);
        if (
            ![chapter, verseStart, verseEnd, chapterEnd].every(
                checkIsVerseNumber,
            ) ||
            chapterEnd < chapter ||
            (chapterEnd === chapter && verseEnd < verseStart)
        ) {
            return null;
        }
        return normalizeBibleTarget({
            bookKey,
            chapter,
            verseStart,
            verseEnd,
            chapterEnd,
        });
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
            getModelKeyBookMap()[bookKey]
        );
    }
    /**
     * Each part of a title in the Bible's own book name and digits, for an
     * editor that lets each part be picked: `chapterEnd` is `null` unless the
     * passage crosses chapters.
     */
    async toTitleParts(bibleKey: string, target: BibleTargetType) {
        const { bookKey, chapter, verseStart, verseEnd } = target;
        const isCrossChapter = checkIsCrossChapterTarget(target);
        const book = await this.toLocaleBook(bibleKey, bookKey);
        const chapterLocale = await toLocaleNumBible(bibleKey, chapter);
        const verseStartLocale = await toLocaleNumBible(bibleKey, verseStart);
        const verseEndLocale = await toLocaleNumBible(bibleKey, verseEnd);
        const chapterEndLocale = isCrossChapter
            ? await toLocaleNumBible(bibleKey, getTargetChapterEnd(target))
            : null;
        return {
            book,
            chapter: chapterLocale ?? '-1',
            verseStart: verseStartLocale ?? `${verseStart}`,
            verseEnd: verseEndLocale ?? `${verseEnd}`,
            chapterEnd: chapterEndLocale,
        };
    }
    // `John 3:16`, `John 3:16-18`, `John 1:2-3:4`
    async toTitle(bibleKey: string, target: BibleTargetType) {
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
        );
        // Its own queue: the verse list titles nothing, and the two sharing
        // one key made either wait on the other.
        const queueKey = this.toTitleQueueKey(bibleVersesKey);
        return await unlocking(queueKey, async () => {
            const cachedTitle = await titleCache.get(bibleVersesKey);
            if (cachedTitle !== null) {
                return cachedTitle;
            }
            const parts = await this.toTitleParts(bibleKey, target);
            const title = toVerseFullKeyFormat(
                parts.book,
                parts.chapter,
                parts.verseStart,
                parts.verseEnd,
                parts.chapterEnd,
            );
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
                isModelNewLine: false,
                newLineTitlesHtmlText: null,
            };
        }
        const isNewLine =
            verse === 1 ||
            (await checkShouldNewLine(bibleKey, bookKey, chapter, verse));
        const isModelNewLine = await checkShouldNewLineModel(
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
            isModelNewLine,
            newLineTitlesHtmlText,
        };
    }

    /**
     * The passage's verses, chapter by chapter: the first chapter from
     * `verseStart`, the middle ones whole, the last up to `verseEnd`.
     *
     * `range` reads only `count` chapters from the `start`-th — a view of a
     * long passage reads the chapters it shows, never the whole book. Each
     * chapter's verse count comes from the chapter read itself. A chapter
     * the Bible lacks ends the list there; when even the first is missing
     * there is no list at all.
     */
    async toVerseTextList(
        bibleKey: string,
        target: BibleTargetType,
        isSkipExtra = false,
        range?: { start: number; count: number },
    ) {
        const isRtl = await getBibleInfoIsRtl(bibleKey);
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
        );
        const queueKey = this.toVerseTextListQueueKey(
            `${bibleVersesKey}|${range?.start ?? 0}:${range?.count ?? '*'}` +
                `|${isSkipExtra}`,
        );
        const langData = await getLangDataFromBibleKey(bibleKey);
        return unlocking(queueKey, async () => {
            const { bookKey } = target;
            const isCrossChapter = checkIsCrossChapterTarget(target);
            const style =
                langData === null ? {} : { fontFamily: langData.fontFamily };
            const locale: LocaleType = langData?.locale ?? 'en-US';
            const compiledVersesList: CompiledVerseType[] = [];
            const sliceList = toTargetChapterSliceList(
                target,
                range?.start ?? 0,
                range?.count,
            );
            for (const slice of sliceList) {
                const { chapter } = slice;
                const verses = await getVerses(bibleKey, bookKey, chapter);
                if (!verses) {
                    if (compiledVersesList.length === 0) {
                        return null;
                    }
                    break;
                }
                const sliceVerseEnd =
                    slice.verseEnd ?? Object.keys(verses).length;
                const localeChapter =
                    (await toLocaleNumBible(bibleKey, chapter)) ?? `${chapter}`;
                for (let i = slice.verseStart; i <= sliceVerseEnd; i++) {
                    const extra = await this.getVerseTextExtra(
                        bibleKey,
                        bookKey,
                        chapter,
                        i,
                        isSkipExtra,
                    );
                    const localNum = await toLocaleNumBible(bibleKey, i);
                    const iString = i.toString();
                    const verseTarget = toSingleChapterTarget(
                        bookKey,
                        chapter,
                        i,
                        i,
                    );
                    compiledVersesList.push({
                        verse: i,
                        localeVerse: localNum ?? iString,
                        text: verses[iString] ?? '??',
                        bibleKey,
                        bookKey,
                        chapter,
                        kjvBibleVersesKey:
                            this.toKJVBibleVersesKey(verseTarget),
                        bibleVersesKey: this.toBibleVersesKey(
                            bibleKey,
                            verseTarget,
                        ),
                        isFirst: slice.isFirstChapter && i === slice.verseStart,
                        isLast: slice.isLastChapter && i === sliceVerseEnd,
                        isChapterStart:
                            isCrossChapter && i === slice.verseStart,
                        localeChapter,
                        isRtl,
                        style,
                        ...extra,
                        locale,
                    });
                }
            }
            return compiledVersesList;
        });
    }
    async getJumpingChapter(
        bibleKey: string,
        target: BibleTargetType,
        isNext: boolean,
    ): Promise<BibleTargetType | null> {
        const { bookKey } = target;
        // Forward from where the passage ENDS: the chapter after `John 1:2-3:4`
        // is John 4, not John 2.
        const chapter = isNext ? getTargetChapterEnd(target) : target.chapter;
        const bibleInfo = await getBibleInfo(bibleKey);
        if (bibleInfo === null) {
            return null;
        }
        const bibleModelInfo = getBibleModelInfo();
        const bookKeysOrder = bibleModelInfo.bookKeysOrder;
        const bookIndex = bookKeysOrder.indexOf(bookKey);
        let nextBookIndex = bookIndex;
        let nextChapter = chapter + (isNext ? 1 : -1);
        if (nextChapter < 1 || nextChapter > getModelChapterCount(bookKey)) {
            const bookLength = bookKeysOrder.length;
            nextBookIndex =
                (bookLength + nextBookIndex + (isNext ? 1 : -1)) % bookLength;
            nextChapter = isNext
                ? 1
                : getModelChapterCount(bookKeysOrder[nextBookIndex]);
        }
        // The verse count belongs to the chapter being jumped TO: across a book
        // boundary that is another book, and counting the old book's chapter
        // cut Obadiah 1 to 17 verses and asked for Revelation 22:1-24.
        const nextBookKey = bookKeysOrder[nextBookIndex];
        const verses = await getVerses(bibleKey, nextBookKey, nextChapter);
        return {
            bookKey: nextBookKey,
            chapter: nextChapter,
            verseStart: 1,
            verseEnd: verses ? Object.keys(verses).length : 1,
        };
    }
    /**
     * A passage crossing chapters as one section per chapter, each under its
     * own title (`John 2:1-25`): what is copied, so a reader can tell where
     * the verse numbers start over. `range` reads only those chapters.
     */
    async toTextSectionList(
        bibleKey: string,
        target: BibleTargetType,
        isSkipExtra = false,
        range?: { start: number; count: number },
        verseNumberStyle: BibleVerseNumberStyleType = 'parenthesis',
    ): Promise<BibleTextSectionType[] | null> {
        const verseTextList = await this.toVerseTextList(
            bibleKey,
            target,
            isSkipExtra,
            range,
        );
        if (verseTextList === null) {
            return null;
        }
        const groupList: CompiledVerseType[][] = [];
        for (const verseInfo of verseTextList) {
            const lastGroup = groupList.at(-1);
            if (lastGroup?.[0]?.chapter === verseInfo.chapter) {
                lastGroup.push(verseInfo);
            } else {
                groupList.push([verseInfo]);
            }
        }
        const sectionList: BibleTextSectionType[] = [];
        for (const group of groupList) {
            const first = group[0];
            const last = group.at(-1) ?? first;
            const title = await this.toTitle(
                bibleKey,
                toSingleChapterTarget(
                    target.bookKey,
                    first.chapter,
                    first.verse,
                    last.verse,
                ),
            );
            sectionList.push({
                chapter: first.chapter,
                localeChapter: first.localeChapter,
                title,
                text: toVerseListText(group, verseNumberStyle),
            });
        }
        return sectionList;
    }
    /**
     * `(16): For God so loved… (17): …` — and, across chapters, each
     * chapter's text under its own title line. `verseNumberStyle` numbers
     * the verses `16: …` or not at all instead.
     */
    async toText(
        bibleKey: string,
        target: BibleTargetType,
        isSkipExtra = false,
        maxChapterCount?: number,
        verseNumberStyle: BibleVerseNumberStyleType = 'parenthesis',
    ) {
        if (checkIsCrossChapterTarget(target)) {
            const sectionList = await this.toTextSectionList(
                bibleKey,
                target,
                isSkipExtra,
                maxChapterCount === undefined
                    ? undefined
                    : { start: 0, count: maxChapterCount },
                verseNumberStyle,
            );
            if (sectionList !== null) {
                return sectionList
                    .map(({ title, text }) => {
                        return `${title}\n${text}`;
                    })
                    .join('\n');
            }
        } else {
            const verseTextList = await this.toVerseTextList(
                bibleKey,
                target,
                isSkipExtra,
            );
            if (verseTextList !== null) {
                return toVerseListText(verseTextList, verseNumberStyle);
            }
        }
        const bibleVersesKey = bibleRenderHelper.toBibleVersesKey(
            bibleKey,
            target,
        );
        return `😟Unable to render text for ${bibleVersesKey}`;
    }
}

export const bibleRenderHelper = new BibleRenderHelper();
