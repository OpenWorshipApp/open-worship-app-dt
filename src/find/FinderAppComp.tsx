import '../others/appInit.scss';
import '../others/theme-override-dark.scss';
import '../others/theme-override-light.scss';
import './FinderAppComp.scss';

import type { ChangeEvent } from 'react';
import { useState, useCallback } from 'react';

import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import type { LookupOptions } from './finderHelpers';
import { findString } from './finderHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function FinderAppComp() {
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
            globalThis.close();
            return;
        }
        setLookupText1('');
    }, [lookupText, setLookupText1]);

    useKeyboardRegistering([{ key: 'Escape' }], handleEscape, [handleEscape]);
    useKeyboardRegistering(
        [{ allControlKey: ['Ctrl'], key: 'q' }],
        () => {
            globalThis.close();
        },
        [],
    );

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

    const lookupTextRef = useAppCurrentRef(lookupText);
    const setLookupText1Ref = useAppCurrentRef(setLookupText1);
    const handlePrevClick = useCallback(() => {
        setLookupText1Ref.current(lookupTextRef.current, {
            forward: false,
            findNext: true,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleNextClick = useCallback(() => {
        setLookupText1Ref.current(lookupTextRef.current, {
            forward: true,
            findNext: true,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleInputChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const text = event.target.value;
            setLookupText1Ref.current(text);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const handleMatchCaseChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            setIsMatchCase(checked);
            setLookupText1Ref.current(lookupTextRef.current, {
                matchCase: checked,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const { theme } = useThemeSource();

    return (
        <div
            id="app"
            className="finder-container card w-100 h-100"
            data-bs-theme={theme}
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
