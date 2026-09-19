import KeyboardEventListener, {
    checkIsControlKeys,
} from '../event/KeyboardEventListener';
import appProvider from '../server/appProvider';

// The live keyboard screencast: an on-screen echo of what the operator PRESSES,
// so an audience watching the app on a projector — or a screen recording, or a
// tutorial being written against it — can follow the keys instead of guessing.
//
// Everything here is pure: a label for one event, and a reducer for the strip.
// That keeps the overlay component down to a listener plus a list, and lets both
// be checked without driving a real keyboard.

// How long the strip stays up after the last key. Long enough to read a chord,
// short enough to be gone again before the next sentence.
export const KEYSTROKE_HIDE_DELAY_MS = 1600;

// The strip is ONE line drawn over the app, so it cannot grow without bound —
// the oldest keys fall off the front.
export const MAX_VISIBLE_KEYSTROKES = 6;

export type KeystrokeType = {
    label: string;
    // Repeats collapse into one pill: six presses of Down read as `↓ ×6` rather
    // than pushing every other key off the strip.
    count: number;
};

// Keys whose `event.key` is not presentable as-is. Arrows are drawn as glyphs
// because they have to be legible from the back of a room; everything else stays
// a word, which survives a projector better than a symbol nobody knows.
const KEY_LABEL_MAP: { [key: string]: string } = {
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
    Delete: 'Del',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
};

// An IME mid-composition reports the physical key as `Process`, and a key the
// layout does not resolve as `Unidentified`; both would render as that literal
// word. Showing nothing is better than showing noise.
const UNPRESENTABLE_KEY_SET = new Set(['Process', 'Unidentified', 'Dead']);

function toModifierLabels(event: KeyboardEvent) {
    const { isMac, isWindows } = appProvider.systemUtils;
    const labels: string[] = [];
    if (event.ctrlKey) {
        labels.push(isMac ? '⌃' : 'Ctrl');
    }
    if (event.altKey) {
        labels.push(isMac ? '⌥' : 'Alt');
    }
    if (event.shiftKey) {
        labels.push(isMac ? '⇧' : 'Shift');
    }
    if (event.metaKey) {
        labels.push(isMac ? '⌘' : isWindows ? 'Win' : 'Super');
    }
    return labels;
}

function joinLabels(labels: string[]) {
    // Mac writes a chord as run-together glyphs (`⌘⇧P`), everywhere else it is
    // the `+` form the app's own shortcut hints use.
    return appProvider.systemUtils.isMac ? labels.join('') : labels.join('+');
}

// Is this press TYPING a character, as opposed to firing a shortcut? Shift is
// not a real modifier here: it only picks which character the key produces.
function checkIsTypingKey(event: KeyboardEvent) {
    return (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
    );
}

// A password field must not narrate itself onto a projector.
function checkIsSecretTarget(event: KeyboardEvent) {
    const { target } = event;
    return target instanceof HTMLInputElement && target.type === 'password';
}

function toMainKeyLabel(event: KeyboardEvent) {
    const mappedLabel = KEY_LABEL_MAP[event.key];
    if (mappedLabel !== undefined) {
        return mappedLabel;
    }
    // Named keys (`F5`, `Home`, `Enter`, ...) are already their own label.
    if (event.key.length !== 1) {
        return event.key;
    }
    // A character pressed with no real modifier is TYPING, so show what the
    // operator's layout actually produced. Anything else is a shortcut, and the
    // app resolves shortcuts on the en-US physical key — so a German layout
    // pressing the `z` key for undo has to read `Ctrl+Z`, not `Ctrl+Y`.
    return checkIsTypingKey(event)
        ? event.key
        : KeyboardEventListener.toEnUsKey(event).toUpperCase();
}

// One pressed chord, as it should appear on screen — or `null` for a press with
// nothing worth showing.
export function toKeystrokeLabel(event: KeyboardEvent) {
    const modifierLabels = toModifierLabels(event);
    if (checkIsControlKeys(event)) {
        // A modifier pressed on its own is still worth showing (`Shift+Win`);
        // its own flag is already set by the time `keydown` fires, so the
        // modifier list IS the label.
        return modifierLabels.length === 0 ? null : joinLabels(modifierLabels);
    }
    if (UNPRESENTABLE_KEY_SET.has(event.key) || event.key === '') {
        return null;
    }
    // The bullet stands ALONE — no `Shift+`. Rendering the modifier would put
    // the password's capitalisation on the projector one character at a time,
    // which is most of what masking is supposed to stop. A shortcut is not a
    // secret and keeps its full label.
    if (checkIsTypingKey(event) && checkIsSecretTarget(event)) {
        return '•';
    }
    return joinLabels([...modifierLabels, toMainKeyLabel(event)]);
}

// The strip after one more press. A new array every time on purpose: this is
// React state, and the pills have to re-render.
export function appendKeystroke(keystrokes: KeystrokeType[], label: string) {
    const lastKeystroke = keystrokes.at(-1);
    if (lastKeystroke !== undefined && lastKeystroke.label === label) {
        return [
            ...keystrokes.slice(0, -1),
            { label, count: lastKeystroke.count + 1 },
        ];
    }
    return [...keystrokes, { label, count: 1 }].slice(-MAX_VISIBLE_KEYSTROKES);
}
