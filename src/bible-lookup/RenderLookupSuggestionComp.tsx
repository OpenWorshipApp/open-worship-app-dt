import { use, useCallback, type MouseEvent } from 'react';

import { tran } from '../lang/langHelpers';
import RenderChapterOptionsComp from './RenderChapterOptionsComp';
import { BibleKeySelectionMiniComp } from './BibleKeySelectionComp';
import { RENDER_FOUND_CLASS } from './selectionHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import RenderVerseOptionsComp from './RenderVerseOptionsComp';
import { openBibleSetting } from '../setting/settingHelpers';
import BibleViewTextComp from '../bible-reader/view-extra/BibleViewTextComp';
import RenderBookOptionsComp from './RenderBookOptionsComp';
import { useAppCurrentRef } from '../helper/appHooks';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

export default function RenderLookupSuggestionComp({
    applyChapterSelection,
    applyBookSelection,
}: Readonly<{
    applyChapterSelection: (newChapter: number) => void;
    applyBookSelection: (newBookKey: string, newBook: string) => void;
}>) {
    const editingResult = use(EditingResultContext);
    const handleFocusing = useCallback((event: MouseEvent<HTMLDivElement>) => {
        event.currentTarget.focus();
    }, []);
    if (editingResult === null) {
        return <div>{tran('Loading')}...</div>;
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
            onClick={handleFocusing}
        >
            <div
                className={
                    'w-100  d-flex flex-wrap align-items-center ' +
                    'justify-content-center'
                }
            >
                {bookKey === null ? (
                    <RenderBookOptionsComp
                        onSelect={applyBookSelection}
                        guessingBook={guessingBook ?? ''}
                    />
                ) : null}
                {bookKey === null || chapter !== null ? null : (
                    <RenderChapterOptionsComp
                        bookKey={bookKey}
                        guessingChapter={guessingChapter}
                        onSelect={applyChapterSelection}
                    />
                )}
            </div>
        </div>
    );
}

export function BibleNotAvailableComp({
    bibleKey,
}: Readonly<{
    bibleKey: string;
}>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const viewController = useLookupBibleItemControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const handleBibleKeyChanging = useCallback(
        (
            _isContextMenu: boolean,
            _oldBibleKey: string,
            newBibleKey: string,
        ) => {
            viewControllerRef.current.applyTargetOrBibleKey(
                viewControllerRef.current.selectedBibleItem,
                {
                    bibleKey: newBibleKey,
                },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleBibleSettingOpening = useCallback(() => {
        openBibleSetting();
    }, []);

    return (
        <div
            id="bible-lookup-container"
            className="card card app-zero-border-radius"
        >
            <div className="body card-body w-100 p-3">
                <h2>
                    {tran('Bible key ')}
                    <span style={{ fontFamily }}>"{bibleKey}"</span>
                    {' is not available!'}
                </h2>
                <div className="d-flex">
                    <h4
                        style={{
                            color: 'var(--bs-warning-text-emphasis)',
                        }}
                    >
                        {tran('Please change bible key here')} 👉
                    </h4>
                    <div>
                        <BibleKeySelectionMiniComp
                            bibleKey={bibleKey}
                            onBibleKeyChange={handleBibleKeyChanging}
                        />
                    </div>
                </div>
                <hr />
                {tran('Or add bible ')}
                <button
                    className="btn btn-primary"
                    onClick={handleBibleSettingOpening}
                >
                    <span>{tran('Go to Bible Setting ')}</span>
                    <i className="bi bi-gear-wide-connected" />
                </button>
            </div>
        </div>
    );
}
