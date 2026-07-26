import KeyboardEventListener, {
    checkIsControlKeys,
    toShortcutKey,
    useKeyboardRegistering,
    type EventMapperType,
} from '../event/KeyboardEventListener';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import type { AppWidgetType } from '../event/WindowEventListener';

// Keys and the keyboard layer for the app-wide annotation overlay. Kept OUT of
// `presentingControlHelpers` (and therefore out of the two engines) so the
// drawing/spotlight code does not drag the keyboard and lang stacks in behind
// it — the same split `screenDrawShortcutHelpers` makes for the screen overlays.

// Layer claimed only while a tool is ARMED — i.e. exactly while the overlay
// covers the window and the app underneath is taking nothing anyway. Then every
// key belongs to the overlay: Ctrl+Z undoes a stroke rather than a slide edit,
// and the palette letters cannot double up with a previewer's own draw panel.
//
// It is deliberately NOT held for as long as the panel is merely OPEN. The
// keyboard stack has one top layer and no fall-through, so a panel sitting on it
// in `interact` silenced the whole app — the Bible Lookup's Enter and Escape,
// F5–F10, Ctrl+B, slide navigation — while advertising that mode as "the app
// stays completely usable". `interact` now means it for the keyboard too; the
// tool keys reach in from `root` instead (`usePresentingToolShortcut`).
export const PRESENTING_CONTROL_LAYER: AppWidgetType = 'presenting-control';

// The overlay's own root element (`ControllerComp`), by id — the one subtree the
// keyboard swallow below has to leave alone.
export const PRESENTING_CONTROL_ID = 'presenting-control';

// Text-entry types are everything an `<input>` can be EXCEPT these. Listing the
// non-typing ones is the safe direction: a type this does not know about — or an
// empty/invalid one, which the DOM resolves to `text` — then counts as typing
// and the shortcut defers.
const NON_TYPING_INPUT_TYPE_SET = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
]);

// Is the user typing right now? The tool keys are plain letters and they are
// bound on `root` too, so they are live in `interact` where the app is fully
// live — without this, typing "bible" into a lookup field would arm the brush,
// then the eraser, and cover the app the user is trying to use.
//
// Only the TOOL keys need this. The two tool panels' palette keys fire only while
// a tool is armed, and an armed overlay covers the whole window, so there is no
// reachable text field for them to steal from.
export function checkIsTypingTarget(event: any) {
    const element =
        event?.target instanceof Element
            ? event.target
            : document.activeElement;
    if (!(element instanceof HTMLElement)) {
        return false;
    }
    if (element.isContentEditable) {
        return true;
    }
    const tagName = element.tagName;
    if (tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return true;
    }
    if (tagName === 'INPUT') {
        return !NON_TYPING_INPUT_TYPE_SET.has(
            (element as HTMLInputElement).type,
        );
    }
    // Monaco edits through the EditContext API, so its editable element is a
    // plain div (`.native-edit-context`) with no contenteditable attribute —
    // none of the checks above would catch it.
    return element.closest('.monaco-editor') !== null;
}

// Is a shadow-hosted widget holding the keyboard? The mini-screen previews are
// the ones that matter: their draw/spotlight overlays live in a shadow root,
// claim the keyboard by DOM focus, and bind `B` and `E` on `root` too — so once
// the controller's own tool keys reach `root` (see below), a single `B` pressed
// on a focused preview would both toggle that screen's brush AND arm the
// app-wide overlay over the top of it. The focused widget wins, exactly as a
// focused text field does.
//
// Reading `shadowRoot.activeElement` off the event target is all it takes and
// costs one property read: a keydown retargets to the shadow HOST, so a set
// `activeElement` on its root means the focus is inside that widget. Doing it
// this way keeps this module free of the screen/draw imports it is split out to
// avoid.
export function checkIsShadowWidgetTarget(event: any) {
    const element = event?.target;
    if (!(element instanceof Element)) {
        return false;
    }
    return element.shadowRoot?.activeElement != null;
}

// Is this key aimed at the CONTROLLER's own widget rather than at the app? The
// widget floats above the overlay and keeps taking the pointer while a tool is
// armed, so its range sliders and color inputs are focusable and their arrow
// keys / Escape / Tab have to keep behaving natively — the swallow below is
// about the app UNDERNEATH the overlay, which is exactly what the operator has
// covered up.
export function checkIsPresentingControlTarget(event: any) {
    const element = event?.target;
    if (!(element instanceof Element)) {
        return false;
    }
    return element.closest(`#${PRESENTING_CONTROL_ID}`) !== null;
}

// A stand-in for a key event that has already been swallowed, so it can still be
// dispatched to the controller's OWN shortcuts. It cannot be the real event:
// `EventHandler.checkOnEvent` refuses to run any listener for an event whose
// default is prevented (and stops at the first listener that prevents it), so
// re-firing the swallowed original would deliver nothing at all.
//
// It carries only what the keyboard stack reads: the key identity and modifiers
// (`genEventKeyFromFiredEvent`), `repeat` and `target` (the shortcut guards),
// and its own prevent flag so a listener that stops the chain still stops it.
function toReplayedKeyEvent(event: KeyboardEvent) {
    const replayedEvent: any = {
        type: event.type,
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        metaKey: event.metaKey,
        target: event.target,
        defaultPrevented: false,
    };
    replayedEvent.preventDefault = () => {
        replayedEvent.defaultPrevented = true;
    };
    replayedEvent.stopPropagation = () => {};
    replayedEvent.stopImmediatePropagation = () => {};
    return replayedEvent as KeyboardEvent;
}

// `keypress` is dead as far as the app is concerned but is what actually inserts
// a character, and `keyup` is what a few listeners watch for a release they will
// now never see a press for — so all three go, and the app hears nothing.
const SWALLOWED_EVENT_TYPE_LIST = ['keydown', 'keypress', 'keyup'];

// One key event, swallowed. Split out from the hook below because this — not the
// listener bookkeeping — is the part with rules worth pinning down in a test.
// Returns whether the event was taken from the app.
export function swallowPresentingKeyEvent(event: KeyboardEvent) {
    if (checkIsPresentingControlTarget(event)) {
        return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type !== 'keydown' || checkIsControlKeys(event)) {
        return true;
    }
    KeyboardEventListener.fireEvent(toReplayedKeyEvent(event));
    return true;
}

// Swallow the keyboard whole while a tool is ARMED — the pointer counterpart of
// what the overlay already does. Scoping the controller's keys to its layer only
// stopped the app's own `KeyboardEventListener` shortcuts; everything else went
// on working under an overlay the operator had deliberately covered the app
// with: Chromium's native defaults (space and arrows scrolling a list, Tab
// walking focus, typing into whatever still had it) and every React `onKeyDown`
// in the tree, which is not routed through the keyboard stack at all.
//
// It has to be a CAPTURE listener on `window` — the first stop in the dispatch
// path, ahead of React's root container and of `document.onkeydown` — and it has
// to `stopImmediatePropagation`, or the swallow would be advisory. That kills
// the controller's own keys too (they arrive through that same
// `document.onkeydown`), which is what the replay is for: the tool letters,
// Escape, Undo/Redo/Clear are dispatched straight into the keyboard stack, under
// the controller's layer, and nothing else is dispatched at all.
//
// Not swallowed: keys aimed at the controller's own widget (see above), and the
// bare modifiers, which have no shortcut of their own and whose default is
// nothing worth blocking. Menu ACCELERATORS are the one thing out of reach —
// Electron answers those in the main process before the page ever sees the key.
export function usePresentingKeyboardSwallow(isSwallowing: boolean) {
    useAppEffect(() => {
        if (!isSwallowing) {
            return;
        }
        const handleKeyEvent = (event: KeyboardEvent) => {
            swallowPresentingKeyEvent(event);
        };
        for (const eventType of SWALLOWED_EVENT_TYPE_LIST) {
            globalThis.addEventListener(
                eventType,
                handleKeyEvent as EventListener,
                true,
            );
        }
        return () => {
            for (const eventType of SWALLOWED_EVENT_TYPE_LIST) {
                globalThis.removeEventListener(
                    eventType,
                    handleKeyEvent as EventListener,
                    true,
                );
            }
        };
    }, [isSwallowing]);
}

export type PresentingShortcutIdType =
    | 'useInteract'
    | 'usePaint'
    | 'useEraser'
    | 'useFocus'
    | 'exitTool'
    | 'toggleHold'
    | 'toggleScreencast';

// Tool switching, deliberately on plain letters like the previewer's draw
// palette: the app's own global shortcuts are function keys, arrows, space and
// Ctrl combos, and these only exist inside the controller's own layer.
//
// They work in every tool INCLUDING `interact`, so a tool can be armed from the
// keyboard rather than only switched between. In `interact` the app underneath
// is live, which is what `checkIsTypingTarget` above is for: a stray `b` while
// typing has to stay a `b`.
export const presentingShortcutMap: {
    [key in PresentingShortcutIdType]: EventMapperType[];
} = {
    useInteract: [{ key: 'v' }],
    usePaint: [{ key: 'b' }],
    useEraser: [{ key: 'e' }],
    useFocus: [{ key: 'f' }],
    exitTool: [{ key: 'Escape' }],
    // Spotlight panel only: follow-the-pointer vs press-and-hold.
    toggleHold: [{ key: 'h' }],
    // The keyboard screencast. `k` for keyboard, and like the tool keys it works
    // from every tool including `interact`.
    toggleScreencast: [{ key: 'k' }],
};

// Bind one controller key for as long as its caller is mounted — which is the
// rule the whole feature follows: a key belongs to a component exactly when its
// button does.
//
// The layer is passed EXPLICITLY rather than picked up from `getLastLayer()`,
// because it is what SCOPES the key: the controller's layer is on the stack only
// while a tool is ARMED (see `ControllerComp`), so a key registered here fires
// only then — and one registered on `root` fires only while the app is live.
// Nothing double-fires: `KeyboardEventListener.fireEvent` dispatches under the
// CURRENT top layer alone, so of two registrations for the same chord exactly
// one can ever match.
//
// The deps are empty on purpose: `useKeyboardRegistering` already reads the
// handler through a ref, so listing state here would only unregister and
// re-register the key every time that state changed.
export function usePresentingShortcut(
    eventMappers: EventMapperType[],
    handle: () => void,
    layer: AppWidgetType = PRESENTING_CONTROL_LAYER,
) {
    const handleRef = useAppCurrentRef(handle);
    useKeyboardRegistering(
        eventMappers,
        (event: any) => {
            // A held key would flap the tool (and re-arm the overlay) ~30 times
            // a second, or push ~30 empty snapshots through the 50-deep undo
            // history for a leaned-on `C`.
            if (event?.repeat === true) {
                return;
            }
            // In `interact` the app underneath is live and these are plain
            // letters, so whatever holds the keyboard wins — a field being
            // typed into (including its own native Ctrl+Z), or a focused
            // mini-screen overlay that binds the same letters.
            if (
                checkIsTypingTarget(event) ||
                checkIsShadowWidgetTarget(event)
            ) {
                return;
            }
            handleRef.current();
        },
        [],
        layer,
    );
}

// The tool-SELECT keys (and the screencast switch) are the only ones that have
// to work on both sides of the arm line: `B` has to be able to reach in and arm
// the brush from `interact`, which is exactly when the controller does NOT own
// the keyboard. Registering the same chord on both layers is how that is said —
// the armed one fires while the overlay owns the window, the `root` one while
// the app is live, and never both.
//
// Everything else the controller binds (Escape, Clear, Undo/Redo) stays on the
// controller's layer alone: while the app is live those chords belong to the
// APP, and a panel that answered them too would be undoing slide edits and
// closing dialogs from under the operator.
export function usePresentingToolShortcut(
    shortcutId: PresentingShortcutIdType,
    handle: () => void,
) {
    const eventMappers = presentingShortcutMap[shortcutId];
    usePresentingShortcut(eventMappers, handle);
    usePresentingShortcut(eventMappers, handle, 'root');
}

// Rendered key label for one shortcut id. Memoized because `toShortcutKey`
// deep-clones (JSON round-trip) its argument and the toolbar re-renders on every
// stroke commit — the labels are constant for the process.
const shortcutKeysCache = new Map<PresentingShortcutIdType, string>();
export function toPresentingShortcutTitle(
    title: string,
    shortcutId: PresentingShortcutIdType,
) {
    let keys = shortcutKeysCache.get(shortcutId);
    if (keys === undefined) {
        // Filter by platform FIRST: `toShortcutKey` throws when handed a
        // foreign-platform mapper, and a throw here would take the toolbar down
        // mid-service.
        keys = KeyboardEventListener.filterEventMappersByPlatform(
            presentingShortcutMap[shortcutId],
        )
            .map(toShortcutKey)
            .filter(Boolean)
            .join(' / ');
        shortcutKeysCache.set(shortcutId, keys);
    }
    return `${title} [${keys}]`;
}
