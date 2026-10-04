import { useCallback, useState } from 'react';

import { tran } from '../lang/langHelpers';
import EventHandler from '../event/EventHandler';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import ScreenEffectManager, {
    SCREEN_EFFECT_CHANGED_EVENT,
} from '../_screen/managers/ScreenEffectManager';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import TransitionOverrideComp, {
    getTransitionIconName,
    showTransitionOverrideDialog,
    toTransitionLabel,
    type TransitionInheritedType,
} from '../others/TransitionOverrideComp';
import PropRowComp from './ForegroundPropRowComp';
import {
    FOREGROUND_TRANSITION_CHANGED_EVENT,
    getForegroundComponentTransition,
    getForegroundSessionTransition,
    setForegroundComponentTransition,
    setForegroundSessionTransition,
} from './foregroundTransitionHelpers';

function checkIsMarquee(widgetKey: string) {
    return widgetKey === 'marquee-top' || widgetKey === 'marquee-bottom';
}

/**
 * What a whole component falls back to: the screen's `Foreground:` effect --
 * except a marquee band, which keeps sliding in from its edge.
 */
export function genForegroundComponentInherited(
    widgetKey: string,
): TransitionInheritedType {
    if (checkIsMarquee(widgetKey)) {
        return { effect: 'move', sourceLabel: tran('Marquee default') };
    }
    return {
        effect: ScreenEffectManager.getCommonEffectType('foreground'),
        sourceLabel: tran('Screen setting'),
    };
}

/** What one session falls back to: its component's own, else the above. */
export function genForegroundSessionInherited(
    widgetKey: string,
): TransitionInheritedType {
    const componentEffect = getForegroundComponentTransition(widgetKey);
    if (componentEffect !== undefined) {
        return {
            effect: componentEffect,
            sourceLabel: tran('All sessions'),
        };
    }
    return genForegroundComponentInherited(widgetKey);
}

/**
 * Re-reads `read` whenever a foreground transition anywhere changes, or a
 * screen's own does -- that is what an unticked level falls back to, and a
 * panel restored open on start-up is drawn before any screen exists.
 */
function useForegroundTransitionValue<T>(read: () => T, deps: unknown[]) {
    const [value, setValue] = useState<T>(read);
    const readRef = useAppCurrentRef(read);
    useAppEffect(() => {
        setValue(readRef.current());
        const registeredEvents = EventHandler.registerEventListener(
            [FOREGROUND_TRANSITION_CHANGED_EVENT, SCREEN_EFFECT_CHANGED_EVENT],
            () => {
                setValue(readRef.current());
            },
        );
        return () => {
            EventHandler.unregisterEventListener(registeredEvents);
        };
    }, deps);
    return value;
}

/**
 * The session's row in Properties: does THIS session's overlay have its own
 * transition? It takes effect at the next Show -- an overlay already up keeps
 * the way it came in, and going out the way it came in is what it does.
 */
export function ForegroundTransitionPropComp({
    prefix,
    widgetKey,
}: Readonly<{
    prefix: string;
    widgetKey: string;
}>) {
    const own = useForegroundTransitionValue(() => {
        return getForegroundSessionTransition(prefix);
    }, [prefix]);
    const inherited = useForegroundTransitionValue(() => {
        return genForegroundSessionInherited(widgetKey);
    }, [widgetKey]);
    const prefixRef = useAppCurrentRef(prefix);
    const handleChange = useCallback(
        (value: TransitionEffectType | undefined) => {
            setForegroundSessionTransition(prefixRef.current, value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const effect = own ?? inherited.effect;
    return (
        <PropRowComp
            iconClassName={`bi bi-${getTransitionIconName(effect)}`}
            label={tran('Transition')}
            isEngaged={own !== undefined}
            title={
                own === undefined
                    ? `${tran('Follows')}: ${inherited.sourceLabel}`
                    : undefined
            }
        >
            <TransitionOverrideComp
                value={own}
                inherited={inherited}
                onChange={handleChange}
                selectClassName="fg-select"
                isCompact
            />
        </PropRowComp>
    );
}

/**
 * One small button in a foreground panel's title bar: the transition for the
 * WHOLE component, every session of it at once. A session's own row in its
 * Properties still wins over it.
 */
export function ForegroundComponentTransitionButtonComp({
    widgetKey,
    widgetLabel,
}: Readonly<{
    widgetKey: string;
    widgetLabel: string;
}>) {
    const own = useForegroundTransitionValue(() => {
        return getForegroundComponentTransition(widgetKey);
    }, [widgetKey]);
    const widgetKeyRef = useAppCurrentRef(widgetKey);
    const widgetLabelRef = useAppCurrentRef(widgetLabel);
    const handleClicking = useCallback(async () => {
        const targetWidgetKey = widgetKeyRef.current;
        const result = await showTransitionOverrideDialog({
            title: `${tran('Transition for all sessions')}: ${tran(
                widgetLabelRef.current,
            )}`,
            value: getForegroundComponentTransition(targetWidgetKey),
            inherited: genForegroundComponentInherited(targetWidgetKey),
            description: tran(
                'Every session of this panel comes in with it, unless the session has its own in Properties.',
            ),
        });
        if (result === null) {
            return;
        }
        setForegroundComponentTransition(targetWidgetKey, result.value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const inherited = useForegroundTransitionValue(() => {
        return genForegroundComponentInherited(widgetKey);
    }, [widgetKey]);
    const title =
        `${tran('Transition for all sessions')}: ` +
        (own === undefined
            ? `${toTransitionLabel(inherited.effect)} (${inherited.sourceLabel})`
            : toTransitionLabel(own));
    return (
        <button
            type="button"
            // The title bar's own button shape, lit while the component has
            // a transition of its own.
            className={
                'floating-widget__button' +
                (own === undefined ? '' : ' text-warning')
            }
            title={title}
            aria-label={title}
            onClick={handleClicking}
        >
            <i
                className={`bi bi-${getTransitionIconName(own ?? inherited.effect)}`}
            />
        </button>
    );
}
