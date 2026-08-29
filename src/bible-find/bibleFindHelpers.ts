import type { Dispatch, SetStateAction } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import BibleItem from '../bible-list/BibleItem';
import type { BibleItemType } from '../bible-list/bibleItemHelpers';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';
import type { LocaleType } from '../lang/langHelpers';
import {
    sanitizeFindingText,
    sanitizePreviewText,
    tran,
} from '../lang/langHelpers';
import type LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type BibleFindController from './BibleFindController';
import { toVerseFullKeyFormat } from '../helper/bible-helpers/bibleInfoHelpers';
import { setSetting } from '../helper/settingHelpers';

export const BIBLE_SEARCH_SETTING_NAME = 'bible-search-tab';

// The tabs of the advanced bible lookup panel: find, cross reference, the
// names & locations of the verses being read, and the user's own resource
// folders. Named so the previewer, the controller slot and this setter cannot
// drift apart.
export type BibleSearchTabType = 's' | 'c' | 'l' | 'r';

export function setBibleSearchingTabType(tabType: BibleSearchTabType) {
    setSetting(BIBLE_SEARCH_SETTING_NAME, tabType);
}

export type FindDataType = {
    pagingData: PagingDataTye;
    foundData: { [key: string]: BibleFindResultType | null | undefined };
};

export type SelectedBookKeyType = {
    bookKey: string;
    book: string;
};

export type APIDataMapType = {
    apiKey: string;
    apiUrl: string;
};
export type APIDataType = {
    mapper: {
        [key: string]: APIDataMapType | undefined;
    };
};

export type BibleFindResultType = {
    maxLineNumber: number;
    fromLineNumber: number;
    toLineNumber: number;
    content: {
        text: string;
        uniqueKey: string;
    }[];
};
export type BibleFindForType = {
    bookKeys?: string[];
    fromLineNumber?: number;
    toLineNumber?: number;
    text: string;
    isFresh?: boolean;
};

export type PagingDataTye = {
    pages: string[];
    currentPage: string;
    perPage: number;
};
export type AllDataType = { [key: string]: BibleFindResultType };

export function checkIsCurrentPage(
    data: BibleFindResultType,
    pageNumber: number,
    perPage: number,
) {
    const maxSize = pageNumber * perPage - 1;
    if (data.fromLineNumber <= maxSize && maxSize <= data.toLineNumber) {
        return true;
    }
}
export function findPageNumber(
    data: BibleFindResultType,
    perPage: number,
    pages: string[],
) {
    for (const pageNumber of pages) {
        if (checkIsCurrentPage(data, Number.parseInt(pageNumber), perPage)) {
            return pageNumber;
        }
    }
    return '0';
}

export function calcPerPage(toLineNumber: number, fromLineNumber: number) {
    const perPage = toLineNumber - fromLineNumber + 1;
    return perPage;
}

export function calcPaging(data: BibleFindResultType | null): PagingDataTye {
    if (data === null) {
        return { pages: [], currentPage: '0', perPage: 0 };
    }
    const perPage = calcPerPage(data.toLineNumber, data.fromLineNumber);
    const pageSize = Math.ceil(data.maxLineNumber / perPage);
    const pages = Array.from(new Array(pageSize)).map((_, i) => {
        return i + 1 + '';
    });
    const currentPage = findPageNumber(data, perPage, pages);
    return { pages, currentPage, perPage };
}

/**
 * The reason a row is on screen, counted: how many verses the find actually
 * matched. `maxLineNumber` is the whole result set, not the loaded slice, and
 * every loaded chunk carries the same figure -- so the first one that has
 * landed answers it, and `null` means nothing has come back yet.
 */
export function toFoundVerseCount(data: FindDataType) {
    for (const pageNumber of data.pagingData.pages) {
        const pageData = data.foundData[pageNumber];
        if (pageData) {
            return pageData.maxLineNumber;
        }
    }
    return null;
}

/**
 * Which verses of the whole result a chunk holds, counted from ONE.
 *
 * Derived from the page rather than read off `fromLineNumber`/`toLineNumber`,
 * which come back zero-based for the first chunk and would print
 * `Results 0-19` under a footer that calls the same chunk `1`. The page number
 * and `perPage` are the values the footer is already built on, so counting from
 * them is the only way the two readouts agree.
 *
 * `totalCount` clamps the last chunk, which is short unless the find divides
 * exactly.
 */
export function toFindChunkRange(
    page: number,
    perPage: number,
    totalCount: number | null,
): [number, number] {
    const fromNumber = (page - 1) * perPage + 1;
    const toNumber = page * perPage;
    if (totalCount === null) {
        return [fromNumber, toNumber];
    }
    return [fromNumber, Math.min(toNumber, totalCount)];
}

/**
 * How many chunk numbers to draw either side of the one being read.
 */
const FIND_PAGE_NEIGHBOUR_RADIUS = 2;

/**
 * How many ALREADY-LOADED chunks to keep a jump-back chip for. Loaded chunks
 * only accumulate by the user clicking, so this is generous in practice; it is
 * capped anyway because nothing else bounds it, and an unbounded strip of
 * buttons is the thing this window exists to stop.
 */
const FIND_PAGE_LOADED_LIMIT = 8;

/**
 * The most numbers ONE opened gap may add.
 *
 * Opening a gap is the user asking for those numbers, so it is generous -- a
 * find of a few hundred chunks opens whole. Past this the gap opens as evenly
 * spaced STEPS across itself instead, and the shorter gaps between those steps
 * open the same way, so every chunk of a 1556-chunk find is two clicks away and
 * the strip never grows back into the thousand-button grid this replaced.
 */
const FIND_PAGE_EXPAND_LIMIT = 200;

/** A number to click, or the gap between two of them. */
export type FindPageItemType =
    | { type: 'page'; page: number }
    | { type: 'gap'; fromPage: number; toPage: number };

/** A gap the user has opened, as the inclusive range it covered. */
export type FindPageRangeType = [number, number];

function addExpandedPages(
    kept: Set<number>,
    [fromPage, toPage]: FindPageRangeType,
    pageCount: number,
) {
    const from = Math.max(1, fromPage);
    const to = Math.min(pageCount, toPage);
    const size = to - from + 1;
    if (size < 1) {
        return;
    }
    // `ceil` so the step is never 0 and never overshoots the limit.
    const step =
        size <= FIND_PAGE_EXPAND_LIMIT
            ? 1
            : Math.ceil(size / FIND_PAGE_EXPAND_LIMIT);
    for (let page = from; page <= to; page += step) {
        kept.add(page);
    }
}

/**
 * Which chunk numbers the footer draws, and where it puts a gap instead.
 *
 * A find over a whole bible pages into the THOUSANDS -- 1556 chunks for a
 * common word -- and drawing every number cost 1556 buttons in a 10000px-tall
 * grid, laid out and painted on every result render to fill a 100px strip. So
 * the default is a window: the first, the last, the neighbours of the chunk
 * being read, and the chunks already loaded (nearest first, capped).
 *
 * Everything else sits behind a gap the user can OPEN -- `expandedRanges` are
 * the gaps already opened -- because a number nobody can reach is worse than a
 * number nobody wants to see. See `FIND_PAGE_EXPAND_LIMIT` for what stops an
 * opened gap growing the strip back.
 *
 * Items come back ascending, de-duplicated, with a `gap` between any two
 * numbers that are not consecutive.
 */
export function toFindPageWindow(
    pageCount: number,
    currentPage: number,
    loadedPages: number[],
    expandedRanges: FindPageRangeType[] = [],
): FindPageItemType[] {
    if (pageCount < 1) {
        return [];
    }
    const kept = new Set<number>([1, pageCount]);
    for (
        let page = currentPage - FIND_PAGE_NEIGHBOUR_RADIUS;
        page <= currentPage + FIND_PAGE_NEIGHBOUR_RADIUS;
        page += 1
    ) {
        if (page >= 1 && page <= pageCount) {
            kept.add(page);
        }
    }
    const nearestLoaded = [...loadedPages]
        .filter((page) => {
            return page >= 1 && page <= pageCount;
        })
        .sort((pageA, pageB) => {
            return (
                Math.abs(pageA - currentPage) - Math.abs(pageB - currentPage)
            );
        })
        .slice(0, FIND_PAGE_LOADED_LIMIT);
    for (const page of nearestLoaded) {
        kept.add(page);
    }
    for (const range of expandedRanges) {
        addExpandedPages(kept, range, pageCount);
    }
    const sortedPages = [...kept].sort((pageA, pageB) => {
        return pageA - pageB;
    });
    const windowed: FindPageItemType[] = [];
    let previousPage: number | null = null;
    for (const page of sortedPages) {
        if (previousPage !== null) {
            const skipped = page - previousPage - 1;
            if (skipped === 1) {
                // A gap of exactly one is not a gap: `1 2 3 … 5` hides a
                // number behind a marker that is wider than the number.
                windowed.push({ type: 'page', page: page - 1 });
            } else if (skipped > 1) {
                windowed.push({
                    type: 'gap',
                    fromPage: previousPage + 1,
                    toPage: page - 1,
                });
            }
        }
        windowed.push({ type: 'page', page });
        previousPage = page;
    }
    return windowed;
}

export async function breakItem(
    locale: LocaleType,
    text: string,
    item: string,
    bibleKey: string,
): Promise<{
    newItem: string;
    bibleItem: BibleItem;
    kjvVerseKey: string;
}> {
    // TODO: use fuse.js to highlight
    const sanitizedFindText = (await sanitizeFindingText(locale, text)) ?? text;
    const [bookKeyChapter, verse, ...newItems] = item.split(':');
    let fullVerseText = newItems.join(':');
    fullVerseText = await sanitizeFindingText(locale, fullVerseText);
    fullVerseText = await sanitizePreviewText(locale, fullVerseText);
    for (const subText of sanitizedFindText.split(' ')) {
        fullVerseText = fullVerseText.replaceAll(
            new RegExp(`(${subText})`, 'ig'),
            '<span class="app-found-match">$1</span>',
        );
    }
    const [bookKey, chapter] = bookKeyChapter.split('.');
    const splitVerse = verse.split('-');
    const target = {
        bookKey: bookKey,
        chapter: Number.parseInt(chapter),
        verseStart: Number.parseInt(splitVerse[0]),
        verseEnd: Number.parseInt(splitVerse[1] || splitVerse[0]),
    };
    const bibleItemJson: BibleItemType = {
        id: -1,
        metadata: {},
        bibleKey,
        target,
    };
    const bibleItem = BibleItem.fromJson(bibleItemJson);
    const kjvVerseKey = toVerseFullKeyFormat(bookKey, chapter, verse);
    return { newItem: fullVerseText, bibleItem, kjvVerseKey };
}

export function pageNumberToReqData(pagingData: PagingDataTye, page: string) {
    const { perPage } = pagingData;
    let newPageNumber = Number.parseInt(page);
    newPageNumber -= 1;
    const fromLineNumber = perPage * newPageNumber + 1;
    return {
        fromLineNumber,
        toLineNumber: fromLineNumber + perPage - 1,
    };
}

export async function findOnline(
    apiUrl: string,
    apiKey: string,
    findData: BibleFindForType,
) {
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            method: 'POST',
            body: JSON.stringify(findData),
        });
        const result = await response.json();
        if (result['content']) {
            result.content = result.content.map((item: string) => {
                return {
                    text: item,
                    uniqueKey: crypto.randomUUID(),
                };
            });
            return result as BibleFindResultType;
        }
        loggerHelpers.appError(`Invalid bible find ${result}`);
    } catch (error) {
        showSimpleToast(
            tran('Fetching Bible Finding Online'),
            tran('Fail to fetch bible online'),
        );
        handleError(error);
    }
    return null;
}

export function openInBibleLookup(
    event: any,
    viewController: LookupBibleItemController,
    bibleItem: BibleItem,
    isForceNew = false,
) {
    if (isForceNew || event.shiftKey) {
        viewController.appendBibleItem(bibleItem);
    } else {
        viewController.setLookupContentFromBibleItem(bibleItem);
    }
}

export function openContextMenu(
    event: any,
    {
        viewController,
        bibleItem,
    }: {
        viewController: LookupBibleItemController;
        bibleItem: BibleItem;
    },
) {
    const contextMenuItems: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('box-arrow-up-right'),
            menuElement: tran('Open'),
            onSelect: () => {
                openInBibleLookup(event, viewController, bibleItem, true);
            },
        },
        ...genBibleItemCopyingContextMenu(bibleItem),
        {
            childBefore: genContextMenuItemIcon('floppy'),
            menuElement: tran('Save bible item'),
            onSelect: () => {
                saveBibleItem(bibleItem);
            },
        },
    ];
    showAppContextMenu(event, contextMenuItems);
}

async function finding(
    bibleFindController: BibleFindController,
    findData: BibleFindForType,
) {
    const foundDataPerPage = await bibleFindController.doFinding(findData);
    if (foundDataPerPage === null) {
        return null;
    }
    const pagingData = calcPaging(foundDataPerPage);
    const page = findPageNumber(
        foundDataPerPage,
        pagingData.perPage,
        pagingData.pages,
    );
    return {
        page,
        pagingData,
        foundDataPerPage,
    };
}

export async function doFinding(
    bibleFindController: BibleFindController,
    findText: string,
    data: FindDataType | null | undefined,
    setData: Dispatch<SetStateAction<FindDataType | null | undefined>>,
) {
    if (data === null) {
        return;
    }
    if (data === undefined) {
        const result = await finding(bibleFindController, {
            text: findText,
        });
        if (result === null) {
            setData(null);
            return;
        }
        const { page, foundDataPerPage, pagingData } = result;
        setData({
            pagingData,
            foundData: Object.fromEntries([
                ...pagingData.pages.map((page) => {
                    return [page, null];
                }),
                [page, foundDataPerPage],
            ]),
        });
    } else {
        const { pagingData, foundData } = data;
        for (const page of pagingData.pages) {
            if (foundData[page] !== undefined) {
                continue;
            }
            const findForData = pageNumberToReqData(data.pagingData, page);
            const result = await finding(bibleFindController, {
                fromLineNumber: findForData.fromLineNumber,
                toLineNumber: findForData.toLineNumber,
                text: findText,
            });
            if (result === null) {
                setData(null);
                return;
            }
            setData((oldData) => {
                if (!oldData) {
                    return oldData;
                }
                const { foundDataPerPage } = result;
                return {
                    pagingData: oldData.pagingData,
                    foundData: {
                        ...oldData.foundData,
                        [page]: foundDataPerPage,
                    },
                };
            });
            break;
        }
    }
}
