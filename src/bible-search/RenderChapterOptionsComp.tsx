import {
    allArrows,
    KeyboardType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { processSelection, userEnteringSelected } from './selectionHelpers';
import { useChapterMatch } from '../helper/bible-helpers/serverBibleHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';

const OPTION_CLASS = 'bible-search-chapter-option';
const OPTION_SELECTED_CLASS = 'active';

export default function RenderChapterOptionsComp({
    bookKey,
    chapter,
    guessingChapter,
    onSelect,
}: Readonly<{
    bookKey: string | null;
    chapter: number | null;
    guessingChapter: string | null;
    onSelect: (chapter: number) => void;
}>) {
    if (bookKey === null || chapter !== null) {
        return null;
    }
    return (
        <ChapterOptions
            bookKey={bookKey}
            guessingChapter={guessingChapter}
            onSelect={onSelect}
        />
    );
}

function ChapterOptions({
    bookKey,
    guessingChapter,
    onSelect,
}: Readonly<{
    bookKey: string;
    guessingChapter: string | null;
    onSelect: (chapter: number) => void;
}>) {
    const bibleKey = useBibleKeyContext();
    const matches = useChapterMatch(bibleKey, bookKey, guessingChapter);
    const arrowListener = (event: KeyboardEvent) => {
        processSelection(
            OPTION_CLASS,
            OPTION_SELECTED_CLASS,
            event.key as KeyboardType,
        );
    };
    useKeyboardRegistering(
        allArrows.map((key) => {
            return { key };
        }),
        arrowListener,
    );
    userEnteringSelected(OPTION_CLASS, OPTION_SELECTED_CLASS);
    if (matches === null) {
        return <div>No chapter options available</div>;
    }
    return (
        <>
            {matches.map(([chapter, chapterNumStr], i) => {
                const className =
                    'chapter-select btn btn-outline-success' +
                    ` ${OPTION_CLASS}` +
                    ` ${i === 0 ? OPTION_SELECTED_CLASS : ''}`;
                const isDiff = `${chapter}` !== chapterNumStr;
                return (
                    <div
                        key={chapter}
                        title={isDiff ? `Chapter ${chapter}` : undefined}
                        style={{ margin: '2px' }}
                    >
                        <button
                            className={className}
                            type="button"
                            onClick={() => {
                                onSelect(chapter);
                            }}
                        >
                            <span>
                                {chapterNumStr}
                                {isDiff ? (
                                    <small className="text-muted">
                                        ({chapter})
                                    </small>
                                ) : null}
                            </span>
                        </button>
                    </div>
                );
            })}
        </>
    );
}
