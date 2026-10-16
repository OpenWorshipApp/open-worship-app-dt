import KeyboardEventListener from '../event/KeyboardEventListener';
import { useAppEffect } from '../helper/appHooks';
import { checkIsTypingTarget } from '../presenting-control/presentingControlShortcutHelpers';
import { nextSlideEventMappers } from './appShortcutMappers';

// Handing the "next" keys to what is being presented, for an operator who is
// holding a presenter remote and cannot click.
//
// Every area that steps a service -- a Presenting Flow window, the slides
// preview, a floating "Slides: ..." preview, Long Text Show's lit part --
// answers Space and the arrows
// only while DOM focus is INSIDE it. That gate has to stay: several of them are
// mounted at once and each one hears every key, so without it they would all
// step together. But one click anywhere else (a Documents row, a screen's
// button, a Bible list) parks focus on that control, and from then on the
// remote did nothing at all, with a projector waiting and nothing but a mouse
// to bring it back.
//
// So the areas NAME themselves here, and one listener moves focus for them:
//
// - nobody holds the keyboard (`<body>`): the first press goes to the area
//   that has a selected element, and that press steps it;
// - something else holds it: the same press three times in quick succession --
//   what a person does anyway when a remote does nothing -- hands the keys
//   over. That third press only FOCUSES, so a hand-over nobody meant never
//   changes what a screen is showing.
//
// The areas' own gates are untouched. This only ever moves focus BEFORE they
// are asked, which is why it listens on the capture phase: the app's keyboard
// stack runs its listeners newest-first and stops at the first one that
// prevents the default, so a listener registered there would see a press or
// miss it depending on what happened to mount after it.

// Which area takes the keys when more than one has a selected element. A run
// sheet is what the operator opened to run the service from, so it outranks
// the document they were merely looking at. Long Text Show comes last: it was
// added after that order was chosen, and placed so as not to change it.
export const KEYING_AREA_PRIORITY = {
    presentingFlow: 0,
    slides: 1,
    slidesPopup: 2,
    longText: 3,
} as const;

export type KeyingAreaType = {
    priority: number;
    getElement: () => HTMLElement | null;
    // Whether a press would MOVE something here: a run cursor, or a slide of
    // this document live on a screen. Asked on a key press only, so it must be
    // an answer already in memory -- never a read or a parse.
    checkHasSelected: () => boolean;
};

const TAKE_OVER_PRESS_COUNT = 3;
const TAKE_OVER_WINDOW_MILLISECOND = 1500;

// One entry per MOUNTED area, taken out again by the function `register`
// returns -- a handful at most, and nothing outlives its component.
const keyingAreas: KeyingAreaType[] = [];
// The presses nothing answered, oldest first. Never longer than the count
// above: it is emptied the moment it gets there.
const pressTimeStamps: number[] = [];

// Bare keys only -- the list is the same object the slides and the run sheet
// bind, so a key added there is a key a remote can hand over with.
const nextKeySet = new Set(
    nextSlideEventMappers.map((eventMapper) => {
        return eventMapper.key;
    }),
);

export function registerKeyingArea(keyingArea: KeyingAreaType) {
    keyingAreas.push(keyingArea);
    return () => {
        const index = keyingAreas.indexOf(keyingArea);
        if (index > -1) {
            keyingAreas.splice(index, 1);
        }
    };
}

// A collapsed floating widget keeps no body and a hidden pane unmounts, so a
// registered area is nearly always drawn -- but one inside a tab that is merely
// hidden cannot take focus, and `focus()` on it fails without a word.
function checkIsFocusable(element: HTMLElement) {
    if (!element.isConnected) {
        return false;
    }
    return (
        typeof element.checkVisibility !== 'function' ||
        element.checkVisibility()
    );
}

// How far up the floating stack this element's widget is, or -1 for one that
// is docked. `FloatingWidgetComp` writes the offset on its own root, and the
// widget pressed last holds the highest.
function getFloatingOffset(element: HTMLElement) {
    const widget = element.closest<HTMLElement>('.floating-widget');
    if (widget === null) {
        return -1;
    }
    const offset = Number.parseInt(
        widget.style.getPropertyValue('--floating-widget-z-offset'),
    );
    return Number.isNaN(offset) ? 0 : offset;
}

// Two areas of ONE kind: two run sheets open side by side, or the panes of a
// Stage Previewer over the same document. The widget on top is the one the
// operator touched last; docked panes fall back to the first in the document,
// the rule `getContainerDiv()` already applies to an unowned keyboard.
function checkIsAhead(element: HTMLElement, otherElement: HTMLElement) {
    const offset = getFloatingOffset(element);
    const otherOffset = getFloatingOffset(otherElement);
    if (offset !== otherOffset) {
        return offset > otherOffset;
    }
    return (
        (element.compareDocumentPosition(otherElement) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
    );
}

/**
 * The area the keys should go to: the highest-ranked one that has a selected
 * element, or null when none has -- there is then nothing a press could move,
 * and focus is left where the operator put it.
 */
export function findKeyingAreaElementToFocus() {
    let foundPriority = Number.POSITIVE_INFINITY;
    let foundElement: HTMLElement | null = null;
    for (const keyingArea of keyingAreas) {
        if (keyingArea.priority > foundPriority) {
            continue;
        }
        const element = keyingArea.getElement();
        if (
            element === null ||
            !checkIsFocusable(element) ||
            !keyingArea.checkHasSelected()
        ) {
            continue;
        }
        if (
            foundElement === null ||
            keyingArea.priority < foundPriority ||
            checkIsAhead(element, foundElement)
        ) {
            foundPriority = keyingArea.priority;
            foundElement = element;
        }
    }
    return foundElement;
}

function findFocusedKeyingArea(activeElement: Element | null) {
    if (activeElement === null) {
        return null;
    }
    for (const keyingArea of keyingAreas) {
        if (keyingArea.getElement()?.contains(activeElement)) {
            return keyingArea;
        }
    }
    return null;
}

// The focused control uses this key ITSELF: a field being typed into, a slider
// or a radio group the arrows move, a player they seek. Three quick presses on
// one of those are somebody working at the desk, not a remote going unanswered.
function checkIsKeyUsedByTarget(event: KeyboardEvent) {
    if (checkIsTypingTarget(event)) {
        return true;
    }
    const element =
        event.target instanceof Element ? event.target : document.activeElement;
    if (element === null) {
        return false;
    }
    const { tagName } = element;
    if (tagName === 'VIDEO' || tagName === 'AUDIO') {
        return true;
    }
    if (tagName === 'INPUT') {
        const { type } = element as HTMLInputElement;
        return type === 'range' || type === 'radio';
    }
    return false;
}

// Whether this press made it three inside the window. Emptied when it did, so
// a fourth press starts counting again instead of handing over twice.
function checkIsTakeOverPress(timeStamp: number) {
    const fromTimeStamp = timeStamp - TAKE_OVER_WINDOW_MILLISECOND;
    while (pressTimeStamps.length > 0 && pressTimeStamps[0] <= fromTimeStamp) {
        pressTimeStamps.shift();
    }
    pressTimeStamps.push(timeStamp);
    if (pressTimeStamps.length < TAKE_OVER_PRESS_COUNT) {
        return false;
    }
    pressTimeStamps.length = 0;
    return true;
}

export function forgetKeyingAreaPresses() {
    pressTimeStamps.length = 0;
}

/**
 * One key press, before anything else in the window has seen it.
 *
 * Answers whether the press was SPENT on a hand-over -- the one case in which
 * it is taken away from the app.
 */
export function handleKeyingAreaKeyDown(event: KeyboardEvent) {
    // Every other key in the app comes through here too, typing included, so
    // the first test is the one that costs nothing.
    if (!nextKeySet.has(event.key)) {
        return false;
    }
    if (
        event.repeat ||
        event.defaultPrevented ||
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey
    ) {
        return false;
    }
    // A modal, a context menu or an armed presenting tool holds the keyboard,
    // and the areas' own keys are silent behind it for the same reason.
    if (KeyboardEventListener.getLastLayer() !== 'root') {
        return false;
    }
    if (checkIsKeyUsedByTarget(event)) {
        return false;
    }
    const { activeElement } = document;
    // It will answer this press itself. Counting it would let an operator
    // stepping quickly through a song be pulled off it onto the run sheet.
    if (findFocusedKeyingArea(activeElement)?.checkHasSelected()) {
        forgetKeyingAreaPresses();
        return false;
    }
    if (activeElement === null || activeElement === document.body) {
        // Nobody holds the keyboard, so there is nothing to take it FROM: the
        // area gets it at once and the press goes on to step it. With no area
        // to name, the slides preview claims it the way it always has.
        forgetKeyingAreaPresses();
        findKeyingAreaElementToFocus()?.focus({ preventScroll: true });
        return false;
    }
    if (!checkIsTakeOverPress(event.timeStamp)) {
        return false;
    }
    const element = findKeyingAreaElementToFocus();
    if (element === null) {
        return false;
    }
    // Spent on the hand-over. Left to carry on, it would step the area that
    // has just been given focus -- and whatever held focus until now (a
    // button, a row's menu) would still be pressed by it.
    event.preventDefault();
    event.stopPropagation();
    // `preventScroll`: the list must not jump under the operator just because
    // a key arrived.
    element.focus({ preventScroll: true });
    return true;
}

/**
 * Listen for the hand-over for as long as the caller is mounted. ONE per
 * window: the Presenter page, the only place these keys step anything.
 */
export function useKeyingAreaTakeOver() {
    useAppEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            handleKeyingAreaKeyDown(event);
        };
        globalThis.addEventListener('keydown', handleKeyDown, true);
        return () => {
            globalThis.removeEventListener('keydown', handleKeyDown, true);
            forgetKeyingAreaPresses();
        };
    }, []);
}
