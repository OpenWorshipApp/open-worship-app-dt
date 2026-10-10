/**
 * The app side of `owa_presenting_flow`: the user's run sheets -- the
 * presenting flows -- and the lines in them.
 *
 * ## What is different about a run sheet
 *
 * A presenting flow has no editor and no Save button: every change the panel
 * makes -- a song dropped in, a line parked, a row moved -- is written to the
 * file at once (`PresentingFlow.setItems`). So it is the one editable document
 * in this app whose Ctrl+Z is nowhere, and the backup taken before each change
 * (`agentBackupHelpers.ts`) is the whole undo. No backup, no change.
 *
 * ## The rules it keeps
 *
 * - A line is added the way a DROP adds it: `PresentingFlow.addItem` for a
 *   document or a passage, `addActionItem` for an action, so a line this tool
 *   writes is exactly the line dragging the same thing in would have written --
 *   a document as a REFERENCE (its path), a passage as its own payload.
 * - A document is found by the NAME the Documents list shows, never by a path
 *   a caller wrote: the caller names what the user can see, and the folder is
 *   the one the app's own setting points at.
 * - A passage is read the way `owa_present_bible` reads one, through that
 *   module's resolvers, never a second parser.
 * - An action id is checked against the app's own registry; a sheet names the
 *   kinds it already holds, and a refusal lists every id there is.
 * - Nothing here reaches a screen. A line is a plan; the operator runs it.
 */
import { dirSourceSettingNames } from './constants';
import DirSource from './DirSource';
import { handleError } from './errorHelpers';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import {
    fsCheckFileExist,
    fsListFilesWithMimetype,
    getMimetypeExtensions,
} from '../server/fileHelpers';
import {
    AGENT_DOCUMENT_MIMETYPE_NAMES,
    type AgentResultType,
    NoBackupError,
    findAgentFreeName,
    genNoBackupReason,
    genUndoField,
    listAgentFiles,
    renameAgentFile,
    runWithAgentBackup,
    snapshotAgentEditing,
    snapshotAgentFileForDelete,
    toAgentFilePath,
    trashAgentFile,
} from './agentBackupHelpers';

export type AgentPresentingFlowRequestType = {
    action?: unknown;
    name?: unknown;
    newName?: unknown;
    document?: unknown;
    reference?: unknown;
    version?: unknown;
    actionId?: unknown;
    seconds?: unknown;
    screenIds?: unknown;
    line?: unknown;
    to?: unknown;
    at?: unknown;
};

const FLOW_LIMIT = 60;
const LINE_LIMIT = 200;
const KIND = 'presentingFlow' as const;

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

function readLineNumber(value: unknown) {
    return Number.isInteger(value) && (value as number) >= 1
        ? (value as number)
        : null;
}

async function getPresentingFlowClass() {
    // Lazily, like every document class a worker reaches: the presenting-flow
    // graph pulls the screen managers in, and nothing here loads until an
    // agent asks.
    const { default: PresentingFlow } =
        await import('../presenting-flow/PresentingFlow');
    return PresentingFlow;
}

async function getFileSourceClass() {
    const { default: FileSource } = await import('./FileSource');
    return FileSource;
}

type PlaceType = {
    dirPath: string;
    extension: string;
};

function getPlace(): PlaceType | AgentResultType {
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.PRESENTING_FLOW,
    );
    if (dirPath === null) {
        return fail(
            'No Presenting Flows folder is set up yet, so there is nowhere ' +
                'to keep run sheets. The user chooses one in Settings under ' +
                'Path Settings.',
        );
    }
    return { dirPath, extension: getMimetypeExtensions('presentingFlow')[0] };
}

function checkIsPlace(value: PlaceType | AgentResultType): value is PlaceType {
    return (value as AgentResultType).isError !== true;
}

type NamedFlowType = { name: string; filePath: string };

/** The sheet a request names, or a refusal naming the sheets there are. */
async function findFlow(
    place: PlaceType,
    name: unknown,
): Promise<NamedFlowType | AgentResultType> {
    const nameReason = checkAgentFileName(name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const safeName = toText(name);
    const filePath = toAgentFilePath(place.dirPath, safeName, place.extension);
    if (filePath === null) {
        return fail(
            'That name would not stay inside the Presenting Flows folder.',
        );
    }
    if (await fsCheckFileExist(filePath)) {
        return { name: safeName, filePath };
    }
    const names = (await listAgentFiles(place.dirPath, 'presentingFlow', ''))
        .slice(0, FLOW_LIMIT)
        .map((one) => {
            return `"${one.name}"`;
        });
    return fail(
        `There is no run sheet called "${safeName}". ` +
            (names.length === 0
                ? 'There are none yet -- action "create" makes one.'
                : `The run sheets are ${names.join(', ')}.`),
    );
}

function checkIsFlowFound(
    found: NamedFlowType | AgentResultType,
): found is NamedFlowType {
    return (found as AgentResultType).isError !== true;
}

/** The lines as a person reads them off the panel, in order. */
async function readLines(filePath: string) {
    const PresentingFlow = await getPresentingFlowClass();
    const items = await PresentingFlow.getInstance(filePath).getItems();
    if (items === null) {
        return null;
    }
    return items.map((item, index) => {
        const line: Record<string, unknown> = {
            n: index + 1,
            title: item.isError ? 'invalid line' : item.title,
            kind: item.isAction ? `action:${String(item.data)}` : item.type,
        };
        if (item.isDisabled) {
            line.isParked = true;
        }
        if (item.screenIds.length > 0) {
            line.screenIds = item.screenIds;
        }
        return line;
    });
}

async function handleList(place: PlaceType) {
    const fileList = await listAgentFiles(place.dirPath, 'presentingFlow', '');
    return {
        folder: place.dirPath,
        count: fileList.length,
        names: fileList.slice(0, FLOW_LIMIT).map((one) => {
            return one.name;
        }),
        isTruncated: fileList.length > FLOW_LIMIT,
    };
}

async function handleInfo(found: NamedFlowType) {
    const lines = await readLines(found.filePath);
    if (lines === null) {
        return fail(`The run sheet "${found.name}" could not be read.`);
    }
    return {
        name: found.name,
        filePath: found.filePath,
        count: lines.length,
        lines: lines.slice(0, LINE_LIMIT),
        ...(lines.length > LINE_LIMIT ? { isTruncated: true } : {}),
    };
}

async function handleCreate(place: PlaceType, name: unknown) {
    const nameReason = checkAgentFileName(name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const safeName = toText(name);
    const filePath = toAgentFilePath(place.dirPath, safeName, place.extension);
    if (filePath === null) {
        return fail(
            'That name would not stay inside the Presenting Flows folder.',
        );
    }
    if (await fsCheckFileExist(filePath)) {
        const freeName = await findAgentFreeName(
            place.dirPath,
            safeName,
            place.extension,
        );
        return fail(
            `A run sheet called "${safeName}" is already there and is not ` +
                `overwritten. "${freeName}" is free.`,
        );
    }
    try {
        const { meta, value: fileSource } = await runWithAgentBackup(
            `Made the run sheet “${safeName}”`,
            [{ type: 'file', filePath, text: null, kind: KIND }],
            async () => {
                const PresentingFlow = await getPresentingFlowClass();
                const created = await PresentingFlow.create(
                    place.dirPath,
                    safeName,
                );
                if (created === null) {
                    throw new Error('The run sheet could not be created.');
                }
                return created;
            },
        );
        fileSource.fireUpdateEvent();
        return {
            created: fileSource.name,
            filePath: fileSource.filePath,
            ...genUndoField(meta),
            note: 'It is on disk and in the Presenting Flows panel already.',
        };
    } catch (error) {
        return toChangeFailure(error, `Making the run sheet “${safeName}”`);
    }
}

async function handleRename(
    place: PlaceType,
    found: NamedFlowType,
    newName: unknown,
) {
    const newNameReason = checkAgentFileName(newName);
    if (newNameReason !== null) {
        return fail(newNameReason);
    }
    const safeNewName = toText(newName);
    const newPath = toAgentFilePath(
        place.dirPath,
        safeNewName,
        place.extension,
    );
    if (newPath === null) {
        return fail(
            'That new name would not stay inside the Presenting Flows folder.',
        );
    }
    if (await fsCheckFileExist(newPath)) {
        return fail(
            `Something called "${safeNewName}" is already there, so ` +
                `"${found.name}" was not renamed.`,
        );
    }
    try {
        const { meta, value: renamedPath } = await runWithAgentBackup(
            `Renamed the run sheet “${found.name}” to “${safeNewName}”`,
            [{ type: 'rename', from: found.filePath, to: newPath, kind: KIND }],
            () => {
                return renameAgentFile(found.filePath, safeNewName, KIND);
            },
        );
        return {
            renamedFrom: found.name,
            renamedTo: safeNewName,
            filePath: renamedPath,
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, `Renaming the run sheet “${found.name}”`);
    }
}

async function handleDelete(found: NamedFlowType) {
    let restores;
    try {
        restores = await snapshotAgentFileForDelete(found.filePath, KIND);
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Moved the run sheet “${found.name}” to the trash`,
            restores,
            () => {
                return trashAgentFile(found.filePath, KIND);
            },
        );
        return {
            deleted: found.name,
            isInTrash: true,
            ...genUndoField(meta),
            note: 'It is in the trash, and owa_undo puts it back.',
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Moving the run sheet “${found.name}” to the trash`,
        );
    }
}

/**
 * A document of the Documents list, by the name it shows there. Every kind the
 * list holds is looked at, because every one of them is a line a run sheet can
 * hold; two files sharing a name (a song and a slide document both called
 * "Sunday") are both named back, so the caller can say which.
 */
async function findDocumentPath(
    documentName: string,
): Promise<string | AgentResultType> {
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.APP_DOCUMENT,
    );
    if (dirPath === null) {
        return fail('No Documents folder is set up yet.');
    }
    const FileSource = await getFileSourceClass();
    const matches: string[] = [];
    for (const mimetypeName of AGENT_DOCUMENT_MIMETYPE_NAMES) {
        const filePathList =
            (await fsListFilesWithMimetype(dirPath, mimetypeName)) ?? [];
        for (const filePath of filePathList) {
            if (FileSource.getInstance(filePath).name === documentName) {
                matches.push(filePath);
            }
        }
    }
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length > 1) {
        return fail(
            `More than one document is called "${documentName}": ` +
                matches
                    .map((one) => {
                        return `"${FileSource.getInstance(one).fullName}"`;
                    })
                    .join(', ') +
                '. Rename one of them first, or name a different document.',
        );
    }
    return fail(
        `There is no document called "${documentName}" in the Documents ` +
            'list. owa_lyric_file or owa_slide_file with action "list" ' +
            'names what is there.',
    );
}

function checkIsRefusal(value: unknown): value is AgentResultType {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as AgentResultType).isError === true
    );
}

async function changeLines(
    found: NamedFlowType,
    summary: string,
    change: () => Promise<boolean>,
    describe: () => Promise<Record<string, unknown>>,
) {
    const editing = await snapshotAgentEditing(KIND, found.filePath);
    if (editing === null) {
        return fail(
            `The run sheet "${found.name}" could not be read, so it was ` +
                'not changed.',
        );
    }
    try {
        const { meta } = await runWithAgentBackup(
            summary,
            [editing],
            async () => {
                if (!(await change())) {
                    // The panel has already said why, in its own toast; what the
                    // caller gets is that the sheet is as it was.
                    throw new Error(
                        'the app refused the change and left the sheet as it was.',
                    );
                }
            },
        );
        return { ...(await describe()), ...genUndoField(meta) };
    } catch (error) {
        return toChangeFailure(error, summary);
    }
}

async function handleAdd(
    found: NamedFlowType,
    request: AgentPresentingFlowRequestType,
) {
    const documentName = toText(request.document);
    const reference = toText(request.reference);
    const actionId = toText(request.actionId);
    const given = [documentName, reference, actionId].filter((one) => {
        return one !== '';
    });
    if (given.length !== 1) {
        return fail(
            'Say what to add, one of: `document` (a name from the Documents ' +
                'list), `reference` (a Bible passage such as "John 3:16"), ' +
                'or `actionId` (an action such as "clear-all").',
        );
    }
    const at = readLineNumber(request.at);
    const toIndex = at === null ? undefined : at - 1;
    const PresentingFlow = await getPresentingFlowClass();
    const flow = PresentingFlow.getInstance(found.filePath);
    const describeAdded = async () => {
        const lines = await readLines(found.filePath);
        const count = lines?.length ?? 0;
        const index =
            toIndex === undefined ? count - 1 : Math.min(toIndex, count - 1);
        return {
            added: lines?.[index]?.title ?? null,
            line: index + 1,
            count,
            sheet: found.name,
        };
    };
    if (documentName !== '') {
        const documentPath = await findDocumentPath(documentName);
        if (checkIsRefusal(documentPath)) {
            return documentPath;
        }
        const { DragTypeEnum } = await import('./DragInf');
        return await changeLines(
            found,
            `Added “${documentName}” to the run sheet “${found.name}”`,
            () => {
                return flow.addItem(
                    {
                        type: DragTypeEnum.APP_DOCUMENT,
                        item: { filePath: documentPath },
                    },
                    { type: DragTypeEnum.APP_DOCUMENT, data: documentPath },
                    toIndex,
                );
            },
            describeAdded,
        );
    }
    if (reference !== '') {
        const { MAX_REFERENCE_LENGTH, resolveBibleItem, resolveVersionOrder } =
            await import('./agentBibleHelpers');
        if (reference.length > MAX_REFERENCE_LENGTH) {
            return fail(
                'That is longer than a reference. Give the book, chapter ' +
                    'and verse only, such as "John 3:16".',
            );
        }
        const version = toText(request.version);
        const resolved = await resolveVersionOrder(
            version === '' ? null : version,
        );
        if (!('order' in resolved)) {
            return fail(resolved.reason);
        }
        const bibleItem = await resolveBibleItem(reference, resolved.order);
        if (bibleItem === null) {
            return fail(
                `"${reference}" could not be read as a passage in ` +
                    `${version === '' ? 'any installed version' : version}. ` +
                    "Write it as the version's full book name, chapter and " +
                    'verse -- "John 3:16", "Psalm 23:1-6".',
            );
        }
        const { DragTypeEnum } = await import('./DragInf');
        const dragData = bibleItem.dragSerialize();
        return await changeLines(
            found,
            `Added “${reference}” to the run sheet “${found.name}”`,
            () => {
                return flow.addItem(
                    { type: DragTypeEnum.BIBLE_ITEM, item: bibleItem },
                    dragData,
                    toIndex,
                );
            },
            describeAdded,
        );
    }
    const { findPresentingFlowAction, presentingFlowActionList } =
        await import('../presenting-flow/presentingFlowActionHelpers');
    const action = findPresentingFlowAction(actionId);
    if (action === null) {
        return fail(
            `"${actionId}" is not an action. The actions are: ` +
                presentingFlowActionList
                    .map((one) => {
                        return one.id;
                    })
                    .join(', ') +
                '.',
        );
    }
    const screenIds = Array.isArray(request.screenIds)
        ? request.screenIds.filter((one): one is number => {
              return Number.isInteger(one);
          })
        : [];
    if (
        action.target === 'screen' &&
        action.requiresScreenIds &&
        screenIds.length === 0
    ) {
        return fail(
            `"${actionId}" has to name the screens it runs on: pass ` +
                '`screenIds`, the ids owa_list_screens shows.',
        );
    }
    const seconds = Number.isInteger(request.seconds)
        ? (request.seconds as number)
        : undefined;
    return await changeLines(
        found,
        `Added the action “${action.label}” to the run sheet “${found.name}”`,
        () => {
            return flow.addActionItem(
                action.id,
                seconds === undefined ? {} : { actionNumber: seconds },
                toIndex,
                screenIds,
            );
        },
        describeAdded,
    );
}

/** The line a request names, checked against the sheet as it is now. */
async function findLine(found: NamedFlowType, value: unknown) {
    const n = readLineNumber(value);
    const lines = await readLines(found.filePath);
    if (lines === null) {
        return fail(`The run sheet "${found.name}" could not be read.`);
    }
    if (n === null || n > lines.length) {
        return fail(
            `Say which line, 1 to ${lines.length} -- action "info" lists ` +
                'them.',
        );
    }
    return { index: n - 1, line: lines[n - 1], count: lines.length };
}

function checkIsLineFound(
    value: Awaited<ReturnType<typeof findLine>>,
): value is { index: number; line: Record<string, unknown>; count: number } {
    return (value as AgentResultType).isError !== true;
}

export async function handleAgentPresentingFlowRequest(
    request: AgentPresentingFlowRequestType,
): Promise<AgentResultType> {
    try {
        const action = toText(request?.action);
        const place = getPlace();
        if (!checkIsPlace(place)) {
            return place;
        }
        if (action === 'list') {
            return await handleList(place);
        }
        if (action === 'create') {
            return await handleCreate(place, request.name);
        }
        if (
            ![
                'info',
                'rename',
                'delete',
                'add',
                'remove',
                'move',
                'duplicate',
                'park',
                'unpark',
            ].includes(action)
        ) {
            return fail(
                'Unknown action. Use list, info, create, rename, delete, ' +
                    'add, remove, move, duplicate, park or unpark.',
            );
        }
        const found = await findFlow(place, request.name);
        if (!checkIsFlowFound(found)) {
            return found;
        }
        if (action === 'info') {
            return await handleInfo(found);
        }
        if (action === 'rename') {
            return await handleRename(place, found, request.newName);
        }
        if (action === 'delete') {
            return await handleDelete(found);
        }
        if (action === 'add') {
            return await handleAdd(found, request);
        }
        const target = await findLine(found, request.line);
        if (!checkIsLineFound(target)) {
            return target;
        }
        const PresentingFlow = await getPresentingFlowClass();
        const flow = PresentingFlow.getInstance(found.filePath);
        const title = String(target.line.title);
        if (action === 'remove') {
            return await changeLines(
                found,
                `Removed line ${target.index + 1} “${title}” from the run ` +
                    `sheet “${found.name}”`,
                () => {
                    return flow.removeItemAtIndex(target.index);
                },
                async () => {
                    // The change went through, so the count is arithmetic;
                    // re-reading the sheet would build every line again.
                    return {
                        removed: title,
                        line: target.index + 1,
                        count: target.count - 1,
                        sheet: found.name,
                    };
                },
            );
        }
        if (action === 'duplicate') {
            return await changeLines(
                found,
                `Copied line ${target.index + 1} “${title}” in the run ` +
                    `sheet “${found.name}”`,
                () => {
                    return flow.duplicateItemAtIndex(target.index);
                },
                async () => {
                    // The copy lands directly below the original.
                    return {
                        copied: title,
                        line: target.index + 2,
                        count: target.count + 1,
                        sheet: found.name,
                    };
                },
            );
        }
        if (action === 'move') {
            const to = readLineNumber(request.to);
            if (to === null || to > target.count) {
                return fail(
                    `Say where to move it, \`to\` 1 to ${target.count}.`,
                );
            }
            return await changeLines(
                found,
                `Moved line ${target.index + 1} “${title}” to line ${to} ` +
                    `in the run sheet “${found.name}”`,
                () => {
                    return flow.moveItemToIndex(target.index, to - 1);
                },
                async () => {
                    return {
                        moved: title,
                        from: target.index + 1,
                        to,
                        sheet: found.name,
                    };
                },
            );
        }
        const isParking = action === 'park';
        if (target.line.isParked === true && isParking) {
            return {
                sheet: found.name,
                line: target.index + 1,
                isParked: true,
                didChange: false,
                note: 'That line was parked already.',
            };
        }
        if (target.line.isParked !== true && !isParking) {
            return {
                sheet: found.name,
                line: target.index + 1,
                isParked: false,
                didChange: false,
                note: 'That line was in play already.',
            };
        }
        return await changeLines(
            found,
            `${isParking ? 'Parked' : 'Put back in play'} line ` +
                `${target.index + 1} “${title}” in the run sheet “${found.name}”`,
            () => {
                return flow.setItemDisabled(target.index, isParking);
            },
            async () => {
                return {
                    [isParking ? 'parked' : 'unparked']: title,
                    line: target.index + 1,
                    isParked: isParking,
                    sheet: found.name,
                    note: isParking
                        ? 'It stays listed and takes no part in the run until ' +
                          'it is unparked.'
                        : 'It takes part in the run again.',
                };
            },
        );
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
