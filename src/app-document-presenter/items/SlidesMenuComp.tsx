import { useMemo } from 'react';

import { getDefaultScreenDisplay } from '../../_screen/managers/screenHelpers';
import {
    useSlideWrongDimension,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import type { WrongDimensionType } from '../../app-document-list/AppDocument';
import AppDocument from '../../app-document-list/AppDocument';
import { FileEditingMenuComp } from '../../editing-manager/editingHelpers';

function CheckingDimensionComp({
    wrongDimension,
}: Readonly<{
    wrongDimension: WrongDimensionType;
}>) {
    const selectedVaryAppDocument = useVaryAppDocumentContext();
    const screenDisplay = getDefaultScreenDisplay();
    if (!AppDocument.checkIsThisType(selectedVaryAppDocument)) {
        return null;
    }
    return (
        <button
            className="btn btn-sm btn-warning"
            type="button"
            title={
                'Fix slide dimension: ' +
                AppDocument.toWrongDimensionString(wrongDimension)
            }
            onClick={() => {
                selectedVaryAppDocument.fixSlidesDimensionForDisplay(
                    screenDisplay,
                );
            }}
        >
            <i className="bi bi-aspect-ratio" style={{ color: 'red' }} />
            <i className="bi bi-hammer" />
        </button>
    );
}

export default function SlidesMenuComp() {
    const selectedVaryAppDocument = useVaryAppDocumentContext();
    const screenDisplay = useMemo(() => {
        return getDefaultScreenDisplay();
    }, []);
    const wrongDimension = useSlideWrongDimension(
        selectedVaryAppDocument,
        screenDisplay,
    );
    if (!AppDocument.checkIsThisType(selectedVaryAppDocument)) {
        return null;
    }
    return (
        <FileEditingMenuComp
            editableDocument={selectedVaryAppDocument}
            extraChildren={
                wrongDimension !== null ? (
                    <CheckingDimensionComp wrongDimension={wrongDimension} />
                ) : null
            }
        />
    );
}
