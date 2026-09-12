import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
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
    const handleClicking = useCallback((event: any) => {
        openInBibleLookup(
            event,
            viewControllerRef.current,
            dataRef.current!.bibleItem,
            true,
        );
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
        openInBibleLookup(
            event,
            viewControllerRef.current,
            dataRef.current!.bibleItem,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (data === undefined) {
        return <div className="app-xref-status">{tran('Loading')}...</div>;
    }
    if (data === null) {
        return (
            <div className="app-xref-status is-error">
                {tran('Fail to get data for')} "{bibleVersesKey}"
            </div>
        );
    }
    const { htmlText, bibleItem, bibleText } = data;
    return (
        <div
            className="app-xref-item app-caught-hover-pointer"
            role="button"
            tabIndex={0}
            // What a click actually does. The old "shift + click to append"
            // described a modifier this row has never read: it appends either
            // way.
            title={tran('Open beside the current verse')}
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
