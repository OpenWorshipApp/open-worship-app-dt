/**
 * The rules of a slide show, with nothing behind them.
 *
 * Deliberately importing NOTHING: the slides previewer reaches these from a
 * helper that a node-environment test loads, and pulling the settings store in
 * through `slideAutoPlayHelpers` dragged `appLocalStorage` and the whole file
 * helper table along with it. What is stored, and where, is that module's job;
 * this one only says what a show DOES.
 */

export const REPEAT_KIND_ALL = 'all';
export const REPEAT_KIND_NONE = 'none';
// There is no "repeat one". A show that never moves is a show that is not
// running, which the play button already says; on a clip it was worse than
// useless, since re-presenting the same file restarts it and the projector
// stuttered once per tick. A setting saved from when it existed falls back to
// "repeat all" through `toValidRepeatKind`.
export const repeatKindList = [REPEAT_KIND_ALL, REPEAT_KIND_NONE] as const;
export type RepeatKindType = (typeof repeatKindList)[number];

export type SlideAutoPlayOptionsType = {
    /** The wait, or the LOW end of the random range. */
    seconds: number;
    /** The high end of the random range; at or below `seconds` it is fixed. */
    maxSeconds: number;
    repeatKind: RepeatKindType;
    /** How many items one tick moves. */
    step: number;
    /** Video shows only: wait for the clip to finish instead of the clock. */
    isUntilMediaEnd: boolean;
};

export const DEFAULT_SLIDE_AUTO_PLAY_OPTIONS: SlideAutoPlayOptionsType = {
    seconds: 5,
    maxSeconds: 0,
    repeatKind: REPEAT_KIND_ALL,
    step: 1,
    isUntilMediaEnd: false,
};

export const MAX_SLIDE_AUTO_PLAY_STEP = 999;

export function toValidRepeatKind(value: string | null): RepeatKindType {
    return repeatKindList.includes(value as RepeatKindType)
        ? (value as RepeatKindType)
        : REPEAT_KIND_ALL;
}

/**
 * The wait before the next item.
 *
 * "Up to N" means exactly that: a whole number of seconds from 1 to N, drawn
 * fresh for every slide. A WHOLE number because that is the operator's own
 * unit -- a show that lands on 4.37s is not something anyone asked for, and
 * the countdown beside it would have to lie about what it is counting.
 *
 * The draw is PUT BACK in the seconds box before the countdown starts (see
 * `setSlideAutoPlayDrawnSeconds`), so a random show is not a mystery: the
 * number on screen is the wait about to happen.
 */
export function genNextDelaySeconds(options: SlideAutoPlayOptionsType) {
    const { seconds, maxSeconds } = options;
    if (!(maxSeconds > 0)) {
        return seconds;
    }
    return 1 + Math.floor(Math.random() * maxSeconds);
}

/**
 * Where a tick lands, or null once the show is over.
 *
 * Null is what "no repeat" means and the only way a show ends by itself: the
 * caller stops its clock on it.
 */
export function toNextIndex(
    index: number,
    length: number,
    {
        isNext,
        step,
        repeatKind,
    }: { isNext: boolean; step: number; repeatKind: RepeatKindType },
) {
    if (length <= 0 || index < 0 || index >= length) {
        return null;
    }
    const safeStep = Math.max(1, Math.trunc(step));
    const rawIndex = index + (isNext ? safeStep : -safeStep);
    if (repeatKind === REPEAT_KIND_NONE) {
        // Walked off either end, so there is nothing left to show. A step
        // bigger than what is left stops too -- landing back near the top
        // would be repeating, which is the one thing this mode is not.
        return rawIndex < 0 || rawIndex >= length ? null : rawIndex;
    }
    return ((rawIndex % length) + length) % length;
}

/**
 * When each running show fires next, so the panel can count down to it.
 *
 * Module level and keyed by the show's own settings prefix, because the two
 * clocks that feed it are in different places -- one inside `SlideAutoPlayComp`
 * and one in `autoPlayRunnerHelpers`, which keeps running with nothing
 * rendered -- and the countdown must not care which is driving.
 */
const dueAtMap = new Map<string, number>();
const drawnSecondsMap = new Map<string, number>();
const stateListeners = new Set<() => void>();

/**
 * Deliberately silent: this moves on every tick, and the countdown polls it
 * once a second off its own clock. Telling the panel about it would re-render
 * the whole toolbar every time a show advanced, to redraw a number that is
 * already being redrawn beside it.
 */
export function setSlideAutoPlayDueAt(prefix: string, dueAt: number | null) {
    if (dueAt === null) {
        dueAtMap.delete(prefix);
        return;
    }
    dueAtMap.set(prefix, dueAt);
}

/**
 * The wait this show DREW for the countdown now running.
 *
 * Kept beside the due time rather than written into the seconds setting: the
 * setting is an INPUT the operator typed, and a clock that overwrote it would
 * both lose the number they chose and, because the seconds are part of what
 * decides how the timer runs, restart itself on its own write -- a show that
 * redraws for ever and never advances. This is the OUTPUT, and it is thrown
 * away when the show stops.
 *
 * Unlike the due time this changes once per slide, not once per second, so it
 * is worth telling the panel about.
 */
export function setSlideAutoPlayDrawnSeconds(
    prefix: string,
    seconds: number | null,
) {
    if (seconds === null) {
        if (!drawnSecondsMap.delete(prefix)) {
            return;
        }
    } else {
        if (drawnSecondsMap.get(prefix) === seconds) {
            return;
        }
        drawnSecondsMap.set(prefix, seconds);
    }
    notifySlideAutoPlayStateChanged();
}

export function getSlideAutoPlayDrawnSeconds(prefix: string) {
    return drawnSecondsMap.get(prefix) ?? null;
}

export function getSlideAutoPlayDueAt(prefix: string) {
    return dueAtMap.get(prefix) ?? null;
}

/** Whole seconds left, or null when nothing is counting down to anything. */
export function getSlideAutoPlayRemainingSeconds(prefix: string) {
    const dueAt = getSlideAutoPlayDueAt(prefix);
    if (dueAt === null) {
        return null;
    }
    return Math.max(0, Math.ceil((dueAt - Date.now()) / 1000));
}

export function subscribeSlideAutoPlayState(listener: () => void) {
    stateListeners.add(listener);
    return () => {
        stateListeners.delete(listener);
    };
}

/**
 * Fired when a show starts, stops or ends ITSELF -- a "no repeat" show that
 * ran out is the case that matters, since nothing else about the app changes
 * at that moment and the panel would otherwise keep drawing a pause button
 * over a clock that is no longer running.
 */
export function notifySlideAutoPlayStateChanged() {
    for (const listener of Array.from(stateListeners)) {
        listener();
    }
}
