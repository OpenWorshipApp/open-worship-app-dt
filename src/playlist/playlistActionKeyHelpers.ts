import type { EventMapperType } from '../event/KeyboardEventListener';
import KeyboardEventListener, {
    checkIsControlKeys,
} from '../event/KeyboardEventListener';

/**
 * Arming a run action with a KEYBOARD SHORTCUT rather than with a clock.
 *
 * A run sheet is walked forward with one key, which is the whole of what a
 * service usually needs. What it cannot do is reach ONE named line at once —
 * "the offering slide, now" — and an operator hunting for that line in a long
 * sheet mid-service is exactly the thing a shortcut is for.
 *
 * Stored as a CANONICAL STRING, `Ctrl+Shift+A`: the modifiers in a fixed order,
 * then the en-US key. Not `KeyboardEventListener.toShortcutKey`'s output, which
 * is formatted for the PLATFORM the app happens to be running on (`⌃⇧ A` on a
 * Mac) — a playlist file is opened on whatever machine is in the building, so
 * what it stores has to mean the same thing on all of them. The canonical string
 * is also what the row shows: `Ctrl` is Control on every platform, so it reads
 * true everywhere without a second, prettier form to keep in step.
 *
 * **Ctrl and Shift only**, which is `AllControlType` and not a coincidence: they
 * are the two modifiers that mean the same thing on all three platforms, so one
 * `allControlKey` mapper matches on all three. Alt is `Option` on a Mac and Meta
 * is a different key altogether, so either would be a shortcut that silently
 * stopped working when the sheet was carried to another machine.
 *
 * **At least one modifier**, always. A bare key would take that key away from
 * the run sheet's own player for as long as the preview is open — `ArrowDown` and
 * `Space` step the run — and the operator would have no way to see why.
 *
 * Pure, and free of every UI import: `PlaylistItem` (which draws the row and
 * reads what the entry is armed with) and the preview (which registers the key)
 * both need it.
 */

/**
 * The modifiers a shortcut may carry, in the order a canonical string writes
 * them. `AllControlType` in `KeyboardEventListener`, spelled again here as a
 * value because the order is part of the stored format.
 */
const CONTROL_KEY_LIST = ['Ctrl', 'Shift'] as const;

type ControlKeyType = (typeof CONTROL_KEY_LIST)[number];

type PlaylistActionKeyPartsType = {
    controlKeys: ControlKeyType[];
    key: string;
};

/**
 * A single character is stored UPPERCASE, so `a` and `A` are one shortcut.
 * `toShortcutKey` upper-cases both sides when it matches, so storing anything
 * else would be storing two spellings of the same key.
 */
function toCanonicalKey(key: string) {
    return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * A stored shortcut split back into its parts, or null when it is not one this
 * app wrote — a hand-edited file, or one written by a later version that allows
 * more than these two modifiers. Everything else here goes through this, so a
 * shortcut that cannot be parsed is simply not armed anywhere: not matched, not
 * registered, and not drawn on the row.
 */
function toPlaylistActionKeyParts(
    value: any,
): PlaylistActionKeyPartsType | null {
    if (typeof value !== 'string' || value === '') {
        return null;
    }
    const parts = value.split('+');
    const key = parts.pop() ?? '';
    // A key of its own is refused here rather than at the question alone: a file
    // carrying `A` would otherwise register a bare letter the moment it was read.
    if (key === '' || parts.length === 0) {
        return null;
    }
    const controlKeys = CONTROL_KEY_LIST.filter((controlKey) => {
        return parts.includes(controlKey);
    });
    // Exactly the modifiers this format knows, each once, in this order — so one
    // shortcut has one spelling and `Shift+Ctrl+A` never reads as a second
    // shortcut meaning the same thing.
    if (controlKeys.join('+') !== parts.join('+')) {
        return null;
    }
    if (key !== toCanonicalKey(key)) {
        return null;
    }
    return { controlKeys, key };
}

/** Whether a stored value is a shortcut this app wrote — and could write again. */
export function checkIsValidPlaylistActionKey(value: any): value is string {
    return toPlaylistActionKeyParts(value) !== null;
}

/**
 * The shortcut as the app's own keyboard layer speaks it, or null for one that
 * cannot be parsed.
 *
 * `allControlKey` rather than a per-platform list, which is what makes one stored
 * string match on Windows, Mac and Linux alike — see the module note above.
 */
export function toPlaylistActionKeyEventMapper(
    value: any,
): EventMapperType | null {
    const parts = toPlaylistActionKeyParts(value);
    if (parts === null) {
        return null;
    }
    return { key: parts.key, allControlKey: [...parts.controlKeys] };
}

/**
 * What a key PRESS means to the question that is asking for a shortcut.
 *
 * Three answers, and they are three because the operator has to be told which
 * one it was:
 * - the shortcut, when the press is one;
 * - a message to show, when the press cannot BE one — the reason matters, since
 *   "hold a modifier" and "not that modifier" are fixed differently;
 * - null, when there is nothing to say at all: a bare `Shift` on the way to
 *   `Shift+A` is the operator mid-gesture, not a mistake to complain about.
 */
export type PlaylistActionKeyAnswerType =
    { actionKey: string; message: null } | { actionKey: null; message: string };

export function readPlaylistActionKeyFromEvent(
    event: KeyboardEvent | { key: string; code?: string } | any,
): PlaylistActionKeyAnswerType | null {
    if (checkIsControlKeys(event)) {
        return null;
    }
    if (event.altKey === true || event.metaKey === true) {
        return { actionKey: null, message: 'Only Ctrl and Shift may be used' };
    }
    const controlKeys: ControlKeyType[] = [];
    if (event.ctrlKey === true) {
        controlKeys.push('Ctrl');
    }
    if (event.shiftKey === true) {
        controlKeys.push('Shift');
    }
    if (controlKeys.length === 0) {
        return { actionKey: null, message: 'Hold Ctrl or Shift with the key' };
    }
    // Through the layout-independent reading the rest of the app matches on, so
    // a shortcut set on a German keyboard is the same shortcut on an en-US one.
    const key = toCanonicalKey(KeyboardEventListener.toEnUsKey(event));
    const actionKey = [...controlKeys, key].join('+');
    if (!checkIsValidPlaylistActionKey(actionKey)) {
        return { actionKey: null, message: 'This key cannot be used' };
    }
    return { actionKey, message: null };
}
