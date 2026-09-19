/**
 * The app side of `owa_bible_note`: the user's Bible notes, and whole note
 * files.
 *
 * ## What is different about a note file
 *
 * A `.own` file is written straight to disk on every change -- no editing
 * history, no `*`, no Ctrl+Z -- so the one undo behind anything done here is
 * the backup taken before it (`agentBackupHelpers.ts`): no backup, no change.
 *
 * It holds two kinds of item. A NOTE is words, stored as the note editor's
 * own state (`agentNoteTextHelpers.ts` writes and reads that shape). A
 * VERSE-MARKS item is the highlights and comments made on one verse in the
 * Reader: its `content` is the verse's short key and must stay so, which is
 * why its words are never written here -- it can be renamed or removed whole,
 * as the panel's own menu does.
 *
 * ## The rules it keeps
 *
 * - The file is read FRESH right before each change and changed in ONE save:
 *   a note instance holds its own copy of the file, and every save rewrites
 *   the whole of it. (A note open in its own window does the same from ITS
 *   copy, which is why the MCP tool refuses a change while one is open.)
 * - A new note takes the next id the file has, worked out before it is added
 *   -- `addNoteItem` numbers its own copy, not the item it was given.
 */
import { getMimetypeExtensions } from '../server/fileHelpers';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import { dirSourceSettingNames } from './constants';
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
import {
    AGENT_NOTE_TEXT_MAX_CHARS,
    readLexicalMentions,
    readLexicalText,
    toFirstWords,
    toLexicalContent,
} from './agentNoteTextHelpers';

export type AgentNoteRequestType = {
    action?: unknown;
    file?: unknown;
    id?: unknown;
    title?: unknown;
    text?: unknown;
    newName?: unknown;
};

const FILE_LIMIT = 30;
const NOTE_LIMIT = 60;
const TITLE_MAX_CHARS = 200;
const DEFAULT_FILE_NAME = 'Default';

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

async function getNoteClasses() {
    const { default: Note } = await import('../bible-list/note/Note');
    const { default: NoteItem } = await import('../bible-list/note/NoteItem');
    return { Note, NoteItem };
}

function toText(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

type NotePlaceType = Awaited<ReturnType<typeof getNoteClasses>> & {
    dirPath: string;
    extension: string;
};

type NamedFileType = { name: string; filePath: string; isThere: boolean };

async function findFile(
    place: NotePlaceType,
    file: unknown,
    { mayBeMissing = false } = {},
): Promise<NamedFileType | AgentResultType> {
    const name = toText(file) === '' ? DEFAULT_FILE_NAME : toText(file);
    const nameReason = checkAgentFileName(name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const filePath = toAgentFilePath(place.dirPath, name, place.extension);
    if (filePath === null) {
        return fail('That file name would not stay inside the notes folder.');
    }
    const fileList = await listAgentFiles(
        place.dirPath,
        'note',
        DEFAULT_FILE_NAME,
    );
    const isThere = fileList.some((one) => {
        return one.filePath === filePath;
    });
    if (isThere || (mayBeMissing && name === DEFAULT_FILE_NAME)) {
        return { name, filePath, isThere };
    }
    const names = fileList.map((one) => {
        return `"${one.name}"`;
    });
    return fail(
        `There is no notes file called "${name}". ` +
            (names.length === 0
                ? 'There are none yet -- "add" writes into Default, which is ' +
                  'made on the way.'
                : `The files are ${names.slice(0, FILE_LIMIT).join(', ')}.`),
    );
}

function checkIsFound(
    found: NamedFileType | AgentResultType,
): found is NamedFileType {
    return (found as AgentResultType).isError !== true;
}

async function readFreshNote(place: NotePlaceType, found: NamedFileType) {
    const note = await place.Note.fromFilePath(found.filePath);
    if (note === null) {
        throw new Error(`The notes file "${found.name}" could not be read.`);
    }
    return note;
}

function describeNoteRow(item: any) {
    if (item.isVerseItem) {
        return {
            id: item.id,
            kind: 'verse-marks',
            title: item.title,
            verse: item.verseKey,
            highlights: item.highlights.length,
            comments: item.comments.length,
        };
    }
    return {
        id: item.id,
        kind: 'note',
        title: item.title,
        firstWords: toFirstWords(readLexicalText(item.content)),
    };
}

function listRealItems(note: any): any[] {
    // An item the file could not read is carried as a placeholder with id -1:
    // it is not a note anybody can name, change or remove from here.
    return note.items.filter((item: any) => {
        return item.id >= 0;
    });
}

async function handleList(place: NotePlaceType, file: unknown) {
    const fileList =
        toText(file) === ''
            ? await listAgentFiles(place.dirPath, 'note', DEFAULT_FILE_NAME)
            : null;
    let targets;
    if (fileList === null) {
        const found = await findFile(place, file);
        if (!checkIsFound(found)) {
            return found;
        }
        targets = [found];
    } else {
        targets = fileList.slice(0, FILE_LIMIT);
    }
    const files = [];
    for (const target of targets) {
        const note = await place.Note.fromFilePath(target.filePath);
        const items = note === null ? [] : listRealItems(note);
        files.push({
            name: target.name,
            count: items.length,
            notes: items.slice(0, NOTE_LIMIT).map(describeNoteRow),
            ...(items.length > NOTE_LIMIT ? { isTruncated: true } : {}),
        });
    }
    return {
        files,
        ...(fileList !== null && fileList.length > FILE_LIMIT
            ? { isTruncated: true, fileCount: fileList.length }
            : {}),
    };
}

function readId(value: unknown) {
    return Number.isInteger(value) ? (value as number) : null;
}

function genNoSuchNoteReason(fileName: string, id: number, note: any) {
    const ids = listRealItems(note).map((item) => {
        return item.id;
    });
    return (
        `The notes file "${fileName}" has no note with the id ${id}. ` +
        (ids.length === 0
            ? 'It is empty.'
            : `Its ids are ${ids.slice(0, NOTE_LIMIT).join(', ')} -- action ` +
              '"list" says which is which.')
    );
}

type FoundNoteType = {
    isFound: true;
    found: NamedFileType;
    note: any;
    item: any;
    id: number;
};

// A real guard, not `'isError' in target`: a refusal's type carries an index
// signature, so the found note is assignable to it and an `in` test narrows
// nothing.
function checkIsFoundNote(
    target: FoundNoteType | AgentResultType,
): target is FoundNoteType {
    return (target as FoundNoteType).isFound === true;
}

async function findNote(
    place: NotePlaceType,
    request: AgentNoteRequestType,
): Promise<FoundNoteType | AgentResultType> {
    const id = readId(request.id);
    if (id === null) {
        return fail('Say which note: its `id`, from action "list".');
    }
    const found = await findFile(place, request.file);
    if (!checkIsFound(found)) {
        return found;
    }
    const note = await readFreshNote(place, found);
    const item = note.getItemById(id);
    if (item === null || item.id < 0) {
        return fail(genNoSuchNoteReason(found.name, id, note));
    }
    return { isFound: true, found, note, item, id };
}

async function handleRead(place: NotePlaceType, request: AgentNoteRequestType) {
    const target = await findNote(place, request);
    if (!checkIsFoundNote(target)) {
        return target;
    }
    const { found, item, id } = target;
    if (item.isVerseItem) {
        return {
            file: found.name,
            id,
            kind: 'verse-marks',
            title: item.title,
            verse: item.verseKey,
            marks: [
                ...item.highlights.map((one: any) => {
                    return {
                        kind: 'highlight',
                        words: one.text,
                        color: one.color,
                    };
                }),
                ...item.comments.map((one: any) => {
                    return {
                        kind: 'comment',
                        words: one.text,
                        comment: one.comment,
                    };
                }),
            ],
        };
    }
    const text = readLexicalText(item.content);
    const verses = readLexicalMentions(item.content);
    return {
        file: found.name,
        id,
        kind: 'note',
        title: item.title,
        text:
            text.length > AGENT_NOTE_TEXT_MAX_CHARS
                ? `${text.slice(0, AGENT_NOTE_TEXT_MAX_CHARS)}…`
                : text,
        ...(verses.length === 0 ? {} : { verses }),
    };
}

function checkTitleAndText(title: string, text: unknown) {
    if (title.length > TITLE_MAX_CHARS) {
        return fail(`A note's title is at most ${TITLE_MAX_CHARS} characters.`);
    }
    if (typeof text === 'string' && text.length > AGENT_NOTE_TEXT_MAX_CHARS) {
        return fail(
            `A note's text is at most ${AGENT_NOTE_TEXT_MAX_CHARS} characters.`,
        );
    }
    return null;
}

async function handleAdd(place: NotePlaceType, request: AgentNoteRequestType) {
    const title = toText(request.title);
    if (title === '') {
        return fail('A new note needs a `title`.');
    }
    const refusal = checkTitleAndText(title, request.text);
    if (refusal !== null) {
        return refusal;
    }
    const found = await findFile(place, request.file, { mayBeMissing: true });
    if (!checkIsFound(found)) {
        return found;
    }
    let restores;
    try {
        restores = found.isThere
            ? [await snapshotAgentFile(found.filePath)]
            : [{ type: 'file' as const, filePath: found.filePath, text: null }];
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    const content = toLexicalContent(
        typeof request.text === 'string' ? request.text : '',
    );
    try {
        const { meta, value: id } = await runWithAgentBackup(
            `Wrote the note “${title}” in “${found.name}”`,
            restores,
            async () => {
                const note = found.isThere
                    ? await readFreshNote(place, found)
                    : await place.Note.getDefault();
                if (note === null) {
                    throw new Error(
                        'the Default notes file could not be made.',
                    );
                }
                const newId = note.maxItemId + 1;
                const json = place.NoteItem.genNewJsonData();
                json.title = title;
                json.content = content;
                note.addNoteItem(new place.NoteItem(json));
                if (!(await note.save())) {
                    throw new Error('the notes file could not be saved.');
                }
                return newId;
            },
        );
        return { file: found.name, added: title, id, ...genUndoField(meta) };
    } catch (error) {
        return toChangeFailure(error, `Writing the note “${title}”`);
    }
}

async function handleUpdate(
    place: NotePlaceType,
    request: AgentNoteRequestType,
) {
    const title = toText(request.title);
    const hasText = typeof request.text === 'string';
    if (title === '' && !hasText) {
        return fail('Give a new `title`, a new `text`, or both.');
    }
    const refusal = checkTitleAndText(title, request.text);
    if (refusal !== null) {
        return refusal;
    }
    const target = await findNote(place, request);
    if (!checkIsFoundNote(target)) {
        return target;
    }
    const { found, item, id } = target;
    if (hasText && item.isVerseItem) {
        return fail(
            "That is a verse's highlights and comments, not a note -- its " +
                'comments are changed in the Reader.',
        );
    }
    let restores;
    try {
        restores = [await snapshotAgentFile(found.filePath)];
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    const shownTitle = title === '' ? item.title : title;
    try {
        const { meta } = await runWithAgentBackup(
            `Changed the note “${item.title}” in “${found.name}”`,
            restores,
            async () => {
                const note = await readFreshNote(place, found);
                const fresh = note.getItemById(id);
                if (fresh === null) {
                    throw new Error('the note is not in the file any more.');
                }
                if (title !== '') {
                    fresh.title = title;
                }
                if (hasText) {
                    fresh.content = toLexicalContent(request.text as string);
                }
                note.updateNoteItem(fresh, true);
                if (!(await note.save())) {
                    throw new Error('the notes file could not be saved.');
                }
            },
        );
        return {
            file: found.name,
            updated: shownTitle,
            id,
            ...genUndoField(meta),
        };
    } catch (error) {
        return toChangeFailure(error, `Changing the note “${item.title}”`);
    }
}

async function handleDelete(
    place: NotePlaceType,
    request: AgentNoteRequestType,
) {
    const target = await findNote(place, request);
    if (!checkIsFoundNote(target)) {
        return target;
    }
    const { found, item, id } = target;
    let restores;
    try {
        restores = [
            await snapshotAgentFile(found.filePath),
            ...(await snapshotAgentSidecars(found.filePath)),
        ];
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Removed the note “${item.title}” from “${found.name}”`,
            restores,
            async () => {
                const note = await readFreshNote(place, found);
                const fresh = note.getItemById(id);
                if (fresh === null) {
                    throw new Error('the note is not in the file any more.');
                }
                note.deleteItem(fresh);
                if (!(await note.save())) {
                    throw new Error('the notes file could not be saved.');
                }
            },
        );
        return { file: found.name, deleted: item.title, ...genUndoField(meta) };
    } catch (error) {
        return toChangeFailure(error, `Removing the note “${item.title}”`);
    }
}

async function handleCreateFile(
    place: NotePlaceType,
    request: AgentNoteRequestType,
) {
    const name = toText(request.file);
    const nameReason = checkAgentFileName(name);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const filePath = toAgentFilePath(place.dirPath, name, place.extension);
    if (filePath === null) {
        return fail('That file name would not stay inside the notes folder.');
    }
    const fileList = await listAgentFiles(
        place.dirPath,
        'note',
        DEFAULT_FILE_NAME,
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
            `A notes file called "${name}" is already there. "${freeName}" is ` +
                'free.',
        );
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Made the notes file “${name}”`,
            [{ type: 'file', filePath, text: null }],
            async () => {
                if ((await place.Note.create(place.dirPath, name)) === null) {
                    throw new Error('the notes file could not be made.');
                }
            },
        );
        return { created: name, ...genUndoField(meta) };
    } catch (error) {
        return toChangeFailure(error, `Making the notes file “${name}”`);
    }
}

async function handleRenameFile(
    place: NotePlaceType,
    request: AgentNoteRequestType,
) {
    const found = await findFile(place, request.file);
    if (!checkIsFound(found)) {
        return found;
    }
    const newName = toText(request.newName);
    const nameReason = checkAgentFileName(newName);
    if (nameReason !== null) {
        return fail(nameReason);
    }
    const newPath = toAgentFilePath(place.dirPath, newName, place.extension);
    if (newPath === null) {
        return fail('That new name would not stay inside the notes folder.');
    }
    const fileList = await listAgentFiles(
        place.dirPath,
        'note',
        DEFAULT_FILE_NAME,
    );
    if (
        fileList.some((one) => {
            return one.filePath === newPath;
        })
    ) {
        return fail(
            `A notes file called "${newName}" is already there, so ` +
                `"${found.name}" was not renamed.`,
        );
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Renamed the notes file “${found.name}” to “${newName}”`,
            [{ type: 'rename', from: found.filePath, to: newPath }],
            () => {
                return renameAgentFile(found.filePath, newName);
            },
        );
        return {
            renamedFrom: found.name,
            renamedTo: newName,
            ...genUndoField(meta),
            ...(found.name === DEFAULT_FILE_NAME
                ? {
                      note:
                          'The app makes a new Default notes file the next ' +
                          'time the Bible Notes panel shows.',
                  }
                : {}),
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Renaming the notes file “${found.name}”`,
        );
    }
}

async function handleDeleteFile(
    place: NotePlaceType,
    request: AgentNoteRequestType,
) {
    const found = await findFile(place, request.file);
    if (!checkIsFound(found)) {
        return found;
    }
    const note = await readFreshNote(place, found);
    let restores;
    try {
        restores = await snapshotAgentFileForDelete(found.filePath);
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Moved the notes file “${found.name}” to the trash`,
            restores,
            () => {
                return trashAgentFile(found.filePath);
            },
        );
        return {
            deleted: found.name,
            isInTrash: true,
            count: listRealItems(note).length,
            ...genUndoField(meta),
            note:
                'It is in the trash, and owa_undo puts it back.' +
                (found.name === DEFAULT_FILE_NAME
                    ? ' The app makes a new Default notes file the next time ' +
                      'the Bible Notes panel shows.'
                    : ''),
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Moving the notes file “${found.name}” to the trash`,
        );
    }
}

const ACTION_HANDLER_MAP: Record<
    string,
    (place: NotePlaceType, request: AgentNoteRequestType) => Promise<unknown>
> = {
    list: (place, request) => {
        return handleList(place, request.file);
    },
    read: handleRead,
    add: handleAdd,
    update: handleUpdate,
    delete: handleDelete,
    'create-file': handleCreateFile,
    'rename-file': handleRenameFile,
    'delete-file': handleDeleteFile,
};

/**
 * One request from `owa_bible_note`. Always answers with a plain object and
 * never throws: the caller is a page expression whose only channel back is a
 * DOM event.
 */
export async function handleAgentNoteRequest(
    request: AgentNoteRequestType,
): Promise<AgentResultType> {
    try {
        const action = String(request?.action ?? '');
        if (!Object.hasOwn(ACTION_HANDLER_MAP, action)) {
            return fail(
                'Unknown action. Use list, read, add, update, delete, ' +
                    'create-file, rename-file or delete-file.',
            );
        }
        const dirPath = DirSource.getDirPathBySettingName(
            dirSourceSettingNames.BIBLE_NOTES,
        );
        if (dirPath === null) {
            return fail(
                'No Bible notes folder is set up yet. The user chooses one in ' +
                    'Settings under Path Settings.',
            );
        }
        const place = {
            ...(await getNoteClasses()),
            dirPath,
            extension: getMimetypeExtensions('note')[0],
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
