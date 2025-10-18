import RenderEditingActionButtonsComp from './RenderEditingActionButtonsComp';
import { RenderTitleMaterialComp } from '../bible-reader/BibleViewExtra';
import { closeCurrentEditingBibleItem } from '../bible-reader/readBibleHelpers';
import { toShortcutKey } from '../event/KeyboardEventListener';
import {
    closeEventMapper,
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { use } from 'react';
import { HoverMotionHandler } from '../helper/domHelpers';

export default function RenderBibleEditingHeader() {
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    return (
        <div
            className={
                'bg-transparent app-top-hover-motion-1 app-border-bottom-white-round'
            }
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
                        className={`${HoverMotionHandler.lowClassname}-1`}
                        data-min-parent-width="550"
                    >
                        <RenderEditingActionButtonsComp
                            bibleItem={foundBibleItem}
                        />
                    </div>
                )}
                <div
                    className={`${HoverMotionHandler.lowClassname}-0`}
                    data-min-parent-width="550"
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
