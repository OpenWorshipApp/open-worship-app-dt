import RenderBookOptionsComp from './RenderBookOptionsComp';
import RenderChapterOptionsComp from './RenderChapterOptionsComp';
import { BibleSelectionMiniComp } from './BibleSelectionComp';
import { RENDER_FOUND_CLASS } from './selectionHelpers';
import { BibleViewTextComp } from '../bible-reader/BibleViewExtra';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import RenderVerseOptionsComp from './RenderVerseOptionsComp';
import { use } from 'react';
import { goToBibleSetting } from '../setting/settingHelpers';

export default function RenderLookupSuggestionComp({
    applyChapterSelection,
    applyBookSelection,
}: Readonly<{
    applyChapterSelection: (newChapter: number) => void;
    applyBookSelection: (newBookKey: string, newBook: string) => void;
}>) {
    const editingResult = use(EditingResultContext);
    if (editingResult === null) {
        return <div>Loading...</div>;
    }
    const {
        bookKey,
        guessingBook,
        chapter,
        guessingChapter,
        bibleItem: foundBibleItem,
    } = editingResult.result;

    if (foundBibleItem !== null) {
        return (
            <>
                <RenderVerseOptionsComp bibleItem={foundBibleItem} />
                <BibleViewTextComp bibleItem={foundBibleItem} />
            </>
        );
    }
    return (
        <div
            className={`found w-100 h-100 app-focusable ${RENDER_FOUND_CLASS}`}
            style={{ overflowY: 'auto' }}
            tabIndex={0}
            onClick={(event) => {
                event.currentTarget.focus();
            }}
        >
            <div
                className={
                    'w-100  d-flex flex-wrap align-items-start ' +
                    'justify-content-start'
                }
            >
                <RenderBookOptionsComp
                    bookKey={bookKey}
                    guessingBook={guessingBook}
                    onSelect={applyBookSelection}
                />
                <RenderChapterOptionsComp
                    bookKey={bookKey}
                    chapter={chapter}
                    guessingChapter={guessingChapter}
                    onSelect={applyChapterSelection}
                />
            </div>
        </div>
    );
}

export function BibleNotAvailableComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const handleBibleKeyChanging = (
        _oldBibleKey: string,
        newBibleKey: string,
    ) => {
        viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
            bibleKey: newBibleKey,
        });
    };

    return (
        <div id="bible-lookup-popup" className="card">
            <div className="body card-body w-100 p-3">
                <h2>Bible key "{bibleKey}" is not available!</h2>
                Please change bible key here:{' '}
                <BibleSelectionMiniComp
                    bibleKey={bibleKey}
                    onBibleKeyChange={handleBibleKeyChanging}
                />
                ??
                <hr />
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        goToBibleSetting();
                    }}
                >
                    <span>`Go to Bible Setting </span>
                    <i className="bi bi-gear-wide-connected" />
                </button>
            </div>
        </div>
    );
}
