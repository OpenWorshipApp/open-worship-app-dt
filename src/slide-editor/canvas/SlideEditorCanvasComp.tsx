import { useCallback } from 'react';

import { defaultRangeSize } from './CanvasController';
import SlideEditorCanvasScalingComp from './tools/SlideEditorCanvasScalingComp';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { onCanvasKeyboardEvent } from '../slideEditingKeyboardEventHelpers';
import { MultiContextRender } from '../../helper/MultiContextRender';
import { type useEditingCanvasContextValue } from '../canvasEditingHelpers';
import SlidesMenuComp from '../../app-document-presenter/items/SlidesMenuComp';
import { VaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import CanvasNoteContainerHandlerComp from '../note/CanvasNoteContainerHandlerComp';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import CanvasContainerComp from './CanvasContainerComp';

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

    const handleScrollEvent = useCallback(
        (event: any) => {
            event.stopPropagation();
            handleCtrlWheel({
                event,
                value: canvasController.scale * 10,
                setValue: (scale) => {
                    canvasController.scale = scale / 10;
                },
                defaultSize: defaultRangeSize,
            });
        },
        [canvasController],
    );
    const handleKeyDownEvent = useCallback(
        (event: any) => {
            if (document.activeElement !== event.currentTarget) {
                return;
            }
            onCanvasKeyboardEvent(
                {
                    stopAllModes,
                    canvasController,
                    selectedCanvasItems,
                    setSelectedCanvasItems,
                },
                event,
            );
        },
        [
            stopAllModes,
            canvasController,
            selectedCanvasItems,
            setSelectedCanvasItems,
        ],
    );
    return (
        <div className="card w-100 h-100 app-overflow-hidden">
            <div
                className={
                    'card-body w-100 m-0 p-0 editor-container app-focusable ' +
                    'app-overflow-hidden'
                }
                tabIndex={0}
                onWheel={handleScrollEvent}
                onKeyDown={handleKeyDownEvent}
            >
                <EditorComp contextData={contextData} />
            </div>
            <div className="card-footer w-100 m-0 p-0">
                <div className="w-100 d-flex">
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
