import './SlidePreviewer.scss';

import { use } from 'react';

import VaryAppDocumentItemsPreviewerComp from './VaryAppDocumentItemsPreviewerComp';
import AppDocumentPreviewerFooterComp from './AppDocumentPreviewerFooterComp';
import {
    SelectedVaryAppDocumentContext,
    VaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import PdfAppearanceSettingComp from '../../screen-setting/PdfAppearanceSettingComp';
import PdfAppDocument from '../../app-document-list/PdfAppDocument';

export default function AppDocumentPreviewerComp() {
    const selectedAppDocumentContext = use(SelectedVaryAppDocumentContext);
    if (!selectedAppDocumentContext?.selectedVaryAppDocument) {
        return (
            <div className="w-100 h-100 d-flex justify-content-center align-items-center">
                <h3 className="text-muted">`No App Document Selected</h3>
            </div>
        );
    }
    const isPDF =
        selectedAppDocumentContext.selectedVaryAppDocument instanceof
        PdfAppDocument;
    return (
        <div className="slide-previewer card w-100 h-100">
            <VaryAppDocumentContext
                value={selectedAppDocumentContext.selectedVaryAppDocument}
            >
                <div className="card-body w-100 h-100 app-overflow-hidden">
                    <VaryAppDocumentItemsPreviewerComp />
                </div>
                <AppDocumentPreviewerFooterComp />
                {isPDF ? <PdfAppearanceSettingComp /> : null}
            </VaryAppDocumentContext>
        </div>
    );
}
