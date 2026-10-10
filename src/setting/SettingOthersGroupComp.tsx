import type { ReactNode } from 'react';

import type { SettingSectionFoldNameType } from './settingSectionFoldHelpers';
import { useSettingSectionFold } from './settingSectionFoldHooks';
import SettingOthersFoldButtonComp from './SettingOthersFoldButtonComp';

/**
 * One box inside a section of the Others tab -- a provider's fields, the
 * user's own servers -- which folds to its title like the section around it.
 *
 * `title` is drawn as given: a provider's name is not a translatable string,
 * and a caller whose title is one translates it.
 */
export default function SettingOthersGroupComp({
    foldName,
    title,
    isWide = false,
    foldedMark,
    openToken,
    onCollapse,
    children,
}: Readonly<{
    foldName: SettingSectionFoldNameType;
    title: string;
    isWide?: boolean;
    /**
     * Drawn beside the title ONLY while folded: what the fold is holding that
     * is worth knowing without opening it (a provider's key is saved). Open,
     * the fields themselves say it.
     */
    foldedMark?: ReactNode;
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
        <div
            className={
                'app-setting-others-group' +
                (isWide ? ' app-setting-others-group-wide' : '') +
                (isCollapsed ? ' app-setting-others-collapsed' : '')
            }
        >
            <span className="app-setting-others-group-title">
                <SettingOthersFoldButtonComp
                    isCollapsed={isCollapsed}
                    onToggle={handleToggling}
                >
                    {title}
                </SettingOthersFoldButtonComp>
                {isCollapsed ? foldedMark : null}
            </span>
            {isCollapsed ? null : children}
        </div>
    );
}
