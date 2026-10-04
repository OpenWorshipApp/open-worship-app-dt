import { lazy, useCallback } from 'react';

import type BibleItem from '../bible-list/BibleItem';
import BibleViewComp from '../bible-reader/BibleViewComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import {
    useCloseBibleItemRenderer,
    useNextEditingBibleItem,
} from '../bible-reader/readBibleHelpers';
import {
    useEditingResult,
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

/**
 * Every view of the lookup, the one being edited included. It was two
 * components -- one for the selected view, one for the rest -- so selecting
 * another view swapped the type at that position and React threw away BOTH
 * views it touched, card, header and verses, and built them again. One type,
 * told by `isEditing`, keeps them.
 */
function RenderBodyComp({
    bibleItem,
    isEditing,
}: Readonly<{
    bibleItem: BibleItem;
    isEditing: boolean;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = useEditingResult();
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    // Read only for the selected view: the getter selects the first view
    // when nothing is, and that must not happen once per view.
    const viewBibleItem = isEditing
        ? viewController.selectedBibleItem
        : bibleItem;
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const foundBibleItemRef = useAppCurrentRef(foundBibleItem);
    const isEditingRef = useAppCurrentRef(isEditing);
    const handleTargetChange = useCallback((newBibleTarget: any) => {
        const targetBibleItem = isEditingRef.current
            ? foundBibleItemRef.current
            : bibleItemRef.current;
        if (targetBibleItem === null) {
            return;
        }
        viewControllerRef.current.applyTargetOrBibleKey(targetBibleItem, {
            target: newBibleTarget,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleEditBibleItem = useCallback(() => {
        viewControllerRef.current.editBibleItem(bibleItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFocusInput = useCallback(() => {
        setBibleLookupInputFocus();
    }, []);
    const titleBibleItem = isEditing ? foundBibleItem : bibleItem;
    let actionElement = null;
    if (!isEditing) {
        // One of the header's actions. At the end of the title it sat under
        // whichever action floated over it on hover -- in a three-pane
        // Reader a press on the pencil CLOSED the pane.
        actionElement = (
            <button
                type="button"
                className="bible-view-header-edit"
                title={tran('Click to edit this section')}
                aria-label={tran('Click to edit this section')}
                onClick={handleEditBibleItem}
            >
                <i className="bi bi-pencil" />
            </button>
        );
    } else if (foundBibleItem !== null) {
        // With the header's other actions, not at the end of the title where
        // those actions float over it.
        actionElement = (
            <button
                type="button"
                className="bible-view-header-edit"
                title={tran('Hit "Escape" to jump back to editing input')}
                aria-label={tran('Hit "Escape" to jump back to editing input')}
                onClick={handleFocusInput}
            >
                <i className="bi bi-pencil-fill highlight-color" />
            </button>
        );
    }
    return (
        <BibleViewTitleMaterialContext
            value={{
                titleElement:
                    titleBibleItem === null ? (
                        <BibleViewTitleWrapperComp
                            bibleKey={viewBibleItem.bibleKey}
                        >
                            {editingResult?.oldInputText ?? ''}
                        </BibleViewTitleWrapperComp>
                    ) : (
                        <BibleViewTitleEditingComp
                            bibleItem={titleBibleItem}
                            onTargetChange={handleTargetChange}
                        />
                    ),
                actionElement,
            }}
        >
            <BibleViewComp bibleItem={viewBibleItem} isEditing={isEditing} />
        </BibleViewTitleMaterialContext>
    );
}

export default function BibleLookupBodyPreviewerComp() {
    useNextEditingBibleItem();
    useCloseBibleItemRenderer();
    const viewController = useLookupBibleItemControllerContext();
    viewController.finalRenderer = function (bibleItem: BibleItem) {
        return (
            <RenderBodyComp
                bibleItem={bibleItem}
                isEditing={viewController.checkIsBibleItemSelected(bibleItem)}
            />
        );
    };
    return (
        <AppSuspenseComp>
            <LazyBiblePreviewerRenderComp />
        </AppSuspenseComp>
    );
}
