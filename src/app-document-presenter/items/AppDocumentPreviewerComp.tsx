import './SlidePreviewer.scss';

import { use } from 'react';

import { tran } from '../../lang/langHelpers';
import VaryAppDocumentItemsPreviewerComp from './VaryAppDocumentItemsPreviewerComp';
import AppDocumentPreviewerFooterComp from './AppDocumentPreviewerFooterComp';
import {
    SelectedVaryAppDocumentContext,
    useVaryAppDocumentContext,
    VaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import PdfAppearanceSettingComp from '../../screen-setting/PdfAppearanceSettingComp';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';
import ResizeActorComp from '../../resize-actor/ResizeActorComp';
import appProvider from '../../server/appProvider';
import PresenterNoteContainerHandlerComp from '../../slide-editor/note/PresenterNoteContainerHandlerComp';

function EditorComp() {
    const varyAppDocument = useVaryAppDocumentContext();
    const fileSource = varyAppDocument.fileSource;
    if (PdfAppDocument.checkIsThisType(varyAppDocument)) {
        return <VaryAppDocumentItemsPreviewerComp />;
    }
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
                            return <VaryAppDocumentItemsPreviewerComp />;
                        },
                    },
                    key: 'v1',
                    widgetName: 'Document List',
                    className: 'flex-item',
                },
                {
                    children: {
                        render: () => {
                            return (
                                <PresenterNoteContainerHandlerComp
                                    appDocument={varyAppDocument}
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

export default function AppDocumentPreviewerComp() {
    const selectedAppDocumentContext = use(SelectedVaryAppDocumentContext);
    if (!selectedAppDocumentContext?.selectedVaryAppDocument) {
        return (
            <div className="w-100 h-100 d-flex justify-content-center align-items-center">
                <h3 className="text-muted">
                    {tran('No App Document Selected')}
                </h3>
            </div>
        );
    }
    const isPDF =
        selectedAppDocumentContext.selectedVaryAppDocument instanceof
        PdfAppDocument;
    return (
        <div
            className="slide-previewer card w-100 h-100 app-zero-border-radius"
            style={{
                position: 'relative',
            }}
        >
            <VaryAppDocumentContext
                value={selectedAppDocumentContext.selectedVaryAppDocument}
            >
                <div
                    className="card-body w-100 h-100 app-overflow-hidden"
                    style={{
                        position: 'relative',
                    }}
                >
                    {appProvider.isPagePresenter ? (
                        <EditorComp />
                    ) : (
                        <VaryAppDocumentItemsPreviewerComp />
                    )}
                </div>
                <AppDocumentPreviewerFooterComp />
                {isPDF ? <PdfAppearanceSettingComp /> : null}
            </VaryAppDocumentContext>
        </div>
    );
}
