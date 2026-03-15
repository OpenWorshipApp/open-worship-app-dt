import { use, useCallback } from 'react';

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

export default function RenderBibleEditingHeader() {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    const handleBibleKeyChange = useCallback(
        (isContextMenu: boolean, _oldBibleKey: string, newBibleKey: string) => {
            const bibleItem = viewController.selectedBibleItem;
            viewController.applyTargetOrBibleKey(
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
        [viewController],
    );
    const handleClose = useCallback(() => {
        closeCurrentEditingBibleItem(viewController);
    }, [viewController]);
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
                {foundBibleItem === null ? null : (
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
            </div>
        </div>
    );
}
