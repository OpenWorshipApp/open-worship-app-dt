import { useState } from 'react';

import { defaultRangeSize } from './CanvasController';
import SlideEditorCanvasScalingComp from './tools/SlideEditorCanvasScalingComp';
import { handleCtrlWheel } from '../../others/AppRangeComp';
import { onCanvasKeyboardEvent } from '../slideEditingKeyboardEventHelpers';
import { MultiContextRender } from '../../helper/MultiContextRender';
import { useEditingCanvasContextValue } from '../canvasEditingHelpers';
import SlidesMenuComp from '../../app-document-presenter/items/SlidesMenuComp';
import { VaryAppDocumentContext } from '../../app-document-list/appDocumentHelpers';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import CanvasContainerComp from './CanvasContainerComp';
import Slide from '../../app-document-list/Slide';
import { tran } from '../../lang/langHelpers';
import AppDocument from '../../app-document-list/AppDocument';
import DocumentNoteEditorComp, {
    DocumentNoteStoreType,
} from './DocumentNoteEditorComp';
import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import appProvider from '../../server/appProvider';

function EditorRenderComp({
    store,
    title,
}: Readonly<{ store: DocumentNoteStoreType; title: string }>) {
    return (
        <div className="w-100 h-100 app-overflow-hidden">
            <div
                className="w-100 px-1 py-0 m-0 muted app-ellipsis"
                style={{
                    textAlign: 'center',
                    fontSize: '0.5rem',
                }}
            >
                {title}
            </div>
            <DocumentNoteEditorComp
                store={store}
                placeholder={tran('Enter your note here') + '...'}
            />
        </div>
    );
}

class SlideNoteStore implements DocumentNoteStoreType {
    readonly defaultText: string;
    currentText: string;
    save: () => Promise<void>;
    constructor(appDocument: AppDocument, slide: Slide) {
        this.defaultText = slide.note;
        this.currentText = slide.note;
        this.save = async () => {
            if (this.currentText === this.defaultText) {
                return;
            }
            slide.note = this.currentText;
            return appDocument.updateSlide(slide);
        };
    }
}

function SlideEditorComp({
    appDocument,
    slide,
}: Readonly<{ appDocument: AppDocument; slide: Slide }>) {
    const [store, setStore] = useState<DocumentNoteStoreType>(
        new SlideNoteStore(appDocument, slide),
    );
    useAppEffect(() => {
        setStore(new SlideNoteStore(appDocument, slide));
    }, [appDocument, slide]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);
    return <EditorRenderComp store={store} title="Slide Note" />;
}

class AppDocumentNoteStore implements DocumentNoteStoreType {
    readonly defaultText: string;
    currentText: string;
    save: () => Promise<void>;
    appDocument: AppDocument;
    constructor(appDocument: AppDocument, note: string) {
        this.defaultText = note;
        this.currentText = note;
        this.save = async () => {};
        this.appDocument = appDocument;
    }
}

function AppDocumentEditorComp({
    appDocument,
}: Readonly<{ appDocument: AppDocument }>) {
    const [store, setStore] = useState<DocumentNoteStoreType>(
        new AppDocumentNoteStore(appDocument, ''),
    );
    useAppEffectAsync(async () => {
        const note = await appDocument.getNote();
        const newStore = new AppDocumentNoteStore(appDocument, note);
        newStore.save = async () => {
            if (newStore.currentText === newStore.defaultText) {
                return;
            }
            await appDocument.setNote(newStore.currentText);
        };
        setStore(newStore);
    }, [appDocument]);
    useAppEffect(() => {
        return () => {
            store.save();
        };
    }, [store]);
    return <EditorRenderComp store={store} title="Document Note" />;
}

function EditorComp({
    appDocument,
    slide,
}: Readonly<{ appDocument: AppDocument; slide: Slide }>) {
    const fileFullName = appDocument.fileSource.fullName;
    return (
        <ResizeActorComp
            flexSizeName={fileFullName}
            isHorizontal
            flexSizeDefault={{
                h1: ['1'],
                h2: ['1'],
            }}
            dataInput={[
                {
                    children: {
                        render: () => {
                            return (
                                <AppDocumentEditorComp
                                    appDocument={appDocument}
                                />
                            );
                        },
                    },
                    key: 'h1',
                    widgetName: slide.name ?? slide.id.toString(),
                    className: 'flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <SlideEditorComp
                                    appDocument={appDocument}
                                    slide={slide}
                                />
                            );
                        },
                    },
                    key: 'h2',
                    widgetName: fileFullName,
                    className: 'flex-item',
                },
            ]}
        />
    );
}

function NoteHandlerComp({
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
                    className: 'flex-item',
                },
                {
                    children: {
                        render: () => {
                            if (appProvider.isPagePresenter) {
                                return (
                                    <SlideEditorComp
                                        appDocument={appDocument}
                                        slide={slide}
                                    />
                                );
                            }
                            return (
                                <EditorComp
                                    appDocument={appDocument}
                                    slide={slide}
                                />
                            );
                        },
                    },
                    key: 'v2',
                    widgetName: 'Note',
                    className: 'flex-item',
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

    const handleScrollEvent = (event: any) => {
        event.stopPropagation();
        handleCtrlWheel({
            event,
            value: canvasController.scale * 10,
            setValue: (scale) => {
                canvasController.scale = scale / 10;
            },
            defaultSize: defaultRangeSize,
        });
    };
    const handleKeyDownEvent = (event: any) => {
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
    };
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
                <NoteHandlerComp contextData={contextData} />
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
