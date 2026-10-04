import { use, useCallback } from 'react';

import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import BibleInfoButtonComp from '../../bible-lookup/BibleInfoButtonComp';
import RenderActionButtonsComp from '../../bible-lookup/RenderActionButtonsComp';
import RenderEditingActionButtonsComp from '../../bible-lookup/RenderEditingActionButtonsComp';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import type LookupBibleItemController from '../LookupBibleItemController';
import {
    closeEventMapper,
    useEditingResult,
} from '../LookupBibleItemController';
import { closeCurrentEditingBibleItem } from '../readBibleHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';
import {
    applyHorizontalWheelScroll,
    BibleViewTitleMaterialContext,
} from './viewExtraHelpers';
import { toShortcutKey } from '../../event/KeyboardEventListener';
import { BIBLE_VERSE_TEXT_TITLE } from '../../helper/helpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

/**
 * ONE header for the plain view and the lookup's editing view. They were two
 * components, so making a pane the one being edited swapped the header's type
 * and React rebuilt its whole title row -- colour dot, version pill, extra
 * bibles, the reference -- which is the flicker a volunteer saw on every
 * switch. Same type, same `RenderTitleMaterialComp` position: only what
 * differs (the action buttons, the close's shortcut, the info button) changes.
 */
export default function BibleViewHeaderComp({
    bibleItem,
    isEditing,
}: Readonly<{
    // The lookup's SELECTED item while editing; the pane's own otherwise.
    bibleItem: ReadIdOnlyBibleItem;
    isEditing: boolean;
}>) {
    const viewController = useBibleItemsViewControllerContext();
    const editingResult = useEditingResult();
    const actionElement = use(BibleViewTitleMaterialContext)?.actionElement;
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const isEditingRef = useAppCurrentRef(isEditing);
    const handleBibleKeyChange = useCallback(
        (isContextMenu: boolean, _oldBibleKey: string, newBibleKey: string) => {
            // The editing view answers for the item selected when pressed.
            const targetBibleItem = isEditingRef.current
                ? (viewControllerRef.current as LookupBibleItemController)
                      .selectedBibleItem
                : bibleItemRef.current;
            viewControllerRef.current.applyTargetOrBibleKey(
                targetBibleItem,
                isContextMenu
                    ? {
                          extraBibleKeys: [
                              ...targetBibleItem.extraBibleKeys,
                              newBibleKey,
                          ],
                      }
                    : { bibleKey: newBibleKey },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleClose = useCallback(() => {
        if (isEditingRef.current) {
            closeCurrentEditingBibleItem(
                viewControllerRef.current as LookupBibleItemController,
            );
            return;
        }
        viewControllerRef.current.deleteBibleItem(bibleItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const foundBibleItem = isEditing
        ? (editingResult?.result.bibleItem ?? null)
        : bibleItem;
    // A plain view always offers its close; the editing one not when it is
    // the lookup's only view.
    const isClosable = !isEditing || !viewController.isAlone;
    const hasActions = foundBibleItem !== null || isClosable || !!actionElement;
    let actionButtons = null;
    if (!isEditing) {
        actionButtons = <RenderActionButtonsComp bibleItem={bibleItem} />;
    } else if (foundBibleItem !== null) {
        actionButtons = (
            <RenderEditingActionButtonsComp bibleItem={foundBibleItem} />
        );
    }
    return (
        <div
            className={
                'bible-view-header ' +
                (isEditing
                    ? 'bg-transparent app-border-bottom-white-round'
                    : 'card-header p-0')
            }
            title={isEditing ? BIBLE_VERSE_TEXT_TITLE : undefined}
        >
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={handleBibleKeyChange}
                actionsElement={
                    hasActions ? (
                        // Floats over the passage's end while the header is
                        // hovered, so it takes no room from the passage at
                        // rest.
                        <div
                            className="bible-view-header-actions"
                            ref={applyHorizontalWheelScroll}
                        >
                            {actionElement}
                            {actionButtons}
                            {isClosable ? (
                                <button
                                    type="button"
                                    className="bible-view-header-close"
                                    title={
                                        isEditing
                                            ? `${tran('Close')} [${toShortcutKey(closeEventMapper)}]`
                                            : tran('Close')
                                    }
                                    aria-label={tran('Close')}
                                    onClick={handleClose}
                                >
                                    <i className="bi bi-x-lg" />
                                </button>
                            ) : null}
                        </div>
                    ) : null
                }
            />
            <div className="bible-view-header-end">
                {isEditing && foundBibleItem === null ? (
                    // Nothing resolved yet, so the verse actions have nothing
                    // to act on. Offer the translation's information here
                    // instead of sending the user to Settings -> Bible just
                    // to read it. In the row, not on hover: it is the one
                    // thing here to press.
                    <div className="d-flex align-items-center px-1">
                        <BibleInfoButtonComp bibleKey={bibleItem.bibleKey} />
                    </div>
                ) : null}
                {/* No handler: the bible view around this header owns the
                    menu. */}
                <ContextMenuDotsButtonComp />
            </div>
        </div>
    );
}
