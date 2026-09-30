import type { ChangeEvent, ReactNode, KeyboardEvent, MouseEvent } from 'react';
import { useCallback, useState } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import {
    describePortableFileNameProblem,
    getPortableFileNameProblem,
} from '../server/fileHelpers';

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
    // Judged by what EVERY computer accepts, not only this one: a name made
    // here has to open on the other machines the data folder goes to.
    const isValid = getPortableFileNameProblem(creatingNewName) === null;
    const handleDivClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);
    const creatingNewNameRef = useAppCurrentRef(creatingNewName);
    const applyNameRef = useAppCurrentRef(applyName);
    // ONE gate for both ways of applying. Enter used to apply the name
    // unchecked, so only a click on the button ever saw the check.
    const applyCheckedName = useCallback(() => {
        const problem = getPortableFileNameProblem(creatingNewNameRef.current);
        if (problem !== null) {
            showSimpleToast(
                tran('Invalid file name'),
                describePortableFileNameProblem(problem),
            );
            return;
        }
        applyNameRef.current(creatingNewNameRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter' && creatingNewNameRef.current) {
                applyCheckedName();
            } else if (event.key === 'Escape') {
                applyNameRef.current(null);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setCreatingNewName(event.target.value);
        },
        [],
    );
    return (
        <div className="input-group" onClick={handleDivClick}>
            <input
                type="text"
                className="form-control form-control-sm"
                placeholder={tran('title')}
                value={creatingNewName}
                aria-label={tran('file name')}
                aria-describedby="button-addon2"
                autoFocus
                onKeyDown={handleKeyDown}
                onChange={handleInputChange}
            />
            <button
                id="button-addon2"
                className={`btn btn-outline-${isValid ? 'success' : 'danger'}`}
                type="button"
                onClick={applyCheckedName}
            >
                {customIcon || <i className="bi bi-check" />}
            </button>
        </div>
    );
}
