/**
 * What an editing-history folder is CALLED, and nothing else.
 *
 * Deliberately a LEAF — no imports at all — because the three modules that need
 * it sit in three different graphs: `EditingHistoryManager` (which owns the
 * folder), `DirSource` (which has to recognize a change inside one and blame the
 * file it belongs to) and the data archive (which excludes them from an export).
 *
 * Holding it in `DirSource` instead cost both of the others something real:
 * `EditingHistoryManager` is reachable from NODE-environment tests, and
 * `DirSource` pulls `langHelpers` — and through it the whole browser-only
 * `appProvider`, which touches `document` at module scope — so importing one
 * string took every one of those tests down while the file was still being
 * imported. The archive paid differently: its tests mock `DirSource` wholesale,
 * so the constant came back `undefined` and was quietly baked into a regex.
 */

/** The suffix appended to a file's path to name its history folder. */
export const HISTORY_DIR_NAME_SUFFIX = '.histories';

/** Where a file's editing history lives. */
export function toEditingHistoryFolderPath(filePath: string) {
    return `${filePath}${HISTORY_DIR_NAME_SUFFIX}`;
}
