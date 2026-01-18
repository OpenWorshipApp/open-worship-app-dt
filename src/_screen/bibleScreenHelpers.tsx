import { renderToStaticMarkup } from 'react-dom/server';
import { getVerses } from '../helper/bible-helpers/bibleInfoHelpers';
import {
    getBibleLocale,
    toLocaleNumBible,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import BibleItem from '../bible-list/BibleItem';
import {
    BibleItemRenderingType,
    BibleBibleTable,
    BibleRenderVerseType,
} from './bibleScreenComps';
import { getHTMLChild } from '../helper/helpers';
import appProvider from '../server/appProvider';
import { getLangDataAsync } from '../lang/langHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';

const bibleScreenHelper = {
    async genHtmlFromScreenViewBibleItem(
        bibleRenderingList: BibleItemRenderingType[],
        isLineSync: boolean,
    ) {
        if (bibleRenderingList.length === 0) {
            return document.createElement('table');
        }
        const bibleRenderingLangList = await Promise.all(
            bibleRenderingList.map(async (item) => {
                let langData = await getLangDataAsync(item.locale);
                langData ??= await getLangDataAsync('en-US');
                return {
                    ...item,
                    langData: langData!,
                };
            }),
        );
        const versesCount = bibleRenderingList[0].verses.length;
        const htmlString = renderToStaticMarkup(
            <BibleBibleTable
                bibleRenderingList={bibleRenderingLangList}
                isLineSync={isLineSync}
                versesCount={versesCount}
            />,
        );
        const div = document.createElement('div');
        div.innerHTML = htmlString;
        return getHTMLChild<HTMLDivElement>(div, 'div');
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
        }: {
            onSelectKey: (
                selectedKJVVerseKey: string | null,
                isToTop: boolean,
            ) => void;
            onBibleSelect: (event: MouseEvent, index: number) => void;
        },
    ) {
        if (!appProvider.isPageScreen) {
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
    genBibleItemRenderList(bibleItems: BibleItem[]) {
        return Promise.all(
            bibleItems.map((bibleItem) => {
                return new Promise<BibleItemRenderingType>((resolve, _) => {
                    (async () => {
                        const bibleTitle = await bibleItem.toTitle();
                        const verses = await getVerses(
                            bibleItem.bibleKey,
                            bibleItem.target.bookKey,
                            bibleItem.target.chapter,
                        );
                        const verseList: BibleRenderVerseType[] = [];
                        if (verses !== null) {
                            for (
                                let i = bibleItem.target.verseStart;
                                i <= bibleItem.target.verseEnd;
                                i++
                            ) {
                                const verseNumb = await toLocaleNumBible(
                                    bibleItem.bibleKey,
                                    i,
                                );
                                const verseKey =
                                    bibleRenderHelper.toBibleVersesKey(
                                        bibleItem.bibleKey,
                                        {
                                            bookKey: bibleItem.target.bookKey,
                                            chapter: bibleItem.target.chapter,
                                            verseStart: i,
                                            verseEnd: i,
                                        },
                                    );
                                const kjvVerseKey =
                                    bibleRenderHelper.toKJVBibleVersesKey({
                                        bookKey: bibleItem.target.bookKey,
                                        chapter: bibleItem.target.chapter,
                                        verseStart: i,
                                        verseEnd: i,
                                    });
                                if (verseNumb !== null) {
                                    verseList.push({
                                        num: verseNumb,
                                        text: verses[`${i}`],
                                        verseKey,
                                        kjvVerseKey,
                                    });
                                }
                            }
                        }
                        const locale = await getBibleLocale(bibleItem.bibleKey);
                        resolve({
                            locale,
                            bibleKey: bibleItem.bibleKey,
                            title: bibleTitle,
                            verses: verseList,
                        });
                    })();
                });
            }),
        );
    },
};

export default bibleScreenHelper;
