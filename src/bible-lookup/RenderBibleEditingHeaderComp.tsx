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
    const isClosable = !viewController.isAlone;
    return (
        <div
            className="bg-transparent app-border-bottom-white-round"
            title={BIBLE_VERSE_TEXT_TITLE}
        >
            <div className="bible-view-header">
                <RenderTitleMaterialComp
                    bibleItem={viewController.selectedBibleItem}
                    onBibleKeyChange={handleBibleKeyChange}
                />
                <div className="bible-view-header-end">
                    {foundBibleItem !== null || isClosable ? (
                        // Floats over the title's end while the header is
                        // hovered, so it takes no room from the passage at
                        // rest.
                        <div className="bible-view-header-actions">
                            {foundBibleItem === null ? null : (
                                <RenderEditingActionButtonsComp
                                    bibleItem={foundBibleItem}
                                />
                            )}
                            {isClosable ? (
                                <button
                                    type="button"
                                    className="bible-view-header-close"
                                    title={`${tran('Close')} [${toShortcutKey(closeEventMapper)}]`}
                                    aria-label={tran('Close')}
                                    onClick={handleClose}
                                >
                                    <i className="bi bi-x-lg" />
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {foundBibleItem === null ? (
                        // Nothing resolved yet, so the verse actions have
                        // nothing to act on. Offer the translation's
                        // information here instead of sending the user to
                        // Settings -> Bible just to read it. In the row, not
                        // on hover: it is the one thing here to press.
                        <div className="d-flex align-items-center px-1">
                            <BibleInfoButtonComp
                                bibleKey={
                                    viewController.selectedBibleItem.bibleKey
                                }
                            />
                        </div>
                    ) : null}
                    {/* No handler: the bible view around this header owns
                        the menu. */}
                    <ContextMenuDotsButtonComp />
                </div>
            </div>
        </div>
    );
}
