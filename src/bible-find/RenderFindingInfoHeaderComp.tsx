import { useMemo } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { checkIsOldTestament } from '../helper/bible-helpers/bibleInfoHelpers';
import type { BookMatchDataType } from '../helper/bible-helpers/bibleLogicHelpers1';
import { genBookMatches } from '../helper/bible-helpers/bibleLogicHelpers1';
import { showSimpleToast } from '../toast/toastHelpers';
import type { SelectedBookKeyType } from './bibleFindHelpers';

function genMenuItem(
    bibleKey: string,
    selectedBooks: SelectedBookKeyType[],
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void,
    { bookKey, book, modelBook, isAvailable }: BookMatchDataType,
) {
    const extraName = book === modelBook ? '' : ` (${modelBook})`;
    return {
        menuElement: (
            <span data-bible-key={bibleKey}>{`${book}${extraName}`}</span>
        ),
        disabled:
            !isAvailable ||
            (selectedBooks.length === 1 &&
                selectedBooks[0].bookKey === bookKey),
        onSelect: (event: any) => {
            if (event.shiftKey) {
                setSelectedBooks([...selectedBooks, { bookKey, book }]);
            } else {
                setSelectedBooks([{ bookKey, book }]);
            }
        },
    } as ContextMenuItemType;
}
async function selectBookKeys(
    event: any,
    bibleKey: string,
    selectedBooks: SelectedBookKeyType[],
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void,
) {
    const bookList = await genBookMatches(bibleKey, '');
    if (bookList === null) {
        showSimpleToast('Getting bible list', 'Fail to get bible list');
        return;
    }
    const oldBookList = bookList.filter((book) => {
        return checkIsOldTestament(book.bookKey);
    });
    const newBookList = bookList.filter((book) => {
        return !checkIsOldTestament(book.bookKey);
    });
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: 'All Books',
            onSelect: () => {
                setSelectedBooks([]);
            },
        },
        ...(selectedBooks.length > 0
            ? [
                  {
                      menuElement: 'Shift + Click to select multiple',
                  },
              ]
            : []),
        {
            menuElement: (
                <span
                    style={{
                        color: 'maroon',
                        borderBottom: '1px dotted gray',
                    }}
                >
                    Old Testament
                </span>
            ),
            onSelect: () => {
                setSelectedBooks(oldBookList);
            },
        },
        ...oldBookList.map((book) => {
            return genMenuItem(bibleKey, selectedBooks, setSelectedBooks, book);
        }),
        {
            menuElement: (
                <span
                    style={{
                        color: 'maroon',
                        borderBottom: '1px dotted gray',
                    }}
                >
                    New Testament
                </span>
            ),
            onSelect: () => {
                setSelectedBooks(newBookList);
            },
        },
        ...newBookList.map((book) => {
            return genMenuItem(bibleKey, selectedBooks, setSelectedBooks, book);
        }),
    ];
    showAppContextMenu(event, contextMenuItems);
}

export default function RenderFindingInfoHeaderComp({
    bibleKey,
    selectedBooks,
    setSelectedBooks,
}: Readonly<{
    bibleKey: string;
    selectedBooks: SelectedBookKeyType[];
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void;
}>) {
    const text = useMemo(() => {
        return selectedBooks.length === 0
            ? 'All Books'
            : `${selectedBooks
                  .map(({ book }) => {
                      return book;
                  })
                  .join(', ')}`;
    }, [selectedBooks]);
    return (
        <div className="w-100 d-flex overflow-hidden app-inner-shadow p-1">
            <div className="w-100 overflow-hidden">
                <button
                    className="btn btn-sm btn-info app-ellipsis"
                    title={text}
                    style={{ maxWidth: '100%' }}
                    onClick={(event) => {
                        selectBookKeys(
                            event,
                            bibleKey,
                            selectedBooks,
                            setSelectedBooks,
                        );
                    }}
                >
                    <span data-bible-key={bibleKey}>{text}</span>
                </button>
            </div>
        </div>
    );
}
