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
    isUpdateAvailable = false,
    children,
}: Readonly<{
    foldName: SettingSectionFoldNameType;
    iconClassName: string;
    title: string;
    // Both optional: a section whose title says it all (Settings > Languages'
    // picker) shows neither the line under it nor the state pill.
    description?: string;
    state: SettingOthersStateType;
    stateLabel?: string;
    headerActions?: ReactNode;
    // Both as `useSettingSectionFold` takes them.
    openToken?: number;
    onCollapse?: () => void;
    // The end of the trail from the Setting gear's dot: something in here has
    // an update. Beside the title, so a folded section still shows it.
    isUpdateAvailable?: boolean;
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
                    {isUpdateAvailable ? (
                        <span
                            className="app-update-dot-inline"
                            role="img"
                            title={tran('Update Available')}
                            aria-label={tran('Update Available')}
                        />
                    ) : null}
                </h2>
                {stateLabel ? (
                    <span className="app-setting-others-state">
                        <i className="bi bi-circle-fill" aria-hidden="true" />
                        {tran(stateLabel)}
                    </span>
                ) : null}
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
                    {description ? (
                        <p className="app-setting-others-description">
                            {tran(description)}
                        </p>
                    ) : null}
                    {children}
                </>
            )}
        </section>
    );
}
