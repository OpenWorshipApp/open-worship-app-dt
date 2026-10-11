import appProvider from '../server/appProvider';

/**
 * What a screen drawing several slides shares, whatever draws them: how a
 * drawn thing is told from another one, and the order a layout is moved into
 * the next one in.
 */

// How long a slide takes from one box to the next.
export const STAGE_MOVE_MILLISECOND = 500;
// `all`, as asked for: a box moves by its left/top/width/height, the slide in
// it by its scale, a count by its font size -- each one only a style changed.
export const STAGE_MOVE_TRANSITION = `all ${STAGE_MOVE_MILLISECOND}ms ease`;

/**
 * The id of something a screen draws: the md5 of the data it is drawn from.
 * Two things with one id are drawn the same, so the one already on screen is
 * never drawn again -- it has its style changed to where the next layout
 * wants it (asked for by the user: "all components rendered in screen should
 * have unique id (md5 for data), so it should just change style rather than
 * rendered").
 */
export function genRenderId(data: unknown) {
    return appProvider.systemUtils.generateMD5(
        typeof data === 'string' ? data : JSON.stringify(data),
    );
}

// On the element itself, so what a screen holds can be read off its DOM.
export function setRenderId(element: HTMLElement, renderId: string | null) {
    if (renderId === null) {
        delete element.dataset.renderId;
        return;
    }
    element.dataset.renderId = renderId;
}

export type StageMoveStateType = {
    // What is to be added once the things on screen have moved.
    pending: { timer: ReturnType<typeof setTimeout>; add: () => void } | null;
};

/**
 * What a move before this one was still to add is due now: one of those is
 * what a quick second press moves. Called before a move pairs what is on
 * screen with what the next layout draws.
 */
export function flushStageMove(state: StageMoveStateType) {
    if (state.pending === null) {
        return;
    }
    clearTimeout(state.pending.timer);
    state.pending.add();
}

/**
 * One move, in the order the user asked for it:
 *
 * 1. `remove` takes out what leaves, all of it, before anything moves;
 * 2. `restyle` changes the style of what stays, and says whether any of it
 *    has somewhere to go;
 * 3. `add` puts in what comes, once those have arrived -- what comes is drawn
 *    where something else has just left.
 */
export function runStageMove(
    root: HTMLElement,
    state: StageMoveStateType,
    steps: {
        remove: () => void;
        restyle: () => boolean;
        add: (() => void) | null;
    },
) {
    steps.remove();
    // Lays the stage out with the leaving things gone, so what follows is a
    // change of style the browser animates, never part of the same step.
    root.getBoundingClientRect();
    const isMoving = steps.restyle();
    const { add } = steps;
    if (add === null) {
        return;
    }
    const addComing = () => {
        state.pending = null;
        // The layout may have been cut away meanwhile.
        if (root.isConnected) {
            add();
        }
    };
    if (isMoving) {
        state.pending = {
            timer: setTimeout(addComing, STAGE_MOVE_MILLISECOND),
            add: addComing,
        };
    } else {
        addComing();
    }
}
