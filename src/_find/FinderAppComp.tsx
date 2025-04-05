import './FinderAppComp.scss';

import { useState } from 'react';

import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { LookupOptions, findString } from './finderHelpers';

export default function FinderAppComp({
    onClose,
}: Readonly<{
    onClose: () => void;
}>) {
    const [lookupText, setLookupText] = useState('');
    const [isMatchCase, setIsMatchCase] = useState(false);
    const setLookupText1 = (text: string, options: LookupOptions = {}) => {
        setLookupText(text);
        findString(text, {
            matchCase: isMatchCase,
            ...options,
        });
    };
    useKeyboardRegistering(
        [{ key: 'Escape' }],
        () => {
            if (!lookupText) {
                onClose();
                return;
            }
            setLookupText1('');
        },
        [isMatchCase],
    );
    useKeyboardRegistering(
        [{ key: 'Enter' }],
        () => {
            if (!lookupText) {
                return;
            }
            setLookupText1(lookupText, {
                forward: true,
                findNext: true,
            });
        },
        [lookupText, isMatchCase],
    );

    return (
        <div className="finder-container card w-100 h-100" data-bs-theme="dark">
            <div className="card-body">
                <div className="finder input-group">
                    <button
                        className="btn btn-info"
                        onClick={() => {
                            setLookupText1(lookupText, {
                                forward: false,
                                findNext: true,
                            });
                        }}
                    >
                        <i className="bi bi-arrow-left" />
                    </button>
                    <button
                        className="btn btn-info"
                        onClick={() => {
                            setLookupText1(lookupText, {
                                forward: true,
                                findNext: true,
                            });
                        }}
                    >
                        <i className="bi bi-arrow-right" />
                    </button>
                    <input
                        type="text"
                        className="form-control"
                        autoFocus
                        value={lookupText}
                        onChange={(event) => {
                            const text = event.target.value;
                            setLookupText1(text);
                        }}
                    />
                    <div className="input-group-text">
                        Aa{' '}
                        <input
                            className="form-check-input mt-0"
                            type="checkbox"
                            checked={isMatchCase}
                            onChange={(event) => {
                                const checked = event.target.checked;
                                setIsMatchCase(checked);
                                setLookupText1(lookupText, {
                                    matchCase: checked,
                                });
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
