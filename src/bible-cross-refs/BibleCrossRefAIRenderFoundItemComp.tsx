import { useCallback } from 'react';

import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { tran } from '../lang/langHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import {
    openContextMenu,
    openInBibleLookup,
} from '../bible-find/bibleFindHelpers';
import { handleDragStart as handleDragStartHelper } from '../helper/dragHelpers';
import { breakItem } from './bibleCrossRefsHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';

function RenderVerseTextComp({
    bibleKey,
    bibleText,
    htmlText,
}: Readonly<{ bibleKey: string; bibleText: string; htmlText: string }>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    return (
        <span
            title={bibleText}
            style={{
                fontFamily,
            }}
            dangerouslySetInnerHTML={{
                __html: sanitizeHtml(htmlText),
            }}
        />
    );
}

export default function BibleCrossRefAIRenderFoundItemComp({
    bibleVersesKey,
}: Readonly<{
    bibleVersesKey: string;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const [data] = useAppStateAsync(() => {
        return breakItem(bibleKey, bibleVersesKey);
    }, [bibleKey, bibleVersesKey]);
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
        return (
            <div
                className={
                    'w-100 app-border-white-round my-1 p-1 ' +
                    'app-caught-hover-pointer'
                }
                style={{ color: 'red' }}
            >
                {tran('Fail to get data for')} "{bibleVersesKey}"
            </div>
        );
    }
    const { htmlText, bibleItem, bibleText } = data;
    return (
        <div
            className={
                'w-100 app-border-white-round my-1 p-1 ' +
                'app-caught-hover-pointer'
            }
            title={tran('shift + click to append')}
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
        >
            <BibleDirectViewTitleComp bibleItem={bibleItem} />
            <RenderVerseTextComp
                bibleKey={bibleItem.bibleKey}
                bibleText={bibleText}
                htmlText={htmlText}
            />
        </div>
    );
}
