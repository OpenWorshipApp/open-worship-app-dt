import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from '../helper/errorHelpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import BibleItem from '../bible-list/BibleItem';
import {
    BibleItemType,
    genDefaultBibleItemContextMenu,
} from '../bible-list/bibleItemHelpers';
import { LocaleType, sanitizeFindingText } from '../lang/langHelpers';
import LookupBibleItemController from '../bible-reader/LookupBibleItemController';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { saveBibleItem } from '../bible-list/bibleHelpers';
import { genContextMenuItemIcon } from '../context-menu/AppContextMenuComp';

export type SelectedBookKeyType = {
    bookKey: string;
    book: string;
} | null;

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
    bookKey?: string;
    fromLineNumber?: number;
    toLineNumber?: number;
    text: string;
    isFresh?: boolean;
};

export type PagingDataTye = {
    pages: string[];
    currentPage: string;
    pageSize: number;
    perPage: number;
};
export type AllDataType = { [key: string]: BibleFindResultType };

export function checkIsCurrentPage(
    data: BibleFindResultType,
    pageNumber: number,
    perPage: number,
) {
    const size = pageNumber * perPage;
    if (data.fromLineNumber <= size && size <= data.toLineNumber) {
        return true;
    }
}
export function findPageNumber(
    data: BibleFindResultType,
    perPage: number,
    pages: string[],
) {
    for (const pageNumber of pages) {
        if (checkIsCurrentPage(data, parseInt(pageNumber), perPage)) {
            return pageNumber;
        }
    }
    return '0';
}

export function calcPerPage(data: BibleFindResultType) {
    const perPage = data.toLineNumber - data.fromLineNumber + 1;
    return perPage;
}

export function calcPaging(data: BibleFindResultType | null): PagingDataTye {
    if (data === null) {
        return { pages: [], currentPage: '0', pageSize: 0, perPage: 0 };
    }
    const perPage = calcPerPage(data);
    const pageSize = Math.ceil(data.maxLineNumber / perPage);
    const pages = Array.from(Array(pageSize)).map((_, i) => {
        return i + 1 + '';
    });
    const currentPage = findPageNumber(data, perPage, pages);
    return { pages, currentPage, pageSize, perPage };
}

export async function breakItem(
    locale: LocaleType,
    text: string,
    item: string,
    bibleKey: string,
): Promise<{
    newItem: string;
    bibleItem: BibleItem;
    kjvTitle: string;
}> {
    const sanitizedFindText = (await sanitizeFindingText(locale, text)) ?? text;
    const [bookKeyChapter, verse, ...newItems] = item.split(':');
    let newItem = newItems.join(':');
    for (const subText of sanitizedFindText.split(' ')) {
        newItem = newItem.replace(
            new RegExp(`(${subText})`, 'ig'),
            '<span style="color:red">$1</span>',
        );
    }
    const [bookKey, chapter] = bookKeyChapter.split('.');
    const splitVerse = verse.split('-');
    const target = {
        bookKey: bookKey,
        chapter: parseInt(chapter),
        verseStart: parseInt(splitVerse[0]),
        verseEnd: parseInt(splitVerse[1] || splitVerse[0]),
    };
    const bibleItemJson: BibleItemType = {
        id: -1,
        metadata: {},
        bibleKey,
        target,
    };
    const bibleItem = BibleItem.fromJson(bibleItemJson);
    const kjvTitle = `${bookKey} ${chapter}:${verse}`;
    return { newItem, bibleItem, kjvTitle };
}

export function pageNumberToReqData(
    pagingData: PagingDataTye,
    pageNumber: string,
) {
    const { perPage } = pagingData;
    let newPageNumber = parseInt(pageNumber);
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
        loggerHelpers.error(`Invalid bible find ${result}`);
    } catch (error) {
        showSimpleToast(
            'Fetching Bible Finding Online',
            'Fail to fetch bible online',
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
    const contextMenuItems: ContextMenuItemType[] = [];
    contextMenuItems.push({
        menuElement: '`Open',
        onSelect: () => {
            openInBibleLookup(event, viewController, bibleItem, true);
        },
    });
    contextMenuItems.push(...genDefaultBibleItemContextMenu(bibleItem));
    contextMenuItems.push({
        childBefore: genContextMenuItemIcon('floppy'),
        menuElement: '`Save bible item',
        onSelect: () => {
            saveBibleItem(bibleItem);
        },
    });
    showAppContextMenu(event, contextMenuItems);
}
