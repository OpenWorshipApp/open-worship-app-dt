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
import { elementDivider } from '../../context-menu/AppContextMenuComp';
import { genContextMenuItemIcon } from '../../context-menu/contextMenuIconHelpers';
import { getBibleLocale, getLangDataFromBibleKey } from './bibleStyleHelpers';
import { BIBLE_SHOWN_CHAPTER_COUNT } from './bibleTargetHelpers';
import { handleError } from '../errorHelpers';

// `JHN 18:33-19:16`, `JHN 18:33-`, `JHN 18:33`: the canonical key a heading
// cites its passage by, as ONE item, crossing chapters when it does.
function getBibleItemFromTitleVerseKey(bibleKey: string, verseKey: string) {
    return BibleItem.fromVerseKey(bibleKey, verseKey.trim());
}

// How much of a cited passage its hover hint reads: enough to recognise it,
// never a whole book because a heading cites one.
const TITLE_VERSE_HINT_MAX_LENGTH = 1000;

/**
 * Names each cited passage in the Bible's own words. Only the TITLE is read
 * here, for every heading of every chapter shown; the text a hover shows is
 * read when the span is first hovered (`reformCustomTitle`).
 */
async function compileVerseTitle(bibleKey: string, content: string) {
    const divElement = document.createElement('div');
    divElement.innerHTML = content;
    const spanElements = divElement.querySelectorAll<HTMLSpanElement>(
        'span[data-title-verse-key]',
    );
    for (const spanElement of spanElements) {
        const verseKey = spanElement.dataset.titleVerseKey;
        if (!verseKey) {
            continue;
        }
        spanElement.classList.add('app-caught-hover-pointer');
        spanElement.title = verseKey;
        spanElement.dataset.bibleKey = bibleKey;
        const bibleItem = await getBibleItemFromTitleVerseKey(
            bibleKey,
            verseKey,
        );
        if (bibleItem === null) {
            continue;
        }
        spanElement.title = await bibleItem.toTitle();
    }
    return divElement.innerHTML;
}

function genContextMenuItems(
    bibleItemViewController:
        BibleItemsViewController | LookupBibleItemController,
    bibleKey: string,
    bibleItem: BibleItem,
    targetBibleItem: BibleItem,
    title: string,
) {
    return [
        {
            menuElement: elementDivider,
            disabled: true,
        },
        {
            childBefore: genContextMenuItemIcon('eye'),
            menuElement: <span data-bible-key-ff={bibleKey}>{title}</span>,
            title: `Open "${title}"`,
            onSelect: () => {
                // Its own passage: kept out of the neighbour's colour-note
                // sync group, which would re-target it to the lookup's.
                bibleItemViewController.addBibleItemRight(
                    bibleItem,
                    targetBibleItem,
                    true,
                );
            },
        },
        {
            childBefore: genContextMenuItemIcon('copy'),
            menuElement: <span data-bible-key-ff={bibleKey}>{title}</span>,
            title: `Copy "${title}" to clipboard`,
            onSelect: () => {
                copyToClipboard(`${bibleItem.getCopyingBibleKey()} ${title}`);
            },
        },
    ];
}

function getTitleVerseSpanData(span: HTMLSpanElement) {
    const verseKey = span.dataset.titleVerseKey;
    const bibleKey = span.dataset.bibleKey;
    if (!verseKey || !bibleKey) {
        return null;
    }
    return { verseKey, bibleKey };
}

/**
 * A cited passage, clicked: read whole in a floating verse panel, across
 * chapters as written (`John 18:33-19:16`), without leaving the passage the
 * heading belongs to.
 */
async function handleCustomTitleVerseClicking(span: HTMLSpanElement) {
    const spanData = getTitleVerseSpanData(span);
    if (spanData === null) {
        return;
    }
    const targetBibleItem = await getBibleItemFromTitleVerseKey(
        spanData.bibleKey,
        spanData.verseKey,
    );
    if (targetBibleItem === null) {
        return;
    }
    // Loaded on demand: this module is in the screen window's graph, which
    // has no detail panel and no lookup language to load for one.
    const { openBibleItemDetailPanel } =
        await import('../../location-name-lookup/detailPanelHelpers');
    await openBibleItemDetailPanel(targetBibleItem);
}

// Right-click: open it beside the passage instead, or copy its reference.
async function handleCustomTitleVerseContextMenu(
    bibleItemViewController:
        BibleItemsViewController | LookupBibleItemController,
    bibleItem: BibleItem,
    event: MouseEvent,
) {
    const span = event.currentTarget as HTMLSpanElement;
    const spanData = getTitleVerseSpanData(span);
    if (spanData === null) {
        return;
    }
    const targetBibleItem = await getBibleItemFromTitleVerseKey(
        spanData.bibleKey,
        spanData.verseKey,
    );
    if (targetBibleItem === null) {
        return;
    }
    const title = await targetBibleItem.toTitle();
    const contextMenuItems: ContextMenuItemType[] = genContextMenuItems(
        bibleItemViewController,
        spanData.bibleKey,
        bibleItem,
        targetBibleItem,
        title,
    );
    showAppContextMenu(event, contextMenuItems);
}

// The text a cited passage's hover shows, read once, on the first hover.
async function loadTitleVerseHint(span: HTMLSpanElement) {
    const spanData = getTitleVerseSpanData(span);
    if (spanData === null || span.dataset.isHintLoaded === 'true') {
        return;
    }
    span.dataset.isHintLoaded = 'true';
    const targetBibleItem = await getBibleItemFromTitleVerseKey(
        spanData.bibleKey,
        spanData.verseKey,
    );
    if (targetBibleItem === null) {
        return;
    }
    const title = await targetBibleItem.toTitle();
    const text = await targetBibleItem.toText(BIBLE_SHOWN_CHAPTER_COUNT);
    const hint = `${title}  ${text}`;
    span.title =
        hint.length > TITLE_VERSE_HINT_MAX_LENGTH
            ? `${hint.slice(0, TITLE_VERSE_HINT_MAX_LENGTH)}…`
            : hint;
}

// The `ref` a heading's HTML is reformed through runs on EVERY render of the
// verse it heads; a span already wired must not gain another set of
// listeners, or one click would open the passage once per render.
const reformedTitleSpans = new WeakSet<HTMLSpanElement>();

export async function reformCustomTitle(
    bibleItemViewController:
        BibleItemsViewController | LookupBibleItemController,
    bibleItem: BibleItem,
    span: HTMLSpanElement,
) {
    const targetSpans = span.querySelectorAll<HTMLSpanElement>(
        'span[data-title-verse-key]',
    );
    for (const targetSpan of targetSpans) {
        const verseKey = targetSpan.dataset.titleVerseKey;
        if (!verseKey || reformedTitleSpans.has(targetSpan)) {
            continue;
        }
        reformedTitleSpans.add(targetSpan);
        targetSpan.addEventListener('click', (event) => {
            event.stopPropagation();
            handleCustomTitleVerseClicking(targetSpan).catch(handleError);
        });
        targetSpan.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleCustomTitleVerseContextMenu(
                bibleItemViewController,
                bibleItem,
                event,
            ).catch(handleError);
        });
        targetSpan.addEventListener('mouseenter', () => {
            loadTitleVerseHint(targetSpan).catch(handleError);
        });
    }
}

const defaultCssStyle =
    'width: 100%; display: inline-block; ' +
    'padding: 0.2em 0.4em; font-weight: bold; ';
async function genTitleHtml(
    bibleKey: string,
    title: ContentTitleType,
    fontFamily?: string,
) {
    let style = `${defaultCssStyle} ${title.cssStyle ?? ''};`;
    if (fontFamily !== undefined) {
        style += ` font-family: ${fontFamily};`;
    }
    const compiledTitle = await compileVerseTitle(bibleKey, title.content);
    const locale = await getBibleLocale(bibleKey);
    return `<div data-dict-locale="${locale}"
            style="${style}">
            ${compiledTitle}
        </div>`;
}
const newLineTitleCache = new CacheManager<string>(10);
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
            titles.map((title) => {
                return genTitleHtml(bibleKey, title, langData?.fontFamily);
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
                const customTitleHtml = await genNewLineTitlesHtmlText(
                    bibleKey,
                    itemTitle.titles,
                );
                return `<div class="mt-2">${customTitleHtml}</div>`;
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
