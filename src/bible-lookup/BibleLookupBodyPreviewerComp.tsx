import { lazy, use, useCallback } from 'react';

import type BibleItem from '../bible-list/BibleItem';
import BibleViewComp from '../bible-reader/BibleViewComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import {
    useCloseBibleItemRenderer,
    useNextEditingBibleItem,
} from '../bible-reader/readBibleHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { setBibleLookupInputFocus } from './selectionHelpers';
import { BibleViewTitleEditingComp } from '../bible-reader/view-extra/BibleViewTitleEditingComp';
import BibleViewTitleWrapperComp from '../bible-reader/view-extra/BibleViewTitleWrapperComp';
import { BibleViewTitleMaterialContext } from '../bible-reader/view-extra/viewExtraHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});

function RenderBodyEditingComp() {
    const viewController = useLookupBibleItemControllerContext();
    const selectedBibleItem = viewController.selectedBibleItem;
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    const viewControllerRef = useAppCurrentRef(viewController);
    const foundBibleItemRef = useAppCurrentRef(foundBibleItem);
    const handleTargetChange = useCallback(async (newBibleTarget: any) => {
        viewControllerRef.current.applyTargetOrBibleKey(
            foundBibleItemRef.current!,
            {
                target: newBibleTarget,
            },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFocusInput = useCallback(() => {
        setBibleLookupInputFocus();
    }, []);
    return (
        <BibleViewTitleMaterialContext
            value={{
                titleElement:
                    foundBibleItem === null ? (
                        <BibleViewTitleWrapperComp
                            bibleKey={selectedBibleItem.bibleKey}
                        >
                            {editingResult?.oldInputText ?? ''}
                        </BibleViewTitleWrapperComp>
                    ) : (
                        <BibleViewTitleEditingComp
                            bibleItem={foundBibleItem}
                            onTargetChange={handleTargetChange}
                        />
                    ),
                // With the header's other actions, not at the end of the
                // title where those actions float over it.
                actionElement:
                    foundBibleItem === null ? null : (
                        <button
                            type="button"
                            className="bible-view-header-edit"
                            title={tran(
                                'Hit "Escape" to jump back to editing input',
                            )}
                            aria-label={tran(
                                'Hit "Escape" to jump back to editing input',
                            )}
                            onClick={handleFocusInput}
                        >
                            <i className="bi bi-pencil-fill highlight-color" />
                        </button>
                    ),
            }}
        >
            <BibleViewComp bibleItem={selectedBibleItem} isEditing />
        </BibleViewTitleMaterialContext>
    );
}

function RenderBodyComp({
    bibleItem,
}: Readonly<{
    bibleItem: BibleItem;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleTargetChange = useCallback((newBibleTarget: any) => {
        viewControllerRef.current.applyTargetOrBibleKey(bibleItemRef.current, {
            target: newBibleTarget,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleEditBibleItem = useCallback(() => {
        viewControllerRef.current.editBibleItem(bibleItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <BibleViewTitleMaterialContext
            value={{
                titleElement: (
                    <BibleViewTitleEditingComp
                        bibleItem={bibleItem}
                        onTargetChange={handleTargetChange}
                    />
                ),
                // One of the header's actions. At the end of the title it sat
                // under whichever action floated over it on hover -- in a
                // three-pane Reader a press on the pencil CLOSED the pane.
                actionElement: (
                    <button
                        type="button"
                        className="bible-view-header-edit"
                        title={tran('Click to edit this section')}
                        aria-label={tran('Click to edit this section')}
                        onClick={handleEditBibleItem}
                    >
                        <i className="bi bi-pencil" />
                    </button>
                ),
            }}
        >
            <BibleViewComp bibleItem={bibleItem} />
        </BibleViewTitleMaterialContext>
    );
}

export default function BibleLookupBodyPreviewerComp() {
    useNextEditingBibleItem();
    useCloseBibleItemRenderer();
    const viewController = useLookupBibleItemControllerContext();
    viewController.finalRenderer = function (bibleItem: BibleItem) {
        if (!viewController.checkIsBibleItemSelected(bibleItem)) {
            return <RenderBodyComp bibleItem={bibleItem} />;
        }
        return <RenderBodyEditingComp />;
    };
    return (
        <AppSuspenseComp>
            <LazyBiblePreviewerRenderComp />
        </AppSuspenseComp>
    );
}
