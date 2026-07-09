import './editingHelpers.scss';

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import EditingHistoryManager from './EditingHistoryManager';
import type AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { EventMapperType as KeyboardEventMapper } from '../event/KeyboardEventListener';
import { toShortcutKey } from '../event/KeyboardEventListener';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

function sanitizeForUpdatingComparison(jsonText: string | null) {
    if (jsonText === null) {
        return null;
    }
    try {
        const jsonData = JSON.parse(jsonText);
        jsonData.metadata ??= {};
        jsonData.metadata.lastEditDate = '';
        return JSON.stringify(jsonData);
    } catch (_error) {}
    return jsonText;
}
export function useEditingHistoryStatus(filePath: string) {
    const [status, setStatus] = useState({
        canUndo: false,
        canRedo: false,
        canSave: false,
    });
    const update = async () => {
        const editingHistoryManager =
            EditingHistoryManager.getInstance(filePath);
        const canUndo = await editingHistoryManager.checkCanUndo();
        const canRedo = await editingHistoryManager.checkCanRedo();
        const historyText = await editingHistoryManager.getCurrentHistory();
        const text = await editingHistoryManager.getOriginalData();
        const sanitizedHistoryText = sanitizeForUpdatingComparison(historyText);
        const sanitizedText = sanitizeForUpdatingComparison(text);
        const canSave =
            sanitizedHistoryText !== null &&
            sanitizedHistoryText !== sanitizedText;
        setStatus({ canUndo, canRedo, canSave });
    };
    useFileSourceEvents(['update'], update, [], filePath);
    useAppEffect(() => {
        update();
    }, [filePath]);
    return status;
}

const savingEventMapper: KeyboardEventMapper = {
    allControlKey: ['Ctrl'],
    key: 's',
};

function genDisabledStyle(isDisabled: boolean) {
    if (!isDisabled) {
        return {};
    }
    return {
        opacity: 0.1,
    };
}

function MenuIsModifying({
    editableDocument,
    caDiscard,
    canSave,
}: Readonly<{
    editableDocument: AppEditableDocumentSourceAbs<any>;
    caDiscard: boolean;
    canSave: boolean;
}>) {
    const editableDocumentRef = useAppCurrentRef(editableDocument);
    const handleDiscard = useCallback(async () => {
        const isOk = await showAppConfirm(
            tran('Discard changed'),
            tran('Are you sure to discard all change histories?'),
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isOk) {
            return;
        }
        editableDocumentRef.current.historyDiscard();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSave = useCallback(() => {
        editableDocumentRef.current.save();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <>
            <button
                className="btn btn-sm btn-danger"
                type="button"
                disabled={!caDiscard}
                title={tran('Discard changed')}
                style={genDisabledStyle(!caDiscard)}
                onClick={handleDiscard}
            >
                <i className="bi bi-x-octagon" />
            </button>
            <button
                className="btn btn-sm btn-success"
                type="button"
                disabled={!canSave}
                title={tran('Save') + ` [${toShortcutKey(savingEventMapper)}]`}
                style={genDisabledStyle(!canSave)}
                onClick={handleSave}
            >
                <i className="bi bi-floppy" />
            </button>
        </>
    );
}

export function FileEditingMenuComp({
    extraChildren,
    editableDocument,
}: Readonly<{
    extraChildren?: ReactNode | null;
    editableDocument: AppEditableDocumentSourceAbs<any>;
}>) {
    const { canUndo, canRedo, canSave } = useEditingHistoryStatus(
        editableDocument.filePath,
    );
    const isShowingTools = canUndo || canRedo || canSave;
    const editableDocumentRef = useAppCurrentRef(editableDocument);
    const handleUndo = useCallback(() => {
        editableDocumentRef.current.historyUndo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRedo = useCallback(() => {
        editableDocumentRef.current.historyRedo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!(isShowingTools || extraChildren)) {
        return null;
    }
    return (
        <div className="editing-menu-body btn-group control d-flex justify-content-center">
            <button
                className="btn btn-sm btn-info"
                type="button"
                title="Undo"
                disabled={!canUndo}
                style={genDisabledStyle(!canUndo)}
                onClick={handleUndo}
            >
                <i className="bi bi-arrow-90deg-left" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title="Redo"
                disabled={!canRedo}
                style={genDisabledStyle(!canRedo)}
                onClick={handleRedo}
            >
                <i className="bi bi-arrow-90deg-right" />
            </button>
            <MenuIsModifying
                editableDocument={editableDocument}
                caDiscard={isShowingTools}
                canSave={canSave}
            />
            {extraChildren}
        </div>
    );
}
