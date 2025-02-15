import RenderBookOptions from './RenderBookOptions';
import RenderChapterOptions from './RenderChapterOptions';
import {
    ExtractedBibleResult,
} from '../helper/bible-helpers/serverBibleHelpers2';
import RenderBibleDataFound from './RenderBibleDataFound';
import { BibleItemContext } from '../bible-reader/BibleItemContext';
import { attemptAddingHistory } from './InputHistoryComp';

export default function RenderSearchSuggestion({
    bibleResult, applyChapterSelection, applyVerseSelection,
    applyBookSelection,
}: Readonly<{
    bibleResult: ExtractedBibleResult,
    applyChapterSelection: (newChapter: number) => void,
    applyVerseSelection: (
        newVerseStart?: number, newVerseEnd?: number,
    ) => void,
    applyBookSelection: (newBookKey: string, newBook: string) => void,
}>) {
    const handleVerseChanging = (
        newVerseStart?: number, newVerseEnd?: number,
    ) => {
        applyVerseSelection(newVerseStart, newVerseEnd);
    };
    const {
        bookKey, guessingBook, chapter, guessingChapter, bibleItem,
    } = bibleResult;

    if (bibleItem !== null) {
        bibleItem.toTitle().then((text) => {
            attemptAddingHistory(bibleItem.bibleKey, text);
        });
        return (
            <BibleItemContext value={bibleItem}>
                <RenderBibleDataFound
                    onVerseChange={handleVerseChanging}
                />
            </BibleItemContext>
        );
    }
    return (
        <div className='found w-100 h-100'>
            <div className={
                'w-100  d-flex flex-wrap align-items-start '
                + 'justify-content-start'
            }>
                <RenderBookOptions
                    bookKey={bookKey}
                    guessingBook={guessingBook}
                    onSelect={applyBookSelection}
                />
                <RenderChapterOptions
                    bookKey={bookKey}
                    chapter={chapter}
                    guessingChapter={guessingChapter}
                    onSelect={applyChapterSelection}
                />
            </div>
        </div>
    );
}

export function BibleNotAvailable() {
    return (
        <div id='bible-search-popup' className='shadow card'>
            <div className='body card-body w-100'>
                Bible not available!
            </div>
        </div>
    );
}
