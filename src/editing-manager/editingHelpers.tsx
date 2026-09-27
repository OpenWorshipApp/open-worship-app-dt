import './editingHelpers.scss';

import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import EditingHistoryManager from './EditingHistoryManager';
import type { EventMapperType as KeyboardEventMapper } from '../event/KeyboardEventListener';
import { toShortcutKey } from '../event/KeyboardEventListener';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';

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
    // per-instance: this hook mounts once per document/lyric list item, and a
    // shared module-level timer would leave N-1 items with stale status
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const update = async () => {
        const editingHistoryManager =
            EditingHistoryManager.getInstance(filePath);
        if (!(await editingHistoryManager.checkHasHistories())) {
            // nothing recorded yet — one cheap stat instead of repeated
            // readdirs plus two full file reads per list item
            setStatus({ canUndo: false, canRedo: false, canSave: false });
            return;
        }
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
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(update);
        },
        [],
        filePath,
    );
    useAppEffect(() => {
        update();
    }, [filePath]);
    return status;
}

export const savingEventMapper: KeyboardEventMapper = {
    allControlKey: ['Ctrl'],
    key: 's',
};

/**
 * What this menu actually presses.
 *
 * A structural type rather than `AppEditableDocumentSourceAbs`: the Bible note
 * window drives the very same history over a note file, and a `Note` is not one
 * of those -- the Bible Notes list still writes that file straight through, so
 * only the window's own `save` goes through the history. Every editable
 * document satisfies this as it stands.
 */
export type EditingHistoryHolderType = {
    filePath: string;
    historyUndo: () => unknown;
    historyRedo: () => unknown;
    historyDiscard: () => unknown;
    save: () => unknown;
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
    editableDocument: EditingHistoryHolderType;
    caDiscard: boolean;
    canSave: boolean;
}>) {
    const editableDocumentRef = useAppCurrentRef(editableDocument);
    const handleDiscard = useCallback(async () => {
        const isOk = await showAppConfirm(
            tran('Discard changed'),
            tran('Are you sure to discard all change histories?'),
            {
                cancelButtonLabel: 'No',
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
                aria-label={tran('Discard changed')}
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
                aria-label={tran('Save')}
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
    undoLabel,
    redoLabel,
}: Readonly<{
    extraChildren?: ReactNode | null;
    editableDocument: EditingHistoryHolderType;
    /**
     * Named by the caller where a plain `Undo` would be the SECOND control of
     * that name in one window -- the Bible note window carries the rich-text
     * editor's own undo arrow as well, and two buttons reading `Undo` are one
     * the user has to guess at and one `owa_click` cannot tell apart.
     */
    undoLabel?: string;
    redoLabel?: string;
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
                title={undoLabel ?? tran('Undo')}
                aria-label={undoLabel ?? tran('Undo')}
                disabled={!canUndo}
                style={genDisabledStyle(!canUndo)}
                onClick={handleUndo}
            >
                <i className="bi bi-arrow-90deg-left" />
            </button>
            <button
                className="btn btn-sm btn-info"
                type="button"
                title={redoLabel ?? tran('Redo')}
                aria-label={redoLabel ?? tran('Redo')}
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
