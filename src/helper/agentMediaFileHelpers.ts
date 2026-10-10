/**
 * The app side of `owa_media_file`: the Background tabs' files -- pictures,
 * clips, tracks and web pages -- listed, renamed, trashed, imported from the
 * disk, and (a web page) written.
 *
 * ## What is different about these files
 *
 * Three of the four are BINARY. The backup store keeps text, so until
 * 2026-10-10 a clip could not be trashed by a tool at all: nothing could put
 * it back. A `blob` restore (`agentBackupPlanHelpers.ts`) copies the file
 * beside its backup first, and `owa_undo` copies it back -- so a delete here
 * is as revertible as a song's. A web page is text and takes the ordinary
 * `file` restore; it is written the way the Webs panel's own New File and
 * editor write it (`fsWriteFile`, `FileSource.writeFileData`), with no
 * editing history to go through.
 *
 * ## The rules it keeps
 *
 * - A file is named by the FULL name the panel shows (`clock.html`,
 *   `bg.mp4`): several extensions share a kind. A rename keeps the extension.
 * - An import copies a file the caller names by its PATH into the kind's
 *   folder, only when its extension is one the kind holds, and never over an
 *   existing file -- the app's own next free name is taken, as a drop takes it.
 *   Undoing an import trashes the copy; the original is never touched.
 * - A clip bigger than `AGENT_BACKUP_MAX_BLOB_BYTES` is not trashed here: the
 *   copy the undo needs would be as big, and the app's own Move to Trash (with
 *   the Recycle Bin behind it) is named instead.
 * - Nothing here reaches a screen.
 */
import { dirSourceSettingNames } from './constants';
import DirSource from './DirSource';
import { handleError } from './errorHelpers';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import {
    fsCheckFileExist,
    fsCloneFile,
    fsGetFileStamp,
    fsReadFile,
    fsWriteFile,
    getFileFullName,
    getMimetypeExtensions,
    type MimetypeNameType,
} from '../server/fileHelpers';
import {
    AGENT_DOCUMENT_MIMETYPE_NAMES,
    type AgentResultType,
    type AgentRestoreType,
    NoBackupError,
    genBlobTooBigReason,
    genNoBackupReason,
    genUndoField,
    listAgentFiles,
    renameAgentFile,
    runWithAgentBackup,
    snapshotAgentFile,
    snapshotAgentSidecars,
    toAgentFilePath,
    trashAgentFile,
} from './agentBackupHelpers';
import { AGENT_BACKUP_MAX_BLOB_BYTES } from './agentBackupPlanHelpers';

export type AgentMediaKindType =
    'image' | 'video' | 'audio' | 'web' | 'document';

// A song or a slide document carries an editing history and its sidecars,
// which `owa_lyric_file` / `owa_slide_file` take with it; this tool only
// IMPORTS one (the file-dialog case) and lists the folder.
const DOCUMENT_TOOL_EXTENSION_MAP: Record<string, string> = {
    owl: 'owa_lyric_file',
    ows: 'owa_slide_file',
};

export type AgentMediaFileRequestType = {
    action?: unknown;
    kind?: unknown;
    name?: unknown;
    newName?: unknown;
    content?: unknown;
    path?: unknown;
};

type KindType = {
    settingName: string;
    /** Every mimetype the folder's panel lists -- several for Documents. */
    mimetypeNames: MimetypeNameType[];
    /** How a volunteer would say it, for a sentence the model passes on. */
    label: string;
    folderLabel: string;
    isText: boolean;
};

const KIND_MAP: Record<AgentMediaKindType, KindType> = {
    image: {
        settingName: dirSourceSettingNames.BACKGROUND_IMAGE,
        mimetypeNames: ['image'],
        label: 'picture',
        folderLabel: 'Background Images',
        isText: false,
    },
    video: {
        settingName: dirSourceSettingNames.BACKGROUND_VIDEO,
        mimetypeNames: ['video'],
        label: 'clip',
        folderLabel: 'Background Videos',
        isText: false,
    },
    audio: {
        settingName: dirSourceSettingNames.BACKGROUND_AUDIO,
        mimetypeNames: ['audio'],
        label: 'track',
        folderLabel: 'Background Audios',
        isText: false,
    },
    web: {
        settingName: dirSourceSettingNames.BACKGROUND_WEB,
        mimetypeNames: ['web'],
        label: 'web page',
        folderLabel: 'Background Webs',
        isText: true,
    },
    // The Documents list: a PDF, a PowerPoint or Word file, a song or a slide
    // document dropped in from the disk -- the file-dialog case (MC-55).
    document: {
        settingName: dirSourceSettingNames.APP_DOCUMENT,
        mimetypeNames: AGENT_DOCUMENT_MIMETYPE_NAMES,
        label: 'document',
        folderLabel: 'Documents',
        isText: false,
    },
};

const LIST_LIMIT = 100;
const TEXT_LIMIT = 20000;

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

function toChangeFailure(error: unknown, what: string) {
    if (error instanceof NoBackupError) {
        return fail(error.message);
    }
    handleError(error);
    return fail(
        `${what} could not be finished: ` +
            `${error instanceof Error ? error.message : String(error)} ` +
            'Anything it did get to do can be put back with owa_undo.',
    );
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

async function getFileSourceClass() {
    const { default: FileSource } = await import('./FileSource');
    return FileSource;
}

/** `name.ext` split at the last dot; an extension is lower-cased. */
function splitName(fullName: string) {
    const index = fullName.lastIndexOf('.');
    return index <= 0
        ? { stem: fullName, extension: '' }
        : {
              stem: fullName.slice(0, index),
              extension: fullName.slice(index + 1).toLowerCase(),
          };
}

/** The web page the Webs panel's own New File writes, in spirit. */
function genDefaultWebPage(title: string) {
    return [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '    <meta charset="UTF-8">',
        `    <title>${title.replace(/[<>&]/g, '')}</title>`,
        '    <style>',
        '    body { margin: 0; width: 100vw; height: 100vh; overflow: hidden; }',
        '    </style>',
        '</head>',
        '<body></body>',
        '</html>',
        '',
    ].join('\n');
}

type PlaceType = {
    kind: KindType;
    kindName: AgentMediaKindType;
    dirPath: string;
};

function getPlace(kindValue: unknown): PlaceType | AgentResultType {
    const kindName = toText(kindValue) as AgentMediaKindType;
    const kind = Object.hasOwn(KIND_MAP, kindName) ? KIND_MAP[kindName] : null;
    if (kind === null) {
        return fail(
            'Unknown kind. Use "image", "video", "audio", "web" or "document".',
        );
    }
    const dirPath = DirSource.getDirPathBySettingName(kind.settingName);
    if (dirPath === null) {
        return fail(
            `No ${kind.folderLabel} folder is set up yet. The user chooses ` +
                'one in Settings under Path Settings, or in the Background ' +
                "panel's own folder box.",
        );
    }
    return { kind, kindName, dirPath };
}

function checkIsPlace(value: PlaceType | AgentResultType): value is PlaceType {
    return (value as AgentResultType).isError !== true;
}

async function listNames(place: PlaceType) {
    const names: string[] = [];
    for (const mimetypeName of place.kind.mimetypeNames) {
        const files = await listAgentFiles(place.dirPath, mimetypeName, '');
        names.push(...files.map((one) => one.fullName));
    }
    return names;
}

/** The extensions a kind's folder holds, lower-cased, each once. */
function listAllowedExtensions(kind: KindType) {
    return [
        ...new Set(
            kind.mimetypeNames.flatMap((mimetypeName) => {
                return getMimetypeExtensions(mimetypeName).map((one) => {
                    return one.toLowerCase();
                });
            }),
        ),
    ];
}

/**
 * A song or slide document is the document tools' to rename or trash -- they
 * take the editing history and the sidecars with it. Null when this tool may.
 */
function findDocumentToolRefusal(place: PlaceType, fullName: string) {
    if (place.kindName !== 'document') {
        return null;
    }
    const tool = DOCUMENT_TOOL_EXTENSION_MAP[splitName(fullName).extension];
    return tool === undefined
        ? null
        : fail(
              `"${fullName}" has an editing history of its own: ${tool} ` +
                  'renames and trashes it, with that history. This tool ' +
                  'imports and lists documents.',
          );
}

async function findFile(
    place: PlaceType,
    nameValue: unknown,
): Promise<{ fullName: string; filePath: string } | AgentResultType> {
    const nameReason = checkAgentFileName(nameValue);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const fullName = toText(nameValue);
    const filePath = toAgentFilePath(place.dirPath, fullName);
    if (filePath === null) {
        return fail('That name would not stay inside the folder.');
    }
    // One stat answers the common case; the folder is listed only to name
    // what IS there, and only on a miss -- a Videos folder can hold hundreds.
    if (
        listAllowedExtensions(place.kind).includes(
            splitName(fullName).extension,
        ) &&
        (await fsCheckFileExist(filePath))
    ) {
        return { fullName, filePath };
    }
    const listed = (await listNames(place)).slice(0, LIST_LIMIT).map((one) => {
        return `"${one}"`;
    });
    return fail(
        `There is no ${place.kind.label} called "${fullName}" in the ` +
            `${place.kind.folderLabel} folder. ` +
            (listed.length === 0
                ? 'The folder is empty.'
                : `The files are ${listed.join(', ')}.`),
    );
}

function checkIsFound(
    value: { fullName: string; filePath: string } | AgentResultType,
): value is { fullName: string; filePath: string } {
    return (value as AgentResultType).isError !== true;
}

async function handleList(place: PlaceType) {
    const names = await listNames(place);
    return {
        kind: place.kindName,
        folder: place.dirPath,
        count: names.length,
        names: names.slice(0, LIST_LIMIT),
        isTruncated: names.length > LIST_LIMIT,
    };
}

async function handleInfo(
    place: PlaceType,
    found: { fullName: string; filePath: string },
) {
    if (!place.kind.isText) {
        return {
            kind: place.kindName,
            name: found.fullName,
            filePath: found.filePath,
        };
    }
    const text = await fsReadFile(found.filePath);
    return {
        kind: place.kindName,
        name: found.fullName,
        filePath: found.filePath,
        characters: text.length,
        text: text.slice(0, TEXT_LIMIT),
        ...(text.length > TEXT_LIMIT ? { isTruncated: true } : {}),
    };
}

async function handleCreate(
    place: PlaceType,
    request: AgentMediaFileRequestType,
) {
    if (!place.kind.isText) {
        return fail(
            `A ${place.kind.label} is not written from text: action ` +
                '"import" copies one in from the disk.',
        );
    }
    const nameReason = checkAgentFileName(request.name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const asked = toText(request.name);
    const fullName = listAllowedExtensions(place.kind).includes(
        splitName(asked).extension,
    )
        ? asked
        : `${asked}.html`;
    const filePath = toAgentFilePath(place.dirPath, fullName);
    if (filePath === null) {
        return fail('That name would not stay inside the folder.');
    }
    if (await fsCheckFileExist(filePath)) {
        return fail(
            `A web page called "${fullName}" is already there and is not ` +
                'overwritten. Action "update" changes it.',
        );
    }
    const content =
        typeof request.content === 'string' && request.content.trim() !== ''
            ? request.content
            : genDefaultWebPage(splitName(fullName).stem);
    try {
        const { meta } = await runWithAgentBackup(
            `Made the web page “${fullName}”`,
            [{ type: 'file', filePath, text: null }],
            async () => {
                await fsWriteFile(filePath, content);
                if (!(await fsCheckFileExist(filePath))) {
                    throw new Error('The web page could not be written.');
                }
            },
        );
        const FileSource = await getFileSourceClass();
        FileSource.getInstance(filePath).fireUpdateEvent();
        return {
            created: fullName,
            filePath,
            ...genUndoField(meta),
            note: 'It is on disk and in the Webs tab already.',
        };
    } catch (error) {
        return toChangeFailure(error, `Making the web page “${fullName}”`);
    }
}

async function handleUpdate(
    place: PlaceType,
    found: { fullName: string; filePath: string },
    content: unknown,
) {
    if (!place.kind.isText) {
        return fail(
            `A ${place.kind.label} is not written from text: import a new ` +
                'one and trash the old.',
        );
    }
    if (typeof content !== 'string' || content.trim() === '') {
        return fail('Content is required to update a web page.');
    }
    let before: AgentRestoreType;
    try {
        before = await snapshotAgentFile(found.filePath);
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Changed the web page “${found.fullName}”`,
            [before],
            async () => {
                const FileSource = await getFileSourceClass();
                if (
                    !(await FileSource.getInstance(
                        found.filePath,
                    ).writeFileData(content))
                ) {
                    throw new Error('The web page could not be written.');
                }
            },
        );
        return {
            updated: found.fullName,
            filePath: found.filePath,
            ...genUndoField(meta),
            note:
                'Written to the file, as the web editor writes it. A Web ' +
                'Show or a Webs tab showing it reloads on its own.',
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Changing the web page “${found.fullName}”`,
        );
    }
}

async function handleRename(
    place: PlaceType,
    found: { fullName: string; filePath: string },
    newNameValue: unknown,
) {
    const newNameReason = checkAgentFileName(newNameValue);
    if (newNameReason !== null) {
        return fail(newNameReason);
    }
    const documentToolRefusal = findDocumentToolRefusal(place, found.fullName);
    if (documentToolRefusal !== null) {
        return documentToolRefusal;
    }
    const asked = toText(newNameValue);
    const old = splitName(found.fullName);
    const wanted = splitName(asked);
    // The extension is what makes it this kind of file: kept, or refused.
    if (wanted.extension !== '' && wanted.extension !== old.extension) {
        return fail(
            `"${asked}" would change the file's extension from ` +
                `.${old.extension}; give the new name without one, or with ` +
                'the same.',
        );
    }
    const newStem = wanted.extension === '' ? asked : wanted.stem;
    const newFullName =
        old.extension === '' ? newStem : `${newStem}.${old.extension}`;
    const newPath = toAgentFilePath(place.dirPath, newFullName);
    if (newPath === null) {
        return fail('That new name would not stay inside the folder.');
    }
    if (await fsCheckFileExist(newPath)) {
        return fail(
            `Something called "${newFullName}" is already there, so ` +
                `"${found.fullName}" was not renamed.`,
        );
    }
    try {
        const { meta, value: renamedPath } = await runWithAgentBackup(
            `Renamed the ${place.kind.label} “${found.fullName}” to “${newFullName}”`,
            [{ type: 'rename', from: found.filePath, to: newPath }],
            () => {
                return renameAgentFile(found.filePath, newStem);
            },
        );
        return {
            renamedFrom: found.fullName,
            renamedTo: newFullName,
            filePath: renamedPath,
            ...genUndoField(meta),
            note:
                'A slide or run sheet that referred to the old name no ' +
                'longer finds it -- say so if they use one.',
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Renaming the ${place.kind.label} “${found.fullName}”`,
        );
    }
}

async function handleDelete(
    place: PlaceType,
    found: { fullName: string; filePath: string },
) {
    const documentToolRefusal = findDocumentToolRefusal(place, found.fullName);
    if (documentToolRefusal !== null) {
        return documentToolRefusal;
    }
    let restores: AgentRestoreType[];
    try {
        if (place.kind.isText) {
            restores = [await snapshotAgentFile(found.filePath)];
        } else {
            // Said here, before anything is copied, with the route that
            // does work; the backup store holds the same cap for an undo.
            const stamp = await fsGetFileStamp(found.filePath);
            if (stamp !== null && stamp.size > AGENT_BACKUP_MAX_BLOB_BYTES) {
                return fail(
                    `${genBlobTooBigReason(found.fullName, stamp.size)}, so ` +
                        "it was left where it is. The app's own Move to " +
                        'Trash on its row sends it to the Recycle Bin, ' +
                        'which keeps it.',
                );
            }
            restores = [
                {
                    type: 'blob',
                    filePath: found.filePath,
                    sourcePath: found.filePath,
                },
            ];
        }
        restores.push(...(await snapshotAgentSidecars(found.filePath)));
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Moved the ${place.kind.label} “${found.fullName}” to the trash`,
            restores,
            () => {
                return trashAgentFile(found.filePath);
            },
        );
        return {
            deleted: found.fullName,
            isInTrash: true,
            ...genUndoField(meta),
            note:
                'It is in the trash, and owa_undo puts it back from the copy ' +
                'kept beside the backup. A slide or run sheet that used it ' +
                'cannot find it until then.',
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Moving the ${place.kind.label} “${found.fullName}” to the trash`,
        );
    }
}

async function handleImport(place: PlaceType, pathValue: unknown) {
    const sourcePath = toText(pathValue);
    if (sourcePath === '') {
        return fail('Give the `path` of the file on the disk to import.');
    }
    if (!(await fsCheckFileExist(sourcePath))) {
        return fail(`There is no file at "${sourcePath}".`);
    }
    const fullName = getFileFullName(sourcePath) ?? '';
    if (fullName === '') {
        return fail(`"${sourcePath}" has no file name.`);
    }
    const { extension } = splitName(fullName);
    const allowed = listAllowedExtensions(place.kind);
    if (!allowed.includes(extension)) {
        return fail(
            `"${fullName}" is not a ${place.kind.label} this app takes. The ` +
                `${place.kind.folderLabel} folder holds: ${allowed.join(', ')}.`,
        );
    }
    const FileSource = await getFileSourceClass();
    const wantedPath = toAgentFilePath(place.dirPath, fullName);
    if (wantedPath === null) {
        return fail('That name would not stay inside the folder.');
    }
    // Never over an existing file: the next free name, as a drop takes it.
    const destinationPath = (await fsCheckFileExist(wantedPath))
        ? await FileSource.getInstance(wantedPath).genNextFilePath()
        : wantedPath;
    const destinationName = FileSource.getInstance(destinationPath).fullName;
    try {
        const { meta } = await runWithAgentBackup(
            `Imported the ${place.kind.label} “${destinationName}” from the disk`,
            [{ type: 'file', filePath: destinationPath, text: null }],
            async () => {
                await fsCloneFile(sourcePath, destinationPath);
                if (!(await fsCheckFileExist(destinationPath))) {
                    throw new Error('The file could not be copied in.');
                }
            },
        );
        FileSource.getInstance(destinationPath).fireUpdateEvent();
        return {
            imported: destinationName,
            from: sourcePath,
            filePath: destinationPath,
            ...(destinationName === fullName
                ? {}
                : { renamedTo: destinationName }),
            ...genUndoField(meta),
            note:
                'A copy; the original is untouched. Undoing it moves the ' +
                'copy to the trash.',
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Importing the ${place.kind.label} “${fullName}”`,
        );
    }
}

/**
 * One request from `owa_media_file`. Always answers with a plain object and
 * never throws: the caller is a page expression whose only channel back is a
 * DOM event.
 */
export async function handleAgentMediaFileRequest(
    request: AgentMediaFileRequestType,
): Promise<AgentResultType> {
    try {
        const action = toText(request?.action);
        const place = getPlace(request?.kind);
        if (!checkIsPlace(place)) {
            return place;
        }
        if (action === 'list') {
            return await handleList(place);
        }
        if (action === 'create') {
            return await handleCreate(place, request);
        }
        if (action === 'import') {
            return await handleImport(place, request.path);
        }
        if (!['info', 'update', 'rename', 'delete'].includes(action)) {
            return fail(
                'Unknown action. Use list, info, create, update, rename, ' +
                    'delete or import.',
            );
        }
        const found = await findFile(place, request.name);
        if (!checkIsFound(found)) {
            return found;
        }
        if (action === 'info') {
            return await handleInfo(place, found);
        }
        if (action === 'update') {
            return await handleUpdate(place, found, request.content);
        }
        if (action === 'rename') {
            return await handleRename(place, found, request.newName);
        }
        return await handleDelete(place, found);
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
