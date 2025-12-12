import RenderBookOptionsComp from './RenderBookOptionsComp';
import RenderChapterOptionsComp from './RenderChapterOptionsComp';
import { BibleSelectionMiniComp } from './BibleSelectionComp';
import { RENDER_FOUND_CLASS } from './selectionHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import RenderVerseOptionsComp from './RenderVerseOptionsComp';
import { use } from 'react';
import { openBibleSetting } from '../setting/settingHelpers';
import BibleViewTextComp from '../bible-reader/view-extra/BibleViewTextComp';

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
        extraBibleItems,
    } = editingResult.result;

    if (foundBibleItem !== null) {
        return (
            <>
                <RenderVerseOptionsComp bibleItem={foundBibleItem} />
                <BibleViewTextComp
                    bibleItem={foundBibleItem}
                    extraBibleItems={extraBibleItems}
                />
            </>
        );
    }
    return (
        <div
            className={`app-render-found w-100 h-100 app-focusable ${RENDER_FOUND_CLASS}`}
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
        _isContextMenu: boolean,
        _oldBibleKey: string,
        newBibleKey: string,
    ) => {
        viewController.applyTargetOrBibleKey(viewController.selectedBibleItem, {
            bibleKey: newBibleKey,
        });
    };

    return (
        <div
            id="bible-lookup-container"
            className="card card app-zero-border-radius"
        >
            <div className="body card-body w-100 p-3">
                <h2>
                    {'`Bible key '}
                    <span data-bible-key={bibleKey}>"{bibleKey}"</span>
                    {' is not available!'}
                </h2>
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
                        openBibleSetting();
                    }}
                >
                    <span>`Go to Bible Setting </span>
                    <i className="bi bi-gear-wide-connected" />
                </button>
            </div>
        </div>
    );
}
