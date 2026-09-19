/**
 * The pure half of `agentBackupHelpers.ts`: what a backup IS, how one is
 * named, the order an undo applies it in, which old ones are let go, and
 * which change an undo with no id means.
 *
 * Split out so it can be tested with no app behind it -- the other half
 * touches the disk, the trash and the editing history, and a rule about
 * ordering is exactly the kind of thing that must not be learned the day an
 * undo put a document's unsaved edits back into a file that did not exist yet.
 */

export type AgentEditableKindType = 'slide' | 'lyric';

/**
 * One thing an undo puts back. Taken BEFORE a change, so each carries the
 * state the change started from:
 *
 * - `file`: a file's text as it was on disk, or `null` when there was no file
 *   (the change created it, so undoing it moves it to the trash). `kind` marks
 *   a document with an editing history, which has to go with it.
 * - `editing`: a document's CURRENT state -- its editing-history head, unsaved
 *   edits and all. Put back as a new history entry, so Ctrl+Z still steps
 *   through it and nothing the user did since is thrown away.
 * - `rename`: what a file was called before.
 */
export type AgentRestoreType =
    | {
          type: 'file';
          filePath: string;
          text: string | null;
          kind?: AgentEditableKindType;
      }
    | {
          type: 'editing';
          kind: AgentEditableKindType;
          filePath: string;
          text: string;
      }
    | {
          type: 'rename';
          from: string;
          to: string;
          kind?: AgentEditableKindType;
      };

/** The small half of a backup: what a list of changes reads. */
export type AgentBackupMetaType = {
    id: string;
    at: string;
    /** For a person: "Moved the song “Amazing Grace” to the trash". */
    summary: string;
    filePaths: string[];
    /** On an undo's own entry: the change it undid. */
    undoOf?: string;
    undoneAt?: string;
    undoneBy?: string;
    /** The change was attempted and did not finish. */
    failedAt?: string;
};

/**
 * The last hundred changes, for thirty days. A backup is a safety net for
 * "put that back", not an archive: bounded, so a run of edits can never fill
 * the disk of a machine that has none to spare.
 */
export const AGENT_BACKUP_KEEP_COUNT = 100;
export const AGENT_BACKUP_KEEP_DAYS = 30;
/**
 * A slide document can carry its pictures inline. One larger than this is
 * refused a backup -- and so refused the change -- rather than written.
 */
export const AGENT_BACKUP_MAX_CHARS = 25 * 1024 * 1024;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^\d{8}-\d{9}-[a-z0-9]{2,8}$/;
const FILE_NAME_PATTERN = /^(\d{8}-\d{9}-[a-z0-9]{2,8})\.(meta|data)\.json$/;
// `YYYYMMDD-HHMMSSmmm`, the part of an id that says when.
const ID_TIME_LENGTH = 18;

/**
 * `20260914-151623456-k3x9`: when, to the millisecond, then a few random
 * letters. Sorts by time as plain text, which is all pruning and listing
 * need, and is nothing but digits, letters and dashes -- an id arrives from a
 * tool call and names a file.
 */
export function genAgentBackupId(now = new Date(), random = Math.random()) {
    const stamp = now.toISOString().replace(/[-:.TZ]/g, '');
    const suffix = random.toString(36).slice(2, 6).padEnd(4, '0');
    return `${stamp.slice(0, 8)}-${stamp.slice(8, 17)}-${suffix}`;
}

/** An id this module could have made -- and so a safe file name. */
export function checkIsAgentBackupId(id: unknown): id is string {
    return typeof id === 'string' && ID_PATTERN.test(id);
}

export function toAgentBackupFileNames(id: string) {
    return { meta: `${id}.meta.json`, data: `${id}.data.json` };
}

export function readAgentBackupFileName(fileName: string) {
    const matched = FILE_NAME_PATTERN.exec(fileName);
    return matched === null
        ? null
        : { id: matched[1], part: matched[2] as 'meta' | 'data' };
}

const RESTORE_PRIORITY_MAP: Record<AgentRestoreType['type'], number> = {
    rename: 0,
    file: 1,
    editing: 2,
};

/**
 * The order an undo applies what it puts back, whatever order the change
 * listed it in: a rename first, so the name everything else addresses is the
 * name on disk; then files, so a deleted document exists again; then editing
 * heads, which can only be written into a document that is there.
 */
export function sortRestoresForUndo(restores: AgentRestoreType[]) {
    return restores
        .map((restore, index) => {
            return { restore, index };
        })
        .sort((one, other) => {
            return (
                RESTORE_PRIORITY_MAP[one.restore.type] -
                    RESTORE_PRIORITY_MAP[other.restore.type] ||
                one.index - other.index
            );
        })
        .map(({ restore }) => {
            return restore;
        });
}

/** Every file a backup concerns, each once. */
export function listRestoreFilePaths(restores: AgentRestoreType[]) {
    const filePathSet = new Set<string>();
    for (const restore of restores) {
        if (restore.type === 'rename') {
            filePathSet.add(restore.from);
            filePathSet.add(restore.to);
        } else {
            filePathSet.add(restore.filePath);
        }
    }
    return [...filePathSet];
}

/** The ids to let go: past the count, or past the age. Oldest first. */
export function pickPrunableBackupIds(ids: string[], now = new Date()) {
    const sortedIds = [...new Set(ids)].sort();
    const cutoff = genAgentBackupId(
        new Date(now.getTime() - AGENT_BACKUP_KEEP_DAYS * DAY_MILLISECONDS),
        0,
    ).slice(0, ID_TIME_LENGTH);
    const excessCount = sortedIds.length - AGENT_BACKUP_KEEP_COUNT;
    return sortedIds.filter((id, index) => {
        return index < excessCount || id.slice(0, ID_TIME_LENGTH) < cutoff;
    });
}

/**
 * The change an undo means. With an id, that one. Without, the newest change
 * that is neither undone already nor itself an undo -- so "undo" twice steps
 * back through two changes rather than undoing and redoing the same one. To
 * put an undone change back, name its undo's id.
 */
export function pickUndoTarget(
    metaList: AgentBackupMetaType[],
    id?: string,
): AgentBackupMetaType | null {
    if (id !== undefined) {
        return (
            metaList.find((meta) => {
                return meta.id === id;
            }) ?? null
        );
    }
    const newestFirst = [...metaList].sort((one, other) => {
        return other.id.localeCompare(one.id);
    });
    return (
        newestFirst.find((meta) => {
            return meta.undoneAt === undefined && meta.undoOf === undefined;
        }) ?? null
    );
}

/**
 * Changes made AFTER `target`, still in force, that touched a file it
 * touched. Undoing `target` rolls those back with it -- they are not lost
 * (the undo takes its own backup first), but the answer has to say so.
 */
export function findLaterOverlappingChanges(
    metaList: AgentBackupMetaType[],
    target: AgentBackupMetaType,
) {
    const targetPathSet = new Set(target.filePaths);
    return metaList.filter((meta) => {
        return (
            meta.id > target.id &&
            meta.undoneAt === undefined &&
            meta.undoOf !== target.id &&
            meta.filePaths.some((filePath) => {
                return targetPathSet.has(filePath);
            })
        );
    });
}
