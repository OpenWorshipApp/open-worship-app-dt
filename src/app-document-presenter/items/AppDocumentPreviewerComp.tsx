import './SlidePreviewer.scss';

import { use } from 'react';

import VaryAppDocumentItemsPreviewerComp from './VaryAppDocumentItemsPreviewerComp';
import AppDocumentPreviewerFooterComp from './AppDocumentPreviewerFooterComp';
import {
    SelectedVaryAppDocumentContext,
    VaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';

export default function AppDocumentPreviewerComp() {
    const selectedAppDocumentContext = use(SelectedVaryAppDocumentContext);
    if (!selectedAppDocumentContext?.selectedVaryAppDocument) {
        return (
            <div className="w-100 h-100 d-flex justify-content-center align-items-center">
                <h3 className="text-muted">`No App Document Selected</h3>
            </div>
        );
    }
    return (
        <div className="slide-previewer card w-100 h-100">
            <VaryAppDocumentContext
                value={selectedAppDocumentContext.selectedVaryAppDocument}
            >
                <div className="card-body w-100 h-100 app-overflow-hidden">
                    <VaryAppDocumentItemsPreviewerComp />
                </div>
                <AppDocumentPreviewerFooterComp />
            </VaryAppDocumentContext>
        </div>
    );
}
