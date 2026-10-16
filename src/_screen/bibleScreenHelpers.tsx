import { renderToStaticMarkup } from 'react-dom/server';
import type BibleItem from '../bible-list/BibleItem';
import type {
    BibleItemRenderingType,
    BibleRenderVerseType,
} from './bibleScreenComps';
import {
    LongTextTableComp,
    SCREEN_BIBLE_MORE_CHAPTER_ATTRIBUTE,
} from './bibleScreenComps';
import type { LongTextColumnType } from './screenLongTextTypeHelpers';
import { toBibleLongTextColumns } from './screenLongTextTypeHelpers';
import { getHTMLChild } from '../helper/helpers';
import appProvider from '../server/appProvider';
import { DEFAULT_LOCALE, getLangDataAsync } from '../lang/langHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';
import { BIBLE_SHOWN_CHAPTER_COUNT } from '../helper/bible-helpers/bibleTargetHelpers';

const bibleScreenHelper = {
    /**
     * The table of either source, as a detached element. `isLongText` is a
     * long text in several languages; otherwise the columns are Bibles.
     */
    async genHtmlFromLongTextColumns(
        columns: LongTextColumnType[],
        {
            isLineSync,
            isLongText,
            moreChapterLabel,
        }: {
            isLineSync: boolean;
            isLongText: boolean;
            moreChapterLabel?: string;
        },
    ) {
        if (columns.length === 0) {
            return document.createElement('table');
        }
        const langColumns = await Promise.all(
            columns.map(async (column) => {
                let langData = await getLangDataAsync(column.locale);
                langData ??= await getLangDataAsync(DEFAULT_LOCALE);
                return {
                    ...column,
                    langData: langData!,
                };
            }),
        );
        const htmlString = renderToStaticMarkup(
            <LongTextTableComp
                columns={langColumns}
                isLineSync={isLineSync}
                isLongText={isLongText}
                moreChapterLabel={moreChapterLabel}
            />,
        );
        const div = document.createElement('div');
        div.innerHTML = htmlString;
        return getHTMLChild<HTMLDivElement>(div, 'div');
    },

    genHtmlFromScreenViewBibleItem(
        bibleRenderingList: BibleItemRenderingType[],
        isLineSync: boolean,
        // Only for an operator's view of a passage with chapters to come.
        moreChapterLabel?: string,
    ) {
        return this.genHtmlFromLongTextColumns(
            toBibleLongTextColumns(bibleRenderingList),
            { isLineSync, isLongText: false, moreChapterLabel },
        );
    },

    removeClassName(parent: HTMLElement, className: string) {
        const targets = parent.querySelectorAll<HTMLSpanElement>(
            `span.${className}`,
        );
        const arrChildren = Array.from(targets);
        for (const target of arrChildren) {
            target.classList.remove(className);
        }
        return arrChildren;
    },
    resetClassName(
        parent: HTMLElement,
        className: string,
        isAdd: boolean,
        kjvVerseKey?: string,
    ) {
        const currentBlocks = parent.querySelectorAll(
            `[data-kjv-verse-key="${kjvVerseKey}"]`,
        );
        for (const currentBlock of currentBlocks) {
            if (isAdd) {
                currentBlock.classList.add(className);
            } else {
                currentBlock.classList.remove(className);
            }
        }
        return currentBlocks;
    },
    registerHighlight(
        div: HTMLDivElement,
        {
            onSelectKey,
            onBibleSelect,
            onShowMoreChapter,
        }: {
            onSelectKey: (
                selectedKJVVerseKey: string | null,
                isToTop: boolean,
            ) => void;
            onBibleSelect: (event: MouseEvent, index: number) => void;
            onShowMoreChapter?: () => void;
        },
    ) {
        if (!appProvider.isPageScreen) {
            const moreChapterButtons = div.querySelectorAll<HTMLButtonElement>(
                `[${SCREEN_BIBLE_MORE_CHAPTER_ATTRIBUTE}]`,
            );
            for (const button of Array.from(moreChapterButtons)) {
                // Its own: a click or double-click here selects no verse.
                button.addEventListener('click', (event) => {
                    event.stopPropagation();
                    onShowMoreChapter?.();
                });
                button.addEventListener('dblclick', (event) => {
                    event.stopPropagation();
                });
            }
            const divBibleKeys =
                div.querySelectorAll<HTMLSpanElement>('div.bible-name');
            for (const divBibleKey of Array.from(divBibleKeys)) {
                divBibleKey.addEventListener('mouseover', () => {
                    divBibleKey.classList.add('hover');
                });
                divBibleKey.addEventListener('mouseout', () => {
                    divBibleKey.classList.remove('hover');
                });
                divBibleKey.addEventListener('click', (event) => {
                    const index = Number(divBibleKey.dataset.index);
                    onBibleSelect(event, index);
                });
            }
        }
        const spans = div.querySelectorAll<HTMLSpanElement>('span.highlight');
        for (const span of Array.from(spans)) {
            const kjvVerseKey = span.dataset.kjvVerseKey;
            span.addEventListener('mouseover', () => {
                this.resetClassName(div, 'hover', true, kjvVerseKey);
            });
            span.addEventListener('mouseout', () => {
                this.resetClassName(div, 'hover', false, kjvVerseKey);
            });
            const clickHandler = (isToTop: boolean) => {
                const arrChildren = this.removeClassName(div, 'selected');
                const kjvVerseKey = span.dataset.kjvVerseKey;
                if (!arrChildren.includes(span) && kjvVerseKey) {
                    onSelectKey(kjvVerseKey, isToTop);
                } else {
                    onSelectKey(null, false);
                }
            };
            span.addEventListener('click', (event) => {
                clickHandler(event.altKey);
            });
            span.addEventListener('dblclick', (event) => {
                event.stopPropagation();
                event.preventDefault();
                clickHandler(true);
            });
        }
    },
    /**
     * What a screen draws of each Bible's passage. A passage crossing
     * chapters is drawn `shownChapterCount` chapters deep, a divider above
     * each; the operator's `...` asks for one more.
     */
    genBibleItemRenderList(
        bibleItems: BibleItem[],
        shownChapterCount = BIBLE_SHOWN_CHAPTER_COUNT,
    ) {
        return Promise.all(
            bibleItems.map(async (bibleItem) => {
                const { bibleKey } = bibleItem;
                const [bibleTitle, verseTextList, locale] = await Promise.all([
                    bibleItem.toTitle(),
                    bibleRenderHelper.toVerseTextList(
                        bibleKey,
                        bibleItem.target,
                        true,
                        { start: 0, count: shownChapterCount },
                    ),
                    getBibleLocale(bibleKey),
                ]);
                const verseList: BibleRenderVerseType[] = (
                    verseTextList ?? []
                ).map((verseInfo) => {
                    return {
                        num: verseInfo.localeVerse,
                        text: verseInfo.text,
                        verseKey: verseInfo.bibleVersesKey,
                        kjvVerseKey: verseInfo.kjvBibleVersesKey,
                        ...(verseInfo.isChapterStart
                            ? { chapterLabel: verseInfo.localeChapter }
                            : {}),
                    };
                });
                const rendering: BibleItemRenderingType = {
                    locale,
                    bibleKey,
                    title: bibleTitle,
                    verses: verseList,
                };
                return rendering;
            }),
        );
    },
};

export default bibleScreenHelper;
