import type { ReactNode } from 'react';

import { tran } from '../lang/langHelpers';

/**
 * The title of a part of the Others tab, as the button that folds it. ONE
 * button in both states with the title's own words on it, so the keyboard
 * stays where it was pressed and a folded part still answers to its name.
 */
export default function SettingOthersFoldButtonComp({
    isCollapsed,
    onToggle,
    children,
}: Readonly<{
    isCollapsed: boolean;
    onToggle: () => void;
    children: ReactNode;
}>) {
    return (
        <button
            className="app-setting-others-fold"
            type="button"
            title={isCollapsed ? tran('Expand') : tran('Collapse')}
            aria-expanded={!isCollapsed}
            onClick={onToggle}
        >
            <i
                className={
                    'bi app-setting-others-chevron ' +
                    `bi-chevron-${isCollapsed ? 'right' : 'down'}`
                }
                aria-hidden="true"
            />
            {children}
        </button>
    );
}
