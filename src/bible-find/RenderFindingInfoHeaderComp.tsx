import { useCallback, useMemo } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { checkIsOldTestament } from '../helper/bible-helpers/bibleInfoHelpers';
import type { BookMatchDataType } from '../helper/bible-helpers/bibleLogicHelpers1';
import { genBookMatches } from '../helper/bible-helpers/bibleLogicHelpers1';
import { showSimpleToast } from '../toast/toastHelpers';
import type { SelectedBookKeyType } from './bibleFindHelpers';
import { tran } from '../lang/langHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import BibleFindController from './BibleFindController';
import appProvider from '../server/appProvider';
import { useAppCurrentRef } from '../helper/appHooks';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

function genMenuItem(
    selectedBooks: SelectedBookKeyType[],
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void,
    { bibleKey, bookKey, book, modelBook, isAvailable }: BookMatchDataType,
) {
    const extraName = book === modelBook ? '' : ` (${modelBook})`;
    return {
        menuElement: (
            <span data-bible-key-ff={bibleKey}>{`${book}${extraName}`}</span>
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
    const bookList = await genBookMatches(bibleKey);
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
            menuElement: tran('All Books'),
            onSelect: () => {
                setSelectedBooks([]);
            },
        },
        ...(selectedBooks.length > 0
            ? [
                  {
                      menuElement: tran('Shift + Click to select multiple'),
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
                    {tran('Old Testament')}
                </span>
            ),
            onSelect: () => {
                setSelectedBooks(oldBookList);
            },
        },
        ...oldBookList.map((book) => {
            return genMenuItem(selectedBooks, setSelectedBooks, book);
        }),
        {
            menuElement: (
                <span
                    style={{
                        color: 'maroon',
                        borderBottom: '1px dotted gray',
                    }}
                >
                    {tran('New Testament')}
                </span>
            ),
            onSelect: () => {
                setSelectedBooks(newBookList);
            },
        },
        ...newBookList.map((book) => {
            return genMenuItem(selectedBooks, setSelectedBooks, book);
        }),
    ];
    showAppContextMenu(event, contextMenuItems);
}

function showExtraActions(
    event: any,
    bibleKey: string,
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void,
    isDisabledFilterResetting = false,
) {
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: (
                <span style={{ color: 'var(--bs-danger)' }}>
                    {tran('Reset Search Data')}
                </span>
            ),
            onSelect: async () => {
                const isOk = await showAppConfirm(
                    tran('Reset Search Data'),
                    tran(
                        'Are you sure to reset search data? This will take a ' +
                            'moment to restore',
                    ),
                );
                if (!isOk) {
                    return;
                }
                const isSuccess =
                    await BibleFindController.resetSearchingDatabase(bibleKey);
                if (isSuccess) {
                    appProvider.reload();
                } else {
                    showSimpleToast(
                        tran('Reset Search Data'),
                        tran('Fail to reset search data, please try again'),
                    );
                }
            },
        },
        {
            menuElement: tran('Reset Selected Books'),
            disabled: isDisabledFilterResetting,
            onSelect: () => {
                setSelectedBooks([]);
            },
        },
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
    const fontFamily = useBibleFontFamily(bibleKey);
    const text = useMemo(() => {
        return selectedBooks.length === 0
            ? tran('All Books')
            : `${selectedBooks
                  .map(({ book }) => {
                      return book;
                  })
                  .join(', ')}`;
    }, [selectedBooks]);
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const selectedBooksRef = useAppCurrentRef(selectedBooks);
    const setSelectedBooksRef = useAppCurrentRef(setSelectedBooks);
    const handleSelectBookKeys = useCallback((event: any) => {
        selectBookKeys(
            event,
            bibleKeyRef.current,
            selectedBooksRef.current,
            setSelectedBooksRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleExtraActions = useCallback((event: any) => {
        showExtraActions(
            event,
            bibleKeyRef.current,
            setSelectedBooksRef.current,
            selectedBooksRef.current.length === 0,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="w-100 d-flex overflow-hidden app-inner-shadow p-1 align-items-center">
            <button
                className="btn btn-sm btn-outline-secondary flex-shrink-0 me-1 px-1 py-0"
                type="button"
                aria-label={tran('Reset Search Data')}
                title={tran('Reset Search Data')}
                onClick={handleExtraActions}
            >
                <i className="bi bi-three-dots-vertical" />
            </button>
            <div className="w-100 overflow-hidden">
                <button
                    className="btn btn-sm btn-info app-ellipsis"
                    title={text}
                    style={{ maxWidth: '100%' }}
                    onClick={handleSelectBookKeys}
                >
                    <span style={{ fontFamily }}>{text}</span>
                </button>
            </div>
        </div>
    );
}
