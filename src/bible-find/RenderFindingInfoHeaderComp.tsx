import { useCallback, useMemo } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
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
import { openChatbotAsking } from '../helper/ai/chatbotHandoffHelpers';
import { genVerseFindAsk } from '../helper/ai/verseFindAskHelpers';

function genMenuItem(
    selectedBooks: SelectedBookKeyType[],
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void,
    { bibleKey, bookKey, book, modelBook, isAvailable }: BookMatchDataType,
) {
    const extraName = book === modelBook ? '' : ` (${modelBook})`;
    return {
        childBefore: genContextMenuItemIcon('book'),
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
        showSimpleToast(
            tran('Getting bible list'),
            tran('Fail to get bible list'),
        );
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
            childBefore: genContextMenuItemIcon('collection'),
            menuElement: tran('All Books'),
            onSelect: () => {
                setSelectedBooks([]);
            },
        },
        ...(selectedBooks.length > 0
            ? [
                  {
                      childBefore: genContextMenuItemIcon('info-circle'),
                      menuElement: tran('Shift + Click to select multiple'),
                  },
              ]
            : []),
        {
            childBefore: genContextMenuItemIcon('journals', {
                color: 'maroon',
            }),
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
            childBefore: genContextMenuItemIcon('journals', {
                color: 'maroon',
            }),
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
            childBefore: genContextMenuItemIcon('arrow-counterclockwise', {
                color: 'var(--bs-danger)',
            }),
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
            childBefore: genContextMenuItemIcon('funnel'),
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
    findText = '',
}: Readonly<{
    bibleKey: string;
    selectedBooks: SelectedBookKeyType[];
    setSelectedBooks: (selectedBooks: SelectedBookKeyType[]) => void;
    // What is typed in Find: the assistant searches it at once.
    findText?: string;
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
    const findTextRef = useAppCurrentRef(findText);
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
    // The assistant, opened already asking which Bible and then what they
    // remember of the verse (`src/chatbot/verseFindChatHelpers.ts`). The
    // Bible this panel is on rides in the request, so it is offered first;
    // words typed in Find ride too, and are searched at once (2026-10-22:
    // `shepherd` under the Khmer Bible found nothing here, and the press
    // had left the word behind). The press asks the 🤖's own two questions
    // first: whether AI is on, then the caution.
    const handleAskingAssistant = useCallback(() => {
        void openChatbotAsking(
            genVerseFindAsk(bibleKeyRef.current, findTextRef.current),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isFiltered = selectedBooks.length > 0;
    const assistantLabel = tran('Find a Verse with the Assistant');
    return (
        <div className="app-find-filter-bar">
            <button
                className="app-ghost-button"
                type="button"
                aria-label={tran('More Options')}
                title={tran('More Options')}
                onClick={handleExtraActions}
            >
                <i className="bi bi-three-dots-vertical" />
            </button>
            <button
                className={
                    'app-find-filter app-ellipsis' +
                    (isFiltered ? ' is-filtered' : '')
                }
                type="button"
                title={text}
                onClick={handleSelectBookKeys}
            >
                {/*
                 * The funnel appears only when one is actually on, so the state
                 * survives a grayscale screen and a colour-blind reader.
                 */}
                {isFiltered ? <i className="bi bi-funnel-fill pe-1" /> : null}
                <span style={{ fontFamily }}>{text}</span>
            </button>
            <button
                className="app-ghost-button ms-auto"
                type="button"
                aria-label={assistantLabel}
                title={assistantLabel}
                onClick={handleAskingAssistant}
            >
                <i className="bi bi-robot" />
            </button>
        </div>
    );
}
