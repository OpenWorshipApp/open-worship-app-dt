import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { useCallback } from 'react';

import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { tran } from '../lang/langHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import {
    openContextMenu,
    openFoundBibleItem,
} from '../bible-find/bibleFindHelpers';
import { handleDragStart as handleDragStartHelper } from '../helper/dragHelpers';
import { breakItem } from './bibleCrossRefsHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

function RenderVerseTextComp({
    bibleKey,
    bibleText,
    htmlText,
}: Readonly<{ bibleKey: string; bibleText: string; htmlText: string }>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    return (
        <span
            className="app-xref-text"
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
    // A press reads the verse in a floating panel and leaves the passage
    // being read alone; putting it beside that passage is in the row's menu.
    const handleClicking = useCallback(() => {
        openFoundBibleItem(dataRef.current!.bibleItem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The row is the target, so it has to take focus too -- the reference is
    // the fast path to a passage and the keyboard is the fast path during a
    // service.
    const handleKeyingDown = useCallback((event: any) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        openFoundBibleItem(dataRef.current!.bibleItem);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (data === undefined) {
        return <div className="app-xref-status">{tran('Loading')}...</div>;
    }
    // A reference that names no passage (see `breakItem`) gets no row. A
    // volunteer can do nothing with "Fail to get data for `PSA 119:ющ`" but
    // read past it, and a row there invites a press that leads nowhere.
    if (data === null) {
        return null;
    }
    const { htmlText, bibleItem, bibleText } = data;
    return (
        <div
            className="app-xref-item app-caught-hover-pointer"
            role="button"
            tabIndex={0}
            // What a click actually does: the verse opens in a floating panel.
            title={tran('Click to open the verse')}
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
            onKeyDown={handleKeyingDown}
        >
            <div className="d-flex align-items-start">
                <div className="flex-fill app-overflow-hidden">
                    <BibleDirectViewTitleComp bibleItem={bibleItem} />
                </div>
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
            <RenderVerseTextComp
                bibleKey={bibleItem.bibleKey}
                bibleText={bibleText}
                htmlText={htmlText}
            />
        </div>
    );
}
