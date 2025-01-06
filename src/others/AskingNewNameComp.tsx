import { useState } from 'react';

import { showSimpleToast } from '../toast/toastHelpers';

export default function AskingNewNameComp({
    defaultName, applyName, customIcon,
}: Readonly<{
    defaultName?: string,
    customIcon?: React.ReactNode,
    applyName: (newName: string | null) => void,
}>) {
    const [creatingNewName, setCreatingNewName] = useState(defaultName || '');
    const isValid = /^[^\\\/:\*\?"<>\|]+$/.test(creatingNewName);
    return (
        <div className='input-group'
            onClick={(event) => {
                event.stopPropagation();
            }}>
            <input type='text'
                className='form-control'
                placeholder='title'
                value={creatingNewName}
                aria-label='file name'
                aria-describedby='button-addon2'
                autoFocus
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && creatingNewName) {
                        applyName(creatingNewName);
                    } else if (event.key === 'Escape') {
                        applyName(null);
                    }
                }}
                onChange={(event) => {
                    setCreatingNewName(event.target.value);
                }} />
            <button type='button'
                id='button-addon2'
                className={`btn btn-outline-${isValid ? 'success' : 'danger'}`}
                onClick={() => {
                    if (!isValid) {
                        showSimpleToast(
                            'Invalid file name',
                            'File name cannot contain any of the following ' +
                            'characters: \\ / : * ? " < > |',
                        );
                        return;
                    }
                    applyName(creatingNewName || null);
                }}>
                {customIcon || <i className='bi bi-check' />}
            </button>
        </div>
    );
}
