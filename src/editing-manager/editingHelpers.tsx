import './editingHelpers.scss';

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import EditingHistoryManager from './EditingHistoryManager';
import type AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { EventMapperType as KeyboardEventMapper } from '../event/KeyboardEventListener';
import { toShortcutKey } from '../event/KeyboardEventListener';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

function removeLastEditingDate(jsonText: string | null) {
    if (jsonText === null) {
        return null;
    }
    // e.g. "lastEditDate": "2026-02-08T16:13:41.284Z"
    return jsonText.replaceAll(
        /"lastEditDate":\s*"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/g,
        '"lastEditDate": ""',
    );
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
        const canSave =
            historyText !== null &&
            removeLastEditingDate(historyText) !== removeLastEditingDate(text);
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
    const handleDiscard = useCallback(async () => {
        const isOk = await showAppConfirm(
            tran('Discard changed'),
            tran('Are you sure to discard all histories?'),
            {
                confirmButtonLabel: 'Yes',
            },
        );
        if (!isOk) {
            return;
        }
        editableDocument.historyDiscard();
    }, [editableDocument]);
    const handleSave = useCallback(() => {
        editableDocument.save();
    }, [editableDocument]);
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
    const handleUndo = useCallback(() => {
        editableDocument.historyUndo();
    }, [editableDocument]);
    const handleRedo = useCallback(() => {
        editableDocument.historyRedo();
    }, [editableDocument]);
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
