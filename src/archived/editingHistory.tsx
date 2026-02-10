import { useCallback, useMemo, useState } from 'react';

import {
    fsCheckFileExist,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import EditingHistoryManager from '../editing-manager/EditingHistoryManager';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { useEditingHistoryStatus } from '../editing-manager/editingHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { getReactRoot } from '../others/initHelpers';

const root = getReactRoot();

const filePath = pathJoin(appLocalStorage.defaultStorage, 'history1.txt');

let timeoutId: any = null;
function HistoryAppComp() {
    const { canUndo, canRedo, canSave } = useEditingHistoryStatus(filePath);
    const [text, setText] = useState('');
    const historyManager = useMemo(() => {
        return new EditingHistoryManager(filePath);
    }, []);
    const setTextFromHistory = useCallback(async () => {
        if (!(await fsCheckFileExist(filePath))) {
            await fsWriteFile(filePath, '');
        }
        const lastHistory = await historyManager.getCurrentHistory();
        if (lastHistory !== null) {
            setText(lastHistory);
        } else {
            const text = await fsReadFile(filePath);
            setText(text);
        }
    }, [setText, historyManager]);
    useFileSourceEvents(
        ['update'],
        setTextFromHistory,
        [historyManager],
        filePath,
    );
    useAppEffectAsync(setTextFromHistory, []);
    const handleTextChanging = (newText: string) => {
        setText(newText);
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            historyManager.addHistory(newText);
        }, 1e3);
    };
    return (
        <div
            style={{
                width: '600px',
                margin: 'auto',
                backgroundColor: 'white',
            }}
        >
            <h1>Editing History</h1>
            <div>
                <button
                    disabled={!canUndo}
                    onClick={() => {
                        historyManager.undo();
                    }}
                >
                    Undo
                </button>
                <button
                    disabled={!canRedo}
                    onClick={() => {
                        historyManager.redo();
                    }}
                >
                    Redo
                </button>
                <button
                    disabled={!canSave}
                    onClick={() => {
                        historyManager.discard();
                    }}
                >
                    Discard
                </button>
                <button
                    disabled={!canSave}
                    onClick={() => {
                        historyManager.save();
                    }}
                >
                    Save
                </button>
                <hr />
                <textarea
                    style={{
                        width: '100%',
                        height: '300px',
                    }}
                    value={text}
                    onChange={(event) => {
                        handleTextChanging(event.target.value);
                    }}
                />
            </div>
        </div>
    );
}

root.render(<HistoryAppComp />);
