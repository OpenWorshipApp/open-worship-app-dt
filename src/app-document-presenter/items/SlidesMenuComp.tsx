import { useCallback, useMemo } from 'react';

import { getPresentingScreenDisplay } from '../../_screen/managers/screenHelpers';
import {
    useSlideWrongDimension,
    useVaryAppDocumentContext,
} from '../../app-document-list/appDocumentHelpers';
import type { WrongDimensionType } from '../../app-document-list/AppDocument';
import type { DisplayType } from '../../_screen/screenTypeHelpers';
import AppDocument from '../../app-document-list/AppDocument';
import { FileEditingMenuComp } from '../../editing-manager/editingHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { tran } from '../../lang/langHelpers';

function CheckingDimensionComp({
    wrongDimension,
    screenDisplay,
}: Readonly<{
    wrongDimension: WrongDimensionType;
    // Passed in rather than read again here: an unmemoised read was a
    // synchronous IPC on every render, and the check and the fix have to
    // agree on WHICH display they are talking about.
    screenDisplay: DisplayType;
}>) {
    const selectedVaryAppDocument = useVaryAppDocumentContext();
    const selectedVaryAppDocumentRef = useAppCurrentRef(
        selectedVaryAppDocument,
    );
    const screenDisplayRef = useAppCurrentRef(screenDisplay);
    const handleFixDimension = useCallback(() => {
        if (!AppDocument.checkIsThisType(selectedVaryAppDocumentRef.current)) {
            return;
        }
        selectedVaryAppDocumentRef.current.fixSlidesDimensionForDisplay(
            screenDisplayRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!AppDocument.checkIsThisType(selectedVaryAppDocument)) {
        return null;
    }
    // Two glyphs and no words, so the title is also the accessible name --
    // without `aria-label` the name is the icon font's own character.
    const label =
        tran('Fix slide dimension') +
        ': ' +
        AppDocument.toWrongDimensionString(wrongDimension);
    return (
        <button
            className="btn btn-sm btn-warning"
            type="button"
            title={label}
            aria-label={label}
            onClick={handleFixDimension}
        >
            <i className="bi bi-aspect-ratio" style={{ color: 'red' }} />
            <i className="bi bi-hammer" />
        </button>
    );
}

export default function SlidesMenuComp() {
    const selectedVaryAppDocument = useVaryAppDocumentContext();
    const screenDisplay = useMemo(() => {
        return getPresentingScreenDisplay();
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
                wrongDimension === null ? null : (
                    <CheckingDimensionComp
                        wrongDimension={wrongDimension}
                        screenDisplay={screenDisplay}
                    />
                )
            }
        />
    );
}
