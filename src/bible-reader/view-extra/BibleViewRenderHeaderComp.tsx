import { use, useCallback } from 'react';

import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import { useBibleItemsViewControllerContext } from '../BibleItemsViewController';
import RenderActionButtonsComp from '../../bible-lookup/RenderActionButtonsComp';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { RenderTitleMaterialComp } from './RenderTitleMaterialComp';
import {
    applyHorizontalWheelScroll,
    BibleViewTitleMaterialContext,
} from './viewExtraHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

export default function BibleViewRenderHeaderComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const viewController = useBibleItemsViewControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const actionElement = use(BibleViewTitleMaterialContext)?.actionElement;
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
        <div className="card-header bible-view-header p-0">
            <RenderTitleMaterialComp
                bibleItem={bibleItem}
                onBibleKeyChange={handleBibleKeyChange}
                actionsElement={
                    // Floats over the passage's end while the header is
                    // hovered, so it takes no room from the passage at rest.
                    <div
                        className="bible-view-header-actions"
                        ref={applyHorizontalWheelScroll}
                    >
                        {actionElement}
                        <RenderActionButtonsComp bibleItem={bibleItem} />
                        <button
                            type="button"
                            className="bible-view-header-close"
                            title={tran('Close')}
                            aria-label={tran('Close')}
                            onClick={handleDelete}
                        >
                            <i className="bi bi-x-lg" />
                        </button>
                    </div>
                }
            />
            <div className="bible-view-header-end">
                {/* The view's own menu. No handler: the bible view around
                    this header owns it. */}
                <ContextMenuDotsButtonComp />
            </div>
        </div>
    );
}
