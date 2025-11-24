import {
    allArrows,
    KeyboardType,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { processSelection, userEnteringSelected } from './selectionHelpers';
import { useChapterMatch } from '../helper/bible-helpers/serverBibleHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { getChapterData } from '../helper/bible-helpers/bibleInfoHelpers';
import { useState } from 'react';

const OPTION_CLASS = 'bible-lookup-chapter-option';
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

function RenderChapterZeroContentComp({
    bibleKey,
    bookKey,
}: Readonly<{ bibleKey: string; bookKey: string }>) {
    const [chapterData] = useAppStateAsync(async () => {
        const localChapterData = await getChapterData(bibleKey, bookKey, 0);
        return localChapterData;
    });
    return (
        <div className="card w-100 my-2">
            <div className="card-body p-1">
                {Object.values(chapterData?.verses ?? {}).map((verse, i) => {
                    return (
                        <p
                            data-bible-key={bibleKey}
                            key={i}
                            dangerouslySetInnerHTML={{
                                __html: verse,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function RenderChapterZeroComp({
    bibleKey,
    bookKey,
}: Readonly<{ bibleKey: string; bookKey: string }>) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div
            className="w-100 my-2"
            style={{
                marginLeft: '2px',
                marginRight: '2px',
            }}
        >
            <button
                className="btn btn-outline-success"
                onClick={() => {
                    console.log('click');
                    setExpanded(!expanded);
                }}
            >
                <span>
                    <i className="bi bi-info-circle" />
                </span>
            </button>
            {expanded ? (
                <RenderChapterZeroContentComp
                    bibleKey={bibleKey}
                    bookKey={bookKey}
                />
            ) : null}
        </div>
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
            event,
        );
    };
    useKeyboardRegistering(
        allArrows.map((key) => {
            return { key };
        }),
        arrowListener,
        [],
    );
    userEnteringSelected(OPTION_CLASS, OPTION_SELECTED_CLASS);
    if (matches === null) {
        return null;
    }
    const chapterZero =
        matches.find((match) => {
            return match.chapter === 0;
        }) ?? null;
    return (
        <>
            {chapterZero?.isIntro ? (
                <RenderChapterZeroComp bibleKey={bibleKey} bookKey={bookKey} />
            ) : null}
            {matches.map(({ chapter, chapterLocaleString }, i) => {
                if (chapter === 0) {
                    return null;
                }
                const className =
                    'app-chapter-select btn btn-outline-success w-100' +
                    ` ${OPTION_CLASS}` +
                    ` ${i === 0 ? OPTION_SELECTED_CLASS : ''}`;
                const isDiff = `${chapter}` !== chapterLocaleString;
                return (
                    <div
                        key={chapter}
                        title={isDiff ? `Chapter ${chapter}` : undefined}
                        style={{ margin: '2px', minWidth: '100px' }}
                    >
                        <button
                            className={className}
                            onClick={() => {
                                onSelect(chapter);
                            }}
                        >
                            <span>
                                <span data-bible-key={bibleKey}>
                                    {chapterLocaleString}
                                </span>
                                {isDiff ? (
                                    <small className="px-1">({chapter})</small>
                                ) : null}
                            </span>
                        </button>
                    </div>
                );
            })}
        </>
    );
}
