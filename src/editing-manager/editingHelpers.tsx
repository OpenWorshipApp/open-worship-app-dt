import { useState, ReactNode } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import EditingHistoryManager from './EditingHistoryManager';
import AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import {
    useKeyboardRegistering,
    EventMapper as KeyboardEventMapper,
    toShortcutKey,
} from '../event/KeyboardEventListener';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

export function useEditingHistoryStatus(filePath: string) {
    const [status, setStatus] = useState({
        canUndo: false,
        canRedo: false,
        canSave: false,
    });
    const update = async () => {
        const editingHistoryManager = new EditingHistoryManager(filePath);
        const canUndo = await editingHistoryManager.checkCanUndo();
        const canRedo = await editingHistoryManager.checkCanRedo();
        const historyText = await editingHistoryManager.getCurrentHistory();
        const text = await editingHistoryManager.getOriginalData();
        const canSave = historyText !== null && historyText !== text;
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
    return (
        <>
            <button
                className="btn btn-sm btn-danger"
                type="button"
                disabled={!caDiscard}
                title="`Discard changed"
                style={genDisabledStyle(!caDiscard)}
                onClick={async () => {
                    const isOk = await showAppConfirm(
                        '`Discard changed',
                        '`Are you sure to discard all histories?',
                    );
                    if (!isOk) {
                        return;
                    }
                    editableDocument.editingHistoryManager.discard();
                }}
            >
                <i className="bi bi-x-octagon" />
            </button>
            <button
                className="btn btn-sm btn-success"
                type="button"
                disabled={!canSave}
                title={`\`Save [${toShortcutKey(savingEventMapper)}]`}
                style={genDisabledStyle(!canSave)}
                onClick={() => {
                    editableDocument.save();
                }}
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
    useKeyboardRegistering(
        [savingEventMapper],
        () => {
            editableDocument.save();
        },
        [editableDocument],
    );
    const isShowingTools = canUndo || canRedo || canSave;
    if (!(isShowingTools || extraChildren)) {
        return null;
    }
    return (
        <div
            style={{
                borderBottom: '1px solid #00000024',
                backgroundColor: '#00000020',
                minHeight: '35px',
            }}
        >
            <div className="btn-group control d-flex justify-content-center">
                <button
                    className="btn btn-sm btn-info"
                    type="button"
                    title="Undo"
                    disabled={!canUndo}
                    style={genDisabledStyle(!canUndo)}
                    onClick={() => {
                        editableDocument.editingHistoryManager.undo();
                    }}
                >
                    <i className="bi bi-arrow-90deg-left" />
                </button>
                <button
                    className="btn btn-sm btn-info"
                    type="button"
                    title="Redo"
                    disabled={!canRedo}
                    style={genDisabledStyle(!canRedo)}
                    onClick={() => {
                        editableDocument.editingHistoryManager.redo();
                    }}
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
        </div>
    );
}
