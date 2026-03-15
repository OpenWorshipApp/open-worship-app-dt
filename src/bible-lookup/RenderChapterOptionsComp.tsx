import { useCallback, useMemo, useState } from 'react';

import { sanitizeHtml } from '../helper/sanitizeHelpers';
import type { KeyboardType } from '../event/KeyboardEventListener';
import {
    allArrows,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import {
    CHAPTER_OPTION_WIDTH,
    processSelection,
    userEnteringSelected,
} from './selectionHelpers';
import { useChapterMatch } from '../helper/bible-helpers/bibleLogicHelpers1';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { getChapterData } from '../helper/bible-helpers/bibleInfoHelpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';

const OPTION_CLASS = 'bible-lookup-chapter-option';
const OPTION_SELECTED_CLASS = 'active';

function RenderChapterZeroContentComp({
    bibleKey,
    bookKey,
}: Readonly<{ bibleKey: string; bookKey: string }>) {
    const fontFamily = useBibleFontFamily(bibleKey);
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
                            key={i}
                            style={{ fontFamily }}
                            dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(verse),
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
    const handleToggleExpanded = useCallback(() => {
        setExpanded(!expanded);
    }, [expanded]);
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
                onClick={handleToggleExpanded}
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

function genChapterOption({
    chapter,
    chapterLocaleString,
    i,
    onSelect,
    fontFamily,
}: Readonly<{
    chapter: number;
    chapterLocaleString: string;
    i: number;
    onSelect: (chapter: number) => void;
    fontFamily?: string;
}>) {
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
            style={{
                margin: '2px',
                width: CHAPTER_OPTION_WIDTH,
            }}
        >
            <button
                className={className}
                onClick={() => {
                    onSelect(chapter);
                }}
            >
                <span>
                    <span style={{ fontFamily }}>{chapterLocaleString}</span>
                    {isDiff ? (
                        <small className="px-1">({chapter})</small>
                    ) : null}
                </span>
            </button>
        </div>
    );
}

export default function RenderChapterOptionsComp({
    bookKey,
    guessingChapter,
    onSelect,
}: Readonly<{
    bookKey: string;
    guessingChapter: string | null;
    onSelect: (chapter: number) => void;
}>) {
    const bibleKey = useBibleKeyContext();
    const fontFamily = useBibleFontFamily(bibleKey);
    const matchedChapters = useChapterMatch(bibleKey, bookKey, guessingChapter);
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
    const ghostElementCount = useMemo(() => {
        const clientWidth = document.body.clientWidth;
        return Math.ceil(clientWidth / CHAPTER_OPTION_WIDTH);
    }, []);
    if (matchedChapters === null) {
        return null;
    }
    const chapterZero =
        matchedChapters.find((match) => {
            return match.chapter === 0;
        }) ?? null;
    return (
        <>
            {chapterZero?.isIntro ? (
                <RenderChapterZeroComp bibleKey={bibleKey} bookKey={bookKey} />
            ) : null}
            {matchedChapters.map(({ chapter, chapterLocaleString }, i) => {
                return genChapterOption({
                    chapter,
                    chapterLocaleString,
                    i,
                    onSelect,
                    fontFamily,
                });
            })}
            {Array.from({
                length: ghostElementCount,
            }).map((_, i) => {
                return (
                    <div
                        key={i}
                        style={{
                            visibility: 'hidden',
                            margin: '2px',
                            width: CHAPTER_OPTION_WIDTH,
                        }}
                    />
                );
            })}
        </>
    );
}
