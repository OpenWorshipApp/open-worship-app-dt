import { use, useCallback } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import BibleInfoButtonComp from './BibleInfoButtonComp';
import RenderEditingActionButtonsComp from './RenderEditingActionButtonsComp';
import { closeCurrentEditingBibleItem } from '../bible-reader/readBibleHelpers';
import { toShortcutKey } from '../event/KeyboardEventListener';
import {
    closeEventMapper,
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { HoverMotionHandler } from '../helper/domHelpers';
import { RenderTitleMaterialComp } from '../bible-reader/view-extra/RenderTitleMaterialComp';
import { BIBLE_VERSE_TEXT_TITLE } from '../helper/helpers';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function RenderBibleEditingHeaderComp() {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    const viewControllerRef = useAppCurrentRef(viewController);
    const handleBibleKeyChange = useCallback(
        (isContextMenu: boolean, _oldBibleKey: string, newBibleKey: string) => {
            const bibleItem = viewControllerRef.current.selectedBibleItem;
            viewControllerRef.current.applyTargetOrBibleKey(
                bibleItem,
                isContextMenu
                    ? {
                          extraBibleKeys: [
                              ...bibleItem.extraBibleKeys,
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
        closeCurrentEditingBibleItem(viewControllerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'bg-transparent app-top-hover-motion-1 app-border-bottom-white-round'
            }
            title={BIBLE_VERSE_TEXT_TITLE}
        >
            <div className="d-flex w-100 h-100">
                <RenderTitleMaterialComp
                    bibleItem={viewController.selectedBibleItem}
                    onBibleKeyChange={handleBibleKeyChange}
                />
                {foundBibleItem === null ? (
                    // Nothing resolved yet, so the verse actions have nothing to
                    // act on and this slot is free. Offer the translation's
                    // information here instead of sending the user to
                    // Settings -> Bible just to read it.
                    <div className="d-flex align-items-center px-1">
                        <BibleInfoButtonComp
                            bibleKey={viewController.selectedBibleItem.bibleKey}
                        />
                    </div>
                ) : (
                    <div
                        className={`${HoverMotionHandler.lowVisibleClassname}-0 app-opacity-hover`}
                        data-opacity-hover="0.1"
                    >
                        <RenderEditingActionButtonsComp
                            bibleItem={foundBibleItem}
                        />
                    </div>
                )}
                <div
                    className={`${HoverMotionHandler.lowDisplayClassname}-0 app-opacity-hover`}
                    data-min-parent-width="550"
                    data-opacity-hover="0.2"
                >
                    {viewController.isAlone ? null : (
                        <i
                            className="bi bi-x-lg app-caught-hover-pointer"
                            title={`${tran('Close')} [${toShortcutKey(closeEventMapper)}]`}
                            style={{
                                color: 'var(--bs-danger-text-emphasis)',
                            }}
                            onClick={handleClose}
                        />
                    )}
                </div>
                {/* No handler: the bible view around this header owns the
                    menu. */}
                <ContextMenuDotsButtonComp />
            </div>
        </div>
    );
}
