import { useState } from 'react';
import {
    allArrows,
    KeyboardType, useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { genInd } from './genInd';
import {
    useFromLocaleNumber, useToLocaleNumber,
} from '../bible-helper/helpers2';
import { getChapterCount } from '../bible-helper/helpers1';
import { useGetChapterCount } from '../bible-helper/bibleHelpers';

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
    const currentIndexing = useFromLocaleNumber(bibleSelected,
        inputText.split(bookSelected)[1]);
    let matches: number[] | null = null;
    if (currentIndexing !== null && chapterCount !== null) {
        const chapterList = Array.from({ length: chapterCount }, (_, i) => i + 1);
        matches = currentIndexing ? chapterList.filter((c) => {
            if (~`${c}`.indexOf(`${currentIndexing}`)) {
                return true;
            }
            if (~`${currentIndexing}`.indexOf(`${c}`)) {
                return true;
            }
            return false;
        }) : chapterList;
    }

    const [attemptChapterIndex, setAttemptChapterIndex] = useState(0);
    const arrowListener = async (e: KeyboardEvent) => {
        const newChapterCount = await getChapterCount(bibleSelected, bookSelected);
        if (newChapterCount !== null) {
            const ind = genInd(attemptChapterIndex, newChapterCount, e.key as KeyboardType, 6);
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
    return <>
        <span className='input-group-text float-start'>
            <i className='bi bi-box-arrow-in-right'></i>
        </span>
        <div className='row w-75 align-items-start g-2'>
            {matches === null ? <div>not matched chapters</div> :
                matches.map((chapter, i) => {
                    const highlight = i === applyAttemptIndex;
                    const className = `chapter-select btn btn-outline-success ${highlight ? 'active' : ''}`;
                    return (
                        <div className='col-2' key={`${i}`}>
                            <button type='button' onClick={() => {
                                onSelect(chapter);
                            }} className={className}>
                                <RendChapterAsync bibleSelected={bibleSelected} chapter={chapter} />
                            </button>
                        </div>
                    );
                })}
        </div>
    </>;
}
function RendChapterAsync({ bibleSelected, chapter }: {
    bibleSelected: string, chapter: number,
}) {
    const n = useToLocaleNumber(bibleSelected, chapter);
    if (n === null) {
        return null;
    }
    return `${n}` !== `${chapter}` ? (<>
        <span>{n}</span>
        (<small className='text-muted'>{chapter}</small>)
    </>) : (<span>{chapter}</span>);
}
