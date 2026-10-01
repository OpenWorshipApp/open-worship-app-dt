/**
 * Edits an editor is still holding back, flushed before the document's
 * history is moved.
 *
 * The slide editor's Properties panel batches what is typed into it for half
 * a second before it commits, so typing stays smooth. A save, an undo or a
 * redo pressed inside that half second reached the history BEFORE the last
 * change did: Ctrl+S straight after typing a new Top saved the old one and
 * left the new one sitting unsaved (found 2026-09-30). The editor registers a
 * flush here, keyed by the document it edits, and the history operations run
 * it first -- which turns the held-back edit into a tracked write they then
 * wait for.
 *
 * A leaf: no imports, so the document classes can use it without pulling any
 * editor code in.
 */

const flusherMap = new Map<string, Set<() => void>>();

export function registerPendingEditFlusher(
    filePath: string,
    flush: () => void,
) {
    let flushers = flusherMap.get(filePath);
    if (flushers === undefined) {
        flushers = new Set();
        flusherMap.set(filePath, flushers);
    }
    flushers.add(flush);
    return () => {
        flushers.delete(flush);
        if (flushers.size === 0) {
            flusherMap.delete(filePath);
        }
    };
}

export function flushPendingEdits(filePath: string) {
    const flushers = flusherMap.get(filePath);
    if (flushers === undefined) {
        return;
    }
    for (const flush of Array.from(flushers)) {
        flush();
    }
}
