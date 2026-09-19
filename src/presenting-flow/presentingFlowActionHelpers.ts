import type ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type ScreenManager from '../_screen/managers/ScreenManager';
import { applyScreenSlideMediaControl } from '../_screen/managers/screenSlideMediaControlHelpers';
import type { ForegroundDragTargetType } from '../presenter-foreground/foregroundDragHelpers';
import {
    jumpPresentingFlowRunToCcItem,
    startPresentingFlowAutoNext,
    startPresentingFlowAutoNextAtTime,
    stopPresentingFlowAutoNextInterval,
} from './presentingFlowAutoNextHelpers';
// A TYPE only: `PresentingFlowItem` imports this module for its values, so anything
// else here would close that cycle.
import type PresentingFlowItem from './PresentingFlowItem';

/**
 * A run sheet holds things to SHOW, and — with this — things to DO.
 *
 * This is the registry of everything the "Add Action" menu offers. It holds two
 * families, and the split is what an action ACTS ON:
 * - a SCREEN action does something to a screen (clearing what is on it, or
 *   putting the screen itself up and down) — it is run on the screens the entry
 *   resolves to, exactly where content would have been shown;
 * - a RUN action does something to the RUN ITSELF rather than to a screen. It
 *   only means anything while a run is open — the floating preview — which is
 *   why it refuses (with a toast) rather than pretending from anywhere else.
 *   Only one of them reaches a screen at all, and then only through what is
 *   attached to it: a `Keyboard Event` is a line the operator aims a shortcut
 *   at, and what goes up is its CC elements.
 *
 * A later action of either family only has to be appended to
 * `presentingFlowActionList`: storage, validation, the row, the preview, the drag and
 * the next-key all read it from here.
 *
 * Stored as its own item type rather than as a `DragTypeEnum`: an action is not
 * draggable content, nothing else in the app produces one, and the drag pipeline
 * must keep refusing it — dropping an "action" on a screen previewer from
 * anywhere but a presenting flow row is meaningless.
 */
export const PRESENTING_FLOW_ACTION_TYPE = 'action';

export type PresentingFlowActionIdType =
    | 'clear-all'
    | 'clear-background'
    | 'clear-slide'
    | 'clear-bible'
    | 'clear-foreground'
    | `clear-foreground-${ForegroundDragTargetType}`
    | 'screen-show'
    | 'screen-hide'
    | 'slide-media-control'
    | 'next-interval'
    | 'next-clear-interval'
    | 'next-timeout'
    | 'jump-to'
    | 'keyboard-event';

type PresentingFlowActionBaseType = {
    /** Stored verbatim in the presenting flow file — never renamed once shipped. */
    id: PresentingFlowActionIdType;
    /** Translated on display, so a run sheet reads in the app's language. */
    label: string;
    /** Short badge shown before the label, the way a slide shows `#id`. */
    badge: string;
    iconName: string;
    color: string;
    /**
     * How many CC elements it may HOST — on the BASE, because both families have
     * entries that host none and the question is asked of an action, never of a
     * family (`PresentingFlowItem.getMaxCcItemCount`).
     *
     * `Infinity` for anything that resolves screens and has work of its own to do
     * there: a clear takes followers exactly as a slide does ("blank the slide
     * and put this background up"). `0` for the ones a follower has no reading
     * under — the clocks, which resolve no screen at all, and `Screen: Show` /
     * `Screen: Hide`, which are about the WINDOW rather than about what is on it:
     * a follower riding a hide would be content pushed onto a screen in the same
     * gesture that darkens it. `1` for a `Jump to`, whose CC names a line instead
     * of following it, and `Infinity` for a `Keyboard Event`, whose CCs are its
     * whole payload.
     */
    ccItemCount: number;
};

export type PresentingFlowScreenActionType = PresentingFlowActionBaseType & {
    target: 'screen';
    /**
     * Whether it may only ever run on the screens it NAMES — its pin
     * (`PresentingFlowItem.screenIds`) — rather than falling back to the selected
     * screens or to the "which screen?" menu.
     *
     * True for `Screen: Show` / `Screen: Hide` alone, and it is why they are the
     * one screen family asked a question before they are added (the way the run
     * family is asked for its seconds): the whole reason they exist is to run
     * with nobody at the machine, and both fallbacks are the operator being
     * there. "The selected screens" is ambient state that whatever they did last
     * has already changed, and a menu waiting for an answer at 7:05 on an
     * unattended sheet is a screen that never goes up at all.
     *
     * A clear is the other way round: it is overwhelmingly fired by hand, on
     * whatever is live at that moment, so making it name a screen up front would
     * be a question asked for nothing.
     */
    requiresScreenIds: boolean;
    /**
     * Whether its own pin FILTERS the screens its host resolved to, instead of
     * replacing them — asked only when it is running as a CC element
     * (`intersectCcScreenIds` vs `resolveCcScreenIds`).
     *
     * True for `Slide: Media Control` alone, and it follows from what the action
     * does rather than from a preference: it acts on the media its HOST just put on
     * a screen, so a pin naming a screen the host did not reach names a screen with
     * no media on it. Replacing there would mean running against an empty screen
     * and reporting nothing.
     *
     * Every other screen action acts on the screen itself and is meaningful wherever
     * it is aimed — "blank screen 2 whatever the slide did" is a sentence — so they
     * keep the ordinary override.
     */
    filtersHostScreenIds: boolean;
    /**
     * Do it.
     *
     * The ENTRY is passed as well as the screen because one action's work depends
     * on what that particular line of the sheet was set to: a `Slide: Media Control`
     * is settings and nothing else. Every other entry ignores it — an action that
     * needed the sheet to decide what to do to a screen would be a design smell,
     * and the fifteen that only clear things read the same as they always did.
     */
    apply: (
        screenManager: ScreenManager,
        presentingFlowItem: PresentingFlowItem,
    ) => void;
};

export type PresentingFlowRunActionType = PresentingFlowActionBaseType & {
    target: 'run';
    /**
     * The number this action is armed with, asked for when it is added and shown
     * in the row's label — or null for one that is armed with something else.
     * Seconds for the two clocks; the label says which, so a later run action is
     * free to mean something else by its number.
     */
    number: { label: string; defaultValue: number } | null;
    /**
     * Whether it may be armed with a TIME OF DAY instead of that number — the
     * same question asked the other way round ("go on AT 7:05", not "go on ten
     * seconds from now").
     *
     * Only the TIMEOUT: it is the one-shot clock, and a time of day is a
     * one-shot instruction. An interval armed with one could repeat exactly
     * once, and a `Jump to` is armed with no number at all.
     */
    canBeTimeArmed: boolean;
    /**
     * Whether it is armed with a KEYBOARD SHORTCUT instead — the third way of
     * answering "when?", and the only one that is not a clock at all: not "in ten
     * seconds" and not "at 7:05" but "when I say".
     *
     * Only the `Keyboard Event`, whose whole existence is that question. It is
     * mutually exclusive with `number` (an action armed with a shortcut is armed
     * with nothing else), which is why the two are read as alternatives
     * everywhere `PresentingFlowActionArmingType` is.
     */
    canBeKeyArmed: boolean;
    /**
     * Whether the CCs it hosts NAME a line rather than follow it.
     *
     * The `Jump to` alone, and the split has to be per-action rather than "is it
     * a run action": a `Keyboard Event`'s CCs are ordinary followers, resolved
     * and applied exactly as a slide's are, while a `Jump to`'s one CC is a
     * pointer that is never applied to anything — which is what lets it name a
     * DOCUMENT, the one thing a follower may never be. Read by
     * `PresentingFlowItem.checkIsCcTargetHost`, and through it by every attach path.
     */
    ccItemsAreTargets: boolean;
    /**
     * Whether it may be ATTACHED to another line as a CC element — the one place
     * a run action can fire without being a line of the run itself.
     *
     * Per-action rather than blanket, because they differ in what happens when
     * the operator does nothing about it. A CC'd TIMEOUT is exactly what a run
     * sheet wants: "show this slide, and go on by yourself ten seconds later",
     * and one press or click takes it back. A CC'd INTERVAL would keep walking
     * the sheet forward from a line that only meant to be shown, and no input
     * stops an interval. A CC'd JUMP would be a line that silently sends the run
     * somewhere else the moment it is shown — and it holds a CC of its own, which
     * a follower may not (one level only).
     */
    canBeCcItem: boolean;
    /**
     * Whether firing it moves the run AT ONCE, rather than some seconds later.
     *
     * The one thing a `Jump to` may not fire when it lands: two jumps aimed at
     * each other would send the run back and forth for ever, with nothing in
     * between to break the chain. A clock is time-separated — a jump landing on
     * one arms it and stops there, which is exactly how a loop is built on
     * purpose (an interval that walks a set of slides, a jump at the end of them
     * pointing back at the interval).
     */
    movesRunAtOnce: boolean;
    /**
     * Fire it. Answers with the message to toast when it could not — a `tran`
     * key, so each one says what is actually missing — or null when it ran.
     */
    start: (presentingFlowItem: PresentingFlowItem) => string | null;
};

export type PresentingFlowActionType =
    PresentingFlowScreenActionType | PresentingFlowRunActionType;

/**
 * What a run action is ARMED with, as the question answers it and as the entry
 * stores it: a count of seconds, a TIME OF DAY, or a keyboard SHORTCUT — one of
 * the three, never two. Carried as optional fields rather than as a tagged union
 * because these ARE the entry's own fields, and writing one has to delete the
 * others (`PresentingFlow.setItemActionArming`) or a re-armed line would still be
 * carrying the answer it was given last time.
 */
export type PresentingFlowActionArmingType = {
    actionNumber?: number;
    actionTime?: string;
    /**
     * The third alternative, and the one that is not a clock: the SHORTCUT that
     * fires this line. `Ctrl+Shift+A` — see `presentingFlowActionKeyHelpers` for the
     * format and for why it is stored that way rather than as the app's own
     * platform-formatted shortcut text.
     */
    actionKey?: string;
};

/**
 * Clearing ONE foreground widget instead of the whole layer, for the eight
 * widgets a screen can actually hold.
 *
 * Keyed by `ForegroundDragTargetType` rather than by `string`, exactly as
 * `foregroundOnScreenMatcherMap` is: a new foreground widget is then a compile
 * error here instead of a widget with no way to clear it on its own.
 *
 * **The Foreground panel's "Background Images Slide Show" is deliberately absent**
 * — it drives `ScreenBackgroundManager`, not this layer, so `Clear Background`
 * already covers it and a clear here would do nothing.
 *
 * Each entry does what the panel's own hide button for that widget does (its
 * setter, sync group and all) — a list widget clears all of its items at once.
 * Written in the panel's top-to-bottom order, which is the order the submenu
 * shows them in.
 */
const foregroundClearMap: Record<
    ForegroundDragTargetType,
    {
        label: string;
        badge: string;
        clear: (manager: ScreenForegroundManager) => void;
    }
> = {
    'marquee-top': {
        label: 'Clear FG Marquee Top',
        badge: 'M↑',
        clear: (manager) => {
            manager.setMarqueeTopData(null);
        },
    },
    'marquee-bottom': {
        label: 'Clear FG Marquee Bottom',
        badge: 'M↓',
        clear: (manager) => {
            manager.setMarqueeBottomData(null);
        },
    },
    'quick-text': {
        label: 'Clear FG Quick Text',
        badge: 'QT',
        clear: (manager) => {
            manager.setQuickTextData(null);
        },
    },
    countdown: {
        label: 'Clear FG Countdown',
        badge: 'CD',
        clear: (manager) => {
            manager.setCountdownData(null);
        },
    },
    stopwatch: {
        label: 'Clear FG Stopwatch',
        badge: 'SW',
        clear: (manager) => {
            manager.setStopwatchData(null);
        },
    },
    time: {
        label: 'Clear FG Time',
        badge: 'TM',
        clear: (manager) => {
            manager.setTimeDataList([]);
        },
    },
    camera: {
        label: 'Clear FG Camera Show',
        badge: 'CM',
        clear: (manager) => {
            manager.setCameraDataList([]);
        },
    },
    web: {
        label: 'Clear FG Web Show',
        badge: 'WB',
        clear: (manager) => {
            manager.setWebDataList([]);
        },
    },
};

/**
 * The per-widget clears, in the order `foregroundClearMap` is written — object
 * key order IS insertion order for these keys, so the map is both exhaustive
 * (the `Record`) and ordered (the panel's own layout) without a second list to
 * keep in step.
 *
 * They all wear `Clear Foreground`'s eraser and colour rather than the widget's
 * own icon: a row that showed the marquee icon would read as the marquee PRESET,
 * which is the opposite of what it does. The badge is what tells them apart.
 */
const foregroundClearActionList: PresentingFlowScreenActionType[] =
    Object.entries(foregroundClearMap).map(
        ([target, { label, badge, clear }]): PresentingFlowScreenActionType => {
            return {
                id: `clear-foreground-${target as ForegroundDragTargetType}`,
                label,
                badge,
                iconName: 'eraser',
                color: 'var(--bs-gray-500)',
                ccItemCount: Infinity,
                requiresScreenIds: false,
                filtersHostScreenIds: false,
                target: 'screen',
                apply: (screenManager) => {
                    clear(screenManager.screenForegroundManager);
                },
            };
        },
    );

/**
 * The screen ITSELF, up and down — the run sheet's copy of the one control the
 * operator otherwise has to reach for by hand (`ShowHideScreenComp`, `F5`).
 *
 * Every other screen action is about what is ON a screen; these two are about
 * whether there is a screen at all. That is the whole reason they exist as run
 * sheet lines: an unattended sheet — one walked by a `Next: Interval` or aimed
 * at a time of day (see `presentingFlowAutoNextHelpers`) — could fill a screen and
 * clear it again, but never darken it at the end or bring it back for the next
 * block, and an operator who has automated the rest should not have to be at the
 * machine for exactly that.
 *
 * They wear the mini screen's own indicator glyph, filled and hollow the way the
 * toggle draws itself showing and hidden, and green/red rather than the clears'
 * neutral: "the screen is live" and "the screen is dark" are the two states an
 * operator scans a sheet for fastest.
 *
 * They are the one screen family that NAMES its screens (`requiresScreenIds`),
 * asked for when the line is added exactly as the run family is asked for its
 * seconds — for the same reason they exist at all. Neither fallback survives
 * being unattended: the selected screens are whatever the operator touched last,
 * and a "which screen?" menu fired at 7:05 with nobody there is a screen that
 * simply never goes up.
 *
 * Neither hosts a CC element (`ccItemCount: 0`): a follower rides its host to the
 * screens the host resolved, and content riding a HIDE would be pushed onto a
 * screen in the very gesture that darkens it, while content riding a SHOW would
 * be indistinguishable from simply listing that content on the next line —
 * which is what a run sheet should say. Being a CC is the other direction and
 * stays open: "put this last slide up AND light the screen" is one click worth
 * having, and screen actions have always been attachable.
 */
const screenShowHideActionList: PresentingFlowScreenActionType[] = [
    {
        id: 'screen-show',
        label: 'Screen: Show',
        badge: 'ON',
        iconName: 'file-slides-fill',
        color: 'var(--bs-success)',
        ccItemCount: 0,
        requiresScreenIds: true,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            // Guarded rather than assigned flat: the setter fires the real
            // show/hide window work and a `visible` event on every write, and a
            // sheet that re-shows an already-live screen every cycle of an
            // interval must not pay for it.
            if (!screenManager.isShowing) {
                screenManager.isShowing = true;
            }
        },
    },
    {
        id: 'screen-hide',
        label: 'Screen: Hide',
        badge: 'OFF',
        iconName: 'file-slides',
        color: 'var(--bs-danger)',
        ccItemCount: 0,
        requiresScreenIds: true,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            if (screenManager.isShowing) {
                screenManager.isShowing = false;
            }
        },
    },
];

/**
 * The media INSIDE a slide, driven from the run sheet — play it, pause it, stop it,
 * from a point, up to a point, at a volume and at a speed.
 *
 * **It is the only action that exists solely as a CC element**, and the only one
 * missing from `presentingFlowActionMenuList`. Everything it does is about ONE host:
 * "start this video ten seconds in" is a sentence about a particular slide, and a
 * line of the sheet that said it about nothing in particular could only ever act on
 * whatever happened to be live — which is the ambient answer this app keeps
 * refusing everywhere else. So it is added from the SLIDE's own menu
 * (`genAddMediaControlContextMenu`), which appends its element and attaches it in
 * one write, and an element reached any other way carries no settings and does
 * nothing. That split is exactly what the registry/menu separation below is for:
 * the id still resolves, so a stored one reads back, but nothing offers to add one
 * loose.
 *
 * Its settings live on the CC RECORD rather than here or on the element
 * (`PresentingFlowCcItemType.mediaControl`) — the same controller attached to two
 * slides must be able to mean two different things.
 *
 * `ccItemCount: 0`: it shows nothing, so there is nothing for a follower to ride
 * behind. `requiresScreenIds: false` with `filtersHostScreenIds: true`: its pin is
 * an optional NARROWING of where its host landed, never a redirection — see the
 * flag's own note.
 */
const slideMediaControlActionList: PresentingFlowScreenActionType[] = [
    {
        id: 'slide-media-control',
        label: 'Slide: Media Control',
        badge: 'MC',
        // Sliders rather than a play triangle: it is a controller with a mode, and
        // a row wearing ▶ would read as "this line plays" even when it is the line
        // that stops. Cyan is the one Bootstrap accent no other action wears.
        iconName: 'sliders',
        color: 'var(--bs-cyan)',
        ccItemCount: 0,
        requiresScreenIds: false,
        filtersHostScreenIds: true,
        target: 'screen',
        apply: (screenManager, presentingFlowItem) => {
            applyScreenSlideMediaControl(
                screenManager.screenVaryAppDocumentManager,
                presentingFlowItem.mediaControl,
            );
        },
    },
];

/**
 * The run family: the ways a run sheet moves ITSELF.
 *
 * The two clocks are the same timer armed with two different endings — see
 * `presentingFlowAutoNextHelpers` for why input cancels one and not the other — so they
 * are written as one pair here rather than twice over, with the interval's own
 * off switch beside it; the jump is the third way and the only one that goes
 * anywhere but forward; the keyboard event is the fourth and the only one the
 * OPERATOR aims, at any moment, from a key.
 *
 * None of them wears an eraser: none of them clears a screen, the RUN moves. And
 * each wears its OWN colour rather than one family colour — a run sheet is read
 * at a glance mid-service, and "waits once" (amber), "keeps going" (teal), "goes
 * somewhere else" (purple) and "when I press it" (pink) are four different things
 * to find in a hurry. The badge and the icon say the same thing twice over. The
 * one exception is `Next: Clear Interval`, which shares the interval's teal
 * BECAUSE it is that same thing undone.
 */
const SECONDS_NUMBER = { label: 'Seconds', defaultValue: 10 };
const NO_RUN_MESSAGE = 'Open the presenting flow preview to use this action';

const nextActionList: PresentingFlowRunActionType[] = [
    {
        id: 'next-interval',
        label: 'Next: Interval',
        badge: '⟳',
        iconName: 'arrow-repeat',
        color: 'var(--bs-teal)',
        target: 'run',
        number: SECONDS_NUMBER,
        canBeTimeArmed: false,
        canBeKeyArmed: false,
        ccItemCount: 0,
        ccItemsAreTargets: false,
        canBeCcItem: false,
        movesRunAtOnce: false,
        start: (presentingFlowItem) => {
            return startPresentingFlowAutoNext(
                presentingFlowItem.filePath,
                'interval',
                presentingFlowItem.actionNumber,
            )
                ? null
                : NO_RUN_MESSAGE;
        },
    },
    {
        /**
         * The INTERVAL's off switch, written as a line of the sheet.
         *
         * An interval ends by its own button on the floating pill, or with the
         * run — both of them the operator being at the machine, which is the one
         * thing an interval running a pre-service loop cannot assume. It is also
         * the only clock the run MOVING does not cancel (that is what makes it a
         * loop), so until now "walk these four slides over and over, then stop
         * and wait for me" could not be written at all: a `Jump to` at the end of
         * the set makes the loop, and nothing in the sheet could end it.
         *
         * It arms with nothing and asks nothing — there is only ever one clock,
         * so there is nothing to name — and it clears the INTERVAL alone; see
         * `stopPresentingFlowAutoNextInterval` for why a timeout is left counting.
         * Doing it twice is doing it once, which is what lets it sit inside a
         * looping set safely.
         *
         * It wears the interval's OWN teal rather than a fifth colour: the other
         * run actions differ because they are four different things, while this
         * one is the interval and nothing else — the same thing, undone. The
         * stopped-square glyph and the `⊘` badge are what tell the pair apart.
         *
         * It may BE a CC (`canBeCcItem`), and for the same reason the timeout may:
         * "put this last slide up AND stop the loop" is one line worth having, and
         * unlike a CC'd interval — which would walk a sheet forward from a line
         * that only meant to be shown — a follower that STOPS something can never
         * run away with the run.
         */
        id: 'next-clear-interval',
        label: 'Next: Clear Interval',
        badge: '⊘',
        iconName: 'stop-circle',
        color: 'var(--bs-teal)',
        target: 'run',
        number: null,
        canBeTimeArmed: false,
        canBeKeyArmed: false,
        ccItemCount: 0,
        ccItemsAreTargets: false,
        canBeCcItem: true,
        movesRunAtOnce: false,
        start: (presentingFlowItem) => {
            return stopPresentingFlowAutoNextInterval(
                presentingFlowItem.filePath,
            )
                ? null
                : NO_RUN_MESSAGE;
        },
    },
    {
        id: 'next-timeout',
        label: 'Next: Timeout',
        badge: '⏱',
        iconName: 'hourglass-split',
        color: 'var(--bs-warning)',
        target: 'run',
        number: SECONDS_NUMBER,
        canBeTimeArmed: true,
        canBeKeyArmed: false,
        ccItemCount: 0,
        ccItemsAreTargets: false,
        canBeCcItem: true,
        movesRunAtOnce: false,
        start: (presentingFlowItem) => {
            // Armed with a time of day, when it has one: that is what the
            // operator answered the question with, and it is stored INSTEAD of
            // the seconds rather than alongside them.
            const { actionTime } = presentingFlowItem;
            if (actionTime !== null) {
                return startPresentingFlowAutoNextAtTime(
                    presentingFlowItem.filePath,
                    actionTime,
                );
            }
            return startPresentingFlowAutoNext(
                presentingFlowItem.filePath,
                'timeout',
                presentingFlowItem.actionNumber,
            )
                ? null
                : NO_RUN_MESSAGE;
        },
    },
    {
        /**
         * The run sheet's GOTO — the one way it moves anywhere but forward.
         *
         * Where it goes is named the way everything else in a presenting flow names
         * another line: by a CC element, a copy of that line. So it is armed by
         * attaching one (exactly one), not by a number, and the row underneath
         * reads as what it jumps to. Behind an INTERVAL it makes a loop; reached
         * by the next-key it makes a section repeat.
         */
        id: 'jump-to',
        label: 'Jump to',
        badge: '⤴',
        iconName: 'sign-turn-right',
        color: 'var(--bs-purple)',
        target: 'run',
        number: null,
        canBeTimeArmed: false,
        canBeKeyArmed: false,
        ccItemCount: 1,
        ccItemsAreTargets: true,
        canBeCcItem: false,
        movesRunAtOnce: true,
        start: (presentingFlowItem) => {
            const [ccItem] = presentingFlowItem.ccItems;
            if (ccItem === undefined) {
                return 'Attach the element to jump to as a CC element';
            }
            return jumpPresentingFlowRunToCcItem(
                presentingFlowItem.filePath,
                ccItem,
            );
        },
    },
    {
        /**
         * The run sheet's HOTKEY — one press, one named line, wherever the run
         * has got to.
         *
         * Everything else in the panel walks FORWARD (or, with a `Jump to`, to a
         * line another line names). This is the one thing the operator aims
         * themselves, in the middle of a service, without looking: `Shift+A` puts
         * the offering slide and its marquee up together, and the run carries on
         * from there.
         *
         * It shows nothing of its own — what it puts up is what is ATTACHED to
         * it, as many CC elements as the sheet needs, which is what makes one
         * press worth more than a click on one line. That is also why it is the
         * one run action that resolves screens (`ccItemsAreTargets` false, so its
         * CCs are ordinary followers): nothing else on the line will, since there
         * is no content of its own for a follower to ride behind. See
         * `sendPresentingFlowItemToScreens`.
         *
         * It may not itself be a CC. A follower that fired a shortcut's worth of
         * content the moment its host went up would be a second, invisible line
         * of the run sheet — and a shortcut is a thing the OPERATOR presses, which
         * is the whole of what it is for.
         */
        id: 'keyboard-event',
        label: 'Keyboard Event',
        badge: '⌨',
        iconName: 'keyboard',
        // The fourth colour of the run family, for the same reason the other
        // three differ: a sheet is read at a glance mid-service, and "I press
        // this one myself" is not "it goes on by itself".
        color: 'var(--bs-pink)',
        target: 'run',
        number: null,
        canBeTimeArmed: false,
        canBeKeyArmed: true,
        // As many as the operator attaches: the CCs ARE the payload, and there is
        // no reading under which a second one is refused.
        ccItemCount: Infinity,
        ccItemsAreTargets: false,
        canBeCcItem: false,
        movesRunAtOnce: false,
        /**
         * Reached only when nothing is attached — with CCs, this line is applied
         * by `sendPresentingFlowItemToScreens`, which is where the screens are resolved
         * and where the followers are armed. An empty one says so rather than
         * reading as a key that did nothing, exactly as an unaimed `Jump to` does.
         */
        start: (presentingFlowItem) => {
            return presentingFlowItem.ccItems.length === 0
                ? 'Attach the elements to show as CC elements'
                : null;
        },
    },
];

/**
 * The clearing family proper: the five that mirror a button of the mini screen's
 * clear bar — same label (so the shipped translations are reused rather than
 * duplicated), same `BG`/`SL`/`BB`/`FG` text as its badge, and kept in the bar's
 * own left-to-right order so the menu reads like the control it mirrors.
 *
 * The bar's two `secondary` buttons are the one thing not copied literally: the
 * context menu's own background IS `--bs-secondary`, so those icons vanished
 * into it. A lighter neutral reads on the menu and on the row alike.
 */
const clearActionList: PresentingFlowScreenActionType[] = [
    {
        id: 'clear-all',
        label: 'Clear All',
        badge: 'ALL',
        iconName: 'eraser-fill',
        color: 'var(--bs-danger)',
        ccItemCount: Infinity,
        requiresScreenIds: false,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            screenManager.clear();
        },
    },
    {
        id: 'clear-background',
        label: 'Clear Background',
        badge: 'BG',
        iconName: 'eraser',
        color: 'var(--bs-gray-500)',
        ccItemCount: Infinity,
        requiresScreenIds: false,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            screenManager.screenBackgroundManager.clear();
        },
    },
    {
        id: 'clear-slide',
        label: 'Clear Slide',
        badge: 'SL',
        iconName: 'eraser',
        color: 'var(--bs-info)',
        ccItemCount: Infinity,
        requiresScreenIds: false,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            screenManager.screenVaryAppDocumentManager.clear();
        },
    },
    {
        id: 'clear-bible',
        label: 'Clear Bible',
        badge: 'BB',
        iconName: 'eraser',
        color: 'var(--bs-primary)',
        ccItemCount: Infinity,
        requiresScreenIds: false,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            screenManager.screenBibleManager.clear();
        },
    },
    {
        id: 'clear-foreground',
        label: 'Clear Foreground',
        badge: 'FG',
        iconName: 'eraser',
        color: 'var(--bs-gray-500)',
        ccItemCount: Infinity,
        requiresScreenIds: false,
        filtersHostScreenIds: false,
        target: 'screen',
        apply: (screenManager) => {
            screenManager.screenForegroundManager.clear();
        },
    },
];

/**
 * A row of the `Add Action` menu that opens a menu of its OWN instead of adding
 * anything — one heading over a family that would otherwise be most of the list.
 *
 * Deliberately in the registry rather than in the component that draws the menu:
 * the grouping IS part of what these actions are (a finer version of the one
 * above them), and a family added later must be able to fold itself away without
 * the component learning its name.
 *
 * A group holds MENU ENTRIES rather than actions, so a family may hold a finer
 * family of its own: `Clear Screen` holds the per-widget foreground clears the
 * same way it holds the five whole-layer ones. The component that draws the menu
 * walks this recursively, so the nesting is a property of the registry alone.
 */
export type PresentingFlowActionGroupType = {
    label: string;
    iconName: string;
    color: string;
    actionList: PresentingFlowActionMenuEntryType[];
};

export type PresentingFlowActionMenuEntryType =
    PresentingFlowActionType | PresentingFlowActionGroupType;

export function checkIsPresentingFlowActionGroup(
    entry: PresentingFlowActionMenuEntryType,
): entry is PresentingFlowActionGroupType {
    return (entry as PresentingFlowActionGroupType).actionList !== undefined;
}

/**
 * The `Add Action` menu, as it is READ.
 *
 * Everything that ERASES is folded behind one `Clear Screen` row, and nothing
 * else is: thirteen of the menu's twenty entries clear something, so left
 * inline they were the menu, and the two questions an operator opens it with —
 * "clear something" or "do something" — could not be told apart at a glance.
 * Inside it, the five whole-layer clears first, in the mini screen bar's own
 * order, then the eight per-widget foreground ones folded again behind
 * `Other Clear FG Items`: they are a finer version of the `Clear Foreground`
 * right above them, and they are eight of the thirteen.
 *
 * Then the screen itself, up and down — still a screen action, but about the
 * window rather than about what is on it, so it reads after the clearing. The
 * run family closes it, after every screen action rather than mixed in among
 * them: they are the entries that ask a question before they are added and that
 * do nothing to a screen at all. So the menu reads as "clear something", "put
 * the screen up or down", then "move the run on".
 */
export const presentingFlowActionMenuList: PresentingFlowActionMenuEntryType[] =
    [
        {
            // The eraser of the family it holds, since that is what every one of
            // them wears, but the FILLED one and a neutral: filled says "all of
            // the clearing is in here" without wearing `Clear All`'s red, which
            // on a row that clears nothing by itself would read as the whole
            // screen going dark on click.
            label: 'Clear Screen',
            iconName: 'eraser-fill',
            color: 'var(--bs-gray-500)',
            actionList: [
                ...clearActionList,
                {
                    // The eraser and neutral of the family it holds, since that
                    // is what every one of them wears — the row is the family,
                    // not an action.
                    label: 'Other Clear FG Items',
                    iconName: 'eraser',
                    color: 'var(--bs-gray-500)',
                    actionList: foregroundClearActionList,
                },
            ],
        },
        ...screenShowHideActionList,
        ...nextActionList,
    ];

/**
 * Every action there is, flat — what an id is resolved against and what anything
 * asking "which actions exist" reads. The menu's own shape is
 * `presentingFlowActionMenuList`; nothing else may depend on it.
 */
export const presentingFlowActionList: PresentingFlowActionType[] = [
    ...clearActionList,
    ...foregroundClearActionList,
    ...screenShowHideActionList,
    // Deliberately absent from `presentingFlowActionMenuList` above — it is added
    // from the slide it controls, never loose. See its own note.
    ...slideMediaControlActionList,
    ...nextActionList,
];

const presentingFlowActionMap = new Map(
    presentingFlowActionList.map((action) => {
        return [action.id as string, action];
    }),
);

/**
 * The stored id resolved back to its action, or null when nothing answers to it
 * — a presenting flow written by a later version, or a hand-edited file. Callers treat
 * null as an invalid entry rather than silently doing nothing on click.
 */
export function findPresentingFlowAction(
    actionId: any,
): PresentingFlowActionType | null {
    if (typeof actionId !== 'string') {
        return null;
    }
    return presentingFlowActionMap.get(actionId) ?? null;
}
