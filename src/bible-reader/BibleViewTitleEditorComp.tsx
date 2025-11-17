import { CSSProperties, useMemo } from 'react';

import { BibleTargetType } from '../bible-list/bibleRenderHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import {
    getBibleInfo,
    getVerses,
} from '../helper/bible-helpers/bibleInfoHelpers';
import {
    getKJVChapterCount,
    getKJVBookKeyValue,
} from '../helper/bible-helpers/serverBibleHelpers';
import {
    getBibleFontFamily,
    getVersesCount,
    toLocaleNumBible,
} from '../helper/bible-helpers/serverBibleHelpers2';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { OptionalPromise } from '../helper/typeHelpers';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';

function chose<T>(
    event: any,
    isAllowAll: boolean,
    currentKey: T,
    keys: [T, string, string | undefined][],
    itemStyle: CSSProperties = {},
) {
    return new Promise<T | null>((resolve) => {
        const { promiseDone } = showAppContextMenu(
            event,
            keys.map(([key, value1, value2], i) => {
                return {
                    menuElement: value1,
                    title: value2,
                    disabled: i === 0 || (!isAllowAll && key === currentKey),
                    onSelect: () => {
                        resolve(key);
                    },
                    style: itemStyle,
                };
            }),
        );
        promiseDone.then(() => {
            resolve(null);
        });
    });
}

async function choseVerse(
    event: any,
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
    title: string,
    fontFamily: string | null,
    filterVerse = (_v: any) => true,
) {
    const verses = await getVerses(bibleKey, bookKey, chapter);
    if (verses === null) {
        return null;
    }
    const verseCount = await getVersesCount(bibleKey, bookKey, chapter);
    const verseList = (
        await Promise.all(
            Array.from({ length: verseCount ?? 0 }, (_, i) => {
                return i + 1;
            }).map((n) => {
                return getNumItem(bibleKey, n);
            }),
        )
    ).filter(filterVerse);
    verseList.unshift([0, title, title]);
    return await chose(event, true, verse, verseList, {
        fontFamily: fontFamily ?? '',
    });
}

async function choseChapter(
    event: any,
    bibleKey: string,
    isAllowAll: boolean,
    bookKey: string,
    chapter: number,
    fontFamily: string | null,
) {
    const chapterCount = getKJVChapterCount(bookKey);
    const chapterList = await Promise.all(
        Array.from({ length: chapterCount }, (_, i) => {
            return getNumItem(bibleKey, i + 1);
        }),
    );
    chapterList.unshift([0, 'Chapter', 'Chapter']);
    return await chose(event, isAllowAll, chapter, chapterList, {
        fontFamily: fontFamily ?? '',
    });
}

type ParamType = {
    applyTarget: (
        book: string,
        chapter: number,
        verseStart: number,
        verseEnd: number,
    ) => void;
    bibleKey: string;
    target: BibleTargetType;
    fontFamily: string | null;
    isOneVerse: boolean;
    waitUntilGotVerseStart: boolean;
    book?: string;
    chapter?: number;
    verseStart?: number;
};
async function handleContextMenu(
    event: any,
    {
        applyTarget,
        bibleKey,
        target,
        fontFamily,
        isOneVerse,
        waitUntilGotVerseStart,
        book,
        chapter,
        verseStart,
    }: ParamType,
) {
    let newBook;
    if (book === undefined) {
        const bookKVList = await getBookList(bibleKey);
        if (bookKVList === null) {
            return;
        }
        bookKVList.unshift(['', 'Book', 'Book']);
        newBook = await chose(event, false, target.bookKey, bookKVList, {
            fontFamily: fontFamily ?? '',
        });
        if (newBook === null) {
            return;
        }
        const verseCount = await getVersesCount(bibleKey, newBook, 1);
        if (!waitUntilGotVerseStart) {
            applyTarget(newBook, 1, 1, verseCount ?? 1);
        }
    } else {
        newBook = book;
    }
    let verseCount;
    let newChapter;
    if (chapter === undefined) {
        newChapter = await choseChapter(
            event,
            bibleKey,
            true,
            newBook,
            1,
            fontFamily,
        );
        if (newChapter === null) {
            return;
        }
        verseCount = await getVersesCount(bibleKey, newBook, newChapter);
        if (!waitUntilGotVerseStart) {
            applyTarget(newBook, newChapter, 1, verseCount ?? 1);
        }
    } else {
        newChapter = chapter;
        verseCount = await getVersesCount(bibleKey, newBook, newChapter);
    }
    let newVerseStart;
    if (verseStart === undefined) {
        newVerseStart = await choseVerse(
            event,
            bibleKey,
            newBook,
            newChapter,
            target.verseStart,
            'Verse Start',
            fontFamily,
        );
        if (newVerseStart === null) {
            return;
        }
        applyTarget(
            newBook,
            newChapter,
            newVerseStart,
            verseCount ?? newVerseStart,
        );
    } else {
        newVerseStart = verseStart;
    }
    if (isOneVerse) {
        return;
    }
    const newVerseEnd = await choseVerse(
        event,
        bibleKey,
        newBook,
        newChapter,
        target.verseEnd,
        'Verse End',
        fontFamily,
        (verse: [number]) => {
            return verse[0] >= newVerseStart;
        },
    );
    if (newVerseEnd === null) {
        return;
    }
    applyTarget(newBook, newChapter, newVerseStart, newVerseEnd);
}

async function getBookList(bibleKey: string) {
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        return null;
    }
    const bookKVList = info.books;
    const booksAvailable = info.booksAvailable;
    const kjvKeyValue = getKJVBookKeyValue();
    const bookList = Object.entries(bookKVList)
        .filter(([bookKey]) => {
            return booksAvailable.includes(bookKey);
        })
        .map(([bookKey, book]) => {
            const title = `${kjvKeyValue[bookKey]}(${getKJVChapterCount(bookKey)})`;
            return [bookKey, book, title] as [string, string, string];
        });
    return bookList;
}

async function getNumItem(bibleKey: string, n: number) {
    const localeNum = await toLocaleNumBible(bibleKey, n);
    return [n, localeNum, n.toString()] as [number, string, string];
}

function breakTitle(
    target: BibleTargetType,
    title: string | null | undefined,
): [string, string, string, string | undefined] {
    if (!title) {
        return [
            target.bookKey,
            target.chapter.toString(),
            target.verseStart.toString(),
            target.verseStart === target.verseEnd
                ? undefined
                : target.verseEnd.toString(),
        ];
    }
    let arr = title.split(':');
    const verses = arr.pop()?.split('-');
    arr = arr[0].split(' ');
    const chapter = arr.pop();
    const book = arr.join(' ');
    return [book, chapter!, verses![0], verses?.[1]];
}

export default function BibleViewTitleEditorComp({
    bibleItem,
    isOneVerse = false,
    onTargetChange,
    waitUntilGotVerseStart = false,
    withCtrl = false,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    isOneVerse?: boolean;
    onTargetChange?: (target: BibleTargetType) => void;
    waitUntilGotVerseStart?: boolean;
    withCtrl?: boolean;
}>) {
    const [title] = useAppStateAsync(() => {
        return bibleItem.toTitle();
    }, [bibleItem.bibleKey, bibleItem.target]);
    const { bibleKey, target } = bibleItem;
    const [fontFamily] = useAppStateAsync(() => {
        return getBibleFontFamily(bibleKey);
    }, [bibleKey]);
    const [book, localeChapter, localeVerseStart, localeVerseEnd] =
        useMemo(() => {
            return breakTitle(target, title);
        }, [target, title]);
    if (onTargetChange === undefined) {
        return <span>{title}</span>;
    }
    const genEditor = (
        text: string,
        onClick: (event: any) => OptionalPromise<void>,
    ) => {
        return (
            <span
                className="app-caught-hover-pointer"
                onContextMenu={(event) => {
                    if (withCtrl && !event.ctrlKey) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    onClick(event);
                }}
            >
                {text}
            </span>
        );
    };
    const applyTarget = (
        bookKey: string,
        chapter: number,
        verseStart: number,
        verseEnd: number,
    ) => {
        onTargetChange({
            bookKey,
            chapter,
            verseStart,
            verseEnd,
        });
    };
    const params = {
        applyTarget,
        bibleKey,
        isOneVerse,
        waitUntilGotVerseStart,
        target,
        fontFamily: fontFamily ?? null,
    };
    return (
        <span>
            {genEditor(book, (event) => {
                handleContextMenu(event, params);
            })}{' '}
            {genEditor(localeChapter, async (event) => {
                handleContextMenu(event, {
                    ...params,
                    book: target.bookKey,
                });
            })}
            {':'}
            {genEditor(localeVerseStart, (event) => {
                handleContextMenu(event, {
                    ...params,
                    book: target.bookKey,
                    chapter: target.chapter,
                });
            })}
            {!isOneVerse && localeVerseEnd ? '-' : ''}
            {!isOneVerse && localeVerseEnd
                ? genEditor(localeVerseEnd, async (event) => {
                      handleContextMenu(event, {
                          ...params,
                          book: target.bookKey,
                          chapter: target.chapter,
                          verseStart: target.verseStart,
                      });
                  })
                : null}
        </span>
    );
}
