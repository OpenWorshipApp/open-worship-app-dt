import type { DragEvent } from 'react';
import { useCallback, useRef } from 'react';

import { useVarySlideThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import VarySlidesComp from './VarySlidesComp';
import AppDocument from '../../app-document-list/AppDocument';
import { useZoomingRegistering } from '../../others/AppRangeComp';
import { defaultRangeSize } from './AppDocumentPreviewerFooterComp';
import SlidesMenuComp from './SlidesMenuComp';
import { SLIDE_ITEMS_CONTAINER_CLASS_NAME } from './varyAppDocumentHelpers';
import {
    useSlideItemsControlEventContext,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import ScrollingHandlerComp from '../../scrolling/ScrollingHandlerComp';
import { changeDragEventStyle } from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from '../../slide-editor/canvas/canvasHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { createNewSlidesFromDroppedData } from './appDocumentHelpers';
import appProvider from '../../server/appProvider';
import { useAppCurrentRef } from '../../helper/appHooks';

async function handleDataDropping(appDocument: AppDocument, event: DragEvent) {
    const files: File[] = [];
    for await (const file of readDroppedFiles(event)) {
        if (checkIsSupportMediaType(file.type)) {
            files.push(file);
        } else {
            showSimpleToast(
                tran('Insert Image or Video'),
                tran('Unsupported file type!'),
            );
        }
    }
    await createNewSlidesFromDroppedData(appDocument, files);
}

export default function VarySlidesPreviewerComp() {
    const varyAppDocument = useVaryAppDocumentContext();
    const onSlideItemsKeyboardEvent = useSlideItemsControlEventContext();
    const [thumbSizeScale, setThumbnailSizeScale] =
        useVarySlideThumbnailSizeScale();
    const isDisplayingEditingMenu =
        appProvider.isPagePresenter && varyAppDocument.isEditable;
    const onSlideItemsKeyboardEventRef = useAppCurrentRef(
        onSlideItemsKeyboardEvent,
    );
    const handleContainerBlur = useCallback((event: any) => {
        onSlideItemsKeyboardEventRef.current(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContainerKeyDown = useCallback((event: any) => {
        if (document.activeElement !== event.currentTarget) {
            return;
        }
        onSlideItemsKeyboardEventRef.current(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const varyAppDocumentRef = useAppCurrentRef(varyAppDocument);
    const handleContextMenu = useCallback((event: any) => {
        varyAppDocumentRef.current.showContextMenu(event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '0.5');
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
    }, []);
    const handleContainerDrop = useCallback((event: DragEvent) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
        if (varyAppDocumentRef.current instanceof AppDocument === false) {
            return;
        }
        handleDataDropping(varyAppDocumentRef.current, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const containerRef = useRef<HTMLDivElement | null>(null);
    useZoomingRegistering(containerRef, {
        value: thumbSizeScale,
        setValue: setThumbnailSizeScale,
        defaultSize: defaultRangeSize,
    });

    return (
        <div
            className={
                `${SLIDE_ITEMS_CONTAINER_CLASS_NAME}` +
                ' app-focusable w-100 h-100 pb-2'
            }
            tabIndex={0}
            onBlur={handleContainerBlur}
            onKeyDown={handleContainerKeyDown}
            // keep vertical to avoid conflict with item resizing effect scroll bar
            style={{ overflowX: 'hidden', overflowY: 'scroll' }}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleContainerDrop}
            ref={containerRef}
        >
            <div
                style={{
                    marginTop: isDisplayingEditingMenu ? '30px' : undefined,
                }}
            >
                <VarySlidesComp />
            </div>
            <ScrollingHandlerComp />
            {isDisplayingEditingMenu ? (
                <div
                    className="w-100 app-outer-shadow"
                    style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                >
                    <SlidesMenuComp />
                </div>
            ) : null}
        </div>
    );
}
