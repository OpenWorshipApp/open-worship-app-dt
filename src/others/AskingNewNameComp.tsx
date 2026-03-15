import type { ChangeEvent, ReactNode, KeyboardEvent, MouseEvent } from 'react';
import { useCallback, useState } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';

export default function AskingNewNameComp({
    defaultName,
    applyName,
    customIcon,
}: Readonly<{
    defaultName?: string;
    customIcon?: ReactNode;
    applyName: (newName: string | null) => void;
}>) {
    const [creatingNewName, setCreatingNewName] = useState(defaultName ?? '');
    const isValid = /^[^\\\/:\*\?"<>\|]+$/.test(creatingNewName);
    const handleDivClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter' && creatingNewName) {
                applyName(creatingNewName);
            } else if (event.key === 'Escape') {
                applyName(null);
            }
        },
        [creatingNewName, applyName],
    );
    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setCreatingNewName(event.target.value);
        },
        [],
    );
    const handleApplyClick = useCallback(() => {
        if (!isValid) {
            showSimpleToast(
                'Invalid file name',
                'File name cannot contain any of the following ' +
                    'characters: \\ / : * ? " < > |',
            );
            return;
        }
        applyName(creatingNewName || null);
    }, [isValid, creatingNewName, applyName]);
    return (
        <div className="input-group" onClick={handleDivClick}>
            <input
                type="text"
                className="form-control form-control-sm"
                placeholder="title"
                value={creatingNewName}
                aria-label="file name"
                aria-describedby="button-addon2"
                autoFocus
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
            />
            <button
                id="button-addon2"
                className={`btn btn-outline-${isValid ? 'success' : 'danger'}`}
                type="button"
                onClick={handleApplyClick}
            >
                {customIcon || <i className="bi bi-check" />}
            </button>
        </div>
    );
}
