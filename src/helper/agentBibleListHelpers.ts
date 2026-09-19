/**
 * The app side of `owa_bible_item`: the user's saved Bible passages -- the
 * Bibles list -- and whole lists of them.
 *
 * ## What is different about a Bibles list
 *
 * Songs and slide documents keep an editing history: a change lands in it,
 * shows a `*`, and Ctrl+Z takes it back. A Bibles list keeps nothing of the
 * kind. It is one `.owb` file of passages, written straight to disk on every
 * change, so the one undo behind anything done here is the backup taken
 * before it (`agentBackupHelpers.ts`) -- no backup, no change.
 *
 * ## The rules it keeps
 *
 * - The folder is the one the page it runs in reads: the Presenter's Bibles
 *   list, or the Reader's own (`Bible.getDirSourceSettingName`). Every answer
 *   says which, because the two are different lists.
 * - A passage is read the way `owa_present_bible` reads one -- the app's own
 *   parser, in the version asked for, then the one the Bible Lookup is on,
 *   then any installed version that reads it -- through that module's own
 *   resolvers, never a second copy of them.
 * - The list is read FRESH right before each change: an instance holds its
 *   own copy of the file, and saving an old copy would erase whatever was
 *   added in between.
 * - A deleted passage takes its attached background with it, as the panel's
 *   own Delete does: ids are reused, and a leftover one would re-attach to the
 *   next passage saved.
 * - Nothing here touches a screen. A presented passage is a snapshot of the
 *   item, so changing or deleting the saved one leaves the screen alone.
 */
import appProvider from '../server/appProvider';
import { getMimetypeExtensions } from '../server/fileHelpers';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import { handleError } from './errorHelpers';
import DirSource from './DirSource';
import {
    type AgentResultType,
    NoBackupError,
    findAgentFreeName,
    genNoBackupReason,
    genUndoField,
    listAgentFiles,
    renameAgentFile,
    runWithAgentBackup,
    snapshotAgentFile,
    snapshotAgentFileForDelete,
    snapshotAgentSidecars,
    toAgentFilePath,
    trashAgentFile,
} from './agentBackupHelpers';

export type AgentBibleListRequestType = {
    action?: unknown;
    list?: unknown;
    id?: unknown;
    reference?: unknown;
    version?: unknown;
    newName?: unknown;
};

const LIST_LIMIT = 30;
const ITEM_LIMIT = 60;
const DEFAULT_LIST_NAME = 'Default';

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
            `${String((error as any)?.message ?? error)} Anything it did get ` +
            'to do can be put back with owa_undo.',
    );
}

async function getBibleClass() {
    const { default: Bible } = await import('../bible-list/Bible');
    return Bible;
}

function getWhere() {
    return appProvider.isPageReader ? 'Reader' : 'Presenter';
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

async function toTitle(bibleItem: any) {
    try {
        return await bibleItem.toTitleWithBibleKey();
    } catch (_error) {
        const { bookKey, chapter, verseStart, verseEnd } =
            bibleItem.target ?? {};
        return (
            `(${bibleItem.bibleKey}) ${bookKey} ${chapter}:${verseStart}` +
            (verseEnd === verseStart ? '' : `-${verseEnd}`)
        );
    }
}

type ListPlaceType = {
    Bible: Awaited<ReturnType<typeof getBibleClass>>;
    dirPath: string;
    extension: string;
};

type NamedListType = { name: string; filePath: string; isThere: boolean };

/**
 * The list a request names, or a refusal naming the lists there are. The
 * Default list may be missing -- the panel makes it the first time it shows --
 * and `mayBeMissing` lets the one change that needs it create it on the way.
 */
async function findList(
    place: ListPlaceType,
    list: unknown,
    { mayBeMissing = false } = {},
): Promise<NamedListType | AgentResultType> {
    const name = toText(list) === '' ? DEFAULT_LIST_NAME : toText(list);
    const nameReason = checkAgentFileName(name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const filePath = toAgentFilePath(place.dirPath, name, place.extension);
    if (filePath === null) {
        return fail('That list name would not stay inside the Bibles folder.');
    }
    const fileList = await listAgentFiles(
        place.dirPath,
        'bible',
        DEFAULT_LIST_NAME,
    );
    const isThere = fileList.some((one) => {
        return one.filePath === filePath;
    });
    if (isThere || (mayBeMissing && name === DEFAULT_LIST_NAME)) {
        return { name, filePath, isThere };
    }
    const names = fileList.map((one) => {
        return `"${one.name}"`;
    });
    return fail(
        `There is no Bibles list called "${name}" in the ${getWhere()}. ` +
            (names.length === 0
                ? 'There are no lists yet -- "add" saves into Default, which ' +
                  'is made on the way.'
                : `The lists are ${names.slice(0, LIST_LIMIT).join(', ')}.`),
    );
}

function checkIsListFound(
    found: NamedListType | AgentResultType,
): found is NamedListType {
    return (found as AgentResultType).isError !== true;
}

async function readFreshList(place: ListPlaceType, found: NamedListType) {
    const bible = await place.Bible.fromFilePath(found.filePath);
    if (bible === null) {
        throw new Error(`The Bibles list "${found.name}" could not be read.`);
    }
    return bible;
}

async function describeItems(items: any[]) {
    const rows = [];
    for (const item of items.slice(0, ITEM_LIMIT)) {
        rows.push({ id: item.id, title: await toTitle(item) });
    }
    return rows;
}

async function handleList(place: ListPlaceType, list: unknown) {
    const fileList =
        toText(list) === ''
            ? await listAgentFiles(place.dirPath, 'bible', DEFAULT_LIST_NAME)
            : null;
    let targets;
    if (fileList === null) {
        const found = await findList(place, list);
        if (!checkIsListFound(found)) {
            return found;
        }
        targets = [found];
    } else {
        targets = fileList.slice(0, LIST_LIMIT);
    }
    const lists = [];
    for (const target of targets) {
        const bible = await place.Bible.fromFilePath(target.filePath);
        const items = bible === null ? [] : bible.items;
        lists.push({
            name: target.name,
            count: items.length,
            items: await describeItems(items),
            ...(items.length > ITEM_LIMIT ? { isTruncated: true } : {}),
        });
    }
    return {
        where: getWhere(),
        lists,
        ...(fileList !== null && fileList.length > LIST_LIMIT
            ? { isTruncated: true, listCount: fileList.length }
            : {}),
    };
}

/** The installed versions, as a clause a refusal can end on. */
function toInstalledClause(versions?: string[]) {
    return versions === undefined || versions.length === 0
        ? ''
        : ` Installed versions: ${versions.join(', ')}.`;
}

/**
 * A reference read the way `owa_present_bible` reads one, in the version
 * asked for or -- with none -- the order that tool uses, or `fallbackVersion`
 * first when the passage already has one.
 */
async function resolvePassage(
    reference: string,
    version: string,
    fallbackVersion: string | null,
) {
    const { MAX_REFERENCE_LENGTH, resolveBibleItem, resolveVersionOrder } =
        await import('./agentBibleHelpers');
    if (reference.length > MAX_REFERENCE_LENGTH) {
        return fail(
            'That is longer than a reference. Give the book, chapter and ' +
                'verse only, such as "John 3:16".',
        );
    }
    const resolved = await resolveVersionOrder(version === '' ? null : version);
    if (!('order' in resolved)) {
        return fail(
            `${resolved.reason}${toInstalledClause(resolved.versions)}`,
        );
    }
    const order =
        version === '' &&
        fallbackVersion !== null &&
        resolved.installed.includes(fallbackVersion)
            ? [fallbackVersion, ...resolved.order]
            : resolved.order;
    const bibleItem = await resolveBibleItem(reference, order);
    if (bibleItem === null) {
        return fail(
            `"${reference}" could not be read as a passage in ` +
                `${version === '' ? 'any installed version' : version}. Write ` +
                "it as the version's full book name, chapter and verse -- " +
                '"John 3:16", "Psalm 23:1-6" -- or a whole chapter as ' +
                `"Psalm 23".${toInstalledClause(resolved.installed)}`,
        );
    }
    return bibleItem;
}

function checkIsRefusal(value: unknown): value is AgentResultType {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as AgentResultType).isError === true
    );
}

async function handleAdd(
    place: ListPlaceType,
    request: AgentBibleListRequestType,
) {
    const reference = toText(request.reference);
    if (reference === '') {
        return fail(
            'Say which passage to save: a reference such as "John 3:16".',
        );
    }
    const found = await findList(place, request.list, { mayBeMissing: true });
    if (!checkIsListFound(found)) {
        return found;
    }
    const bibleItem = await resolvePassage(
        reference,
        toText(request.version),
        null,
    );
    if (checkIsRefusal(bibleItem)) {
        return bibleItem;
    }
    const title = await toTitle(bibleItem);
    let restores;
    try {
        restores = found.isThere
            ? [await snapshotAgentFile(found.filePath)]
            : // Default is made on the way, so undoing this puts it in the
              // trash again -- which is where it was not, but nowhere is
              // where it was.
              [{ type: 'file' as const, filePath: found.filePath, text: null }];
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta, value: id } = await runWithAgentBackup(
            `Saved “${title}” to the Bibles list “${found.name}”`,
            restores,
            async () => {
                const bible = found.isThere
                    ? await readFreshList(place, found)
                    : await place.Bible.getDefault();
                if (bible === null) {
                    throw new Error('the Default list could not be made.');
                }
                bible.addBibleItem(bibleItem);
                if (!(await bible.save())) {
                    throw new Error('the list could not be saved.');
                }
                return bible.maxItemId;
            },
        );
        return {
            where: getWhere(),
            added: title,
            version: bibleItem.bibleKey,
            list: found.name,
            id,
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, `Saving “${title}”`);
    }
}

function readId(value: unknown) {
    return Number.isInteger(value) ? (value as number) : null;
}

function genNoSuchItemReason(listName: string, id: number, bible: any) {
    const ids = bible.items
        .map((item: any) => {
            return item.id;
        })
        .filter((one: number) => {
            return one >= 0;
        });
    return (
        `The Bibles list "${listName}" has no passage with the id ${id}. ` +
        (ids.length === 0
            ? 'It is empty.'
            : `Its ids are ${ids.slice(0, ITEM_LIMIT).join(', ')} -- action ` +
              '"list" says which is which.')
    );
}

async function handleUpdate(
    place: ListPlaceType,
    request: AgentBibleListRequestType,
) {
    const id = readId(request.id);
    if (id === null) {
        return fail(
            'Say which passage to change: its `id`, from action "list".',
        );
    }
    const reference = toText(request.reference);
    const version = toText(request.version);
    if (reference === '' && version === '') {
        return fail('Give a new `reference`, a new `version`, or both.');
    }
    const found = await findList(place, request.list);
    if (!checkIsListFound(found)) {
        return found;
    }
    const bible = await readFreshList(place, found);
    const item = bible.getItemById(id);
    if (item === null || item.id < 0) {
        return fail(genNoSuchItemReason(found.name, id, bible));
    }
    const was = await toTitle(item);
    let resolved;
    if (reference !== '') {
        resolved = await resolvePassage(reference, version, item.bibleKey);
    } else {
        // The same passage in another version: read by its language-neutral
        // key, so "John" need not be a book name that version knows.
        const { resolveVersionOrder } = await import('./agentBibleHelpers');
        const versionOrder = await resolveVersionOrder(version);
        if (!('order' in versionOrder)) {
            return fail(
                `${versionOrder.reason}${toInstalledClause(versionOrder.versions)}`,
            );
        }
        const { default: BibleItem } = await import('../bible-list/BibleItem');
        resolved =
            (await BibleItem.fromVerseKey(
                versionOrder.order[0],
                item.toVerseFullKey(),
            )) ??
            fail(
                `${was} could not be read in ${versionOrder.order[0]}, so it ` +
                    'was not changed.',
            );
    }
    if (checkIsRefusal(resolved)) {
        return resolved;
    }
    const passage = resolved;
    const title = await toTitle(passage);
    let restores;
    try {
        restores = [await snapshotAgentFile(found.filePath)];
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Changed “${was}” in the Bibles list “${found.name}” to “${title}”`,
            restores,
            async () => {
                const fresh = await readFreshList(place, found);
                const target = fresh.getItemById(id);
                if (target === null) {
                    throw new Error('the passage is not in the list any more.');
                }
                // Only what a passage IS changes: its id, its colour note and
                // its audio and extra-version settings stay.
                target.bibleKey = passage.bibleKey;
                target.target = passage.target;
                fresh.setItemById(id, target);
                if (!(await fresh.save())) {
                    throw new Error('the list could not be saved.');
                }
            },
        );
        return {
            where: getWhere(),
            updated: title,
            was,
            list: found.name,
            id,
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, `Changing “${was}”`);
    }
}

async function handleDelete(
    place: ListPlaceType,
    request: AgentBibleListRequestType,
) {
    const id = readId(request.id);
    if (id === null) {
        return fail(
            'Say which passage to remove: its `id`, from action "list".',
        );
    }
    const found = await findList(place, request.list);
    if (!checkIsListFound(found)) {
        return found;
    }
    const bible = await readFreshList(place, found);
    const item = bible.getItemById(id);
    if (item === null || item.id < 0) {
        return fail(genNoSuchItemReason(found.name, id, bible));
    }
    const title = await toTitle(item);
    let restores;
    try {
        // The list, and its sidecar: the background attached to THIS passage
        // is in there, keyed by its id.
        restores = [
            await snapshotAgentFile(found.filePath),
            ...(await snapshotAgentSidecars(found.filePath)),
        ];
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Removed “${title}” from the Bibles list “${found.name}”`,
            restores,
            async () => {
                const fresh = await readFreshList(place, found);
                const target = fresh.getItemById(id);
                if (target === null) {
                    throw new Error('the passage is not in the list any more.');
                }
                fresh.deleteItem(target);
                if (!(await fresh.save())) {
                    throw new Error('the list could not be saved.');
                }
                const { attachBackgroundManager } =
                    await import('../others/AttachBackgroundManager');
                await attachBackgroundManager.detachBackground(
                    found.filePath,
                    id,
                );
            },
        );
        return {
            where: getWhere(),
            deleted: title,
            list: found.name,
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, `Removing “${title}”`);
    }
}

async function handleCreateList(
    place: ListPlaceType,
    request: AgentBibleListRequestType,
) {
    const name = toText(request.list);
    const nameReason = checkAgentFileName(name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const filePath = toAgentFilePath(place.dirPath, name, place.extension);
    if (filePath === null) {
        return fail('That list name would not stay inside the Bibles folder.');
    }
    const fileList = await listAgentFiles(
        place.dirPath,
        'bible',
        DEFAULT_LIST_NAME,
    );
    if (
        fileList.some((one) => {
            return one.filePath === filePath;
        })
    ) {
        const freeName = await findAgentFreeName(
            place.dirPath,
            name,
            place.extension,
        );
        return fail(
            `A Bibles list called "${name}" is already there. "${freeName}" ` +
                'is free.',
        );
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Made the Bibles list “${name}”`,
            [{ type: 'file', filePath, text: null }],
            async () => {
                if ((await place.Bible.create(place.dirPath, name)) === null) {
                    throw new Error('the list could not be made.');
                }
            },
        );
        return { where: getWhere(), created: name, ...genUndoField(meta) };
    } catch (error) {
        return toChangeFailure(error, `Making the Bibles list “${name}”`);
    }
}

async function handleRenameList(
    place: ListPlaceType,
    request: AgentBibleListRequestType,
) {
    const found = await findList(place, request.list);
    if (!checkIsListFound(found)) {
        return found;
    }
    const newName = toText(request.newName);
    const nameReason = checkAgentFileName(newName);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const newPath = toAgentFilePath(place.dirPath, newName, place.extension);
    if (newPath === null) {
        return fail('That new name would not stay inside the Bibles folder.');
    }
    const fileList = await listAgentFiles(
        place.dirPath,
        'bible',
        DEFAULT_LIST_NAME,
    );
    if (
        fileList.some((one) => {
            return one.filePath === newPath;
        })
    ) {
        return fail(
            `A Bibles list called "${newName}" is already there, so ` +
                `"${found.name}" was not renamed.`,
        );
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Renamed the Bibles list “${found.name}” to “${newName}”`,
            [{ type: 'rename', from: found.filePath, to: newPath }],
            () => {
                return renameAgentFile(found.filePath, newName);
            },
        );
        return {
            where: getWhere(),
            renamedFrom: found.name,
            renamedTo: newName,
            ...genUndoField(meta),
            ...(found.name === DEFAULT_LIST_NAME
                ? {
                      note:
                          'The app makes a new, empty Default list the next ' +
                          'time the Bibles panel shows.',
                  }
                : {}),
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Renaming the Bibles list “${found.name}”`,
        );
    }
}

async function handleDeleteList(
    place: ListPlaceType,
    request: AgentBibleListRequestType,
) {
    const found = await findList(place, request.list);
    if (!checkIsListFound(found)) {
        return found;
    }
    const bible = await readFreshList(place, found);
    let restores;
    try {
        restores = await snapshotAgentFileForDelete(found.filePath);
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Moved the Bibles list “${found.name}” to the trash`,
            restores,
            () => {
                return trashAgentFile(found.filePath);
            },
        );
        return {
            where: getWhere(),
            deleted: found.name,
            isInTrash: true,
            count: bible.itemsLength,
            ...genUndoField(meta),
            note:
                'It is in the trash, and owa_undo puts it back.' +
                (found.name === DEFAULT_LIST_NAME
                    ? ' The app makes a new, empty Default list the next ' +
                      'time the Bibles panel shows.'
                    : ''),
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Moving the Bibles list “${found.name}” to the trash`,
        );
    }
}

const ACTION_HANDLER_MAP: Record<
    string,
    (
        place: ListPlaceType,
        request: AgentBibleListRequestType,
    ) => Promise<unknown>
> = {
    list: (place, request) => {
        return handleList(place, request.list);
    },
    add: handleAdd,
    update: handleUpdate,
    delete: handleDelete,
    'create-list': handleCreateList,
    'rename-list': handleRenameList,
    'delete-list': handleDeleteList,
};

/**
 * One request from `owa_bible_item`. Always answers with a plain object and
 * never throws: the caller is a page expression whose only channel back is a
 * DOM event.
 */
export async function handleAgentBibleListRequest(
    request: AgentBibleListRequestType,
): Promise<AgentResultType> {
    try {
        const action = String(request?.action ?? '');
        if (!Object.hasOwn(ACTION_HANDLER_MAP, action)) {
            return fail(
                'Unknown action. Use list, add, update, delete, create-list, ' +
                    'rename-list or delete-list.',
            );
        }
        const Bible = await getBibleClass();
        const dirPath = DirSource.getDirPathBySettingName(
            Bible.getDirSourceSettingName(),
        );
        if (dirPath === null) {
            return fail(
                `No Bibles folder is set up for the ${getWhere()} yet. The ` +
                    'user chooses one in Settings under Path Settings.',
            );
        }
        const place = {
            Bible,
            dirPath,
            extension: getMimetypeExtensions('bible')[0],
        };
        return (await ACTION_HANDLER_MAP[action](
            place,
            request,
        )) as AgentResultType;
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
