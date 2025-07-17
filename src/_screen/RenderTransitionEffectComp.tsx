import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ScreenEffectManager from './managers/ScreenEffectManager';
import {
    ScreenTransitionEffectType,
    transitionEffect,
} from './screenTypeHelpers';
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
                        className={`${icon} ps-1 ${isSelected ? 'app-highlight-selected' : ''}`}
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
            type="button"
            title={domTitle}
            className="btn btn-outline-secondary"
            onClick={(event) => {
                openContextMenu(event, screenEffectManager);
            }}
        >
            {title}
            <i className={`${selected[0]} ps-1 'app-highlight-selected`} />
        </button>
    );
}
