import { useSyncExternalStore } from 'react';

import { tran } from '../lang/langHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { toPresentingFlowActionDueTime } from './presentingFlowActionTimeHelpers';
import type PresentingFlowItem from './PresentingFlowItem';

/**
 * The run sheet moving itself on.
 *
 * Two shapes, and they differ ONLY in what the RUN MOVING does to them — never in
 * what the operator's hands do generally:
 * - a TIMEOUT counts down once and then forces the run forward — from a count of
 *   seconds, or down to a TIME OF DAY (`startPresentingFlowAutoNextAtTime`), which is
 *   the same one-shot clock read off the wall instead of off a stopwatch. It is
 *   cancelled by the run's SELECTION CHANGING, i.e. by the operator going
 *   somewhere themselves — the only thing that means "I have taken over". Clicking
 *   a background, a button, or anything else that is not the run moving leaves it
 *   counting — an unintended click must not silently kill the wait.
 * - an INTERVAL keeps forcing the run forward every N seconds, and a selection
 *   change RESTARTS its count instead of ending it: an operator who steps ahead
 *   by hand gets the full interval on the line they landed on, not whatever was
 *   left of the last one. It ends by its own button, or with the run.
 *
 * A TIMEOUT going off while an INTERVAL is running is the one crossing between
 * them, and it does NOT replace it — see `borrowPresentingFlowAutoNextCycle`.
 *
 * ONE slot PER OPEN RUN, exactly like the preview's own cursor: a floating
 * preview is one run being walked, and several of them may be open at once — a
 * pre-service loop ticking in one sheet must go on ticking while the operator
 * steps through another. Held in memory only — this is where a run has got to
 * right now, not something to restore later — for exactly as long as that run's
 * widget is open, and a ticking timer exists only while something is armed.
 */

export type PresentingFlowAutoNextModeType = 'timeout' | 'interval';

export type PresentingFlowAutoNextStateType = {
    mode: PresentingFlowAutoNextModeType;
    /** What it was armed with, which an interval counts down from again. */
    seconds: number;
    remainingSeconds: number;
    /**
     * When it is due, for one armed with a TIME OF DAY rather than with a number
     * of seconds — null for the ordinary kind. An INTERVAL carrying one is a
     * BORROWED cycle and nothing else (`borrowPresentingFlowAutoNextCycle`), so it is
     * dropped the moment that cycle ends.
     *
     * A countdown to 7:05 may be hours long, and 1000ms ticks that each subtract
     * a second would be minutes out by the end of it (a laptop that sleeps mid-
     * countdown, worse still). So the wall clock is the truth while this is set
     * and each tick merely RE-READS the remainder from it; the ticking exists to
     * redraw the pill, not to keep the count.
     */
    dueTime: number | null;
    /**
     * HELD where it is, by the pill's own button — the count frozen and the
     * ticking stopped outright rather than ticking against a flag (a run sheet
     * left paused must cost nothing on the machines this app is for).
     *
     * The one thing every clock needs and neither had: a service runs late, a
     * speaker overruns, and the answer to "not yet" was to lose the countdown
     * and re-arm it afterwards. Stopping is still its own button — pausing says
     * "in a moment", stopping says "not at all".
     */
    isPaused: boolean;
};

/**
 * How the run is DRIVEN, registered by the ONE thing that can drive it: the
 * floating preview, which holds the list, the cursor and the loaded slides. A
 * registration rather than an implementation here — nothing in this module may
 * keep a run sheet (or a document's slides) alive.
 */
export type PresentingFlowRunControllerType = {
    /**
     * Move the run on one place and fire what it lands on. `false` when it could
     * not move — the end of the sheet — which is what stops an interval ticking
     * against it forever.
     */
    stepForward: () => boolean;
    /**
     * Point the run at the LISTED element with this uuid — what a `Jump to` is
     * armed with — and fire it. `false` when nothing in the sheet answers to it,
     * so the caller can say so instead of looking like it moved.
     */
    jumpToUuid: (uuid: string) => boolean;
};

/**
 * Everything ONE open run holds: how it is driven, what it has armed, and the
 * timer counting that down.
 *
 * The entry exists for exactly as long as the widget's controller is registered,
 * so nothing here can outlive the preview it belongs to — closing a run drops its
 * clock, its timer and its entry together.
 */
type PresentingFlowRunStateType = {
    controller: PresentingFlowRunControllerType;
    autoNextState: PresentingFlowAutoNextStateType | null;
    tickingId: any;
    // Bumped by every start and stop, so a step that arms something new (a run
    // that walks straight onto another auto-next element) is not undone by the
    // tick it was fired from.
    generation: number;
};

const runStateMap = new Map<string, PresentingFlowRunStateType>();

// ONE listener set for every open run: a widget's snapshot is its own file's
// state, and a notification it has no interest in compares identical and
// re-renders nothing.
const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) {
        listener();
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * What is armed on THIS presenting flow right now, or null. The object is
 * replaced only when something actually changes, so `useSyncExternalStore` can
 * compare it by identity.
 */
export function usePresentingFlowAutoNext(filePath: string) {
    const getSnapshot = () => {
        return runStateMap.get(filePath)?.autoNextState ?? null;
    };
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getPresentingFlowAutoNextState(filePath: string) {
    return runStateMap.get(filePath)?.autoNextState ?? null;
}

/**
 * The run went somewhere — the ONE thing either clock answers to.
 *
 * Called by the preview's cursor itself (`presentingFlowPreviewFloatingHelpers`), so
 * "the operator took over" means exactly what the panel means by it: the run is
 * on another element, or on another slide of the one it was on. Nothing else
 * counts — a click on a background, on a foreground button, on the widget's own
 * chrome, is not the run moving and must leave a countdown alone.
 *
 * Named with the presenting flow whose cursor moved: stepping one open sheet says
 * nothing about the clock another one is counting.
 *
 * Safe to call from the clock's OWN step: a timeout has already stopped itself by
 * then, and an interval restarting the count it has just reset writes the same
 * number back.
 */
export function notifyPresentingFlowRunSelectionChanged(filePath: string) {
    const runState = runStateMap.get(filePath);
    const current = runState?.autoNextState;
    if (runState === undefined || current === undefined || current === null) {
        return;
    }
    if (current.mode === 'timeout') {
        stopPresentingFlowAutoNext(filePath);
        return;
    }
    // `dueTime` as well as the count: a BORROWED cycle is given up here too, the
    // operator having gone somewhere themselves.
    if (
        current.remainingSeconds === current.seconds &&
        current.dueTime === null
    ) {
        return;
    }
    runState.autoNextState = {
        ...current,
        remainingSeconds: current.seconds,
        dueTime: null,
    };
    notify();
}

/**
 * Where the run is stepped from, for as long as the preview is open on this
 * presenting flow. Unregistering ENDS whatever is armed: the widget closing is the
 * run being over, and a timer that outlived it would step a list nothing is
 * looking at.
 */
export function registerPresentingFlowRunController(
    filePath: string,
    controller: PresentingFlowRunControllerType,
) {
    // Whatever the registration being replaced had ticking goes with it — the
    // entry below is a fresh run, and an orphaned interval would step it.
    stopPresentingFlowAutoNext(filePath);
    runStateMap.set(filePath, {
        controller,
        autoNextState: null,
        tickingId: null,
        generation: 0,
    });
    return () => {
        // Only if it is still ours: a re-register from the widget that replaced
        // this one must not be dropped by our cleanup.
        if (runStateMap.get(filePath)?.controller !== controller) {
            return;
        }
        stopPresentingFlowAutoNext(filePath);
        runStateMap.delete(filePath);
    };
}

/** The open run on THIS presenting flow, or null — what every trigger goes through. */
function findPresentingFlowRunController(filePath: string) {
    return runStateMap.get(filePath)?.controller ?? null;
}

/** Whether a run is open on this presenting flow at all — what a trigger needs. */
export function checkPresentingFlowAutoNextIsRunnable(filePath: string) {
    return runStateMap.has(filePath);
}

// Always from a whole second, so a count that has just been (re-)armed is not
// short by whatever was left of the tick it landed in.
function restartTicking(
    filePath: string,
    runState: PresentingFlowRunStateType,
) {
    if (runState.tickingId !== null) {
        clearInterval(runState.tickingId);
    }
    runState.tickingId = setInterval(() => {
        handleTicking(filePath);
    }, 1000);
}

function clearTicking(runState: PresentingFlowRunStateType) {
    if (runState.tickingId !== null) {
        clearInterval(runState.tickingId);
        runState.tickingId = null;
    }
}

export function stopPresentingFlowAutoNext(filePath: string) {
    const runState = runStateMap.get(filePath);
    if (runState === undefined) {
        return;
    }
    clearTicking(runState);
    runState.generation += 1;
    if (runState.autoNextState === null) {
        return;
    }
    runState.autoNextState = null;
    notify();
}

/**
 * A TIMEOUT that goes off while an INTERVAL is running LENDS it its count for one
 * cycle rather than replacing it: an interval at 5 that meets a `Next: Timeout
 * (7)` counts 7 this once, then goes back to 5, 5, 5.
 *
 * The one crossing between the two clocks, and the only exception to "an operator
 * who fires a second one is saying `this instead`". A timeout is nearly always
 * met as a CC riding along with a line the run is showing anyway — "hold this one
 * a little longer" — and killing the loop that is walking the sheet is the
 * opposite of what that says. Firing an INTERVAL is still a re-arm, since that is
 * an operator naming the sheet's own pace.
 *
 * Answers whether it borrowed. The ticking is restarted rather than left alone so
 * the borrowed count gets its whole first second; `seconds` is untouched, which is
 * what the interval counts from again once this cycle is spent, and `dueTime`
 * rides along for a timeout armed with a time of day — an interval carrying one
 * is a borrowed cycle by definition.
 */
function borrowPresentingFlowAutoNextCycle(
    filePath: string,
    runState: PresentingFlowRunStateType,
    mode: PresentingFlowAutoNextModeType,
    seconds: number,
    dueTime: number | null,
) {
    const current = runState.autoNextState;
    if (current === null || mode !== 'timeout' || current.mode !== 'interval') {
        return false;
    }
    runState.autoNextState = {
        ...current,
        remainingSeconds: seconds,
        dueTime,
    };
    // Not while HELD: the operator stopped this run walking itself, and a line
    // going up with a timeout attached is not them letting it go again.
    if (!current.isPaused) {
        restartTicking(filePath, runState);
    }
    notify();
    return true;
}

/**
 * Hold the clock where it is, or let it go again.
 *
 * A paused countdown gives up its `dueTime`: holding a "go on at 7:05" means the
 * run waits that many more seconds from when it is let go, not that the hour
 * comes round regardless — which is the whole of what an operator means by
 * pausing while a speaker overruns. The remainder is already re-read to the
 * second on every tick, so freezing it loses nothing.
 *
 * Ticking is CLEARED rather than made to skip: a run sheet left paused must cost
 * nothing at all.
 */
export function setPresentingFlowAutoNextPaused(
    filePath: string,
    isPaused: boolean,
) {
    const runState = runStateMap.get(filePath);
    const current = runState?.autoNextState;
    if (
        runState === undefined ||
        current === undefined ||
        current === null ||
        current.isPaused === isPaused
    ) {
        return;
    }
    if (isPaused) {
        clearTicking(runState);
        runState.autoNextState = { ...current, isPaused: true, dueTime: null };
    } else {
        runState.autoNextState = { ...current, isPaused: false };
        restartTicking(filePath, runState);
    }
    notify();
}

/**
 * Arm the run to move itself on, replacing whatever THIS run had armed before:
 * one run has one clock, and an operator who fires a second one is saying "this
 * instead". The one exception is a timeout met by a running interval — see
 * `borrowPresentingFlowAutoNextCycle`.
 *
 * Refuses when no run is open on THIS presenting flow — a run action clicked in the tree
 * with that sheet's preview closed must say so rather than quietly stepping a
 * list nobody is looking at, or stepping some other sheet that happens to be
 * open.
 */
export function startPresentingFlowAutoNext(
    filePath: string,
    mode: PresentingFlowAutoNextModeType,
    seconds: number,
    dueTime: number | null = null,
) {
    const runState = runStateMap.get(filePath);
    if (runState === undefined || !Number.isFinite(seconds) || seconds <= 0) {
        return false;
    }
    // After the guard above, so a timeout with nothing valid to count leaves the
    // interval running on its own count rather than borrowing a nonsense one.
    if (
        borrowPresentingFlowAutoNextCycle(
            filePath,
            runState,
            mode,
            seconds,
            dueTime,
        )
    ) {
        return true;
    }
    stopPresentingFlowAutoNext(filePath);
    runState.autoNextState = {
        mode,
        seconds,
        remainingSeconds: seconds,
        dueTime,
        isPaused: false,
    };
    restartTicking(filePath, runState);
    runState.generation += 1;
    notify();
    return true;
}

/**
 * End a running INTERVAL — and ONLY an interval — which is what a
 * `Next: Clear Interval` line does.
 *
 * The loop's off switch as a line of the sheet. An interval ends by its own
 * button or with the run, and neither is available to a sheet that has to walk
 * itself: "loop these four slides, then stop looping and wait for me" could not
 * be written at all, since the one thing an interval does not answer to is the
 * run moving.
 *
 * A TIMEOUT is deliberately left alone. It is a one-shot that the run moving
 * cancels by itself, and it is nearly always a CC riding a line that is being
 * shown ("hold this one a little longer") — killing that from a line named after
 * the interval would leave a sheet that says it stops a loop silently stopping a
 * wait as well, and an unattended sheet with its clock gone never moves again. A
 * PAUSED interval is still an interval and is ended; a BORROWED cycle goes with
 * the interval that borrowed it.
 *
 * Answers whether there is a run to act on at all — NOT whether it stopped
 * anything: an interval that was not running is already the state this asks for,
 * and a toast fired mid-service to say so would be noise. This is the same
 * reason `Screen: Show` is silent on an already-showing screen.
 */
export function stopPresentingFlowAutoNextInterval(filePath: string) {
    const runState = runStateMap.get(filePath);
    if (runState === undefined) {
        return false;
    }
    if (runState.autoNextState?.mode === 'interval') {
        stopPresentingFlowAutoNext(filePath);
    }
    return true;
}

/**
 * Arm a TIMEOUT to end at a time of day instead of after a count of seconds —
 * "go on at 7:05", which is how the start of a service is actually described.
 *
 * Answers with the message to toast, or null when it was armed: the shape every
 * `start` answers in. A time that has already gone by is REFUSED and said out
 * loud rather than rolled over to tomorrow — see `toPresentingFlowActionDueTime`.
 *
 * Only a timeout: an interval that ends at a fixed time of day would be a
 * countdown wearing an interval's badge, since it could repeat exactly once.
 */
export function startPresentingFlowAutoNextAtTime(
    filePath: string,
    time: string,
) {
    if (!checkPresentingFlowAutoNextIsRunnable(filePath)) {
        return 'Open the presenting flow preview to use this action';
    }
    const dueTime = toPresentingFlowActionDueTime(time, Date.now());
    if (dueTime === null) {
        return 'The set time is already due';
    }
    const seconds = Math.ceil((dueTime - Date.now()) / 1000);
    return startPresentingFlowAutoNext(filePath, 'timeout', seconds, dueTime)
        ? null
        : 'Open the presenting flow preview to use this action';
}

/**
 * The remainder as the pill shows it: bare seconds under a minute, `m:ss`, then
 * `h:mm:ss`. A countdown to a time of day is routinely thousands of seconds, and
 * a five-digit number in a pill says nothing an operator can read at a glance.
 */
export function toPresentingFlowAutoNextCountdownLabel(
    remainingSeconds: number,
) {
    if (remainingSeconds < 60) {
        return `${remainingSeconds}`;
    }
    const pad = (value: number) => {
        return `${value}`.padStart(2, '0');
    };
    const seconds = remainingSeconds % 60;
    const minutes = Math.floor(remainingSeconds / 60) % 60;
    const hours = Math.floor(remainingSeconds / 3600);
    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${minutes}:${pad(seconds)}`;
}

/**
 * Fire a run-action ELEMENT — the one funnel for every way one can go off: the
 * row click, the preview's button, the next-key, its own menu entry, and a
 * TIMEOUT attached to another line as a CC.
 *
 * Lives here rather than in `presentingFlowHelpers` because both of those callers must
 * reach it and `presentingFlowCcApplyHelpers` may not import back into
 * `presentingFlowHelpers` — this module is under both of them and takes `PresentingFlowItem`
 * as a TYPE only, so nothing is added to the cycle either way.
 *
 * A sheet whose own preview is not open is told, not swallowed: an operator whose
 * countdown did not start has to know it did not start, and another sheet's open
 * run is not an answer to it.
 */
export function firePresentingFlowRunAction(
    presentingFlowItem: PresentingFlowItem,
) {
    const runAction = presentingFlowItem.runAction;
    if (runAction === null) {
        return;
    }
    const message = runAction.start(presentingFlowItem);
    if (message !== null) {
        // Titled with the action's own label rather than one generic heading:
        // "nothing to jump to" under `Jump to` says which line of the sheet is
        // unfinished, which is the whole point of saying anything.
        showSimpleToast(tran(runAction.label), tran(message));
    }
}

/**
 * Send the run to the element a `Jump to` is armed with.
 *
 * Answers with the message to toast, or null when it moved — the shape every
 * `start` answers in.
 *
 * The target is found by UUID, exactly as every other CC is resolved: a CC names
 * one line of the sheet and nothing else can answer to it, so two identical-
 * looking lines are no longer a guess.
 */
export function jumpPresentingFlowRunToCcItem(
    presentingFlowFilePath: string,
    ccItem: PresentingFlowItem,
) {
    const controller = findPresentingFlowRunController(presentingFlowFilePath);
    if (controller === null) {
        return 'Open the presenting flow preview to use this action';
    }
    const { uuid } = ccItem;
    if (uuid === null || !controller.jumpToUuid(uuid)) {
        return 'The element to jump to is not in this presenting flow';
    }
    return null;
}

function handleTicking(filePath: string) {
    const runState = runStateMap.get(filePath);
    const current = runState?.autoNextState;
    if (runState === undefined || current === undefined || current === null) {
        return;
    }
    // One armed with a time of day is RE-READ from the wall clock; the ordinary
    // kind counts itself down.
    const remainingSeconds =
        current.dueTime === null
            ? current.remainingSeconds - 1
            : Math.ceil((current.dueTime - Date.now()) / 1000);
    if (remainingSeconds > 0) {
        if (remainingSeconds !== current.remainingSeconds) {
            runState.autoNextState = { ...current, remainingSeconds };
            notify();
        }
        return;
    }
    // Reaching zero. The slot is settled BEFORE the run is stepped — a timeout
    // is spent, an interval starts its next count — so the panel never draws a
    // stale `0`, and so an action the step lands on can take the slot over.
    if (current.mode === 'timeout') {
        stopPresentingFlowAutoNext(filePath);
    } else {
        // Back to the interval's OWN count, and off any wall clock a borrowed
        // cycle was counting to — that cycle is spent.
        runState.autoNextState = {
            ...current,
            remainingSeconds: current.seconds,
            dueTime: null,
        };
        notify();
    }
    const steppedGeneration = runState.generation;
    const isStepped = runState.controller.stepForward();
    // The run may have been closed by what the step fired, taking its entry with
    // it — anything still armed went with it too.
    if (
        isStepped ||
        runStateMap.get(filePath) !== runState ||
        runState.generation !== steppedGeneration
    ) {
        return;
    }
    // The end of the run sheet: an interval has nothing left to step, so it
    // stops itself rather than ticking against the last element for good.
    stopPresentingFlowAutoNext(filePath);
}
