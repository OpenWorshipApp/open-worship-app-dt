import { useState } from 'react';
import {
    allArrows,
    KeyboardType, useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { genInd } from './genInd';
import {
    useFromLocaleNumBB, useToLocaleNumBB,
} from '../server/bible-helpers/bibleHelpers2';
import {
    getChapterCount,
} from '../server/bible-helpers/bibleInfoHelpers';
import {
    useGetChapterCount,
} from '../server/bible-helpers/bibleHelpers';

const OPTION_CLASS = 'bible-search-chapter-option';

function genMatchedChapters(currentIndexing: number,
    chapterCount: number | null) {
    if (currentIndexing !== null && chapterCount !== null) {
        const chapterList = Array.from({
            length: chapterCount,
        }, (_, i) => {
            return i + 1;
        });
        return currentIndexing ? chapterList.filter((c) => {
            if (`${c}`.includes(`${currentIndexing}`)) {
                return true;
            }
            if (`${currentIndexing}`.includes(`${c}`)) {
                return true;
            }
            return false;
        }) : chapterList;
    }
    return null;
}

export default function RenderChapterOption({
    bookSelected,
    bibleSelected,
    inputText,
    onSelect,
}: {
    bibleSelected: string,
    bookSelected: string,
    inputText: string,
    onSelect: (chapter: number) => void,
}) {
    const chapterCount = useGetChapterCount(bibleSelected, bookSelected);
    const currentIndexing = useFromLocaleNumBB(bibleSelected,
        inputText.split(bookSelected)[1]);
    const matches = genMatchedChapters(currentIndexing || 0, chapterCount);

    const [attemptChapterIndex, setAttemptChapterIndex] = useState(0);
    const arrowListener = async (event: KeyboardEvent) => {
        const newChapterCount = await getChapterCount(
            bibleSelected, bookSelected);
        if (newChapterCount !== null) {
            const ind = genInd(attemptChapterIndex, newChapterCount,
                event.key as KeyboardType, 6, OPTION_CLASS);
            setAttemptChapterIndex(ind);
        }
    };
    const useCallback = (k: KeyboardType) => {
        useKeyboardRegistering({
            key: k,
        }, arrowListener);
    };
    allArrows.forEach(useCallback);
    const enterListener = () => {
        if (matches !== null) {
            const chapter = matches[attemptChapterIndex];
            if (chapter) {
                onSelect(chapter);
            }
        }
    };
    useKeyboardRegistering({
        key: 'Enter',
    }, enterListener);
    let applyAttemptIndex = attemptChapterIndex;
    if (matches === null || attemptChapterIndex > matches.length - 1) {
        applyAttemptIndex = 0;
    }
    return (
        <>
            {matches === null ? <div>
                No matched chapters
            </div> :
                matches.map((chapter, i) => {
                    const highlight = i === applyAttemptIndex;
                    const activeClass = highlight ? 'active' : '';
                    const className = 'chapter-select btn btn-outline-success '
                        + activeClass;
                    return (
                        <div key={chapter} className={OPTION_CLASS}
                            style={{ margin: '2px' }}>
                            <button type='button' onClick={() => {
                                onSelect(chapter);
                            }} className={className}>
                                <RendChapterAsync
                                    bibleSelected={bibleSelected}
                                    chapter={chapter} />
                            </button>
                        </div>
                    );
                })}
        </>
    );
}
function RendChapterAsync({ bibleSelected, chapter }: {
    bibleSelected: string, chapter: number,
}) {
    const n = useToLocaleNumBB(bibleSelected, chapter);
    if (n === null) {
        return null;
    }
    return `${n}` !== `${chapter}` ? (<>
        <span>{n}</span>
        (<small className='text-muted'>{chapter}</small>)
    </>) : (<span>{chapter}</span>);
}
