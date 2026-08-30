import type { DragEvent } from 'react';
import { useCallback, useMemo, useRef } from 'react';

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
import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import ScrollingHandlerComp from '../../scrolling/ScrollingHandlerComp';
import {
    bringDomToCenterView,
    changeDragEventStyle,
} from '../../helper/helpers';
import { tran } from '../../lang/langHelpers';
import { readDroppedFiles } from '../../others/droppingFileHelpers';
import { checkIsSupportMediaType } from '../../slide-editor/canvas/canvasHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    APP_DOCUMENT_ITEM_CLASS,
    createNewSlidesFromDroppedData,
} from './appDocumentHelpers';
import appProvider from '../../server/appProvider';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { notifyElementHighlight } from '../../helper/domHelpers';
import {
    genSlidesPreviewerScope,
    SLIDES_PREVIEWER_SCOPE_KEY,
    SlidesPreviewerScopeContext,
    useThumbnailScaleSettingOptions,
} from './slidesPreviewerScopeHelpers';

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
    const containerRef = useRef<HTMLDivElement | null>(null);
    // One per mounted previewer, so everything below can ask for ITS container
    // instead of the first one in the document.
    const scope = useMemo(() => {
        return genSlidesPreviewerScope(containerRef);
    }, []);
    useAppEffect(() => {
        notifyElementHighlight(
            () => {
                // Scoped: `notifyElementHighlight` polls every 100ms up to 30
                // times, so an unscoped query has every mounted previewer
                // hunting for — and scrolling to — the same first match.
                return (
                    containerRef.current?.querySelector(
                        `.${APP_DOCUMENT_ITEM_CLASS}.active`,
                    ) ?? null
                );
            },
            {
                moveToView: bringDomToCenterView,
                type: 'warning',
            },
        );
    }, []);

    const varyAppDocument = useVaryAppDocumentContext();
    const onSlideItemsKeyboardEvent = useSlideItemsControlEventContext();
    const thumbnailScaleSettingOptions = useThumbnailScaleSettingOptions();
    const [thumbSizeScale, setThumbnailSizeScale] =
        useVarySlideThumbnailSizeScale(thumbnailScaleSettingOptions);
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
            {...{ [SLIDES_PREVIEWER_SCOPE_KEY]: scope.scopeId }}
        >
            <SlidesPreviewerScopeContext value={scope}>
                {/* The document's own menu — the one a right-click on the empty
                    area gives. Sticky in a zero-height row so it stays reachable
                    however far the list is scrolled without taking a strip of
                    the previewer away from the slides. */}
                <div
                    style={{
                        position: 'sticky',
                        top: 0,
                        height: 0,
                        zIndex: 3,
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <ContextMenuDotsButtonComp
                        className="me-2"
                        onOpening={handleContextMenu}
                    />
                </div>
                <div>
                    {isDisplayingEditingMenu ? (
                        <div
                            className="w-100 app-outer-shadow"
                            style={{
                                height: 30,
                            }}
                        >
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
                        </div>
                    ) : null}
                    <VarySlidesComp />
                </div>
                <ScrollingHandlerComp />
            </SlidesPreviewerScopeContext>
        </div>
    );
}
