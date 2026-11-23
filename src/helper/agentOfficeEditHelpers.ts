/**
 * The app side of `owa_office_edit`: a PowerPoint (`.pptx`) or Word
 * (`.docx`) file read line by line and changed by the help window's
 * assistant (2026-11-20, the user: _open pptx or docx in chatbot then
 * interact to edit the powerpoint_, _able to undo_, the goal _chatbot smart
 * enough to help editor the pptx and docx file_).
 *
 * - `read` lists the file as lines with ids (`2.3` is slide 2's third line;
 *   a Word line is its number), a slide's speaker notes, the box a line is
 *   in or a Word line's style; a long file is read a page at a time.
 * - `edit` applies many changes in ONE write and ONE backup
 *   (`officePackageEditHelpers.ts`): words replaced everywhere, lines
 *   rewritten, added or taken out, speaker notes, slides moved, copied or
 *   taken out. A refusal anywhere refuses the lot before anything is kept.
 *
 * The file is the user's own and has no Save here: every change is the
 * file at once. So the whole file is copied beside the backup first (a
 * `blob` restore, the copy `owa_undo` and the window's **Undo this change**
 * put back), the new package is streamed into a file beside it, and only
 * a finished one is moved over the original -- a crash half way leaves the
 * file as it was. Untouched parts, pictures above all, are copied as the
 * bytes they are; the file is held for the one call and dropped with it.
 */
import { dirSourceSettingNames } from './constants';
import DirSource from './DirSource';
import { getActiveDirSourceSettingName } from '../media-sessions/folderSessionHelpers';
import { handleError } from './errorHelpers';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsGetFileStamp,
    fsMove,
    fsReadFileBytes,
    getFileFullName,
} from '../server/fileHelpers';
import { pathJoin } from '../server/storageFileHelpers';
import appProvider from '../server/appProvider';
import {
    type AgentResultType,
    NoBackupError,
    genBlobTooBigReason,
    genUndoField,
    runWithAgentBackup,
} from './agentBackupHelpers';
import { AGENT_BACKUP_MAX_BLOB_BYTES } from './agentBackupPlanHelpers';
import type { OfficePackageType } from '../ms-office/officePackageEditHelpers';

export type AgentOfficeEditRequestType = {
    action?: unknown;
    filePath?: unknown;
    name?: unknown;
    start?: unknown;
    changes?: unknown;
    replace?: unknown;
};

const OFFICE_EXTENSIONS = ['pptx', 'docx'] as const;
type OfficeExtensionType = (typeof OFFICE_EXTENSIONS)[number];
// Asks in one call: far past a deck's worth, short of a runaway loop.
const MAX_CHANGE_COUNT = 200;
// A picture put into a deck: a phone's photo, never a whole film's frames.
const MAX_PICTURE_BYTES = 25 * 1024 * 1024;
const PICTURE_PATH_PATTERN = /\.(?:png|jpe?g|gif|bmp)$/i;
const MAX_PICTURE_COUNT = 10;
// A video or a sound put on a slide (2026-11-21): held whole while the deck
// is written, so a short clip -- a longer film is PowerPoint's to embed.
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MEDIA_PATH_PATTERN = /\.(?:mp4|m4v|mov|wmv|avi|mp3|m4a|wav|wma)$/i;
const MAX_MEDIA_COUNT = 2;

const CHANGE_FILE_RULE_LIST = [
    {
        key: 'picture',
        pattern: PICTURE_PATH_PATTERN,
        maxBytes: MAX_PICTURE_BYTES,
        maxCount: MAX_PICTURE_COUNT,
        badPath:
            '`picture` is a picture attached to the chat, by its name: a ' +
            'PNG, JPEG, GIF or BMP file.',
        what: 'picture',
        plural: 'pictures',
        tooBig:
            'is over 25 MB: make it smaller first, or put it in in ' +
            'PowerPoint.',
    },
    {
        key: 'media',
        pattern: MEDIA_PATH_PATTERN,
        maxBytes: MAX_MEDIA_BYTES,
        maxCount: MAX_MEDIA_COUNT,
        badPath:
            '`media` is a video or a sound attached to the chat, by its ' +
            'name: an MP4, MOV, WMV, AVI, MP3, M4A, WAV or WMA file.',
        what: 'video or sound',
        plural: 'videos or sounds',
        tooBig:
            'is over 50 MB: shorten it first, or put it in in PowerPoint ' +
            '(Insert > Video or Audio).',
    },
] as const;

/**
 * The bytes of every picture, video or sound a change names, by the path
 * the window put in for its attached file's name -- a whole path, read once
 * each, its size asked first -- or a failure in words. A file's kind is the
 * pure rules' to judge, off its bytes.
 */
async function readChangePictures(changes: readonly unknown[]) {
    const pictures = new Map<string, Uint8Array>();
    for (const rule of CHANGE_FILE_RULE_LIST) {
        const paths = new Set<string>();
        for (const change of changes) {
            const value = (change as Record<string, unknown>)[rule.key];
            if (value === undefined) {
                continue;
            }
            if (
                typeof value !== 'string' ||
                !/^(?:[a-zA-Z]:[\\/]|[\\/])/.test(value) ||
                !rule.pattern.test(value) ||
                /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value)
            ) {
                return { failure: fail(rule.badPath) };
            }
            paths.add(value);
        }
        if (paths.size > rule.maxCount) {
            return {
                failure: fail(
                    `At most ${rule.maxCount} ${rule.plural} in one call: ` +
                        'send the rest in another.',
                ),
            };
        }
        for (const filePath of paths) {
            const name = getFileFullName(filePath);
            const stamp = await fsGetFileStamp(filePath);
            if (stamp === null) {
                return {
                    failure: fail(
                        `The ${rule.what} "${name}" could not be read.`,
                    ),
                };
            }
            if (stamp.size > rule.maxBytes) {
                return {
                    failure: fail(`The ${rule.what} "${name}" ${rule.tooBig}`),
                };
            }
            pictures.set(filePath, await fsReadFileBytes(filePath));
        }
    }
    return { pictures };
}

// A whole path: a drive (`C:\` / `C:/`), a share (`\\server`) or a root.
const ABSOLUTE_PATH_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/;

function fail(reason: string): AgentResultType {
    return { isError: true, reason };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function toExtension(fileName: string): OfficeExtensionType | null {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return (OFFICE_EXTENSIONS as readonly string[]).includes(extension)
        ? (extension as OfficeExtensionType)
        : null;
}

type OfficeTargetType = {
    filePath: string;
    name: string;
    kind: OfficeExtensionType;
};

function checkIsTarget(
    value: OfficeTargetType | AgentResultType,
): value is OfficeTargetType {
    return (value as AgentResultType).isError !== true;
}

const ONLY_OFFICE_REASON =
    'Only a PowerPoint (.pptx) or Word (.docx) file can be read or changed ' +
    'this way. An older .ppt or .doc must be saved again as .pptx or .docx ' +
    'in PowerPoint or Word first.';

/**
 * The file a request names: the attached file by its whole path, or a file
 * of the Documents folder by its full name.
 */
async function resolveTarget(
    request: AgentOfficeEditRequestType,
): Promise<OfficeTargetType | AgentResultType> {
    let filePath = toText(request.filePath);
    if (filePath !== '') {
        if (!ABSOLUTE_PATH_PATTERN.test(filePath)) {
            return fail('A file path must be the whole path to the file.');
        }
        if (
            filePath.split(/[\\/]/).some((part) => {
                return part === '..';
            })
        ) {
            return fail(
                'A file path may not step out of its folder with "..".',
            );
        }
    } else {
        const name = toText(request.name);
        const nameProblem = checkAgentFileName(name);
        if (nameProblem !== null) {
            return fail(
                name === ''
                    ? 'Give the `filePath` of the file, or its full `name` ' +
                          'in the Documents folder (with .pptx or .docx).'
                    : nameProblem,
            );
        }
        const dirPath = DirSource.getDirPathBySettingName(
            getActiveDirSourceSettingName(dirSourceSettingNames.APP_DOCUMENT),
        );
        if (dirPath === null) {
            return fail(
                'No Documents folder is set up yet. The user chooses one in ' +
                    'Settings under Path Settings.',
            );
        }
        filePath = pathJoin(dirPath, name);
    }
    const name = getFileFullName(filePath) ?? filePath;
    const kind = toExtension(name);
    if (kind === null) {
        return fail(ONLY_OFFICE_REASON);
    }
    if (!(await fsCheckFileExist(filePath))) {
        return fail(
            `There is no file "${name}" in that folder. Name a PowerPoint ` +
                'or Word file exactly as the Documents list shows it, with ' +
                '.pptx or .docx.',
        );
    }
    return { filePath, name, kind };
}

async function getEditModules() {
    // Lazily: nothing of the Office rules loads until an agent asks.
    const [edit, io] = await Promise.all([
        import('../ms-office/officePackageEditHelpers'),
        import('../ms-office/officePackageIoHelpers'),
    ]);
    return { ...edit, ...io };
}

async function openTarget(target: OfficeTargetType) {
    const stamp = await fsGetFileStamp(target.filePath);
    if (stamp === null) {
        return { failure: fail(`"${target.name}" could not be read.`) };
    }
    if (stamp.size > AGENT_BACKUP_MAX_BLOB_BYTES) {
        const failure = fail(
            `${genBlobTooBigReason(target.name, stamp.size)}, so it is not ` +
                'changed here. Change it in PowerPoint or Word.',
        );
        return { failure };
    }
    const modules = await getEditModules();
    const bytes = await fsReadFileBytes(target.filePath);
    const opened = modules.openOfficePackage(bytes);
    if ('reason' in opened) {
        return { failure: fail(`"${target.name}": ${opened.reason}`) };
    }
    const document = await modules.readOfficeDocument(opened.pkg, target.kind);
    if ('reason' in document) {
        return { failure: fail(`"${target.name}": ${document.reason}`) };
    }
    return { modules, opened, document };
}

async function handleRead(target: OfficeTargetType, startValue: unknown) {
    const opened = await openTarget(target);
    if (opened.failure !== undefined) {
        return opened.failure;
    }
    const start =
        typeof startValue === 'number' &&
        Number.isInteger(startValue) &&
        startValue > 0
            ? startValue
            : 1;
    return {
        file: target.name,
        ...opened.modules.toOfficeReadResult(opened.document, start),
    };
}

function toList(value: unknown) {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

/** The new package streamed beside the file, then moved over it. */
async function writeBeside(
    target: OfficeTargetType,
    write: (sink: (chunk: Uint8Array) => Promise<void>) => Promise<void>,
) {
    const { createOfficeFileSink } =
        await import('../ms-office/officeFileSinkHelpers');
    // a name no folder list shows (it starts with a dot) and no other call
    // shares
    const tempPath = pathJoin(
        target.filePath.slice(0, target.filePath.length - target.name.length),
        `.${target.name}.${Date.now().toString(36)}.owa-edit`,
    );
    const sink = createOfficeFileSink(tempPath);
    try {
        await write(sink.write);
        await sink.close();
        await fsMove(tempPath, target.filePath);
    } catch (error) {
        sink.abort();
        await fsDeleteFile(tempPath).catch(handleError);
        throw error;
    }
}

/**
 * The program that has the document open, read off the file it keeps
 * beside it -- never on Windows, where the open file refuses the write
 * itself and a file left behind by a crash is common and hidden.
 */
async function findOpenElsewhere(target: OfficeTargetType) {
    if (appProvider.systemUtils.isWindows) {
        return null;
    }
    const { listOfficeOwnerFiles } =
        await import('../ms-office/officeOwnerFileHelpers');
    const dirPath = target.filePath.slice(
        0,
        target.filePath.length - target.name.length,
    );
    for (const owner of listOfficeOwnerFiles(target.name)) {
        if (await fsCheckFileExist(pathJoin(dirPath, owner.name))) {
            return owner;
        }
    }
    return null;
}

function toChangeFailure(error: unknown, target: OfficeTargetType) {
    if (error instanceof NoBackupError) {
        return fail(error.message);
    }
    handleError(error);
    const code = (error as { code?: unknown })?.code;
    const isBusy = code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
    return fail(
        `"${target.name}" could not be written` +
            (isBusy
                ? ': it is open in another program. Close it in PowerPoint ' +
                  'or Word and ask again.'
                : `: ${error instanceof Error ? error.message : String(error)}.`) +
            ' The file is as it was.',
    );
}

/**
 * The slides a call copied, read off the package as it was written -- the
 * one already in memory with the call's changed parts over it, never the
 * file read again -- so the next change names the copy's lines without
 * reading the whole deck (2026-11-20: "copy the welcome slide to the end
 * and retitle it" took a read between). Only when a slide part is new.
 */
async function readCopies(
    opened: Exclude<
        Awaited<ReturnType<typeof openTarget>>,
        { failure: unknown }
    >,
    parts: ReadonlyMap<string, string | Uint8Array | null>,
) {
    const { pkg } = opened.opened;
    const newSlideParts = [...parts.keys()].filter((name) => {
        return (
            /^ppt\/slides\/slide\d+\.xml$/.test(name) &&
            !pkg.names.includes(name)
        );
    });
    if (newSlideParts.length === 0 || opened.document.kind !== 'pptx') {
        return [];
    }
    const written: OfficePackageType = {
        names: [
            ...pkg.names.filter((name) => {
                return parts.get(name) !== null;
            }),
            ...[...parts.keys()].filter((name) => {
                return parts.get(name) !== null && !pkg.names.includes(name);
            }),
        ],
        readText: async (name) => {
            if (!parts.has(name)) {
                return await pkg.readText(name);
            }
            const value = parts.get(name);
            return typeof value === 'string' ? value : null;
        },
    };
    const document = await opened.modules.readOfficeDocument(written, 'pptx');
    if ('reason' in document || document.kind !== 'pptx') {
        return [];
    }
    const read = opened.modules.toOfficeReadResult({
        ...document,
        slides: document.slides.filter((slide) => {
            return newSlideParts.includes(slide.partPath);
        }),
    });
    return read.kind === 'PowerPoint' ? read.slides : [];
}

async function handleEdit(
    target: OfficeTargetType,
    changesValue: unknown,
    replaceValue: unknown,
) {
    const changes = toList(changesValue);
    const replaces = toList(replaceValue);
    if (changes.length === 0 && replaces.length === 0) {
        return fail(
            'Say what to change: `changes` (by line id or slide) or ' +
                '`replace` ({from, to}).',
        );
    }
    if (changes.length + replaces.length > MAX_CHANGE_COUNT) {
        return fail(
            `At most ${MAX_CHANGE_COUNT} changes in one call: send the rest ` +
                'in another.',
        );
    }
    if (
        [...changes, ...replaces].some((one) => {
            return typeof one !== 'object' || one === null;
        })
    ) {
        return fail('Each change and each replace is an object.');
    }
    const owner = await findOpenElsewhere(target);
    if (owner !== null) {
        const { genOfficeOpenElsewhereReason } =
            await import('../ms-office/officeOwnerFileHelpers');
        return fail(
            `Nothing was changed. ${genOfficeOpenElsewhereReason(target.name, owner)}`,
        );
    }
    const read = await readChangePictures(changes);
    if (read.failure !== undefined) {
        return read.failure;
    }
    const opened = await openTarget(target);
    if (opened.failure !== undefined) {
        return opened.failure;
    }
    const { modules } = opened;
    // worked out first, on what was read: a refusal writes nothing and
    // takes no backup
    const result = await modules.applyOfficeChanges(
        opened.opened.pkg,
        opened.document,
        changes,
        replaces,
        read.pictures,
    );
    if ('reason' in result) {
        return fail(`Nothing was changed. ${result.reason}`);
    }
    const summary = `Changed “${target.name}”`;
    try {
        const { meta } = await runWithAgentBackup(
            summary,
            [
                {
                    type: 'blob',
                    filePath: target.filePath,
                    sourcePath: target.filePath,
                },
            ],
            async () => {
                await writeBeside(target, async (sink) => {
                    await modules.writeOfficePackage(
                        opened.opened,
                        result.parts,
                        sink,
                    );
                });
            },
        );
        const { default: FileSource } = await import('./FileSource');
        FileSource.getInstance(target.filePath).fireUpdateEvent();
        const copies = await readCopies(opened, result.parts);
        const isLinesMoved = changes.some((change) => {
            return (
                change.after !== undefined ||
                change.before !== undefined ||
                change.remove === true ||
                change.removeSlide === true ||
                change.duplicate === true ||
                change.newSlide === true ||
                change.to !== undefined ||
                change.removeBox !== undefined ||
                change.toShapes !== undefined ||
                change.textBox !== undefined ||
                change.slideSize !== undefined
            );
        });
        return {
            file: target.name,
            changed: result.changed,
            didChange: true,
            note:
                'Kept in the file at once.' +
                (isLinesMoved
                    ? ' Lines or slides moved: read it again before the ' +
                      'next change by id' +
                      (copies.length > 0
                          ? "; a copy's lines are in `copies`, by their ids."
                          : '.')
                    : ''),
            ...(copies.length > 0 ? { copies } : {}),
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, target);
    }
}

export async function handleAgentOfficeEditRequest(
    request: AgentOfficeEditRequestType,
): Promise<AgentResultType> {
    try {
        const action = toText(request?.action) || 'read';
        if (action !== 'read' && action !== 'edit') {
            return fail('Unknown action. Use read or edit.');
        }
        const target = await resolveTarget(request ?? {});
        if (!checkIsTarget(target)) {
            return target;
        }
        if (action === 'read') {
            return await handleRead(target, request.start);
        }
        return await handleEdit(target, request.changes, request.replace);
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
