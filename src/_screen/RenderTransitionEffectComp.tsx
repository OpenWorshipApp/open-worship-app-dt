import { useCallback } from 'react';

import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import type ScreenEffectManager from './managers/ScreenEffectManager';
import {
    transitionEffect,
    type TransitionEffectType,
    useScreenEffectEvents,
} from './transitionEffectHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

function openContextMenu(event: any, screenEffectManager: ScreenEffectManager) {
    const transitionEffectList = Object.entries(transitionEffect);
    showAppContextMenu(
        event,
        transitionEffectList.map(([effect, [icon]]) => {
            const isSelected = effect === screenEffectManager.effectType;
            return {
                // The effect names are untranslated identifiers; the glyph is
                // what makes each row scannable, so it leads the row instead of
                // trailing it. It keeps doubling as the selected marker.
                childBefore: (
                    <i
                        className={`${icon} ${isSelected ? HIGHLIGHT_SELECTED_CLASSNAME : ''}`}
                        style={{
                            marginRight: '2px',
                            display: 'inline-block',
                            flexShrink: 0,
                            width: '1.25em',
                            textAlign: 'center',
                        }}
                    />
                ),
                menuElement: effect,
                onSelect: () => {
                    screenEffectManager.effectType =
                        effect as TransitionEffectType;
                },
            };
        }),
    );
}

export default function RenderTransitionEffectComp({
    title,
    domTitle,
    screenEffectManager,
}: Readonly<{
    title: string;
    domTitle: string;
    screenEffectManager: ScreenEffectManager;
}>) {
    useScreenEffectEvents(['update'], screenEffectManager);
    const selected = transitionEffect[screenEffectManager.effectType];
    const screenEffectManagerRef = useAppCurrentRef(screenEffectManager);
    const handleOpenContextMenu = useCallback((event: any) => {
        openContextMenu(event, screenEffectManagerRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className="btn btn-outline-secondary"
            type="button"
            title={domTitle}
            onClick={handleOpenContextMenu}
        >
            {title}
            <i className={`${selected[0]} ps-1`} />
        </button>
    );
}
