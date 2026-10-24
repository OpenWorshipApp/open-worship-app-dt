import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { handleError } from '../helper/errorHelpers';
import { RECEIVING_DROP_CLASSNAME } from '../helper/helpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import { useAppCurrentRef } from '../helper/appHooks';
import { extractDragData } from '../helper/dragHelpers';
import { DragTypeEnum } from '../helper/DragInf';

export default function NoBibleViewAvailableComp() {
    const viewController = useBibleItemsViewControllerContext();
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.add(RECEIVING_DROP_CLASSNAME);
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
    }, []);
    const viewControllerRef = useAppCurrentRef(viewController);
    const handleDrop = useCallback((event: any) => {
        event.currentTarget.classList.remove(RECEIVING_DROP_CLASSNAME);
        // Dragged text, a file or a run-sheet row is not a passage, and not
        // an error either: only a passage (or a view's title) opens a view.
        const dragData = extractDragData(event);
        if (
            dragData === null ||
            ![
                DragTypeEnum.BIBLE_ITEM,
                DragTypeEnum.BIBLE_ITEM_TARGET_ONLY,
            ].includes(dragData.type)
        ) {
            return;
        }
        try {
            const bibleItem = ReadIdOnlyBibleItem.fromJson(dragData.data);
            viewControllerRef.current.addBibleItem(
                null,
                bibleItem,
                false,
                false,
                false,
            );
        } catch (error) {
            handleError(error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className={
                'bible-view card flex-fill d-flex align-items-center ' +
                'justify-content-center'
            }
            style={{ minWidth: '30%' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <h3>{tran('No Bible Available')}</h3>
        </div>
    );
}
