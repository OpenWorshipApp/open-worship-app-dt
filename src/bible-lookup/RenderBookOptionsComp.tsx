import './RenderBookOptionsComp.scss';

import { Fragment } from 'react';

import { genBookMatches } from '../helper/bible-helpers/bibleLogicHelpers1';
import type { KeyboardType } from '../event/KeyboardEventListener';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import type { SelectBookType } from './selectionHelpers';
import { processSelection, userEnteringSelected } from './selectionHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import {
    checkIsApocrypha,
    checkIsOldTestament,
} from '../helper/bible-helpers/bibleInfoHelpers';
import { tran } from '../lang/langHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';

const OPTION_CLASS = 'bible-lookup-book-option';
const OPTION_SELECTED_CLASS = 'active';

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
    let borderColor = '#3a3a8eb2';
    if (isOldTestament) {
        borderColor = '#53854420';
    }
    if (isApocrypha) {
        borderColor = '#733a8eb2';
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
                disabled={!isAvailable}
                style={{
                    borderColor,
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
        return genBookMatches(bibleKey, guessingBook);
    }, [bibleKey, guessingBook]);
    const handleOnArrow = (event: KeyboardEvent) => {
        processSelection(
            OPTION_CLASS,
            OPTION_SELECTED_CLASS,
            event.key as KeyboardType,
            event,
        );
    };
    useKeyboardRegistering([{ key: 'ArrowLeft' }], handleOnArrow, []);
    useKeyboardRegistering([{ key: 'ArrowRight' }], handleOnArrow, []);
    useKeyboardRegistering([{ key: 'ArrowUp' }], handleOnArrow, []);
    useKeyboardRegistering([{ key: 'ArrowDown' }], handleOnArrow, []);
    userEnteringSelected(OPTION_CLASS, OPTION_SELECTED_CLASS);

    if (!matchedBooks) {
        return <div>{tran('No book options available')}</div>;
    }
    return matchedBooks.map((matchBook, i) => {
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
    });
}
