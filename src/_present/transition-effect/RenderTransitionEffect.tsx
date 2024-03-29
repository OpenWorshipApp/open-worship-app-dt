import { showAppContextMenu } from '../../others/AppContextMenu';
import PresentTransitionEffect from './PresentTransitionEffect';
import {
    PresentTransitionEffectType, TargetType, transitionEffect, usePTEEvents,
} from './transitionEffectHelpers';

function openContextMenu(event: any,
    ptEffect: PresentTransitionEffect) {
    const ptEffectList = Object.entries(transitionEffect);
    showAppContextMenu(event, ptEffectList.map(([effect, [icon]]) => {
        const isSelected = effect === ptEffect.effectType;
        return {
            title: effect,
            onClick: () => {
                ptEffect.effectType = effect as PresentTransitionEffectType;
            },
            otherChild: (
                <i className={
                    `${icon} ps-1 ${isSelected ? 'highlight-selected' : ''}`
                } />
            ),
        };
    }));
}

export default function RenderTransitionEffect({
    title, presentId, target,
}: Readonly<{
    title: string,
    presentId: number,
    target: TargetType,
}>) {
    const ptEffect = PresentTransitionEffect.getInstance(presentId, target);
    usePTEEvents(['update'], ptEffect);
    const selected = transitionEffect[ptEffect.effectType];
    return (
        <button type='button' className='btn btn-outline-secondary'
            onClick={(event) => {
                openContextMenu(event, ptEffect);
            }}>
            {title}
            <i className={`${selected[0]} ps-1 'highlight-selected`} />
        </button>
    );
}

export function RendStyle({
    presentId, ptEffectTarget,
}: Readonly<{
    presentId: number,
    ptEffectTarget: TargetType,
}>) {
    const ptEffect = PresentTransitionEffect.getInstance(
        presentId, ptEffectTarget);
    usePTEEvents(['update'], ptEffect);
    return (
        <style>
            {ptEffect.style}
        </style>
    );
}
