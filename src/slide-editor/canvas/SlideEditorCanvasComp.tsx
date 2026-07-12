import './SlideEditorCanvasComp.scss';

import { useCallback, useRef } from 'react';

import { defaultRangeSize } from './CanvasController';
import { useSlideCanvasScale } from './canvasEventHelpers';
import SlideEditorCanvasScalingComp from './tools/SlideEditorCanvasScalingComp';
import { useZoomingRegistering } from '../../others/AppRangeComp';
import { onCanvasKeyboardEvent } from '../slideEditingKeyboardEventHelpers';
import { MultiContextRender } from '../../helper/MultiContextRender';
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';
import { type useEditingCanvasContextValue } from '../canvasEditingHelpers';
import SlidesMenuComp from '../../app-document-presenter/items/SlidesMenuComp';
import { VaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import CanvasNoteContainerHandlerComp from '../note/CanvasNoteContainerHandlerComp';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import CanvasContainerComp from './canvas-container/CanvasContainerComp';

function EditorComp({
    contextData,
}: Readonly<{
    contextData: ReturnType<typeof useEditingCanvasContextValue>;
}>) {
    const { canvasController } = contextData;
    const { appDocument, canvas } = canvasController;
    const fileSource = appDocument.fileSource;
    const { slide } = canvas;
    return (
        <ResizeActorComp
            flexSizeName={fileSource.fullName}
            isHorizontal={false}
            flexSizeDefault={{
                v1: ['6'],
                v2: ['1'],
            }}
            dataInput={[
                {
                    children: {
                        render: () => {
                            return (
                                <CanvasContainerComp
                                    contextData={contextData}
                                />
                            );
                        },
                    },
                    key: 'v1',
                    widgetName: 'Document List',
                    className: 'app-flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <CanvasNoteContainerHandlerComp
                                    appDocument={appDocument}
                                    slide={slide}
                                />
                            );
                        },
                    },
                    key: 'v2',
                    widgetName: 'Note',
                    className: 'app-flex-item',
                },
            ]}
        />
    );
}

export default function SlideEditorCanvasComp({
    contextData,
}: Readonly<{ contextData: ReturnType<typeof useEditingCanvasContextValue> }>) {
    const {
        contextValue: allCanvasContextValue,
        selectedCanvasItems,
        setSelectedCanvasItems,
        canvasController,
        stopAllModes,
    } = contextData;

    const stopAllModesRef = useAppCurrentRef(stopAllModes);
    const canvasControllerRef = useAppCurrentRef(canvasController);
    const selectedCanvasItemsRef = useAppCurrentRef(selectedCanvasItems);
    const setSelectedCanvasItemsRef = useAppCurrentRef(setSelectedCanvasItems);
    const handleKeyDownEvent = useCallback((event: any) => {
        if (document.activeElement !== event.currentTarget) {
            return;
        }
        onCanvasKeyboardEvent(
            {
                stopAllModes: stopAllModesRef.current,
                canvasController: canvasControllerRef.current,
                selectedCanvasItems: selectedCanvasItemsRef.current,
                setSelectedCanvasItems: setSelectedCanvasItemsRef.current,
            },
            event,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // `useZoomingRegistering` snapshots `value` into a ref that is only
    // refreshed when this component re-renders. Reading
    // `canvasController.scale` directly here would never re-render on its
    // own scale changes (only the sibling `SlideEditorCanvasScalingComp`
    // subscribes to those), so every Ctrl+Scroll after the first would
    // recompute from a stale base value and appear to do nothing.
    const scale = useSlideCanvasScale(canvasController);
    const containerRef = useRef<HTMLDivElement | null>(null);
    useZoomingRegistering(containerRef, {
        value: scale * 10,
        setValue: (newScale) => {
            canvasController.scale = newScale / 10;
        },
        defaultSize: defaultRangeSize,
    });

    useAppEffect(() => {
        canvasController.focusEditor = () => {
            containerRef.current?.focus();
        };
        return () => {
            canvasController.focusEditor = () => {};
        };
    }, [canvasController]);

    return (
        <div className="card w-100 h-100 app-overflow-hidden">
            <div
                className={
                    'card-body w-100 m-0 p-0 editor-container app-focusable ' +
                    'app-overflow-hidden'
                }
                tabIndex={0}
                onKeyDown={handleKeyDownEvent}
                ref={containerRef}
            >
                <EditorComp contextData={contextData} />
            </div>
            <div className="card-footer w-100 m-0 p-0">
                <div className="slide-editor-canvas-footer w-100 d-flex">
                    <VaryAppDocumentContext
                        value={canvasController.appDocument}
                    >
                        <SlidesMenuComp />
                    </VaryAppDocumentContext>
                    <MultiContextRender contexts={allCanvasContextValue}>
                        <SlideEditorCanvasScalingComp />
                    </MultiContextRender>
                </div>
            </div>
        </div>
    );
}
