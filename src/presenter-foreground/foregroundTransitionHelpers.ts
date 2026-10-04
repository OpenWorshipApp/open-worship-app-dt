import EventHandler from '../event/EventHandler';
import {
    getSetting,
    removeSetting,
    setSetting,
} from '../helper/settingHelpers';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import { toValidTransitionEffect } from '../_screen/transitionOverrideHelpers';

/**
 * A foreground overlay's transition, most specific first: its SESSION's own
 * (the checkbox in that session's Properties), else its COMPONENT's own (the
 * button in the panel's title bar, for every session of the widget at once),
 * else nothing -- and nothing means the screen's `Foreground:` effect, which
 * the screen applies itself.
 *
 * A level that is switched on is a level whose setting EXISTS; unticking
 * removes it. The session level is the key the media widgets' Transition
 * picker always wrote, so a choice made there before this existed reads as a
 * ticked override of that same effect, and a session that never chose one
 * used to mean `fade` -- the screen's default -- which is what it follows now.
 */
export const FOREGROUND_TRANSITION_CHANGED_EVENT =
    'foreground-transition-changed';

/** The session level: one key under the session's Properties prefix. */
export function genForegroundSessionTransitionSettingName(prefix: string) {
    return `${prefix}-setting-show-widget-transition`;
}

/**
 * The component level, keyed by the widget (`countdown`, `marquee-top`).
 * Not `foreground-<key>-...`: that namespace holds each widget's session
 * list.
 */
export function genForegroundComponentTransitionSettingName(widgetKey: string) {
    return `foreground-component-transition-${widgetKey}`;
}

function readTransition(settingName: string) {
    return toValidTransitionEffect(getSetting(settingName));
}

function writeTransition(
    settingName: string,
    effect: TransitionEffectType | undefined,
) {
    if (effect === undefined) {
        removeSetting(settingName);
    } else {
        setSetting(settingName, effect);
    }
    EventHandler.addPropEvent(FOREGROUND_TRANSITION_CHANGED_EVENT);
}

export function getForegroundSessionTransition(prefix: string) {
    return readTransition(genForegroundSessionTransitionSettingName(prefix));
}

export function setForegroundSessionTransition(
    prefix: string,
    effect: TransitionEffectType | undefined,
) {
    writeTransition(genForegroundSessionTransitionSettingName(prefix), effect);
}

export function getForegroundComponentTransition(widgetKey: string) {
    return readTransition(
        genForegroundComponentTransitionSettingName(widgetKey),
    );
}

export function setForegroundComponentTransition(
    widgetKey: string,
    effect: TransitionEffectType | undefined,
) {
    writeTransition(
        genForegroundComponentTransitionSettingName(widgetKey),
        effect,
    );
}

/**
 * What an overlay of `widgetKey`, put up by the session on `prefix`, carries
 * on its datum: the session's own, else the component's own, else
 * `undefined` (follow the screen). Read straight from the settings so a
 * caller that is not rendering the panel -- a drop, a slide show's next step
 * -- gets the current answer.
 */
export function resolveForegroundTransition(
    widgetKey: string,
    prefix?: string,
): TransitionEffectType | undefined {
    return (
        (prefix === undefined
            ? undefined
            : getForegroundSessionTransition(prefix)) ??
        getForegroundComponentTransition(widgetKey)
    );
}
