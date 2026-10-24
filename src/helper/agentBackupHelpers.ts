/**
 * Every change an agent makes to the user's data can be put back.
 *
 * The data tools -- `owa_lyric_file`, `owa_slide_file`, `owa_bible_item`,
 * `owa_bible_note` -- create, change, rename and delete the user's own files,
 * and some of what they touch has no undo of its own at all: a Bibles list or a
 * notes file is written straight to disk, with no editing history and no `*`.
 * The rule this module enforces, asked for in so many words ("make sure all
 * actions have backup action, e.g. delete it should move to trash and can
 * undo"):
 *
 *  - **No backup, no change.** A worker takes what it is about to change
 *    (`snapshotAgentFile`, `snapshotAgentEditing`, `snapshotAgentSidecars`),
 *    saves it (`saveAgentBackup`, which throws when it cannot), and only then
 *    changes anything. A change whose backup could not be written is refused.
 *  - **A delete is a move to the trash** (`trashAgentFile`), exactly what the
 *    app's own Move to Trash does, and the file's text is kept here too -- the
 *    OS trash cannot be emptied back into a folder by a program, so that copy is
 *    what `owa_undo` restores from.
 *  - **An undo is itself a change.** It takes its own backup of the state it is
 *    about to overwrite before it writes anything, so undoing the wrong thing
 *    is one more undo away from right, and nothing the user did in between is
 *    lost.
 *
 * Where: `<data folder>/agent-backups/`, two files a change -- a small
 * `.meta.json` a list reads and the `.data.json` only an undo reads, so listing
 * the last twenty changes never reads a document's worth of text twenty times.
 * Bounded by count and age (`agentBackupPlanHelpers.ts`), and deliberately not
 * one of the data directories a whole-data archive carries.
 *
 * Imported lazily, by the relay in `domHelpers.ts` and by the workers, and it
 * imports the document classes lazily in turn -- the app-document graph closes
 * a cycle when entered from a module this shallow (memory:
 * `app-document-helpers-lyric-cycle`).
 */
import { appManagedDataDirNames } from './constants';
import { handleError } from './errorHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsCloneFile,
    fsCreateDir,
    fsDeleteFile,
    fsGetFileStamp,
    fsListFiles,
    fsListFilesWithMimetype,
    fsReadFile,
    fsWriteFile,
    getFileFullName,
    pathJoin,
} from '../server/fileHelpers';
import {
    AGENT_BACKUP_MAX_BLOB_BYTES,
    AGENT_BACKUP_MAX_CHARS,
    type AgentBackupMetaType,
    type AgentEditableKindType,
    type AgentRestoreType,
    checkIsAgentBackupId,
    findLaterOverlappingChanges,
    genAgentBackupId,
    listRestoreFilePaths,
    pickPrunableBackupIds,
    pickUndoTarget,
    readAgentBackupFileName,
    sortRestoresForUndo,
    toAgentBackupBlobName,
    toAgentBackupFileNames,
} from './agentBackupPlanHelpers';

export type { AgentEditableKindType, AgentRestoreType };

export type AgentResultType = {
    isError?: boolean;
    reason?: string;
} & Record<string, unknown>;

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

/** The sentence a worker answers with when a backup could not be saved. */
export function genNoBackupReason(error: unknown) {
    return (
        'Nothing was changed: the backup that lets it be undone could not be ' +
        `saved first (${String((error as any)?.message ?? error)}), and no ` +
        'change is made without one.'
    );
}

// The files every document drags along: its attached background, the
// preview of it and its slides' own transitions. Trashed with it, renamed with
// it, and backed up with it. (Literal rather than imported: this module is
// reached from the agent relay and keeps its imports lazy.)
export const AGENT_SIDECAR_EXTENSIONS = [
    '.bg.json',
    '.preview.bg.json',
    '.transition.json',
];

async function getFileSourceClass() {
    const { default: FileSourceClass } = await import('./FileSource');
    return FileSourceClass;
}

/**
 * A bible note in the shape the three things above ask of an editable
 * document -- read its live state, put a state back, clean up on delete.
 *
 * `Note` is deliberately NOT an `AppEditableDocumentSourceAbs` (the Bible
 * Notes list writes the file straight through, and only the note WINDOW goes
 * through the history), so it has no `getInstance`. It has the history all
 * the same, and everything here is about the history.
 */
async function getNoteEditableClass() {
    const { default: Note } = await import('../bible-list/note/Note');
    return {
        getInstance(filePath: string) {
            return {
                async getJsonData() {
                    // NULL when this note has no history folder, and that is
                    // the point: `fromFilePathEditing` falls back to the file
                    // when there is none, and backing THAT up as an "editing"
                    // state would have an undo build a history folder for a
                    // note nobody ever opened a window on -- whose first
                    // entry is a whole clone of the file.
                    const { default: EditingHistoryManager } =
                        await import('../editing-manager/EditingHistoryManager');
                    const manager = EditingHistoryManager.getInstance(filePath);
                    if (!(await manager.checkHasHistories())) {
                        return null;
                    }
                    const note = await Note.fromFilePathEditing(filePath);
                    return note === null ? null : note.toJson();
                },
                async setJsonData(jsonData: any) {
                    // A new history STEP, exactly like a document's
                    // `setJsonData`: putting a state back is itself something
                    // the user can walk out of again in the note window.
                    await Note.fromJson(filePath, jsonData).addEditingHistory();
                },
                async preDelete() {
                    const { attachBackgroundManager } =
                        await import('../others/AttachBackgroundManager');
                    await attachBackgroundManager.deleteMetaDataFile(filePath);
                    // The FOLDER, not `discard()`: that one is a no-op when
                    // there is no step to walk back, and the whole point here
                    // is that nothing of this file is left for a note made
                    // under the same name to inherit.
                    const { default: EditingHistoryManager } =
                        await import('../editing-manager/EditingHistoryManager');
                    await EditingHistoryManager.getInstance(
                        filePath,
                    ).deleteHistories();
                },
            };
        },
    };
}

/**
 * A run sheet in the same shape. It is an `AppEditableDocumentSourceAbs`,
 * but one with no Save button: the panel writes every change to the file at
 * once (`PresentingFlow.setItems` is `setJsonData` then `save`), so a state put
 * back goes the same way, or the panel would read the restored head while the
 * file on disk still held the undone change. Its settings go with a delete the
 * way the panel's own Move to Trash takes them.
 */
async function getPresentingFlowEditableClass() {
    const { default: PresentingFlow } =
        await import('../presenting-flow/PresentingFlow');
    return {
        getInstance(filePath: string) {
            const flow = PresentingFlow.getInstance(filePath);
            return {
                getJsonData() {
                    return flow.getJsonData();
                },
                async setJsonData(jsonData: any) {
                    await flow.setJsonData(jsonData);
                    await flow.save();
                },
                async preDelete() {
                    await flow.preDelete();
                    const { removePresentingFlowSettings } =
                        await import('../presenting-flow/presentingFlowHelpers');
                    await removePresentingFlowSettings(filePath);
                },
            };
        },
    };
}

async function getEditableClass(kind: AgentEditableKindType) {
    if (kind === 'note') {
        return await getNoteEditableClass();
    }
    if (kind === 'presentingFlow') {
        return await getPresentingFlowEditableClass();
    }
    if (kind === 'lyric') {
        const { default: Lyric } = await import('../lyric-list/Lyric');
        return Lyric;
    }
    const { default: AppDocument } =
        await import('../app-document-list/AppDocument');
    return AppDocument;
}

export async function getAgentBackupDirPath() {
    const { appLocalStorage } =
        await import('../setting/directory-setting/appLocalStorage');
    return pathJoin(
        appLocalStorage.defaultStorageDirPath,
        appManagedDataDirNames.AGENT_BACKUP,
    );
}

// --- taking what is about to change -------------------------------------

/**
 * A file's text as it is on disk right now, or `null` when there is no file.
 * Read past the app's short read cache on purpose: a backup of what a cache
 * remembers is a backup of something that may no longer be there.
 */
export async function snapshotAgentFile(
    filePath: string,
    kind?: AgentEditableKindType,
): Promise<AgentRestoreType> {
    const text = (await fsCheckFileExist(filePath))
        ? await fsReadFile(filePath)
        : null;
    return kind === undefined
        ? { type: 'file', filePath, text }
        : { type: 'file', filePath, text, kind };
}

/**
 * A document's CURRENT state -- the editing-history head, which is what the
 * user sees, unsaved edits included -- or null when it cannot be read.
 */
export async function snapshotAgentEditing(
    kind: AgentEditableKindType,
    filePath: string,
): Promise<AgentRestoreType | null> {
    if (!(await fsCheckFileExist(filePath))) {
        return null;
    }
    const DocumentClass = await getEditableClass(kind);
    const jsonData = await DocumentClass.getInstance(filePath).getJsonData();
    return jsonData === null
        ? null
        : {
              type: 'editing',
              kind,
              filePath,
              text: JSON.stringify(jsonData, null, 2),
          };
}

/** The sidecar files a document has, as they are. */
export async function snapshotAgentSidecars(filePath: string) {
    const restoreList: AgentRestoreType[] = [];
    for (const extension of AGENT_SIDECAR_EXTENSIONS) {
        const sidecarPath = `${filePath}${extension}`;
        if (await fsCheckFileExist(sidecarPath)) {
            restoreList.push(await snapshotAgentFile(sidecarPath));
        }
    }
    return restoreList;
}

/**
 * Everything a delete must be able to put back: the file as saved, a
 * document's unsaved state on top of it, and its sidecars.
 */
export async function snapshotAgentFileForDelete(
    filePath: string,
    kind?: AgentEditableKindType,
) {
    const restoreList: AgentRestoreType[] = [
        await snapshotAgentFile(filePath, kind),
    ];
    if (kind !== undefined) {
        const editing = await snapshotAgentEditing(kind, filePath);
        if (editing !== null) {
            restoreList.push(editing);
        }
    }
    restoreList.push(...(await snapshotAgentSidecars(filePath)));
    return restoreList;
}

// --- the store -----------------------------------------------------------

async function writeJsonFile(filePath: string, data: unknown) {
    await fsWriteFile(filePath, JSON.stringify(data));
    if (!(await fsCheckFileExist(filePath))) {
        throw new Error('the backup file was not written');
    }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        if (!(await fsCheckFileExist(filePath))) {
            return null;
        }
        return JSON.parse(await fsReadFile(filePath)) as T;
    } catch (error) {
        handleError(error);
    }
    return null;
}

async function pruneAgentBackups(dirPath: string) {
    const fileNameList = await fsListFiles(dirPath);
    const idList = fileNameList
        .map((fileName) => {
            return readAgentBackupFileName(fileName)?.id ?? null;
        })
        .filter((id): id is string => {
            return id !== null;
        });
    for (const id of pickPrunableBackupIds(idList)) {
        const { meta, data } = toAgentBackupFileNames(id);
        // Meta first: a data file with no meta is invisible to a list, while
        // a meta pointing at missing data would offer an undo that fails.
        await fsDeleteFile(pathJoin(dirPath, meta));
        await fsDeleteFile(pathJoin(dirPath, data));
        // ...then the binary copies the change kept, which are the bulk.
        for (const fileName of fileNameList) {
            const read = readAgentBackupFileName(fileName);
            if (read?.id === id && read.part === 'blob') {
                await fsDeleteFile(pathJoin(dirPath, fileName));
            }
        }
    }
}

/**
 * Copy the binary files a change is about to remove beside its backup, and
 * point the restores at the copies. Done before the data file is written, so
 * a backup never names a blob that is not there.
 */
/** The sentence for a file too big to keep a copy of. */
export function genBlobTooBigReason(fileName: string, size: number) {
    return (
        `"${fileName}" is ${Math.round(size / 1048576)} MB, too big for ` +
        'the copy an undo needs'
    );
}

async function keepBlobs(
    dirPath: string,
    id: string,
    restores: AgentRestoreType[],
) {
    let index = 0;
    const kept: AgentRestoreType[] = [];
    const blobPaths: string[] = [];
    try {
        for (const restore of restores) {
            if (restore.type !== 'blob' || restore.sourcePath === undefined) {
                kept.push(restore);
                continue;
            }
            // The cap holds for an undo's own snapshot too: the file put
            // back over may be a far bigger one the user dropped in since.
            const stamp = await fsGetFileStamp(restore.sourcePath);
            if (stamp === null) {
                throw new Error(`there is no file at "${restore.sourcePath}"`);
            }
            if (stamp.size > AGENT_BACKUP_MAX_BLOB_BYTES) {
                throw new Error(
                    genBlobTooBigReason(
                        getFileFullName(restore.sourcePath) ?? '',
                        stamp.size,
                    ),
                );
            }
            const blobName = toAgentBackupBlobName(id, index);
            index += 1;
            const blobPath = pathJoin(dirPath, blobName);
            await fsCloneFile(restore.sourcePath, blobPath);
            blobPaths.push(blobPath);
            kept.push({ type: 'blob', filePath: restore.filePath, blobName });
        }
    } catch (error) {
        await dropBlobs(blobPaths);
        throw error;
    }
    return { kept, blobPaths };
}

/** The copies of a backup that will not be written: nothing may orphan them. */
async function dropBlobs(blobPaths: string[]) {
    for (const blobPath of blobPaths) {
        await fsDeleteFile(blobPath).catch(handleError);
    }
}

/**
 * Keeps what a change is about to overwrite. Throws when it cannot: the
 * caller's answer to a throw is to change nothing.
 */
export async function saveAgentBackup(
    summary: string,
    restores: AgentRestoreType[],
    extra: Pick<AgentBackupMetaType, 'undoOf'> = {},
): Promise<AgentBackupMetaType> {
    const now = new Date();
    const id = genAgentBackupId(now);
    const dirPath = await getAgentBackupDirPath();
    if (!(await fsCheckDirExist(dirPath))) {
        await fsCreateDir(dirPath);
    }
    // Judged before any copy is made: a blob entry is a few characters
    // either way, and a copy made for a backup that is then refused -- or
    // whose data file cannot be written -- would sit in the folder until
    // the prune reached it.
    if (JSON.stringify(restores).length > AGENT_BACKUP_MAX_CHARS) {
        throw new Error('what it would change is too large to back up');
    }
    const { kept: keptRestores, blobPaths } = await keepBlobs(
        dirPath,
        id,
        restores,
    );
    const dataText = JSON.stringify({ id, restores: keptRestores });
    const meta: AgentBackupMetaType = {
        id,
        at: now.toISOString(),
        summary,
        filePaths: listRestoreFilePaths(keptRestores),
        ...extra,
    };
    const { meta: metaName, data: dataName } = toAgentBackupFileNames(id);
    try {
        // Data before meta: a meta must never point at data that is not there.
        await fsWriteFile(pathJoin(dirPath, dataName), dataText);
        await writeJsonFile(pathJoin(dirPath, metaName), meta);
    } catch (error) {
        await dropBlobs(blobPaths);
        throw error;
    }
    try {
        await pruneAgentBackups(dirPath);
    } catch (error) {
        // A backup that could not let an old one go is still a backup.
        handleError(error);
    }
    return meta;
}

async function updateAgentBackupMeta(
    id: string,
    patch: Partial<AgentBackupMetaType>,
) {
    const dirPath = await getAgentBackupDirPath();
    const metaPath = pathJoin(dirPath, toAgentBackupFileNames(id).meta);
    const meta = await readJsonFile<AgentBackupMetaType>(metaPath);
    if (meta !== null) {
        await writeJsonFile(metaPath, { ...meta, ...patch });
    }
}

/**
 * Take the backup, then make the change. When the backup cannot be saved the
 * change is not attempted and `NoBackupError` says so; when the change itself
 * fails the backup stays -- whatever part of it happened can still be put
 * back -- and is marked as a change that did not finish.
 */
export class NoBackupError extends Error {}

export async function runWithAgentBackup<T>(
    summary: string,
    restores: AgentRestoreType[],
    change: () => Promise<T>,
): Promise<{ meta: AgentBackupMetaType; value: T }> {
    let meta: AgentBackupMetaType;
    try {
        meta = await saveAgentBackup(summary, restores);
    } catch (error) {
        throw new NoBackupError(genNoBackupReason(error));
    }
    try {
        return { meta, value: await change() };
    } catch (error) {
        await updateAgentBackupMeta(meta.id, {
            failedAt: new Date().toISOString(),
        }).catch(handleError);
        throw error;
    }
}

/** What every change answers with, so the model can say how to undo it. */
export function genUndoField(meta: AgentBackupMetaType) {
    return {
        undoId: meta.id,
        undo: `owa_undo with id "${meta.id}" puts this back.`,
    };
}

// --- the moves a change and an undo share --------------------------------

/**
 * The app's own Move to Trash, minus the question: the file to the OS trash,
 * then its sidecars, then -- only once the file is really gone -- a document's
 * editing history, or a file created later under the same name would open
 * showing this one's unsaved edits. Throws when the file is still there.
 */
export async function trashAgentFile(
    filePath: string,
    kind?: AgentEditableKindType,
) {
    const FileSourceClass = await getFileSourceClass();
    const fileSource = FileSourceClass.getInstance(filePath);
    await fileSource.trash();
    if (await fsCheckFileExist(filePath)) {
        // Never deleted outright from here: on a drive with no trash (a USB
        // stick on Windows) only a PERSON may agree to that, through the
        // app's own Move to Trash, which then asks them.
        throw new Error(
            `"${fileSource.name}" could not be moved to the trash, so it was ` +
                'left where it is. If it is on a USB flash drive, Windows ' +
                'keeps no Recycle Bin there: the person can remove it with ' +
                'Move to Trash in the app, which asks before deleting it ' +
                'permanently.',
        );
    }
    const { trashAllMaterialFiles } = await import('../server/appHelpers');
    await trashAllMaterialFiles(fileSource);
    if (kind !== undefined) {
        const DocumentClass = await getEditableClass(kind);
        await DocumentClass.getInstance(filePath).preDelete();
    } else {
        const { attachBackgroundManager } =
            await import('../others/AttachBackgroundManager');
        await attachBackgroundManager.deleteMetaDataFile(filePath);
        const { slideTransitionManager } =
            await import('../others/SlideTransitionManager');
        await slideTransitionManager.deleteMetaDataFile(filePath);
    }
}

/**
 * A rename that takes everything the file owns with it: the editing history
 * (or unsaved edits stay behind under the old name and the `*` disappears)
 * and the sidecars (or its attached background does). Answers the renamed
 * file's path; throws when it was not renamed.
 */
export async function renameAgentFile(
    filePath: string,
    newName: string,
    kind?: AgentEditableKindType,
) {
    const FileSourceClass = await getFileSourceClass();
    const fileSource = FileSourceClass.getInstance(filePath);
    const oldName = fileSource.name;
    const renamed = await fileSource.renameTo(newName);
    if (renamed === null) {
        throw new Error(
            `"${oldName}" could not be renamed. Either it is not there, or ` +
                `something called "${newName}" already is.`,
        );
    }
    if (kind !== undefined) {
        const { default: EditingHistoryManager } =
            await import('../editing-manager/EditingHistoryManager');
        await EditingHistoryManager.moveFilePath(filePath, renamed.filePath);
    }
    const { renameAllMaterialFiles } = await import('../server/appHelpers');
    await renameAllMaterialFiles(fileSource, newName);
    renamed.fireUpdateEvent();
    return renamed.filePath;
}

// --- naming the files a worker works on ------------------------------------

/**
 * Every kind of file the Documents list shows -- what a run sheet takes as a
 * document line, and what `owa_media_file` lists and imports as a document.
 */
export const AGENT_DOCUMENT_MIMETYPE_NAMES: MimetypeNameType[] = [
    'appDocument',
    'lyric',
    'pdf',
    'pptx',
    'docx',
];

/**
 * A named file's full path in a folder, or null when the name would not stay
 * inside it. Checked on the JOINED path rather than trusted to the name rules
 * (`agentFileName.mjs`): two checks that agree cost nothing, and this is the
 * one actually about staying in the folder.
 */
export function toAgentFilePath(
    dirPath: string,
    name: string,
    extension?: string,
) {
    const filePath = pathJoin(
        dirPath,
        extension === undefined ? name : `${name}.${extension}`,
    );
    const toPosix = (one: string) => {
        return one.split('\\').join('/');
    };
    const dir = toPosix(dirPath).replace(/\/+$/, '');
    return toPosix(filePath).startsWith(`${dir}/`) ? filePath : null;
}

/** `Name (2)`, `Name (3)` … the first name no file answers to. */
export async function findAgentFreeName(
    dirPath: string,
    name: string,
    extension: string,
) {
    for (let index = 2; index < 100; index += 1) {
        const candidate = `${name} (${index})`;
        const candidatePath = toAgentFilePath(dirPath, candidate, extension);
        if (
            candidatePath !== null &&
            !(await fsCheckFileExist(candidatePath))
        ) {
            return candidate;
        }
    }
    return `${name} (${Date.now().toString(36)})`;
}

/**
 * The files of one kind in a folder, by the name a panel shows them under,
 * the default first -- the order the Bibles and Bible Notes panels list them.
 */
export async function listAgentFiles(
    dirPath: string,
    mimetypeName: MimetypeNameType,
    defaultName: string,
) {
    const filePathList =
        (await fsListFilesWithMimetype(dirPath, mimetypeName)) ?? [];
    const FileSourceClass = await getFileSourceClass();
    return filePathList
        .map((filePath) => {
            const fileSource = FileSourceClass.getInstance(filePath);
            return {
                filePath,
                name: fileSource.name,
                fullName: fileSource.fullName,
            };
        })
        .sort((one, other) => {
            if (one.name === defaultName || other.name === defaultName) {
                return one.name === defaultName ? -1 : 1;
            }
            return one.name.localeCompare(other.name);
        });
}

// --- undo ----------------------------------------------------------------

async function readAllMetas(dirPath: string) {
    if (!(await fsCheckDirExist(dirPath))) {
        return [];
    }
    const metaList: AgentBackupMetaType[] = [];
    for (const fileName of await fsListFiles(dirPath)) {
        if (readAgentBackupFileName(fileName)?.part !== 'meta') {
            continue;
        }
        const meta = await readJsonFile<AgentBackupMetaType>(
            pathJoin(dirPath, fileName),
        );
        if (meta !== null && checkIsAgentBackupId(meta.id)) {
            metaList.push(meta);
        }
    }
    return metaList.sort((one, other) => {
        return other.id.localeCompare(one.id);
    });
}

export async function listAgentBackups(limit = 20) {
    const dirPath = await getAgentBackupDirPath();
    const metaList = await readAllMetas(dirPath);
    return {
        changes: metaList.slice(0, limit).map((meta) => {
            return {
                id: meta.id,
                at: meta.at,
                summary: meta.summary,
                ...(meta.undoneAt === undefined ? {} : { isUndone: true }),
                ...(meta.undoOf === undefined ? {} : { isUndo: true }),
                ...(meta.failedAt === undefined ? {} : { didNotFinish: true }),
            };
        }),
        note:
            'Newest first. Action "undo" with an id puts that change back; ' +
            'with no id, the newest change not yet undone.',
    };
}

async function applyRestore(restore: AgentRestoreType) {
    const FileSourceClass = await getFileSourceClass();
    if (restore.type === 'rename') {
        if (!(await fsCheckFileExist(restore.to))) {
            throw new Error(
                `"${FileSourceClass.getInstance(restore.to).name}" is not ` +
                    'there any more, so it cannot be renamed back.',
            );
        }
        await renameAgentFile(
            restore.to,
            FileSourceClass.getInstance(restore.from).name,
            restore.kind,
        );
        return;
    }
    if (restore.type === 'blob') {
        if (restore.blobName === undefined) {
            throw new Error(
                `"${FileSourceClass.getInstance(restore.filePath).name}" has ` +
                    'no copy kept beside its backup, so it cannot be put back.',
            );
        }
        const blobPath = pathJoin(
            await getAgentBackupDirPath(),
            restore.blobName,
        );
        if (!(await fsCheckFileExist(blobPath))) {
            throw new Error(
                `The copy of "${FileSourceClass.getInstance(restore.filePath).name}" ` +
                    'kept beside its backup is gone, so it cannot be put back.',
            );
        }
        await fsCloneFile(blobPath, restore.filePath);
        FileSourceClass.getInstance(restore.filePath).fireUpdateEvent();
        return;
    }
    if (restore.type === 'file') {
        if (restore.text === null) {
            if (await fsCheckFileExist(restore.filePath)) {
                await trashAgentFile(restore.filePath, restore.kind);
            }
        } else {
            const fileSource = FileSourceClass.getInstance(restore.filePath);
            if (!(await fileSource.writeFileData(restore.text))) {
                throw new Error(
                    `"${fileSource.name}" could not be written back.`,
                );
            }
        }
        if (restore.bibleKey !== undefined) {
            const { clearBibleXMLCache } =
                await import('../setting/bible-setting/bibleXMLHelpers');
            await clearBibleXMLCache(restore.bibleKey);
        }
        return;
    }
    if (!(await fsCheckFileExist(restore.filePath))) {
        throw new Error(
            `"${FileSourceClass.getInstance(restore.filePath).name}" is not ` +
                'there any more, so its earlier state cannot be put back in.',
        );
    }
    const DocumentClass = await getEditableClass(restore.kind);
    const document = DocumentClass.getInstance(restore.filePath);
    const wanted = JSON.parse(restore.text);
    const current = await document.getJsonData();
    // Written only when it differs: an identical history entry would make the
    // document read as edited when nothing about it changed.
    if (
        current !== null &&
        JSON.stringify(current) === JSON.stringify(wanted)
    ) {
        return;
    }
    await document.setJsonData(wanted);
    FileSourceClass.getInstance(restore.filePath).fireUpdateEvent();
}

async function snapshotBeforeRestore(restore: AgentRestoreType) {
    if (restore.type === 'rename') {
        return [
            restore.kind === undefined
                ? {
                      type: 'rename' as const,
                      from: restore.to,
                      to: restore.from,
                  }
                : {
                      type: 'rename' as const,
                      from: restore.to,
                      to: restore.from,
                      kind: restore.kind,
                  },
        ];
    }
    if (restore.type === 'editing') {
        const editing = await snapshotAgentEditing(
            restore.kind,
            restore.filePath,
        );
        return editing === null ? [] : [editing];
    }
    if (restore.type === 'blob') {
        // Putting a clip back over one that is there keeps that one too;
        // over nothing, undoing the undo trashes it again.
        return (await fsCheckFileExist(restore.filePath))
            ? [
                  {
                      type: 'blob' as const,
                      filePath: restore.filePath,
                      sourcePath: restore.filePath,
                  },
              ]
            : [
                  {
                      type: 'file' as const,
                      filePath: restore.filePath,
                      text: null,
                  },
              ];
    }
    const restoreList: AgentRestoreType[] = [
        {
            ...(await snapshotAgentFile(restore.filePath, restore.kind)),
            ...(restore.bibleKey === undefined
                ? {}
                : { bibleKey: restore.bibleKey }),
        } as AgentRestoreType,
    ];
    if (restore.kind !== undefined) {
        const editing = await snapshotAgentEditing(
            restore.kind,
            restore.filePath,
        );
        if (editing !== null) {
            restoreList.push(editing);
        }
    }
    return restoreList;
}

export async function undoAgentBackup(id?: string): Promise<AgentResultType> {
    if (id !== undefined && !checkIsAgentBackupId(id)) {
        return fail(
            `"${String(id)}" is not the id of a change. Action "list" names ` +
                'the recent ones.',
        );
    }
    const dirPath = await getAgentBackupDirPath();
    const metaList = await readAllMetas(dirPath);
    const target = pickUndoTarget(metaList, id);
    if (target === null) {
        return fail(
            id === undefined
                ? 'There is no change left to undo.'
                : `There is no change with the id "${id}" -- it may be older ` +
                      'than the last hundred, which are all that are kept.',
        );
    }
    if (target.undoneAt !== undefined) {
        return fail(
            `"${target.summary}" was already undone. Its undo is a change of ` +
                `its own, id "${target.undoneBy}", which can itself be undone.`,
        );
    }
    const data = await readJsonFile<{ restores: AgentRestoreType[] }>(
        pathJoin(dirPath, toAgentBackupFileNames(target.id).data),
    );
    if (data === null || !Array.isArray(data.restores)) {
        return fail(
            `The backup of "${target.summary}" could not be read, so nothing ` +
                'was changed.',
        );
    }
    const orderedList = sortRestoresForUndo(data.restores);
    const snapshotList: AgentRestoreType[] = [];
    for (const restore of orderedList) {
        snapshotList.push(...(await snapshotBeforeRestore(restore)));
    }
    let undoMeta: AgentBackupMetaType;
    try {
        undoMeta = await saveAgentBackup(
            `Undid: ${target.summary}`,
            snapshotList,
            { undoOf: target.id },
        );
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    for (const restore of orderedList) {
        try {
            await applyRestore(restore);
        } catch (error: any) {
            await updateAgentBackupMeta(undoMeta.id, {
                failedAt: new Date().toISOString(),
            }).catch(handleError);
            return fail(
                `Part of "${target.summary}" could not be put back: ` +
                    `${String(error?.message ?? error)} Whatever was put back ` +
                    `can be reversed with owa_undo id "${undoMeta.id}".`,
            );
        }
    }
    await updateAgentBackupMeta(target.id, {
        undoneAt: new Date().toISOString(),
        undoneBy: undoMeta.id,
    });
    const laterList = findLaterOverlappingChanges(metaList, target);
    return {
        undone: target.summary,
        ...genUndoField(undoMeta),
        note:
            'Put back. The undo is a change of its own in the list, so it can ' +
            'be undone too.' +
            (laterList.length === 0
                ? ''
                : ' Later changes to the same file went back with it -- ' +
                  'say so; each can be put back from the list.'),
        ...(laterList.length === 0
            ? {}
            : {
                  laterChanges: laterList.map((meta) => {
                      return meta.summary;
                  }),
              }),
    };
}

/**
 * One request from `owa_undo`. Always answers with a plain object and never
 * throws: the caller is a page expression whose only channel back is a DOM
 * event, so an exception here would simply hang it.
 */
export async function handleAgentUndoRequest(request: {
    action?: unknown;
    id?: unknown;
}): Promise<AgentResultType> {
    try {
        if (request?.action === 'list') {
            return await listAgentBackups();
        }
        if (request?.action === 'undo') {
            const id =
                typeof request.id === 'string' && request.id.trim() !== ''
                    ? request.id.trim()
                    : undefined;
            return await undoAgentBackup(id);
        }
        return fail('Unknown action. Use "list" or "undo".');
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
