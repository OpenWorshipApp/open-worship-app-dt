import { Fragment } from 'react';

import { genBookMatches } from '../helper/bible-helpers/bibleLogicHelpers1';
import {
    KeyboardType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import {
    SelectBookType,
    processSelection,
    userEnteringSelected,
} from './selectionHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import {
    checkIsApocrypha,
    checkIsOldTestament,
} from '../helper/bible-helpers/bibleInfoHelpers';

const OPTION_CLASS = 'bible-lookup-book-option';
const OPTION_SELECTED_CLASS = 'active';

function genBookOption({
    bibleKey,
    onSelect,
    index,
    bookKey,
    book,
    modelBook,
    isAvailable,
}: {
    bibleKey: string;
    onSelect: SelectBookType;
    index: number;
    bookKey: string;
    book: string;
    modelBook: string;
    isAvailable: boolean;
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
            title={isAvailable ? undefined : 'Not available'}
            style={{
                margin: '2px',
                cursor: isAvailable ? undefined : 'not-allowed',
            }}
        >
            <button
                className={
                    'text-nowrap btn-sm btn btn-outline-success' +
                    ` ${OPTION_CLASS} ${activeClass}`
                }
                disabled={!isAvailable}
                style={{
                    width: '240px',
                    overflowX: 'auto',
                    borderColor,
                }}
                type="button"
                onClick={() => {
                    onSelect(bookKey, book);
                }}
            >
                <span data-bible-key={bibleKey}>{book}</span>
                {book === modelBook ? null : (
                    <small className="px-1">({modelBook})</small>
                )}
            </button>
        </div>
    );
}

function BookOptionsComp({
    onSelect,
    guessingBook,
}: Readonly<{
    onSelect: SelectBookType;
    guessingBook: string;
}>) {
    const bibleKey = useBibleKeyContext();
    const [matches] = useAppStateAsync(() => {
        return genBookMatches(bibleKey, guessingBook);
    }, [bibleKey, guessingBook]);
    const useKeyEvent = (key: KeyboardType) => {
        useKeyboardRegistering(
            [{ key }],
            (event: KeyboardEvent) => {
                processSelection(
                    OPTION_CLASS,
                    OPTION_SELECTED_CLASS,
                    event.key as KeyboardType,
                    event,
                );
            },
            [],
        );
    };
    useKeyEvent('ArrowLeft');
    useKeyEvent('ArrowRight');
    useKeyEvent('ArrowUp');
    useKeyEvent('ArrowDown');
    userEnteringSelected(OPTION_CLASS, OPTION_SELECTED_CLASS);

    if (!matches) {
        return <div>No book options available</div>;
    }
    return (
        <>
            {matches.map(
                ({ bibleKey, bookKey, book, modelBook, isAvailable }, i) => {
                    return (
                        <Fragment key={bookKey}>
                            {genBookOption({
                                bibleKey,
                                bookKey,
                                book,
                                modelBook,
                                onSelect,
                                index: i,
                                isAvailable,
                            })}
                        </Fragment>
                    );
                },
            )}
        </>
    );
}

export default function RenderBookOptionsComp({
    onSelect,
    bookKey,
    guessingBook,
}: Readonly<{
    onSelect: SelectBookType;
    bookKey: string | null;
    guessingBook: string | null;
}>) {
    if (bookKey !== null) {
        return null;
    }
    return (
        <BookOptionsComp
            onSelect={onSelect}
            guessingBook={guessingBook ?? ''}
        />
    );
}
