import { useCallback, useState } from 'react';

import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import type { SettingSectionFoldNameType } from './settingSectionFoldHelpers';
import {
    getIsSettingSectionCollapsed,
    saveIsSettingSectionCollapsed,
} from './settingSectionFoldHelpers';

/**
 * The fold of one part of the Others tab: whether it is folded, and the press
 * that folds or opens it. The caller renders its header either way and what
 * is inside only while open, so a folded part mounts nothing.
 *
 * `openToken` changes when something INSIDE the part is asked for -- another
 * window sending the user to a key box (`aiKeyFocusHelpers`). A folded part
 * opens for it, on its own mount too: a box inside a folded box inside a
 * folded section is reached by each opening in turn. A token rather than a
 * flag, so asking twice opens it twice.
 *
 * `onCollapse` is told of a fold by hand, so a caller holding a one-time
 * request for something inside can forget it: everything in here is mounted
 * afresh when the part opens again.
 */
export function useSettingSectionFold(
    foldName: SettingSectionFoldNameType,
    openToken?: number,
    onCollapse?: () => void,
) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return getIsSettingSectionCollapsed(foldName);
    });
    const foldNameRef = useAppCurrentRef(foldName);
    const isCollapsedRef = useAppCurrentRef(isCollapsed);
    const onCollapseRef = useAppCurrentRef(onCollapse);
    const handleToggling = useCallback(() => {
        const isNewCollapsed = !isCollapsedRef.current;
        setIsCollapsed(isNewCollapsed);
        saveIsSettingSectionCollapsed(foldNameRef.current, isNewCollapsed);
        if (isNewCollapsed) {
            onCollapseRef.current?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        if (openToken === undefined || !isCollapsedRef.current) {
            return;
        }
        setIsCollapsed(false);
        saveIsSettingSectionCollapsed(foldNameRef.current, false);
    }, [openToken]);
    return [isCollapsed, handleToggling] as const;
}
