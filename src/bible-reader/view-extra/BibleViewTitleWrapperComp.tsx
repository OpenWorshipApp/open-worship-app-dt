import {
    useCallback,
    type DragEvent as ReactDragEvent,
    type ReactNode,
} from 'react';

import { useBibleViewFontSizeContext } from '../../helper/bibleViewHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import { DragTypeEnum } from '../../helper/DragInf';
import { useAppCurrentRef } from '../../helper/appHooks';
import { handleDragStart } from '../../helper/dragHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';

function toggleParentReceiveDrop(element: HTMLElement, isDraggable: boolean) {
    if (element.classList.contains('bible-view')) {
        element.setAttribute('data-do-not-allow-drop', isDraggable ? '0' : '1');
        return;
    }
    if (element.parentElement) {
        toggleParentReceiveDrop(element.parentElement, isDraggable);
    }
}

export default function BibleViewTitleWrapperComp({
    children,
    bibleKey,
    bibleItem,
}: Readonly<{
    children: ReactNode;
    bibleKey: string;
    bibleItem?: ReadIdOnlyBibleItem;
}>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const fontSize = useBibleViewFontSizeContext();
    const bibleItemRef = useAppCurrentRef(bibleItem);
    const handleDraggingStart = useCallback(
        (event: ReactDragEvent<HTMLSpanElement>) => {
            if (bibleItemRef.current === undefined) {
                return;
            }
            toggleParentReceiveDrop(event.currentTarget, false);
            // Through the shared helper like every other drag in the app, so
            // it carries its kind's mime type beside the payload -- the one
            // thing a drop target can read while the drag is still hovering.
            handleDragStart(
                event,
                bibleItemRef.current,
                DragTypeEnum.BIBLE_ITEM_TARGET_ONLY,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleDraggingEnd = (event: ReactDragEvent<HTMLSpanElement>) => {
        toggleParentReceiveDrop(event.currentTarget, true);
    };
    return (
        <span
            className="title full-view-reset-font-size"
            style={{ fontSize, fontFamily, paddingLeft: '5px' }}
            draggable={bibleItem !== undefined}
            onDragStart={handleDraggingStart}
            onDragEnd={handleDraggingEnd}
        >
            {children}
        </span>
    );
}
