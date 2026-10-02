import type { Dispatch, SetStateAction } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import BibleItem from '../bible-list/BibleItem';
import type { BibleItemType } from '../bible-list/bibleItemHelpers';
import { genBibleItemCopyingContextMenu } from '../bible-list/bibleItemHelpers';
import type { LocaleType } from '../lang/langHelpers';
import {
    DEFAULT_LOCALE,
    getLangDataAsync,
    quickTrimText,
    tran,
} from '../lang/langHelpers';
import { escapeHtmlText } from '../helper/sanitizeHelpers';
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

/**
 * The `LIKE` needle a find runs on, or `null` when the query holds nothing
 * this bible's script can match.
 *
 * `quickTrimText` answers "is there anything of this locale in this word?", so
 * a query typed in another script drops every part and the needle comes out as
 * nothing but `%`. Handed to SQL that is `LIKE '%%'`, which matches EVERY row:
 * measured 2026-09-20, a Khmer word looked up in the KJV answered
 * **31,102 verses found** -- the whole bible, every word drawn as a match --
 * and an English word in a Khmer bible answered 31,099. `null` says "no verse
 * can match", which the caller answers without touching the database.
 *
 * The needle keeps the RAW part, not the trimmed one: trimming is the test,
 * the untrimmed word is what the verse text is searched for.
 */
export function toFindWildCardText(locale: LocaleType, sText: string) {
    const wildCardText = sText
        .split(' ')
        .filter((part) => quickTrimText(locale, part))
        .filter((part) => part.length > 0)
        .map((part) => `%${part}%`)
        .join('')
        .replaceAll("'", '');
    // Also catches a query that survived the filter and then lost everything
    // to the quote strip, which lands on the same match-everything needle.
    if (wildCardText.replaceAll('%', '') === '') {
        return null;
    }
    return wildCardText;
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

/**
 * Words that START with what was typed come first, then words holding it
 * anywhere, then the rest, each group in the index's own (bm25) order.
 *
 * The spell index stores a word as its letters, so a MATCH finds every word
 * holding those letters in ANY order: `pharao` + Tab offered
 * `pharaohhophra` and never `pharaoh`.
 *
 * Among the words that start with it, the shortest -- the fewest letters
 * added -- comes first, since Tab takes the top one: bm25 put `pharaohhophra`
 * (one verse) above `pharaoh` (hundreds), and Tab completed `pharao` to it.
 */
export function rankSuggestionWords(words: string[], attemptingWord: string) {
    const needle = attemptingWord.toLowerCase();
    const rankOf = (word: string) => {
        const lowerWord = word.toLowerCase();
        if (lowerWord.startsWith(needle)) {
            return 0;
        }
        return lowerWord.includes(needle) ? 1 : 2;
    };
    return words
        .map((word, index) => ({ word, index, rank: rankOf(word) }))
        .sort((a, b) => {
            if (a.rank !== b.rank) {
                return a.rank - b.rank;
            }
            if (a.rank === 0 && a.word.length !== b.word.length) {
                return a.word.length - b.word.length;
            }
            return a.index - b.index;
        })
        .map(({ word }) => word);
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
});

const KHMER_COENG = '្';

/**
 * A verse's grapheme clusters, so a letter and the marks on it move as one.
 * One repair, the one `pptxFontHelpers` makes: Unicode has no conjunct rule for
 * Khmer, so `ស្រី` segments as `ស្` + `រី`, and a match marker dropped between
 * the two would break the subscript off its consonant. A cluster that ends in a
 * coeng is kept with what follows it.
 */
function toTextClusters(text: string) {
    const clusters: string[] = [];
    for (const { segment } of graphemeSegmenter.segment(text)) {
        const lastIndex = clusters.length - 1;
        if (lastIndex >= 0 && clusters[lastIndex].endsWith(KHMER_COENG)) {
            clusters[lastIndex] += segment;
        } else {
            clusters.push(segment);
        }
    }
    return clusters;
}

/**
 * What a row marks: every part of the query in its finding form, plus the
 * parts run together -- the find itself matches `%lord%s%` against a verse
 * whose spaces and apostrophes are gone, so `lord's` should mark `LORD's`
 * whole. A one-letter part is left out when there are longer ones: `lord's`
 * splits into `lord` + `s`, and `s` on its own marked every s in the verse.
 * Longest first, so `beginning` wins over `begin` where both start.
 */
function toFindNeedles(
    findText: string,
    toFindingText: (text: string) => string,
) {
    // An empty needle would match between every character and wrap the whole
    // verse in markers -- the visible half of the match-everything bug
    // `toFindWildCardText` closes.
    const parts = toFindingText(findText)
        .split(/\s+/)
        .filter((part) => part !== '');
    const hasLongPart = parts.some((part) => part.length > 1);
    const needles = new Set(
        parts.filter((part) => !hasLongPart || part.length > 1),
    );
    if (parts.length > 1) {
        needles.add(parts.join(''));
    }
    return [...needles].sort((a, b) => b.length - a.length);
}

const FOUND_MATCH_OPEN = '<span class="app-found-match">';
const FOUND_MATCH_CLOSE = '</span>';

/**
 * The verse as the bible prints it -- its own capitals and punctuation --
 * HTML-escaped, with every searched word wrapped in a match marker.
 *
 * The row used to show the verse in its FINDING form, "and the lord god formed
 * man", because that is the form the words were found in. They still are:
 * `toFindingText` (the locale's `sanitizeFindingText`) is run over the verse
 * cluster by cluster, so every character of the finding form still knows
 * which cluster it came from, and the markers go around those ORIGINAL
 * clusters. A match may run over what the finding form drops -- a space, an
 * apostrophe, a Khmer zero-width break -- exactly as the find's own `LIKE`
 * does.
 *
 * Everything the verse holds is escaped here, so the markers are the only
 * markup that can come out: the row renders this as HTML. One left-to-right
 * pass, never a replace per word: replacing word by word matched a later word
 * inside the markup an earlier one had inserted, and the row showed raw
 * `<span class=…>` text.
 */
export function highlightFoundWords(
    text: string,
    findText: string,
    toFindingText: (text: string) => string,
) {
    const clusters = toTextClusters(text);
    const needles = toFindNeedles(findText, toFindingText);
    // The verse in its finding form, run together the way the find stores it,
    // and for each of its code units the cluster it came from. A verse repeats
    // its letters, so each distinct cluster is converted once.
    let findingText = '';
    const clusterIndexes: number[] = [];
    const findingClusterMap = new Map<string, string>();
    clusters.forEach((cluster, clusterIndex) => {
        let findingCluster = findingClusterMap.get(cluster);
        if (findingCluster === undefined) {
            findingCluster = toFindingText(cluster).replaceAll(/\s+/g, '');
            findingClusterMap.set(cluster, findingCluster);
        }
        findingText += findingCluster;
        for (let i = 0; i < findingCluster.length; i++) {
            clusterIndexes.push(clusterIndex);
        }
    });
    // Left to right, the longest needle first at each position, never
    // overlapping -- what one alternation over the text did -- and the matched
    // stretch widened to whole clusters. Two matches sharing a cluster merge.
    const ranges: [number, number][] = [];
    let position = 0;
    while (needles.length > 0 && position < findingText.length) {
        const needle = needles.find((word) => {
            return findingText.startsWith(word, position);
        });
        if (needle === undefined) {
            position += 1;
            continue;
        }
        const fromCluster = clusterIndexes[position];
        const toCluster = clusterIndexes[position + needle.length - 1];
        const lastRange = ranges.at(-1);
        if (lastRange !== undefined && fromCluster <= lastRange[1]) {
            lastRange[1] = Math.max(lastRange[1], toCluster);
        } else {
            ranges.push([fromCluster, toCluster]);
        }
        position += needle.length;
    }
    let html = '';
    let rangeIndex = 0;
    clusters.forEach((cluster, clusterIndex) => {
        const range = ranges[rangeIndex];
        if (range?.[0] === clusterIndex) {
            html += FOUND_MATCH_OPEN;
        }
        html += escapeHtmlText(cluster);
        if (range?.[1] === clusterIndex) {
            html += FOUND_MATCH_CLOSE;
            rangeIndex += 1;
        }
    });
    return html;
}

/**
 * The locale's finding form -- what the find matches on, `sanitizeFindingText`
 * -- as a plain function, so a verse can go through it cluster by cluster
 * without an `await` per cluster. A locale with no language data falls back to
 * the default's, as `sanitizeFindingText` itself does.
 */
async function getFindingTextConverter(locale: LocaleType) {
    const langData =
        (await getLangDataAsync(locale)) ??
        (await getLangDataAsync(DEFAULT_LOCALE));
    if (langData === null) {
        return (text: string) => text.toLowerCase();
    }
    return (text: string) => langData.sanitizeFindingText(text);
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
    const toFindingText = await getFindingTextConverter(locale);
    const [bookKeyChapter, verse, ...newItems] = item.split(':');
    const verseText = newItems.join(':');
    const newItem = highlightFoundWords(verseText, text, toFindingText);
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
    return { newItem, bibleItem, kjvVerseKey };
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
