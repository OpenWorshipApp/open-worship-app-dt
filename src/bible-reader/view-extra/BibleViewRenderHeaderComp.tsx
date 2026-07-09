import { useCallback } from 'react';

import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import RenderActionButtonsComp from '../../bible-lookup/RenderActionButtonsComp';
import { HoverMotionHandler } from '../../helper/domHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function BibleViewRenderHeaderComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleBibleKeyChange = useCallback(
        (isContextMenu: boolean, _oldBibleKey: string, newBibleKey: string) => {
            viewControllerRef.current.applyTargetOrBibleKey(
                bibleItemRef.current,
                isContextMenu
                    ? {
                          extraBibleKeys: [
                              ...bibleItemRef.current.extraBibleKeys,
                              newBibleKey,
                          ],
                      }
                    : {
                          bibleKey: newBibleKey,
                      },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleDelete = useCallback(() => {
        viewControllerRef.current.deleteBibleItem(bibleItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className="card-header d-flex app-top-hover-motion-1 p-0"
            style={{ height: 'unset' }}
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
