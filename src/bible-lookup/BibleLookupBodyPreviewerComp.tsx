import { lazy, use } from 'react';

import BibleItem from '../bible-list/BibleItem';
import BibleViewComp from '../bible-reader/BibleViewComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import {
    useCloseBibleItemRenderer,
    useNextEditingBibleItem,
} from '../bible-reader/readBibleHelpers';
import {
    BibleViewTitleEditingComp,
    BibleViewTitleMaterialContext,
    BibleViewTitleWrapperComp,
} from '../bible-reader/BibleViewExtra';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { setBibleLookupInputFocus } from './selectionHelpers';

const LazyBiblePreviewerRenderComp = lazy(() => {
    return import('../bible-reader/BiblePreviewerRenderComp');
});

function RenderBodyEditingComp() {
    const viewController = useLookupBibleItemControllerContext();
    const selectedBibleItem = viewController.selectedBibleItem;
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
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
                            onTargetChange={async (newBibleTarget) => {
                                viewController.applyTargetOrBibleKey(
                                    foundBibleItem,
                                    { target: newBibleTarget },
                                );
                            }}
                        >
                            <span
                                className="app-caught-hover-pointer"
                                title='Hit "Escape" to force edit'
                                onClick={() => {
                                    setBibleLookupInputFocus();
                                }}
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
    return (
        <BibleViewTitleMaterialContext
            value={{
                titleElement: (
                    <BibleViewTitleEditingComp
                        bibleItem={bibleItem}
                        onTargetChange={(newBibleTarget) => {
                            viewController.applyTargetOrBibleKey(bibleItem, {
                                target: newBibleTarget,
                            });
                        }}
                    >
                        <span
                            className={
                                'pointer app-low-hover-visible-1 ' +
                                'app-caught-hover-pointer app-pencil-bible-lookup'
                            }
                            title='Hit "Escape" to force edit'
                            onClick={() => {
                                viewController.editBibleItem(bibleItem);
                            }}
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
