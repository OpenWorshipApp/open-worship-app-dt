import type { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';
import type { SettingSectionFoldNameType } from './settingSectionFoldHelpers';
import { useSettingSectionFold } from './settingSectionFoldHooks';
import SettingOthersFoldButtonComp from './SettingOthersFoldButtonComp';

/**
 * The three rows of the Others tab are three OUTSIDE services, each of which is
 * either wired up or not. `idle` is deliberately not a warning colour: two of
 * the three are entirely optional, and painting them amber would train the
 * operator to ignore amber on the one row where it means a feature is broken.
 */
export type SettingOthersStateType = 'ready' | 'idle' | 'attention';

export default function SettingOthersSectionComp({
    foldName,
    iconClassName,
    title,
    description,
    state,
    stateLabel,
    headerActions,
    openToken,
    onCollapse,
    children,
}: Readonly<{
    foldName: SettingSectionFoldNameType;
    iconClassName: string;
    title: string;
    description: string;
    state: SettingOthersStateType;
    stateLabel: string;
    headerActions?: ReactNode;
    // Both as `useSettingSectionFold` takes them.
    openToken?: number;
    onCollapse?: () => void;
    children: ReactNode;
}>) {
    const [isCollapsed, handleToggling] = useSettingSectionFold(
        foldName,
        openToken,
        onCollapse,
    );
    return (
        <section
            className={
                'app-setting-others-section ' +
                `app-setting-others-${state}` +
                (isCollapsed ? ' app-setting-others-collapsed' : '')
            }
        >
            <div className="app-setting-others-header">
                <h2 className="app-setting-others-title">
                    <SettingOthersFoldButtonComp
                        isCollapsed={isCollapsed}
                        onToggle={handleToggling}
                    >
                        <i
                            className={`bi ${iconClassName} app-setting-others-icon`}
                            aria-hidden="true"
                        />
                        {tran(title)}
                    </SettingOthersFoldButtonComp>
                </h2>
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
            {/* Folded, what is in the section is not mounted at all: AI
                Providers alone is four provider boxes and every server and
                model the user has added. */}
            {isCollapsed ? null : (
                <>
                    <p className="app-setting-others-description">
                        {tran(description)}
                    </p>
                    {children}
                </>
            )}
        </section>
    );
}
