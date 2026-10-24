import { useCallback, useId } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';
import { useAppStateAsync, useAppCurrentRef } from '../helper/appHooks';
import { handleDragStart as handleDragStartHelper } from '../helper/dragHelpers';
import { tran } from '../lang/langHelpers';
import { useBibleFindController } from './BibleFindController';
import {
    breakItem,
    openContextMenu,
    openFoundBibleItem,
} from './bibleFindHelpers';
import { pressElementLikeButton } from '../helper/helpers';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleStyleHelpers';

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
    const idPrefix = useId();
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
    // A press reads the verse in a floating panel and leaves the passage
    // being read alone; putting it beside that passage is in the row's menu.
    const handleClicking = useCallback(() => {
        openFoundBibleItem(dataRef.current!.bibleItem);
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
            className="w-100 app-find-item app-caught-hover-pointer"
            draggable
            onDragStart={handleDragStart}
            onContextMenu={handleContextMenuOpening}
            onClick={handleClicking}
            title={tran('Click to open the verse')}
            // A div you could only click: no keyboard reached a result.
            role="button"
            tabIndex={0}
            // Its name is its own words -- the reference and the verse --
            // named outright: worked out from the content, it also took in the
            // ⋮ button inside the row ("Genesis 2:7 More Options And ...").
            aria-labelledby={`${idPrefix}-title ${idPrefix}-text`}
            onKeyDown={(event) => {
                // Not a key meant for the ⋮ button inside the row.
                if (event.target === event.currentTarget) {
                    pressElementLikeButton(event);
                }
            }}
        >
            <div className="d-flex align-items-start">
                <div
                    id={`${idPrefix}-title`}
                    className="flex-fill app-overflow-hidden"
                >
                    <BibleDirectViewTitleComp bibleItem={bibleItem} />
                </div>
                <ContextMenuDotsButtonComp
                    onOpening={handleContextMenuOpening}
                />
            </div>
            <span
                id={`${idPrefix}-text`}
                className="app-find-text"
                style={{ fontFamily }}
                dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(newItem),
                }}
            />
        </div>
    );
}
