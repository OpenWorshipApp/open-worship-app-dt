import { useCallback } from 'react';

import {
    fontSizeToHeightStyle,
    useBibleViewFontSizeContext,
} from '../../helper/bibleViewHelpers';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import RenderActionButtonsComp from '../../bible-lookup/RenderActionButtonsComp';
import { HoverMotionHandler } from '../../helper/domHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';

export default function BibleViewRenderHeaderComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const fontSize = useBibleViewFontSizeContext();
    const handleBibleKeyChange = useCallback(
        (isContextMenu: boolean, _oldBibleKey: string, newBibleKey: string) => {
            viewController.applyTargetOrBibleKey(
                bibleItem,
                isContextMenu
                    ? {
                          extraBibleKeys: [
                              ...bibleItem.extraBibleKeys,
                              newBibleKey,
                          ],
                      }
                    : {
                          bibleKey: newBibleKey,
                      },
            );
        },
        [viewController, bibleItem],
    );
    const handleDelete = useCallback(() => {
        viewController.deleteBibleItem(bibleItem);
    }, [viewController, bibleItem]);
    return (
        <div
            className="card-header d-flex app-top-hover-motion-1 p-0"
            style={{ ...fontSizeToHeightStyle(fontSize) }}
        >
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={handleBibleKeyChange}
            />
            <div
                className={`${HoverMotionHandler.lowVisibleClassname}-0 app-opacity-hover`}
                data-opacity-hover="0.1"
            >
                <RenderActionButtonsComp bibleItem={bibleItem} />
            </div>
            <div
                className={`${HoverMotionHandler.lowDisplayClassname}-0 app-opacity-hover`}
                data-min-parent-width="550"
                data-opacity-hover="0.2"
            >
                <i
                    className="bi bi-x-lg app-caught-hover-pointer"
                    style={{
                        color: 'var(--bs-danger-text-emphasis)',
                    }}
                    onClick={handleDelete}
                />
            </div>
        </div>
    );
}
