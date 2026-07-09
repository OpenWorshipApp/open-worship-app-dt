import './RenderBookOptionsComp.scss';

import {
    Fragment,
    useCallback,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { genBookMatches } from '../helper/bible-helpers/bibleLogicHelpers1';
import type { KeyboardType } from '../event/KeyboardEventListener';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import type { SelectBookType } from './selectionHelpers';
import {
    BOOK_OPTION_WIDTH,
    processSelection,
    userEnteringSelected,
} from './selectionHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppStateAsync } from '../helper/appHooks';
import {
    checkIsApocrypha,
    checkIsOldTestament,
} from '../helper/bible-helpers/bibleInfoHelpers';
import { tran } from '../lang/langHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';
import {
    type BookSubtypeType,
    kjvBibleModelInfo,
} from '../helper/bible-helpers/bibleModelHelpers';

const OPTION_CLASS = 'bible-lookup-book-option';
const OPTION_SELECTED_CLASS = 'active';

const bookToSubtype = Object.fromEntries(
    (kjvBibleModelInfo.bookKeysSubtype || []).reduce(
        (acc, subtype: BookSubtypeType) => {
            subtype.bookKeys.forEach((bookKey) => {
                acc.push([bookKey, subtype.type]);
            });
            return acc;
        },
        [] as [string, string][],
    ),
);

function genBookOption({
    onSelect,
    index,
    bookKey,
    book,
    modelBook,
    isAvailable,
    fontFamily,
}: {
    onSelect: SelectBookType;
    index: number;
    bookKey: string;
    book: string;
    modelBook: string;
    isAvailable: boolean;
    fontFamily?: string;
}) {
    const activeClass = index === 0 && isAvailable ? OPTION_SELECTED_CLASS : '';
    const isOldTestament = checkIsOldTestament(bookKey);
    const isApocrypha = checkIsApocrypha(bookKey);
    let borderColor = '#a415d85a';
    if (isOldTestament) {
        borderColor = '#5385441a';
    }
    if (isApocrypha) {
        borderColor = '#3a578e2a';
    }
    return (
        <div
            className="book-option"
            title={isAvailable ? undefined : tran('Not available')}
            style={{
                cursor: isAvailable ? undefined : 'not-allowed',
            }}
        >
            <button
                data-book-index={index + 1}
                className={
                    'd-flex text-nowrap btn-sm btn btn-outline-success' +
                    ` ${OPTION_CLASS} ${activeClass}`
                }
                data-book-subtype={bookToSubtype[bookKey]}
                disabled={!isAvailable}
                style={{
                    borderColor: '#00000000',
                    borderBottomColor: borderColor,
                    width: BOOK_OPTION_WIDTH,
                }}
                type="button"
                onClick={() => {
                    onSelect(bookKey, book);
                }}
            >
                <div className="book-option-index">{index + 1}</div>
                <div className="flex-fill" style={{ fontFamily }}>
                    {book}
                    {book === modelBook ? null : (
                        <small className="px-1">({modelBook})</small>
                    )}
                </div>
            </button>
        </div>
    );
}

export default function RenderBookOptionsComp({
    onSelect,
    guessingBook,
}: Readonly<{
    onSelect: SelectBookType;
    guessingBook: string;
}>) {
    const bibleKey = useBibleKeyContext();
    const fontFamily = useBibleFontFamily(bibleKey);
    const [matchedBooks] = useAppStateAsync(() => {
        return genBookMatches(bibleKey, { guessingBook });
    }, [bibleKey, guessingBook]);
    const handleOnArrow = useCallback(
        (event: KeyboardEvent | ReactKeyboardEvent<any>) => {
            processSelection(
                OPTION_CLASS,
                OPTION_SELECTED_CLASS,
                event.key as KeyboardType,
                event,
            );
        },
        [],
    );
    useKeyboardRegistering([{ key: 'ArrowLeft' }], handleOnArrow, []);
    useKeyboardRegistering([{ key: 'ArrowRight' }], handleOnArrow, []);
    useKeyboardRegistering([{ key: 'ArrowUp' }], handleOnArrow, []);
    useKeyboardRegistering([{ key: 'ArrowDown' }], handleOnArrow, []);
    userEnteringSelected(OPTION_CLASS, OPTION_SELECTED_CLASS);
    const ghostElementCount = Math.ceil(
        document.body.clientWidth / BOOK_OPTION_WIDTH,
    );

    if (!matchedBooks) {
        return <div>{tran('No book options available')}</div>;
    }
    return (
        <>
            {matchedBooks.map((matchBook, i) => {
                const { bookKey, book, modelBook, isAvailable } = matchBook;
                return (
                    <Fragment key={bookKey}>
                        {genBookOption({
                            bookKey,
                            book,
                            modelBook,
                            onSelect,
                            index: i,
                            isAvailable,
                            fontFamily,
                        })}
                    </Fragment>
                );
            })}
            {Array.from({
                length: ghostElementCount,
            }).map((_, i) => {
                return (
                    <div
                        className="book-option-ghost"
                        key={i}
                        style={{ width: BOOK_OPTION_WIDTH }}
                    />
                );
            })}
        </>
    );
}
