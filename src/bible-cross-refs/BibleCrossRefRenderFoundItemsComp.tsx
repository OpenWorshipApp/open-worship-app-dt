import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import {
    openContextMenu,
    openInBibleLookup,
} from '../bible-find/bibleFindHelpers';
import { handleDragStart as handleDragStartHelper } from '../helper/dragHelpers';
import type { BibleCrossRefType } from './bibleCrossRefsHelpers';
import { breakItem } from './bibleCrossRefsHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';

export default function BibleCrossRefRenderFoundItemsComp({
    bibleVersesKey,
    itemInfo,
}: Readonly<{
    bibleVersesKey: string;
    itemInfo: BibleCrossRefType;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const fontFamily = useBibleFontFamily(bibleKey);
    const [data] = useAppStateAsync(() => {
        return breakItem(bibleKey, bibleVersesKey);
    }, [bibleKey, bibleVersesKey]);
    const handleDragStart = useCallback(
        (event: any) => {
            handleDragStartHelper(event, data!.bibleItem);
        },
        [data],
    );
    const handleContextMenuOpening = useCallback(
        (event: any) => {
            openContextMenu(event, {
                viewController,
                bibleItem: data!.bibleItem,
            });
        },
        [viewController, data],
    );
    const handleClicking = useCallback(
        (event: any) => {
            openInBibleLookup(event, viewController, data!.bibleItem, true);
        },
        [viewController, data],
    );
    if (data === undefined) {
        return <div>{tran('Loading')}...</div>;
    }
    if (data === null) {
        return (
            <div
                className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
                style={{ color: 'red' }}
            >
                {tran('Fail to get data for')} "{bibleVersesKey}"
            </div>
        );
    }
    const { htmlText, bibleItem, bibleText } = data;
    return (
        <div
            className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
            title={tran('shift + click to append')}
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
        >
            <BibleDirectViewTitleComp bibleItem={bibleItem} />
            {/* TODO: update title */}
            <span className="badge badge-success" title="isS">
                {itemInfo.isS ? 'S ' : ''}
            </span>
            <span className="badge badge-success" title="isFN">
                {itemInfo.isFN ? 'FN ' : ''}
            </span>
            <span className="badge badge-success" title="isStar">
                {itemInfo.isStar ? '★ ' : ''}
            </span>
            <span className="badge badge-success" title="isTitle">
                {itemInfo.isTitle ? 'T ' : ''}
            </span>
            <span className="badge badge-success" title="isLXXDSS">
                {itemInfo.isLXXDSS ? 'LXXDSS ' : ''}
            </span>
            <span
                title={bibleText}
                style={{ fontFamily }}
                dangerouslySetInnerHTML={{
                    __html: htmlText,
                }}
            />
        </div>
    );
}
