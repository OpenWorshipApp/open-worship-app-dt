import type { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';

/**
 * The three rows of the Others tab are three OUTSIDE services, each of which is
 * either wired up or not. `idle` is deliberately not a warning colour: two of
 * the three are entirely optional, and painting them amber would train the
 * operator to ignore amber on the one row where it means a feature is broken.
 */
export type SettingOthersStateType = 'ready' | 'idle' | 'attention';

export default function SettingOthersSectionComp({
    iconClassName,
    title,
    description,
    state,
    stateLabel,
    headerActions,
    children,
}: Readonly<{
    iconClassName: string;
    title: string;
    description: string;
    state: SettingOthersStateType;
    stateLabel: string;
    headerActions?: ReactNode;
    children: ReactNode;
}>) {
    return (
        <section
            className={
                'app-setting-others-section ' + `app-setting-others-${state}`
            }
        >
            <div className="app-setting-others-header">
                <i
                    className={`bi ${iconClassName} app-setting-others-icon`}
                    aria-hidden="true"
                />
                <h2 className="app-setting-others-title">{tran(title)}</h2>
                <span className="app-setting-others-state">
                    <i className="bi bi-circle-fill" aria-hidden="true" />
                    {tran(stateLabel)}
                </span>
                {headerActions ? (
                    <span className="app-setting-others-actions">
                        {headerActions}
                    </span>
                ) : null}
            </div>
            <p className="app-setting-others-description">
                {tran(description)}
            </p>
            {children}
        </section>
    );
}
