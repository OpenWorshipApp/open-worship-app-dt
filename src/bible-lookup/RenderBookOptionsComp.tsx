import { Fragment } from 'react';

import { genBookMatches } from '../helper/bible-helpers/serverBibleHelpers';
import {
    allArrows,
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
import { checkIsOldTestament } from '../helper/bible-helpers/bibleInfoHelpers';

const OPTION_CLASS = 'bible-lookup-book-option';
const OPTION_SELECTED_CLASS = 'active';

function genBookOption({
    bibleKey,
    onSelect,
    index,
    bookKey,
    book,
    bookKJV,
    isAvailable,
}: {
    bibleKey: string;
    onSelect: SelectBookType;
    index: number;
    bookKey: string;
    book: string;
    bookKJV: string;
    isAvailable: boolean;
}) {
    const activeClass = index === 0 && isAvailable ? OPTION_SELECTED_CLASS : '';
    const isOldTestament = checkIsOldTestament(bookKey);
    return (
        <div
            style={{ margin: '2px' }}
            title={isAvailable ? undefined : 'Not available'}
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
                    borderStyle: isOldTestament ? 'dashed' : 'double',
                    borderWidth: isOldTestament ? '1px' : '2px',
                }}
                type="button"
                onClick={() => {
                    onSelect(bookKey, book);
                }}
            >
                <span data-bible-key={bibleKey}>{book}</span>
                {book !== bookKJV ? (
                    <>
                        (<small className="text-muted">{bookKJV}</small>)
                    </>
                ) : null}
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
    allArrows.forEach(useKeyEvent);
    userEnteringSelected(OPTION_CLASS, OPTION_SELECTED_CLASS);

    if (!matches) {
        return <div>No book options available</div>;
    }
    return (
        <>
            {matches.map(
                ({ bibleKey, bookKey, book, bookKJV, isAvailable }, i) => {
                    return (
                        <Fragment key={bookKey}>
                            {genBookOption({
                                bibleKey,
                                bookKey,
                                book,
                                bookKJV,
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
