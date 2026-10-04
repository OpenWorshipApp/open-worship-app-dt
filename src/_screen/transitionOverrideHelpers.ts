import type { TransitionEffectType } from './transitionEffectHelpers';

/**
 * A transition chosen BELOW the screen: a slides preview, one slide, a
 * Background tab, one background, a foreground component or one of its
 * sessions. Its checkbox being ticked is the override being PRESENT -- each
 * level stores just the effect, and unticking removes it -- so nothing ever
 * writes a default.
 *
 * That last part is load-bearing. `checkAreObjectsEqual` counts keys, so a
 * datum that grows `transitionEffect: undefined` (or the default spelled out)
 * stops matching its own copy restored from disk, and the screen tears the
 * item down and builds it again. Every datum gets the key through
 * `withTransitionEffect` / `toTransitionPart`, which write it only when set.
 *
 * Type imports only: this is read by the screen managers, the documents and
 * the foreground panels, and must not drag any of them into the others.
 */
export const TRANSITION_EFFECT_LIST: readonly TransitionEffectType[] = [
    'none',
    'fade',
    'move',
    'zoom',
];

/**
 * The sidecar beside a document holding its slides preview's and its slides'
 * own transitions (`SlideTransitionManager`). Declared here, in a leaf, so the
 * rename / trash / backup / archive code can name it without loading the
 * manager.
 */
export const TRANSITION_META_DOT_EXTENSION = '.transition.json';

export function toValidTransitionEffect(
    value: unknown,
): TransitionEffectType | undefined {
    if (
        typeof value === 'string' &&
        (TRANSITION_EFFECT_LIST as readonly string[]).includes(value)
    ) {
        return value as TransitionEffectType;
    }
    return undefined;
}

export type TransitionPartType = { transitionEffect?: TransitionEffectType };

export function toTransitionPart(
    effect?: TransitionEffectType | null,
): TransitionPartType {
    return effect ? { transitionEffect: effect } : {};
}

/**
 * `data` with `transitionEffect` set to `effect`, or with no such key at all.
 * A copy: the argument can be an entry of a memoized on-screen map.
 */
export function withTransitionEffect<T extends object>(
    data: T,
    effect?: TransitionEffectType | null,
): T {
    const { transitionEffect: _previous, ...rest } = data as T &
        TransitionPartType;
    return { ...rest, ...toTransitionPart(effect) } as T;
}
