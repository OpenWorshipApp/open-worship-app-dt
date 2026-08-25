import type { FocusEvent, ReactNode } from 'react';
import { useCallback, useId, useState } from 'react';

import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

/**
 * The one credential field shared by every row of the Others tab. The AI keys
 * and the SongSelect credentials had grown two near-identical copies of this.
 *
 * `isSecret` fields render masked: this machine is usually the one plugged into
 * the projector, so a key left on screen is a key readable from the pews.
 */
export default function SettingOthersFieldComp({
    label,
    hintKey,
    value,
    isSecret = false,
    onSave,
    children,
}: Readonly<{
    label: string;
    hintKey: string;
    value: string;
    isSecret?: boolean;
    onSave: (value: string) => void;
    children?: ReactNode;
}>) {
    const inputId = useId();
    const [isRevealed, setIsRevealed] = useState(false);
    const onSaveRef = useAppCurrentRef(onSave);
    const handleSaving = useCallback((event: FocusEvent<HTMLInputElement>) => {
        onSaveRef.current(event.target.value.trim());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRevealing = useCallback(() => {
        setIsRevealed((oldIsRevealed) => {
            return !oldIsRevealed;
        });
    }, []);
    const isSet = !!value;
    return (
        <div className="app-setting-others-field">
            <label className="app-setting-others-label" htmlFor={inputId}>
                {label}
                <i
                    className="bi bi-info-circle app-setting-others-hint"
                    title={tran(hintKey)}
                />
                {isSet ? (
                    <i
                        className={
                            'bi bi-check-circle-fill' +
                            ' app-setting-others-field-set'
                        }
                        title={tran('Saved')}
                    />
                ) : null}
            </label>
            <div className="d-flex align-items-center gap-1">
                <input
                    // Keyed by the stored value so an outside write (e.g. the
                    // dev mock button) remounts the uncontrolled input with the
                    // new value; while typing the stored value is unchanged, so
                    // no remount happens under the user.
                    key={value}
                    id={inputId}
                    className="form-control form-control-sm"
                    type={isSecret && !isRevealed ? 'password' : 'text'}
                    defaultValue={value}
                    onBlur={handleSaving}
                />
                {isSecret ? (
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        title={tran(isRevealed ? 'Hide' : 'Show')}
                        aria-pressed={isRevealed}
                        onClick={handleRevealing}
                    >
                        <i
                            className={
                                'bi ' + (isRevealed ? 'bi-eye-slash' : 'bi-eye')
                            }
                        />
                    </button>
                ) : null}
                {children}
            </div>
        </div>
    );
}
