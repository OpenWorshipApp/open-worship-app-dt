import RenderEditingActionButtonsComp from './RenderEditingActionButtonsComp';
import { RenderTitleMaterialComp } from '../bible-reader/BibleViewExtra';
import {
    fontSizeToHeightStyle,
    useBibleViewFontSizeContext,
} from '../helper/bibleViewHelpers';
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
    const fontSize = useBibleViewFontSizeContext();
    const viewController = useLookupBibleItemControllerContext();
    const editingResult = use(EditingResultContext);
    const foundBibleItem = editingResult?.result.bibleItem ?? null;
    return (
        <div
            className={
                'card-header bg-transparent border-success ' +
                'app-top-hover-motion-1'
            }
            style={fontSizeToHeightStyle(fontSize)}
        >
            <div className="d-flex w-100 h-100">
                <RenderTitleMaterialComp
                    bibleItem={viewController.selectedBibleItem}
                    onBibleKeyChange={(_oldBibleKey, newBibleKey) => {
                        viewController.applyTargetOrBibleKey(
                            viewController.selectedBibleItem,
                            { bibleKey: newBibleKey },
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
