/**
 * A windowed list's off-screen rows have no DOM, so anything that finds an
 * item by querying the document -- the new-file flash, "Reveal Original", a
 * slide show following what it is presenting, a run player stepping onto the
 * next slide, the agent's `owa_find_ui` -- has to ask the list to bring it
 * into range FIRST.
 *
 * Every mounted virtual list registers one revealer. The set holds the lists
 * currently on screen and nothing else: a list removes its own on unmount.
 */

/** True when this list HOLDS `key` -- whether or not it had to scroll for it. */
export type VirtualRevealerType = (key: string) => boolean;

const revealerSet = new Set<VirtualRevealerType>();

// Polled on a timer rather than per frame: an occluded window runs no
// `requestAnimationFrame` at all, and a run player stepped by a keyboard
// shortcut while the operator looks at the projector is exactly that window.
//
// A turn has to be long enough for the list to answer: a re-aimed scroll costs
// a React commit, then the measuring pass, then another commit before the row
// it was aimed at exists. The budget is the two multiplied -- generous,
// because it is only ever spent on a row that is NOT on screen, and a jump
// across a thousand lines that gives up half way is worse than one that takes
// a moment.
const REVEAL_POLL_DELAY = 40;
const MAX_REVEAL_POLL_COUNT = 40;

export function registerVirtualReveal(revealer: VirtualRevealerType) {
    revealerSet.add(revealer);
    return () => {
        revealerSet.delete(revealer);
    };
}

/**
 * Asks every mounted virtual list to scroll `key` into view. True when any of
 * them holds it -- and by then the row is on its way, so a `querySelector` for
 * it can succeed once React has drawn the new range. EVERY list is asked, not
 * the first that answers: two panels can list the same folder, and stopping at
 * one scrolled whichever registered first rather than the one the caller's
 * selector is about to find.
 */
export function revealVirtualItem(key: string) {
    let isRevealed = false;
    for (const revealer of revealerSet) {
        isRevealed = revealer(key) || isRevealed;
    }
    return isRevealed;
}

function waitAMoment() {
    return new Promise((resolve) => {
        setTimeout(resolve, REVEAL_POLL_DELAY);
    });
}

/**
 * Waits for an element a reveal has just asked for, since a revealed row only
 * exists a React commit later.
 *
 * `key` is re-asked on every turn rather than once, because a list whose rows
 * are not all one height AIMS at where it currently believes the row to be:
 * the rows the first scroll brings into view are then measured for real, every
 * row after them moves by the difference, and the target slides out from under
 * the scroll that was aimed at it. Re-asking closes that gap in a few turns --
 * each one only has to absorb the error of the screenful it just drew.
 *
 * Bounded either way: a key a list claims to hold but never draws must not
 * leave a caller waiting for ever.
 */
export async function waitForVirtualElement(
    getElement: () => Element | null,
    key?: string,
) {
    for (let count = 0; count < MAX_REVEAL_POLL_COUNT; count++) {
        const element = getElement();
        if (element !== null) {
            return element;
        }
        await waitAMoment();
        if (key !== undefined) {
            revealVirtualItem(key);
        }
    }
    return getElement();
}

/**
 * The element of a windowed item, brought into range if it was not drawn.
 *
 * Revealing an item is a state change, so its row exists a React commit later
 * -- a caller that needs the element ITSELF (to click it, to measure it) has
 * to wait for that commit rather than read the DOM straight after asking.
 *
 * Gives up at once when no mounted list holds the key: that is the ordinary
 * "it is simply not there" answer, and a caller on a keyboard path must not be
 * made to wait a third of a second for it.
 */
export async function revealVirtualElement(
    key: string,
    getElement: () => Element | null,
) {
    const element = getElement();
    if (element !== null) {
        return element;
    }
    if (!revealVirtualItem(key)) {
        return null;
    }
    return await waitForVirtualElement(getElement, key);
}
