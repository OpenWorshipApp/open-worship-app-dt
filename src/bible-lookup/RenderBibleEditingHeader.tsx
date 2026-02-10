import { use } from 'react';

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

export default function RenderBibleEditingHeader() {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
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
                    onBibleKeyChange={(
                        isContextMenu,
                        _oldBibleKey,
                        newBibleKey,
                    ) => {
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
                    }}
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
                            title={`Close [${toShortcutKey(closeEventMapper)}]`}
                            style={{
                                color: 'var(--bs-danger-text-emphasis)',
                            }}
                            onClick={() => {
                                closeCurrentEditingBibleItem(viewController);
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
