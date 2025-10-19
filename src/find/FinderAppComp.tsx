import '../appInit.scss';
import '../others/theme-override-dark.scss';
import '../others/theme-override-light.scss';
import './FinderAppComp.scss';

import { useState, useCallback } from 'react';

import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { LookupOptions, findString } from './finderHelpers';
import { applyDarkModeToApp } from '../initHelpers';

export default function FinderAppComp({
    onClose,
}: Readonly<{
    onClose: () => void;
}>) {
    const [lookupText, setLookupText] = useState('');
    const [isMatchCase, setIsMatchCase] = useState(false);

    const setLookupText1 = useCallback(
        (text: string, options: LookupOptions = {}) => {
            setLookupText(text);
            findString(text, {
                matchCase: isMatchCase,
                ...options,
            });
        },
        [isMatchCase],
    );

    const handleEscape = useCallback(() => {
        if (!lookupText) {
            onClose();
            return;
        }
        setLookupText1('');
    }, [lookupText, onClose, setLookupText1]);

    useKeyboardRegistering([{ key: 'Escape' }], handleEscape, [handleEscape]);

    const handleEnter = useCallback(() => {
        if (!lookupText) {
            return;
        }
        setLookupText1(lookupText, {
            forward: true,
            findNext: true,
        });
    }, [lookupText, setLookupText1]);

    useKeyboardRegistering([{ key: 'Enter' }], handleEnter, [handleEnter]);

    const handlePrevClick = useCallback(() => {
        setLookupText1(lookupText, {
            forward: false,
            findNext: true,
        });
    }, [lookupText, setLookupText1]);

    const handleNextClick = useCallback(() => {
        setLookupText1(lookupText, {
            forward: true,
            findNext: true,
        });
    }, [lookupText, setLookupText1]);

    const handleInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const text = event.target.value;
            setLookupText1(text);
        },
        [setLookupText1],
    );

    const handleMatchCaseChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            setIsMatchCase(checked);
            setLookupText1(lookupText, {
                matchCase: checked,
            });
        },
        [lookupText, setLookupText1],
    );

    return (
        <div
            id="app"
            ref={applyDarkModeToApp}
            className="finder-container card w-100 h-100"
            data-bs-theme="dark"
        >
            <div className="card-body p-0">
                <div className="finder input-group">
                    <button className="btn btn-info" onClick={handlePrevClick}>
                        <i className="bi bi-arrow-left" />
                    </button>
                    <button className="btn btn-info" onClick={handleNextClick}>
                        <i className="bi bi-arrow-right" />
                    </button>
                    <input
                        className="form-control form-control-sm"
                        type="text"
                        autoFocus
                        value={lookupText}
                        onChange={handleInputChange}
                    />
                    <div className="input-group-text">
                        Aa{' '}
                        <input
                            className="form-check-input mt-0"
                            type="checkbox"
                            checked={isMatchCase}
                            onChange={handleMatchCaseChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
