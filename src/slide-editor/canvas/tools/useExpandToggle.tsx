import { type CSSProperties, useCallback, useMemo, useState } from 'react';

import { tran } from '../../../lang/langHelpers';
import { useAppEffect } from '../../../helper/appHooks';
import { getSetting, setSetting } from '../../../helper/settingHelpers';

/**
 * Shared collapse/expand state for the slide-editor tool panels.
 *
 * Returns the current `isExpanded` flag plus `headerProps` to spread onto the
 * clickable header (role/title/onClick) so every panel toggles and reads the
 * same way.
 */
export function useExpandToggle(
    initiallyExpanded: boolean,
    persistingKey?: string,
) {
    const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
    useAppEffect(() => {
        if (persistingKey) {
            const stored = getSetting(persistingKey);
            if (stored !== null) {
                setIsExpanded(stored === 'true');
            }
        }
    }, [persistingKey]);
    const toggleExpanded = useCallback(() => {
        setIsExpanded((prev) => {
            const next = !prev;
            if (persistingKey) {
                setSetting(persistingKey, next.toString());
            }
            return next;
        });
    }, [persistingKey]);
    const headerProps = useMemo(
        () =>
            ({
                role: 'button',
                title: tran(isExpanded ? 'Collapse' : 'Expand'),
                onClick: toggleExpanded,
            }) as const,
        [isExpanded, toggleExpanded],
    );
    return { isExpanded, toggleExpanded, headerProps };
}

export function ExpandChevron({
    isExpanded,
    className,
    style,
}: Readonly<{
    isExpanded: boolean;
    className?: string;
    style?: CSSProperties;
}>) {
    return (
        <i
            className={`bi ${
                isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'
            }${className ? ` ${className}` : ''}`}
            style={style}
        />
    );
}
