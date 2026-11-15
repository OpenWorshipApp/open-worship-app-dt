/**
 * The Background panel's FILL kind -- a colour, a gradient or a pattern -- was
 * the COLOR kind until 2026-11-14 (the user: _rename all across code base to
 * make sure no where else using background color anymore_). What was saved
 * before still says so: a screen's background and the panel's last tab in the
 * settings, a tab's own transition, a slide's attached background
 * (`.bg.json`), a run sheet's line, an undo backup. This is the one place the
 * old names are spelled, and every reader of saved data asks it.
 *
 * Leaf on purpose: the screen window, the presenter and the agent helpers all
 * read saved backgrounds.
 */

const LEGACY_FILL_BACKGROUND_TYPE = 'color';
const LEGACY_FILL_DRAG_TYPE = 'bg-color';

/** A saved background type, with the old name for a fill read as `fill`. */
export function toCurrentBackgroundTypeName<T>(type: T): T | 'fill' {
    return type === LEGACY_FILL_BACKGROUND_TYPE ? 'fill' : type;
}

/** A saved drag kind, with the old name for a fill read as `bg-fill`. */
export function toCurrentDragTypeName<T>(type: T): T | 'bg-fill' {
    return type === LEGACY_FILL_DRAG_TYPE ? 'bg-fill' : type;
}

/**
 * A saved `{type, …}` record with its type read the current way; the same
 * object when nothing changed.
 */
export function withCurrentBackgroundType<T extends { type?: unknown }>(
    record: T,
): T {
    const type = toCurrentBackgroundTypeName(record.type);
    return type === record.type ? record : { ...record, type };
}

/** The same for a saved dropped item (`{type, item}`, a drag kind). */
export function withCurrentDragType<T extends { type?: unknown }>(
    record: T,
): T {
    const type = toCurrentDragTypeName(record.type);
    return type === record.type ? record : { ...record, type };
}

/**
 * A saved map keyed by background type (a tab's own transition), with the old
 * key read as `fill`; a key saved both ways keeps the current one.
 */
export function withCurrentBackgroundTypeKeys<T>(map: { [key: string]: T }): {
    [key: string]: T;
} {
    if (!Object.hasOwn(map, LEGACY_FILL_BACKGROUND_TYPE)) {
        return map;
    }
    const { [LEGACY_FILL_BACKGROUND_TYPE]: legacy, ...rest } = map;
    return Object.hasOwn(rest, 'fill') ? rest : { ...rest, fill: legacy };
}
