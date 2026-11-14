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

// `note` is here for what it CARRIES, not because a bible note is an
// `AppEditableDocumentSourceAbs`: it is not. A note file has an editing
// history all the same -- the note window writes into it and the human
// presses Save -- so a rename has to take that history with the file, a
// delete has to take it away, and an undo has to put it back.
// `presentingFlow` IS one, with the opposite twist: it has a history and no
// Save button, every write being the file, so a state put back is saved at
// once (`getEditableClass` in `agentBackupHelpers.ts`).
export type AgentEditableKindType =
    'slide' | 'lyric' | 'note' | 'presentingFlow';

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
          // An installed Bible: the app keeps parsed copies of it beside the
          // file and in every window, which must be dropped once the file is
          // put back, or the Bible reads as it was before the undo for a week.
          bibleKey?: string;
          // A file in a Resources folder (a study file, EC-464): nothing
          // watches those folders, so the panel is told once it is put back,
          // or it keeps a row for a file the undo just took away.
          isResource?: true;
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
      }
    | {
          // A BINARY file -- a picture, a clip, a track -- which no text
          // field can hold (2026-10-10, MC-52). Taken as `sourcePath`, the
          // file still on disk; `saveAgentBackup` copies it beside the
          // backup as `blobName` and writes that instead. An undo copies the
          // blob back over `filePath`.
          type: 'blob';
          filePath: string;
          sourcePath?: string;
          blobName?: string;
      }
    | {
          // One key of the app's home storage: what the Bible Note editor
          // keeps for itself -- its settings (the invisible-characters view)
          // and its block links (2026-11-08, the note toolbar through the
          // help window). `null` when the key was not there. `filePath` is
          // the note whose open window is told to show it.
          type: 'home-setting';
          key: string;
          text: string | null;
          filePath: string;
      }
    | {
          // One of the app's own settings -- a foreground component's
          // session, its words and its look (2026-11-09, the help window
          // changing a foreground component). `null` when the key was not
          // there, so an undo takes off a key the change made. `foreground`
          // names the component: its open panel is told to read its
          // settings again, and what of it is on a screen is dressed again.
          type: 'app-setting';
          key: string;
          text: string | null;
          foreground?: string;
      }
    | {
          // What one screen held in one slot of its foreground -- the items
          // of its `listKey` list (`countdownDataList`, ...) under `itemKey`,
          // their `id` ('' for a Default session's), none when the slot was
          // empty (2026-11-13, EC-540: an undo of a start put the session's
          // settings back and left its countdown running on the wall).
          // Kept AFTER the change, by diffing the screens around it
          // (`appendAgentBackupRestores`): which slots a show fills is known
          // only once it has.
          type: 'screen-foreground';
          screenId: number;
          listKey: string;
          itemKey: string;
          items: unknown[];
          foreground?: string;
      }
    | {
          // What one screen's text layer held -- the one a Bible passage and
          // a Long Text Show take turns in, `null` when it held nothing
          // (2026-11-13, EC-550: an undo of a Long Text Show's start put the
          // session back and left its text on the wall, over whatever it had
          // replaced). `expect` is what the layer has to hold for the undo
          // to touch it (`toTextLayerKey`): what the change left there. A
          // verse or another text put up since is left alone.
          type: 'screen-text';
          screenId: number;
          data: unknown;
          expect: string;
          foreground?: string;
      }
    | {
          // One control of one screen as it was -- what its Mini Screen card
          // sets: its group (colour note), display, stage, a layer's
          // transition, Line Sync, its tick, whether it is on, its lock --
          // or the Bible text style every screen shares (`style`, no
          // screen). Put back through the managers' own setters, so the
          // screens redraw and the card follows (2026-11-13,
          // `owa_screen_edit`). `target` is a transition's layer, the effect
          // manager's own name for it.
          type: 'screen-setting';
          field: AgentScreenSettingFieldType;
          screenId?: number;
          target?: string;
          value: unknown;
      }
    | {
          // What a screen's background or slide layer held, `null` for
          // nothing, put back only while it still holds `expect`, what the
          // change left there (`toScreenLayerKey`): one put up since stays
          // (2026-11-13, `owa_screen_edit`'s clear and a group's join).
          type: 'screen-layer';
          screenId: number;
          layer: 'background' | 'slide';
          data: unknown;
          expect: string;
      }
    | {
          // A screen the change ADDED -- the Mini Screen menu's Add New
          // Screen (2026-11-14, EC-630) -- taken away again by the undo
          // (`present: false`), only while it is still off, unlocked and
          // empty: on, or holding anything, it is somebody's screen now.
          // Or one an undo took away, put back (`present: true`) with its
          // card's settings as they were (`controls`).
          type: 'screen-presence';
          screenId: number;
          present: boolean;
          controls?: AgentScreenControlStateType;
      };

/**
 * A screen's controls, in the order a change's restores are listed and an
 * undo puts them back: a group first (joining one takes the group's lock and
 * content), the display, the stage before the transitions (a stage above 0
 * sets the slide one to none), the tick, then whether it is on and its lock,
 * which `sortRestoresForUndo` holds back for last when they go back ON -- and
 * an unlock puts first, before anything else of the screen goes back.
 */
export const AGENT_SCREEN_SETTING_FIELD_LIST = [
    'group',
    'display',
    'stage',
    'transition',
    'line-sync',
    'selected',
    'showing',
    'lock',
    'style',
] as const;
export type AgentScreenSettingFieldType =
    (typeof AGENT_SCREEN_SETTING_FIELD_LIST)[number];

const SCREEN_RESTORE_TYPE_SET = new Set<AgentRestoreType['type']>([
    'screen-foreground',
    'screen-text',
    'screen-setting',
    'screen-layer',
    'screen-presence',
]);

/** A restore that changes a screen, which only the Presenter page can do. */
export function checkIsScreenRestore(restore: AgentRestoreType) {
    return SCREEN_RESTORE_TYPE_SET.has(restore.type);
}

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
/**
 * A clip bigger than this is not copied beside its backup -- and so the
 * change that would trash it is refused, with the app's own Move to Trash
 * (and the Recycle Bin behind it) named as the route. A hundred such copies
 * is the most the store can hold, and the disk of a church machine is small.
 */
export const AGENT_BACKUP_MAX_BLOB_BYTES = 200 * 1024 * 1024;

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^\d{8}-\d{9}-[a-z0-9]{2,8}$/;
const FILE_NAME_PATTERN =
    /^(\d{8}-\d{9}-[a-z0-9]{2,8})\.(meta|data|blob-\d+)\.(?:json|bin)$/;
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

/** The copy of a binary file a backup keeps: `<id>.blob-<n>.bin`. */
export function toAgentBackupBlobName(id: string, index: number) {
    return `${id}.blob-${index}.bin`;
}

export function readAgentBackupFileName(fileName: string) {
    const matched = FILE_NAME_PATTERN.exec(fileName);
    if (matched === null) {
        return null;
    }
    const part = matched[2].startsWith('blob-') ? 'blob' : matched[2];
    return { id: matched[1], part: part as 'meta' | 'data' | 'blob' };
}

const RESTORE_PRIORITY_MAP: Record<AgentRestoreType['type'], number> = {
    rename: 0,
    file: 1,
    blob: 1,
    editing: 2,
    'home-setting': 4,
    'app-setting': 4,
    'screen-setting': 4,
    // Last: the session a screen's overlay belongs to is back before it is.
    'screen-foreground': 5,
    'screen-text': 5,
    'screen-layer': 5,
    // A screen taken away after everything else of the change went back;
    // one put back is first (`SCREEN_BACK_RESTORE_PRIORITY`).
    'screen-presence': 7,
};

// A screen unlocked before anything else of it goes back: locked, it refuses
// what goes onto it and its Line Sync too, whose setter asks the lock -- a
// change that turned Line Sync on and locked the screen lists the lock after
// it.
const UNLOCK_RESTORE_PRIORITY = 3;
// A screen locked again, or turned on again, once what goes back onto it is
// there: locked first it would refuse it, on first it would show the room
// the screen half put back.
const LAST_RESTORE_PRIORITY = 6;
// A screen put back before anything goes back onto it, an unlock included:
// a setting of a screen that is not there has nothing to go to.
const SCREEN_BACK_RESTORE_PRIORITY = UNLOCK_RESTORE_PRIORITY - 0.5;

function toRestorePriority(restore: AgentRestoreType) {
    if (restore.type === 'screen-presence' && restore.present) {
        return SCREEN_BACK_RESTORE_PRIORITY;
    }
    if (
        restore.type === 'screen-setting' &&
        (restore.field === 'lock' || restore.field === 'showing')
    ) {
        if (restore.value === true) {
            return LAST_RESTORE_PRIORITY;
        }
        if (restore.field === 'lock') {
            return UNLOCK_RESTORE_PRIORITY;
        }
    }
    return RESTORE_PRIORITY_MAP[restore.type];
}

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
                toRestorePriority(one.restore) -
                    toRestorePriority(other.restore) || one.index - other.index
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
        } else if (restore.type === 'app-setting') {
            // No file: the key, so a later change to the same setting is
            // named as going back with an undo of this one.
            filePathSet.add(`setting:${restore.key}`);
        } else if (restore.type === 'screen-foreground') {
            // No file either: the slot, so a later show into the same one is
            // named as going back with an undo of this one.
            filePathSet.add(
                `screen:${restore.screenId}:${restore.listKey}:${restore.itemKey}`,
            );
        } else if (restore.type === 'screen-text') {
            filePathSet.add(`screen:${restore.screenId}:text`);
        } else if (restore.type === 'screen-setting') {
            filePathSet.add(
                restore.screenId === undefined
                    ? `screen:${restore.field}`
                    : `screen:${restore.screenId}:${restore.field}` +
                          (restore.target === undefined
                              ? ''
                              : `:${restore.target}`),
            );
        } else if (restore.type === 'screen-layer') {
            filePathSet.add(`screen:${restore.screenId}:${restore.layer}`);
        } else if (restore.type === 'screen-presence') {
            filePathSet.add(`screen:${restore.screenId}`);
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
 * Whether a later change's subject went back with an undo of a change to
 * `targetPath`: the same one, or anything on a screen the change added or
 * took away (`screen:<id>`, a `screen-presence` restore) -- its controls,
 * its layers, its overlays (2026-11-14, EC-630: a screen added, moved and
 * turned on and off, went with the undo of its add, and nothing said so).
 */
function checkWentBackWith(targetPath: string, laterPath: string) {
    return (
        laterPath === targetPath ||
        (/^screen:\d+$/.test(targetPath) &&
            laterPath.startsWith(`${targetPath}:`))
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
    return metaList.filter((meta) => {
        return (
            meta.id > target.id &&
            meta.undoneAt === undefined &&
            meta.undoOf !== target.id &&
            meta.filePaths.some((filePath) => {
                return target.filePaths.some((targetPath) => {
                    return checkWentBackWith(targetPath, filePath);
                });
            })
        );
    });
}

/**
 * The undo's sentence about those later changes, naming what they shared
 * with it: a file, a setting (`setting:<key>`) or a screen (`screen:...`,
 * `listRestoreFilePaths`). It said "the same file" for all three, and a
 * screen's lock or group has no file -- the model passes the sentence on to
 * a person who changed none (2026-11-14, EC-613).
 */
export function genLaterChangesNote(
    target: AgentBackupMetaType,
    laterList: AgentBackupMetaType[],
) {
    if (laterList.length === 0) {
        return '';
    }
    const kindSet = new Set<string>();
    for (const meta of laterList) {
        for (const filePath of meta.filePaths) {
            if (
                !target.filePaths.some((targetPath) => {
                    return checkWentBackWith(targetPath, filePath);
                })
            ) {
                continue;
            }
            if (filePath.startsWith('screen:')) {
                kindSet.add('screen');
            } else if (filePath.startsWith('setting:')) {
                kindSet.add('setting');
            } else {
                kindSet.add('file');
            }
        }
    }
    const what =
        kindSet.size === 1 ? [...kindSet][0] : 'file, setting or screen';
    return (
        ` Later changes to the same ${what} went back with it -- ` +
        'say so; each can be put back from the list.'
    );
}

// --- a screen's foreground, slot by slot (EC-540) --------------------------

/**
 * One screen's items of one foreground list, as JSON: what a backup can hold
 * and what two moments of the same screen are compared by.
 */
export type AgentScreenListType = {
    screenId: number;
    items: unknown[];
};

/**
 * The slot an item of a foreground list fills: its `id` -- a session's, a
 * message's, a clock's, a screen's number -- '' for a Default session's, which
 * carries none (`toSessionDataKey`).
 */
export function toForegroundItemKey(item: unknown) {
    const id = (item as { id?: unknown } | null)?.id;
    return typeof id === 'string' || typeof id === 'number' ? `${id}` : '';
}

function groupBySlot(items: unknown[]) {
    const slotMap = new Map<string, unknown[]>();
    for (const item of items) {
        const itemKey = toForegroundItemKey(item);
        slotMap.set(itemKey, [...(slotMap.get(itemKey) ?? []), item]);
    }
    return slotMap;
}

/**
 * What a change did to the screens, as the restores that undo it: each slot
 * whose items differ between `beforeList` and `afterList`, with the items it
 * held before (none for one the change filled). A slot the change did not
 * touch is not named, so an undo leaves alone what else is on the wall --
 * another session's overlay, or one put up since.
 */
export function diffForegroundSlots(
    listKey: string,
    beforeList: AgentScreenListType[],
    afterList: AgentScreenListType[],
    foreground?: string,
): AgentRestoreType[] {
    const restoreList: AgentRestoreType[] = [];
    for (const after of afterList) {
        const beforeItems =
            beforeList.find((before) => {
                return before.screenId === after.screenId;
            })?.items ?? [];
        const beforeMap = groupBySlot(beforeItems);
        const afterMap = groupBySlot(after.items);
        const itemKeySet = new Set([...beforeMap.keys(), ...afterMap.keys()]);
        for (const itemKey of itemKeySet) {
            const items = beforeMap.get(itemKey) ?? [];
            if (
                JSON.stringify(items) ===
                JSON.stringify(afterMap.get(itemKey) ?? [])
            ) {
                continue;
            }
            restoreList.push({
                type: 'screen-foreground',
                screenId: after.screenId,
                listKey,
                itemKey,
                items,
                ...(foreground === undefined ? {} : { foreground }),
            });
        }
    }
    return restoreList;
}

export type AgentTextLayerType = {
    screenId: number;
    data: unknown;
};

/**
 * What a screen's text layer holds, as an undo tells one thing there from
 * another: '' for nothing, a long text by the session that put it up -- its
 * words may be scrolled or restyled since and it is still that text -- and a
 * Bible passage by its verses.
 */
export function toTextLayerKey(data: unknown) {
    if (typeof data !== 'object' || data === null) {
        return '';
    }
    const layer = data as {
        type?: unknown;
        longTextData?: { sourceId?: unknown };
        bibleItemData?: { bibleItem?: unknown };
    };
    if (layer.type === 'long-text') {
        return `long-text:${String(layer.longTextData?.sourceId ?? '')}`;
    }
    return `bible:${JSON.stringify(layer.bibleItemData?.bibleItem ?? null)}`;
}

/**
 * What a change did to the screens' text layers, as the restores that undo
 * it: each screen whose layer differs between `beforeList` and `afterList`,
 * with what it held before and what it holds now, by key (`expect`). A
 * screen the change did not touch is not named.
 */
export function diffTextLayers(
    beforeList: AgentTextLayerType[],
    afterList: AgentTextLayerType[],
    foreground?: string,
): AgentRestoreType[] {
    const restoreList: AgentRestoreType[] = [];
    for (const after of afterList) {
        const data =
            beforeList.find((before) => {
                return before.screenId === after.screenId;
            })?.data ?? null;
        if (JSON.stringify(data) === JSON.stringify(after.data ?? null)) {
            continue;
        }
        restoreList.push({
            type: 'screen-text',
            screenId: after.screenId,
            data,
            expect: toTextLayerKey(after.data),
            ...(foreground === undefined ? {} : { foreground }),
        });
    }
    return restoreList;
}

// --- a screen's controls and layers (owa_screen_edit) ---------------------

/** One screen's controls at one moment, as JSON values. */
export type AgentScreenControlStateType = {
    screenId: number;
    values: Partial<
        Record<
            Exclude<AgentScreenSettingFieldType, 'transition' | 'style'>,
            unknown
        >
    >;
    /** Each layer's transition, by the effect manager's `target`. */
    transitions: Record<string, unknown>;
};

export type AgentScreenControlsType = {
    style: unknown;
    screens: AgentScreenControlStateType[];
};

function checkIsSameJson(one: unknown, other: unknown) {
    return JSON.stringify(one ?? null) === JSON.stringify(other ?? null);
}

// The slide layer's transition, which a stage above 0 sets to none.
const SLIDE_EFFECT_TARGET = 'vary-app-document';

/**
 * What a change did to the screens' controls, as the restores that undo it,
 * each with what it was before -- in `AGENT_SCREEN_SETTING_FIELD_LIST`'s
 * order, a screen at a time, the shared style last. A screen's slide
 * transition goes back whenever its stage does, changed or not: the stage
 * put back can set it to none (`ScreenManager.stage`), and the transition
 * after it puts the one it had back. A screen there only after the change
 * has nothing to go back to.
 */
export function diffScreenSettings(
    before: AgentScreenControlsType,
    after: AgentScreenControlsType,
): AgentRestoreType[] {
    const restoreList: AgentRestoreType[] = [];
    for (const afterScreen of after.screens) {
        const beforeScreen = before.screens.find((screen) => {
            return screen.screenId === afterScreen.screenId;
        });
        if (beforeScreen === undefined) {
            continue;
        }
        const { screenId } = afterScreen;
        const isStageChanged = !checkIsSameJson(
            beforeScreen.values.stage,
            afterScreen.values.stage,
        );
        for (const field of AGENT_SCREEN_SETTING_FIELD_LIST) {
            if (field === 'style') {
                continue;
            }
            if (field === 'transition') {
                for (const [target, value] of Object.entries(
                    beforeScreen.transitions,
                )) {
                    if (
                        checkIsSameJson(
                            value,
                            afterScreen.transitions[target],
                        ) &&
                        !(isStageChanged && target === SLIDE_EFFECT_TARGET)
                    ) {
                        continue;
                    }
                    restoreList.push({
                        type: 'screen-setting',
                        field,
                        screenId,
                        target,
                        value,
                    });
                }
                continue;
            }
            const value = beforeScreen.values[field];
            if (checkIsSameJson(value, afterScreen.values[field])) {
                continue;
            }
            restoreList.push({
                type: 'screen-setting',
                field,
                screenId,
                value: value ?? null,
            });
        }
    }
    if (!checkIsSameJson(before.style, after.style)) {
        restoreList.push({
            type: 'screen-setting',
            field: 'style',
            value: before.style ?? null,
        });
    }
    return restoreList;
}

/** One screen's background and slide layers at one moment, as JSON. */
export type AgentScreenLayerStateType = {
    screenId: number;
    background: unknown;
    slide: unknown;
};

/**
 * What a change did to the screens' background and slide layers, as the
 * restores that undo it: each layer that differs, with what it held before
 * and, as `expect`, what it holds now.
 */
export function diffScreenLayers(
    beforeList: AgentScreenLayerStateType[],
    afterList: AgentScreenLayerStateType[],
): AgentRestoreType[] {
    const restoreList: AgentRestoreType[] = [];
    for (const after of afterList) {
        const before = beforeList.find((one) => {
            return one.screenId === after.screenId;
        });
        if (before === undefined) {
            continue;
        }
        for (const layer of ['background', 'slide'] as const) {
            if (checkIsSameJson(before[layer], after[layer])) {
                continue;
            }
            restoreList.push({
                type: 'screen-layer',
                screenId: after.screenId,
                layer,
                data: before[layer] ?? null,
                expect: toScreenLayerKey(after[layer]),
            });
        }
    }
    return restoreList;
}

/**
 * The screens a change added -- live after it and not before -- as the
 * restores that take each away again. A screen gone by the end of a change
 * is not here: no change takes one away.
 */
export function genAddedScreenRestores(
    beforeIdList: readonly number[],
    afterIdList: readonly number[],
): Extract<AgentRestoreType, { type: 'screen-presence' }>[] {
    const beforeIdSet = new Set(beforeIdList);
    return [...new Set(afterIdList)]
        .filter((screenId) => {
            return !beforeIdSet.has(screenId);
        })
        .sort((one, other) => {
            return one - other;
        })
        .map((screenId) => {
            return { type: 'screen-presence', screenId, present: false };
        });
}

/**
 * What a screen's background or slide layer holds, as an undo tells one
 * from another: '' for nothing, else the data's length and a short hash of
 * it -- a slide's data is its whole canvas, too long to keep twice.
 */
export function toScreenLayerKey(data: unknown) {
    if (data === null || data === undefined) {
        return '';
    }
    const text = JSON.stringify(data);
    let hash = 5381;
    for (let index = 0; index < text.length; index++) {
        hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
    }
    return `${text.length}:${hash.toString(36)}`;
}

/**
 * `list` with the slot `itemKey` holding `items` instead: in the place it
 * holds now, else at the end; emptied when `items` is. Every other item is
 * the same object it was -- the manager keys what it drew by identity.
 */
export function mergeForegroundSlot<T>(list: T[], itemKey: string, items: T[]) {
    const index = list.findIndex((item) => {
        return toForegroundItemKey(item) === itemKey;
    });
    const keptList = list.filter((item) => {
        return toForegroundItemKey(item) !== itemKey;
    });
    const at = index === -1 ? keptList.length : index;
    return [...keptList.slice(0, at), ...items, ...keptList.slice(at)];
}
