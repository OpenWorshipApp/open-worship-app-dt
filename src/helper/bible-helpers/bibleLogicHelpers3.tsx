import { getChapterData, toVerseFullKeyFormat } from './bibleInfoHelpers';
import BibleItem from '../../bible-list/BibleItem';
import CacheManager from '../../others/CacheManager';
import { unlocking } from '../../server/unlockingHelpers';
import type {
    ContentTitleType,
    CustomTitlesVerseType,
    CustomVerseContentType,
} from './BibleDataReader';
import appProvider from '../../server/appProvider';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import type LookupBibleItemController from '../../bible-reader/LookupBibleItemController';
import type BibleItemsViewController from '../../bible-reader/BibleItemsViewController';
import { copyToClipboard } from '../../server/appHelpers';
import { bibleRenderHelper } from '../../bible-list/bibleRenderHelpers';
import { elementDivider } from '../../context-menu/AppContextMenuComp';
import { getLangDataFromBibleKey } from './bibleLogicHelpers2';

async function getBibleItemsFromTitleVerseKey(
    bibleKey: string,
    verseKey: string,
) {
    let verseKey2: string | null = null;
    if (/(\s.+:.+)-(.+:.+)/.exec(verseKey)) {
        const arr = verseKey.split('-');
        const verseKey1 = arr[0].trim() + '-';
        const key2Arr = arr[1].trim().split(':');
        const key2 = `${key2Arr[0]}:1-${key2Arr[1]}`;
        verseKey2 = `${verseKey1.split(' ')[0]} ${key2}`;
        verseKey = verseKey1;
    }
    const bibleItem = await BibleItem.fromVerseKey(bibleKey, verseKey);
    if (bibleItem === null) {
        return {
            title: null,
            bibleItem1: null,
            bibleItem2: null,
        };
    }
    let title = await bibleRenderHelper.toTitle(bibleKey, bibleItem.target);
    if (verseKey2 === null) {
        return {
            title,
            bibleItem1: bibleItem,
            bibleItem2: null,
        };
    }
    const bibleItem2 = await BibleItem.fromVerseKey(bibleKey, verseKey2);
    title = await bibleRenderHelper.toTitle(
        bibleKey,
        bibleItem.target,
        bibleItem2?.target,
    );
    return {
        title,
        bibleItem1: bibleItem,
        bibleItem2,
    };
}

async function compileVerseTitle(bibleKey: string, content: string) {
    const dom = document.createElement('div');
    dom.innerHTML = content;
    const spans = dom.querySelectorAll<HTMLSpanElement>(
        'span[data-title-verse-key]',
    );
    for (const span of spans) {
        const verseKey = span.dataset.titleVerseKey;
        if (!verseKey) {
            continue;
        }
        span.classList.add('app-caught-hover-pointer');
        span.title = verseKey;
        span.dataset.bibleKey = bibleKey;
        const { bibleItem1, bibleItem2 } = await getBibleItemsFromTitleVerseKey(
            bibleKey,
            verseKey,
        );
        if (bibleItem1 === null) {
            continue;
        }
        const text1 = await bibleItem1.toText();
        const title1 = await bibleItem1.toTitle();
        let title = `${title1}  ${text1}`;
        if (bibleItem2 !== null) {
            const text2 = await bibleItem2.toText();
            const title2 = await bibleItem2.toTitle();
            title += `\n${title2}  ${text2}`;
        }
        span.title = title;
    }
    return dom.innerHTML;
}

function genContextMenuItems(
    bibleItemViewController: BibleItemsViewController,
    bibleKey: string,
    bibleItem: BibleItem,
    targetBibleItem: BibleItem,
    title: string,
    onSelect?: () => void,
) {
    return [
        {
            menuElement: elementDivider,
            disabled: true,
        },
        {
            childBefore: <i className="bi bi-eye" />,
            menuElement: <span data-bible-key={bibleKey}>{title}</span>,
            title: `Open "${title}"`,
            onSelect:
                onSelect ??
                (() => {
                    bibleItemViewController.addBibleItemRight(
                        bibleItem,
                        targetBibleItem,
                    );
                }),
        },
        {
            childBefore: <i className="bi bi-copy" />,
            menuElement: <span data-bible-key={bibleKey}>{title}</span>,
            title: `Copy "${title}" to clipboard`,
            onSelect: () => {
                copyToClipboard(`${bibleItem.getCopyingBibleKey()} ${title}`);
            },
        },
    ];
}
async function handleCustomTitleVerseClicking(
    bibleItemViewController:
        | BibleItemsViewController
        | LookupBibleItemController,
    bibleItem: BibleItem,
    event: MouseEvent,
) {
    const span = event.currentTarget as HTMLSpanElement;
    const verseKey = span.dataset.titleVerseKey;
    const bibleKey = span.dataset.bibleKey;
    if (!verseKey || !bibleKey) {
        return;
    }
    // TODO: open context menu for copy, save and open verse
    const { title, bibleItem1, bibleItem2 } =
        await getBibleItemsFromTitleVerseKey(bibleKey, verseKey);
    if (bibleItem1 === null) {
        return;
    }
    let contextMenuItems: ContextMenuItemType[] = [];
    const title1 = await bibleItem1.toTitle();
    contextMenuItems.push(
        ...genContextMenuItems(
            bibleItemViewController,
            bibleKey,
            bibleItem,
            bibleItem1,
            title1,
        ),
    );
    if (bibleItem2 !== null) {
        const title2 = await bibleItem2.toTitle();
        contextMenuItems = [
            ...(bibleItemViewController.isLookup
                ? genContextMenuItems(
                      bibleItemViewController,
                      bibleKey,
                      bibleItem,
                      bibleItem,
                      title,
                      () => {
                          bibleItemViewController.addBibleItemRight(
                              bibleItem,
                              bibleItem,
                          );
                          setTimeout(() => {
                              (
                                  bibleItemViewController as LookupBibleItemController
                              ).inputText = title;
                          }, 100);
                      },
                  )
                : []),
            ...contextMenuItems,
            ...genContextMenuItems(
                bibleItemViewController,
                bibleKey,
                bibleItem,
                bibleItem2,
                title2,
            ),
        ];
    }
    showAppContextMenu(event, contextMenuItems);
}

export async function reformCustomTitle(
    bibleItemViewController: BibleItemsViewController,
    bibleItem: BibleItem,
    span: HTMLSpanElement,
) {
    const targetSpans = span.querySelectorAll<HTMLSpanElement>(
        'span[data-title-verse-key]',
    );
    for (const span of targetSpans) {
        const verseKey = span.dataset.titleVerseKey;
        if (!verseKey) {
            continue;
        }
        span.addEventListener('click', (event) =>
            handleCustomTitleVerseClicking(
                bibleItemViewController,
                bibleItem,
                event,
            ),
        );
    }
}

const defaultCssStyle =
    'width: 100%; display: inline-block; padding: 0.2em 0.4em; font-weight: bold; ';
const newLineTitleCache = new CacheManager<string>(60); // 1 minute
export async function genNewLineTitlesHtmlText(
    bibleKey: string,
    titles: ContentTitleType[],
) {
    const md5 = appProvider.systemUtils.generateMD5(JSON.stringify(titles));
    const cacheKey = `${bibleKey}:${md5}`;
    return unlocking(cacheKey, async () => {
        const cachedData = await newLineTitleCache.get(cacheKey);
        if (cachedData !== null) {
            return cachedData;
        }
        const langData = await getLangDataFromBibleKey(bibleKey);
        const list = await Promise.all(
            titles.map(async (title) => {
                let style = `${defaultCssStyle} ${title.cssStyle ?? ''};`;
                if (langData !== null) {
                    style += ` font-family: ${langData.fontFamily};`;
                }
                return `
                        <div data-bible-key="${bibleKey}"
                        style="${style}">
                        ${await compileVerseTitle(bibleKey, title.content)}
                        </div>
                        `;
            }),
        );
        const verseText = list.join('');
        await newLineTitleCache.set(cacheKey, verseText);
        return verseText;
    });
}
export async function getNewLineTitlesHtmlText(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    if (!chapterData?.newLinesTitleMap) {
        return null;
    }
    const verseKey = toVerseFullKeyFormat(bookKey, chapter, verse);
    const titles = chapterData.newLinesTitleMap[verseKey] ?? [];
    if (titles.length === 0) {
        return null;
    }
    return genNewLineTitlesHtmlText(bibleKey, titles);
}

export async function getCustomVerseText(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    if (!chapterData?.customVersesMap) {
        return null;
    }
    const verseKey = toVerseFullKeyFormat(bookKey, chapter, verse);
    const customVerseList = chapterData.customVersesMap[verseKey] ?? [];
    const renderList = await Promise.all(
        customVerseList.map(async (item) => {
            if ((item as any).isTitle) {
                const itemTitle = item as CustomTitlesVerseType;
                return `
            <div class="mt-2">
                ${await genNewLineTitlesHtmlText(bibleKey, itemTitle.titles)}
            </div>
            `;
            }
            if (!(item as any).content) {
                return '';
            }
            const itemVerse = item as CustomVerseContentType;
            if (itemVerse.isGW) {
                return `<span class="app-god-word">${itemVerse.content}</span>`;
            }
            return itemVerse.content;
        }),
    );
    const text = renderList
        .join('')
        .replaceAll('\n', '')
        .replaceAll(/\s+/g, ' ');
    if (text.trim() === '') {
        return null;
    }
    return text;
}
