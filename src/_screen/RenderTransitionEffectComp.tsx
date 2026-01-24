import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { HIGHLIGHT_SELECTED_CLASSNAME } from '../helper/helpers';
import type ScreenEffectManager from './managers/ScreenEffectManager';
import type { ScreenTransitionEffectType } from './screenTypeHelpers';
import { transitionEffect } from './screenTypeHelpers';
import { useScreenEffectEvents } from './transitionEffectHelpers';

function openContextMenu(event: any, screenEffectManager: ScreenEffectManager) {
    const transitionEffectList = Object.entries(transitionEffect);
    showAppContextMenu(
        event,
        transitionEffectList.map(([effect, [icon]]) => {
            const isSelected = effect === screenEffectManager.effectType;
            return {
                menuElement: effect,
                onSelect: () => {
                    screenEffectManager.effectType =
                        effect as ScreenTransitionEffectType;
                },
                childAfter: (
                    <i
                        className={`${icon} ps-1 ${isSelected ? HIGHLIGHT_SELECTED_CLASSNAME : ''}`}
                    />
                ),
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
    return (
        <button
            className="btn btn-outline-secondary"
            type="button"
            title={domTitle}
            onClick={(event) => {
                openContextMenu(event, screenEffectManager);
            }}
        >
            {title}
            <i
                className={`${selected[0]} ps-1 ${HIGHLIGHT_SELECTED_CLASSNAME}`}
            />
        </button>
    );
}
