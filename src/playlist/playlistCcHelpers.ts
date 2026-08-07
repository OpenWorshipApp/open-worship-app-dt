/**
 * CC elements — everything about them that nothing else needs to import.
 *
 * Deliberately a LEAF: `PlaylistItem` imports this, and `PlaylistItem` is
 * already the bottom of an import graph the whole playlist panel sits on
 * (`playlistItemsHelpers.ts` documents the cycle this file must not close).
 * Nothing translated, nothing that reads a file, no React.
 */

/**
 * What a CC element STORES: the uuid of the listed entry it follows, and its own
 * pin if it has one. Nothing else.
 *
 * A CC is a REFERENCE, not a copy. Everything it shows and everything it sends to
 * a screen — the payload, the title, the colour, what a run action is armed with
 * — is read off that entry every time it is drawn, so re-arming a `Next: Timeout`
 * element re-arms every CC of it at once and a slide edited elsewhere reaches the
 * screen as it now is.
 *
 * Which means EVERY CC has an element of its own in the sheet: something dropped
 * on a row from outside is appended as an element first (`Playlist.addItemCcItem`
 * callers) and the CC then points at it. There is no such thing as a follower
 * with nothing to follow, so there is no dangling state to read defensively
 * around — a uuid that answers to nothing is an entry that has been removed, and
 * the CC goes with it.
 *
 * `screenIds` is the ONE thing a CC may say for itself: where it lands is about
 * this line of the sheet, not about what the element is. Absent means "wherever
 * the element itself is pinned, else wherever the host went".
 */
export type PlaylistCcItemType = {
    uuid: string;
    screenIds?: number[];
};

/**
 * A playlist entry's identity, stable for as long as the entry is in the sheet.
 *
 * Assigned when it is added and never rewritten — reordering, re-arming, parking,
 * pinning and colouring all leave it alone, which is exactly what makes it worth
 * pointing at. A DUPLICATE gets a new one: it is another line of the run sheet,
 * and its CCs must not move when the original's do.
 */
export function genPlaylistItemUuid() {
    return globalThis.crypto.randomUUID();
}

/** Whether a stored value is a uuid this app wrote — and could write again. */
export function checkIsValidPlaylistItemUuid(value: any): value is string {
    return typeof value === 'string' && value !== '';
}

/**
 * Stamped on every row, frame and card that IS a listed entry, so revealing what
 * a CC points at is one `querySelector` instead of a ref per row.
 *
 * The bare uuid, unscoped: it is unique across every playlist ever written, so
 * unlike the derived key it replaced it cannot pick up an identical-looking line
 * of a different run sheet.
 */
export const PLAYLIST_ITEM_UUID_ATTR = 'data-playlist-item-uuid';

/**
 * Marks a CC row. Read by the floating preview's element frame, whose capture
 * handler moves the run cursor onto whatever is clicked inside it — a CC is
 * shown BY the run, never something the run stops on.
 */
export const PLAYLIST_CC_ROW_ATTR = 'data-playlist-cc-row';

/**
 * Where a CC actually lands: its OWN pin if it has one, else wherever its host
 * just went. The same inheritance a document's slide makes against the element
 * above it — a CC pinned to nothing follows its host rather than going nowhere.
 */
export function resolveCcScreenIds(
    ccScreenIds: number[],
    hostScreenIds: number[],
) {
    return ccScreenIds.length > 0 ? ccScreenIds : hostScreenIds;
}
