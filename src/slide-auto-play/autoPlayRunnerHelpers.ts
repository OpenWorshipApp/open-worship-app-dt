import { handleError } from '../helper/errorHelpers';
import {
    setSlideAutoPlayDrawnSeconds,
    setSlideAutoPlayDueAt,
} from './slideAutoPlayRuleHelpers';

/**
 * The slide-show timers of the foreground media widgets, held OUTSIDE React.
 *
 * A session's show has to keep running while its panel is not being looked at
 * -- another session picked, the widget collapsed, the whole Foreground panel
 * closed. `SlideAutoPlayComp` keeps its timer in an effect, so the moment its
 * session stopped being rendered the show stopped with it; these live in the
 * module instead and are reconciled from whatever happens to render.
 *
 * Keyed by the show's own settings prefix -- the same key the countdown reads
 * -- one timer each, and the tick is what decides whether the show still has
 * anything to advance, so clearing the foreground (F10) stops a show whose
 * panel nobody has open, with no subscription needed.
 */
export type AutoPlayRunnerType = {
    key: string;
    /**
     * Everything that decides HOW the timer runs, as one string. A runner
     * whose signature is unchanged keeps the countdown it is already on --
     * re-scheduling on every render would reset it and the show would never
     * reach its next slide.
     */
    signature: string;
    /**
     * The wait before the next tick, asked fresh each time: a random range
     * draws a new number, and "until the video ends" is the length of the clip
     * that is up right now.
     */
    getDelaySeconds: () => Promise<number> | number;
    /** Returns false once this show has nothing on screen any more. */
    tick: () => Promise<boolean> | boolean;
    /** Called when the show ended itself -- "no repeat" ran out of items. */
    onEnded?: () => void;
};

type RunningType = {
    signature: string;
    timerId: ReturnType<typeof setTimeout> | null;
};

const runningMap = new Map<string, RunningType>();

function stop(key: string) {
    const running = runningMap.get(key);
    if (running === undefined) {
        return;
    }
    if (running.timerId !== null) {
        clearTimeout(running.timerId);
    }
    runningMap.delete(key);
    setSlideAutoPlayDueAt(key, null);
    setSlideAutoPlayDrawnSeconds(key, null);
}

function schedule(runner: AutoPlayRunnerType) {
    const key = runner.key;
    // Claim the slot BEFORE the delay is worked out: reading a clip's length
    // is asynchronous, and a stop or a re-schedule arriving during that read
    // has to be able to cancel this one. Identity is the test -- a later
    // schedule replaces the entry, so this one finds its own gone.
    const running: RunningType = { signature: runner.signature, timerId: null };
    runningMap.set(key, running);
    Promise.resolve()
        .then(() => {
            return runner.getDelaySeconds();
        })
        .then((delaySeconds) => {
            if (runningMap.get(key) !== running) {
                return;
            }
            if (!(delaySeconds > 0)) {
                stop(key);
                return;
            }
            // Each tick is scheduled after the last one has RUN, never on a
            // fixed interval: putting a picture up decodes it and redraws the
            // screen, and on the machines this app is built for that can
            // outlast the interval -- `setInterval` would then fire again the
            // moment the tick returned and the show would stutter instead of
            // resting on each slide.
            running.timerId = setTimeout(async () => {
                let isAlive = false;
                try {
                    isAlive = await runner.tick();
                } catch (error) {
                    handleError(error);
                }
                // The timer may have been replaced or stopped while the tick
                // ran.
                if (runningMap.get(key) !== running) {
                    return;
                }
                runningMap.delete(key);
                if (isAlive) {
                    schedule(runner);
                    return;
                }
                setSlideAutoPlayDueAt(key, null);
                setSlideAutoPlayDrawnSeconds(key, null);
                runner.onEnded?.();
            }, delaySeconds * 1000);
            setSlideAutoPlayDueAt(key, Date.now() + delaySeconds * 1000);
            setSlideAutoPlayDrawnSeconds(key, delaySeconds);
        })
        .catch((error) => {
            handleError(error);
            stop(key);
        });
}

/**
 * Makes the running timers match `runners`: anything missing is stopped,
 * anything new is started, and one whose rules are unchanged is LEFT ALONE.
 *
 * `checkIsOwnKey` is what keeps three surfaces -- the foreground widgets, the
 * two background lists and anything added later -- out of each other's way.
 * They reconcile independently and none of them can see the others' shows, so
 * without a scope the first one to render would stop every timer it did not
 * recognise, which is every timer but its own.
 */
export function applyAutoPlayRunners(
    runners: AutoPlayRunnerType[],
    checkIsOwnKey: (key: string) => boolean = () => {
        return true;
    },
) {
    const wantedKeys = new Set(
        runners.map((runner) => {
            return runner.key;
        }),
    );
    for (const key of Array.from(runningMap.keys())) {
        if (!wantedKeys.has(key) && checkIsOwnKey(key)) {
            stop(key);
        }
    }
    for (const runner of runners) {
        const running = runningMap.get(runner.key);
        if (running !== undefined && running.signature === runner.signature) {
            continue;
        }
        stop(runner.key);
        schedule(runner);
    }
}

/** Test seam: what is running right now. */
export function getRunningAutoPlayKeys() {
    return Array.from(runningMap.keys());
}

export function stopAllAutoPlay() {
    for (const key of Array.from(runningMap.keys())) {
        stop(key);
    }
}
