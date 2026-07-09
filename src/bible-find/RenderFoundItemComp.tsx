import { useCallback } from 'react';

import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import { handleDragStart as handleDragStartHelper } from '../helper/dragHelpers';
import { tran } from '../lang/langHelpers';
import { useBibleFindController } from './BibleFindController';
import {
    breakItem,
    openContextMenu,
    openInBibleLookup,
} from './bibleFindHelpers';

export default function RenderFoundItemComp({
    findText,
    text,
    bibleKey,
}: Readonly<{
    findText: string;
    text: string;
    bibleKey: string;
}>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const viewController = useLookupBibleItemControllerContext();
    const bibleFindController = useBibleFindController();
    const [data] = useAppStateAsync(() => {
        return breakItem(bibleFindController.locale, findText, text, bibleKey);
    }, [bibleFindController.locale, findText, text, bibleKey]);
    const dataRef = useAppCurrentRef(data);
    const handleDragStart = useCallback((event: any) => {
        handleDragStartHelper(event, dataRef.current!.bibleItem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const viewControllerRef = useAppCurrentRef(viewController);
    const handleContextMenuOpening = useCallback((event: any) => {
        openContextMenu(event, {
            viewController: viewControllerRef.current,
            bibleItem: dataRef.current!.bibleItem,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClicking = useCallback((event: any) => {
        openInBibleLookup(
            event,
            viewControllerRef.current,
            dataRef.current!.bibleItem,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (data === undefined) {
        return <div>{tran('Loading')}...</div>;
    }
    if (data === null) {
        return <div>{tran('Fail to get data')}</div>;
    }
    const { newItem, bibleItem } = data;
    return (
        <div
            className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
        >
            <BibleDirectViewTitleComp bibleItem={bibleItem} />
            <span
                style={{ fontFamily }}
                dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(newItem),
                }}
            />
        </div>
    );
}
