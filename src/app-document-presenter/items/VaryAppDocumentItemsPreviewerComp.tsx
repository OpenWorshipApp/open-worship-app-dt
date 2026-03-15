import type { DragEvent } from 'react';
import { useCallback } from 'react';

import { useAppDocumentItemThumbnailSizeScale } from '../../event/VaryAppDocumentEventListener';
import AppDocumentItemsComp from './AppDocumentItemsComp';
import AppDocument from '../../app-document-list/AppDocument';
import { handleCtrlWheel } from '../../others/AppRangeComp';
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

async function handleDataDropping(appDocument: AppDocument, event: DragEvent) {
    changeDragEventStyle(event, 'opacity', '1');
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

export default function VaryAppDocumentItemsPreviewerComp() {
    const varyAppDocument = useVaryAppDocumentContext();
    const onSlideItemsKeyboardEvent = useSlideItemsControlEventContext();
    const [thumbSizeScale, setThumbnailSizeScale] =
        useAppDocumentItemThumbnailSizeScale();
    const isDisplayingEditingMenu =
        appProvider.isPagePresenter && varyAppDocument.isEditable;
    const handleContainerBlur = useCallback(
        (event: any) => {
            onSlideItemsKeyboardEvent(event);
        },
        [onSlideItemsKeyboardEvent],
    );
    const handleContainerKeyDown = useCallback(
        (event: any) => {
            if (document.activeElement !== event.currentTarget) {
                return;
            }
            onSlideItemsKeyboardEvent(event);
        },
        [onSlideItemsKeyboardEvent],
    );
    const handleContainerWheel = useCallback(
        (event: any) => {
            handleCtrlWheel({
                event,
                value: thumbSizeScale,
                setValue: setThumbnailSizeScale,
                defaultSize: defaultRangeSize,
            });
        },
        [thumbSizeScale, setThumbnailSizeScale],
    );
    const handleContextMenu = useCallback(
        (event: any) => {
            varyAppDocument.showContextMenu(event);
        },
        [varyAppDocument],
    );
    const handleDragOver = useCallback((event: any) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '0.5');
    }, []);
    const handleDragLeave = useCallback((event: any) => {
        event.preventDefault();
        changeDragEventStyle(event, 'opacity', '1');
    }, []);
    const handleContainerDrop = useCallback(
        (event: DragEvent) => {
            event.preventDefault();
            if (varyAppDocument instanceof AppDocument === false) {
                return;
            }
            handleDataDropping(varyAppDocument, event);
        },
        [varyAppDocument],
    );
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
            onWheel={handleContainerWheel}
            onContextMenu={handleContextMenu}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleContainerDrop}
        >
            <div
                style={{
                    marginTop: isDisplayingEditingMenu ? '30px' : undefined,
                }}
            >
                <AppDocumentItemsComp />
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
