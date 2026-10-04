import { useState } from 'react';

import { tran } from '../lang/langHelpers';
import appProvider from '../server/appProvider';
import EventHandler from '../event/EventHandler';
import { useAppEffect } from '../helper/appHooks';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import ScreenEffectManager from '../_screen/managers/ScreenEffectManager';
import type { BackgroundType } from '../_screen/screenTypeHelpers';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import {
    genTransitionMenuItem,
    getTransitionIconName,
    showTransitionOverrideDialog,
    toTransitionLabel,
    type TransitionInheritedType,
} from '../others/TransitionOverrideComp';
import {
    BACKGROUND_TRANSITION_CHANGED_EVENT,
    getBackgroundItemTransition,
    getBackgroundTabTransition,
    setBackgroundItemTransition,
    setBackgroundTabTransition,
} from './backgroundTransitionHelpers';

/**
 * Each Background tab's own name, as its tab shows it. Literals so
 * `tranKeyCoverage.test.ts` can read them.
 */
const BACKGROUND_TAB_LABEL_MAP: Partial<Record<BackgroundType, string>> = {
    color: 'Colors',
    image: 'Images',
    video: 'Videos',
    camera: 'Cameras',
    web: 'Webs',
};

function toTabLabel(backgroundType: BackgroundType) {
    const label = BACKGROUND_TAB_LABEL_MAP[backgroundType];
    return label === undefined ? backgroundType : tran(label);
}

/** What a Background tab falls back to: the screen's `Background:` effect. */
export function genBackgroundTabInherited(): TransitionInheritedType {
    return {
        effect: ScreenEffectManager.getCommonEffectType('background'),
        sourceLabel: tran('Screen setting'),
    };
}

/** What one background falls back to: its tab's own, else the screen's. */
export function genBackgroundItemInherited(
    backgroundType: BackgroundType,
): TransitionInheritedType {
    const tabEffect = getBackgroundTabTransition(backgroundType);
    if (tabEffect !== undefined) {
        return { effect: tabEffect, sourceLabel: toTabLabel(backgroundType) };
    }
    return genBackgroundTabInherited();
}

export async function openBackgroundTabTransitionDialog(
    backgroundType: BackgroundType,
) {
    const result = await showTransitionOverrideDialog({
        title: `${tran('Transition')}: ${toTabLabel(backgroundType)}`,
        value: getBackgroundTabTransition(backgroundType),
        inherited: genBackgroundTabInherited(),
        description: tran(
            'Every background from this tab comes in with it, unless the background has its own.',
        ),
    });
    if (result === null) {
        return;
    }
    setBackgroundTabTransition(backgroundType, result.value);
}

export async function openBackgroundItemTransitionDialog(
    backgroundType: BackgroundType,
    src: string,
) {
    const result = await showTransitionOverrideDialog({
        title: tran('Background transition'),
        value: getBackgroundItemTransition(src),
        inherited: genBackgroundItemInherited(backgroundType),
    });
    if (result === null) {
        return;
    }
    setBackgroundItemTransition(src, result.value);
}

/** A Background tab's `Transition: …` row (its right-click). */
export function genBackgroundTabTransitionMenuItems(
    backgroundType: BackgroundType,
): ContextMenuItemType[] {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    return [
        genTransitionMenuItem({
            value: getBackgroundTabTransition(backgroundType),
            inherited: genBackgroundTabInherited(),
            onSelect: () => {
                openBackgroundTabTransitionDialog(backgroundType);
            },
        }),
    ];
}

/** One background's `Transition: …` row (its tile's right-click). */
export function genBackgroundItemTransitionMenuItems(
    backgroundType: BackgroundType,
    src: string,
): ContextMenuItemType[] {
    if (!appProvider.isPagePresenter) {
        return [];
    }
    return [
        genTransitionMenuItem({
            value: getBackgroundItemTransition(src),
            inherited: genBackgroundItemInherited(backgroundType),
            onSelect: () => {
                openBackgroundItemTransitionDialog(backgroundType, src);
            },
        }),
    ];
}

/**
 * The override a tab (no `src`) or one background has of its own, kept
 * current when any of them changes. A read is a lookup in one memoised map.
 */
export function useBackgroundOwnTransition(
    backgroundType: BackgroundType,
    src?: string,
) {
    const read = () => {
        return src === undefined
            ? getBackgroundTabTransition(backgroundType)
            : getBackgroundItemTransition(src);
    };
    const [effect, setEffect] = useState<TransitionEffectType | undefined>(
        read,
    );
    useAppEffect(() => {
        setEffect(read());
        const registeredEvents = EventHandler.registerEventListener(
            [BACKGROUND_TRANSITION_CHANGED_EVENT],
            () => {
                setEffect(read());
            },
        );
        return () => {
            EventHandler.unregisterEventListener(registeredEvents);
        };
    }, [backgroundType, src]);
    return effect;
}

/**
 * The small mark on a Background tab or tile while it has its OWN
 * transition. It only shows, it does not press: the tab or tile is itself a
 * button, and the right-click is where the choice lives. Hidden from the
 * accessible name so a tab is still called "Images", not "Images Transition:
 * Zoom" -- the name the app's own find/click tools aim by.
 */
export function BackgroundTransitionBadgeComp({
    backgroundType,
    src,
    className = 'ms-1',
}: Readonly<{
    backgroundType: BackgroundType;
    src?: string;
    className?: string;
}>) {
    const effect = useBackgroundOwnTransition(backgroundType, src);
    if (effect === undefined) {
        return null;
    }
    const title = `${tran('Transition')}: ${toTransitionLabel(effect)}`;
    return (
        <i
            className={`bi bi-${getTransitionIconName(effect)} ${className}`}
            title={title}
            aria-hidden="true"
        />
    );
}

/**
 * The same mark, pinned in a tile's corner (the video tile's fade-at-end mark
 * sits in the other one).
 */
export function BackgroundTransitionTileBadgeComp({
    backgroundType,
    src,
}: Readonly<{
    backgroundType: BackgroundType;
    src: string;
}>) {
    return (
        <div
            className="position-absolute mx-1 text-white"
            style={{
                bottom: 0,
                right: 0,
                textShadow: '0 0 3px black',
                pointerEvents: 'none',
            }}
        >
            <BackgroundTransitionBadgeComp
                backgroundType={backgroundType}
                src={src}
                className=""
            />
        </div>
    );
}
