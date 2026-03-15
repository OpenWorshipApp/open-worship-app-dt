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
import { HoverMotionHandler } from '../helper/domHelpers';

const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});

function RenderBodyEditingComp() {
    const viewController = useLookupBibleItemControllerContext();
    const selectedBibleItem = viewController.selectedBibleItem;
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    const handleTargetChange = useCallback(
        async (newBibleTarget: any) => {
            viewController.applyTargetOrBibleKey(foundBibleItem!, {
                target: newBibleTarget,
            });
        },
        [viewController, foundBibleItem],
    );
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
                        >
                            <span
                                className="app-caught-hover-pointer app-opacity-hover"
                                title='Hit "Escape" to jump back to editing input'
                                data-opacity-hover="0.2"
                                onClick={handleFocusInput}
                            >
                                <i
                                    className={
                                        'bi bi-pencil-fill highlight-color ' +
                                        'app-pencil-bible-lookup'
                                    }
                                />
                            </span>
                        </BibleViewTitleEditingComp>
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
    const handleTargetChange = useCallback(
        (newBibleTarget: any) => {
            viewController.applyTargetOrBibleKey(bibleItem, {
                target: newBibleTarget,
            });
        },
        [viewController, bibleItem],
    );
    const handleEditBibleItem = useCallback(() => {
        viewController.editBibleItem(bibleItem);
    }, [viewController, bibleItem]);
    return (
        <BibleViewTitleMaterialContext
            value={{
                titleElement: (
                    <BibleViewTitleEditingComp
                        bibleItem={bibleItem}
                        onTargetChange={handleTargetChange}
                    >
                        <span
                            className={
                                `pointer ${HoverMotionHandler.lowVisibleClassname}-0 ` +
                                'app-caught-hover-pointer app-opacity-hover'
                            }
                            title="Click to edit this section"
                            data-opacity-hover="0.2"
                            onClick={handleEditBibleItem}
                        >
                            <i
                                style={{ color: 'green' }}
                                className="bi bi-pencil"
                            />
                        </span>
                    </BibleViewTitleEditingComp>
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
