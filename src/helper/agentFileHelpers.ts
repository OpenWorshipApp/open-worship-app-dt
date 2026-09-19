/**
 * The app side of `owa_lyric_file` and `owa_slide_file` — the MCP tools that
 * let an agent (a developer driving QA, or the help chatbot acting for a
 * volunteer) look at and write the user's own song and slide documents.
 *
 * ## Why this lives in a renderer at all
 *
 * Everything these files need is here and nowhere else: `Lyric.create`,
 * `AppDocument.validate`, `FileSource.renameTo` and the editing history all
 * run through `appProvider.fileUtils`, and open-lyric's own validator is
 * browser-only (its module graph touches `document` at evaluation time). The
 * MCP package cannot import any of it — the same files are spawned standalone
 * over stdio, where there is no app — so the tools reach this module the way
 * the walkthrough card reaches the main process: a dependency-free page
 * expression fires a DOM event and `domHelpers.ts` relays it here. An injected
 * expression must never `import()` an app module (memory:
 * `cdp-dynamic-import-hijack`).
 *
 * ## Two tools, one implementation
 *
 * The tools are separate on the wire because a model picking between them
 * should not have to read about a file type it is not touching. The lifecycle
 * is identical, so it is written once here and the differences live in
 * `AGENT_FILE_KIND_MAP` — the same shape `LLM_PROVIDER_MAP` uses for the same
 * reason: a third file type should be a descriptor, not a third copy. The
 * slide actions belong to slide documents only, and their rules -- which box
 * an `id` names, where a new slide goes -- are the pure module
 * `agentSlideHelpers.ts`, so they are tested without an app behind them.
 *
 * ## What it will not do
 *
 * These are the app's own rules, not the tools', because this module is what
 * actually touches the disk and a check placed further out is one a later
 * caller can forget:
 *
 *  - **Nothing is lost, and `create` never overwrites.** A delete is a move to
 *    the trash, and every change -- create, update, rename, delete, a slide --
 *    is backed up BEFORE it is made (`agentBackupHelpers.ts`): no backup, no
 *    change, and `owa_undo` puts any of them back. `fsCreateFile` throws on an
 *    existing path unless told to override, and it is never told to.
 *  - **`update` and the slide actions write the EDITING HISTORY, never the
 *    saved file.** The change is undoable with Ctrl+Z, the document shows its
 *    `*` dirty marker, and a human presses Save. It is "the assistant may
 *    point, the human presses" applied to content rather than to a button. It
 *    also leaves anything already ON a screen alone — a presented slide is a
 *    snapshot until re-presented.
 *  - **A name is REFUSED, never quietly cleaned.** `createNewFileDetail` still
 *    carries a `// TODO: verify file name before create`, so a separator or a
 *    `..` in a name would land wherever it pointed. Writing to a different
 *    file than the caller named is worse than saying no.
 *  - **Content must satisfy the app's own validator** before any write —
 *    open-lyric's for a song, `AppDocument.validate` for a slide document, and
 *    the canvas item classes for every box a slide action writes. A file the
 *    app cannot parse is one that renders as nothing on a projector, which is
 *    the failure a volunteer cannot debug mid-service.
 */
import type FileSource from './FileSource';
import type { MimetypeNameType } from '../server/fileHelpers';
import type { AnyObjectType } from './typeHelpers';
import { handleError } from './errorHelpers';
import DirSource from './DirSource';
import { dirSourceSettingNames } from './constants';
import { checkAgentFileName } from '../../tools/owa-devtools-mcp/agentFileName.mjs';
import {
    fsCheckFileExist,
    fsListFilesWithMimetype,
    getMimetypeExtensions,
    pathJoin,
} from '../server/fileHelpers';
import {
    type AgentEditableKindType,
    NoBackupError,
    genNoBackupReason,
    genUndoField,
    renameAgentFile,
    runWithAgentBackup,
    snapshotAgentEditing,
    snapshotAgentFileForDelete,
    trashAgentFile,
} from './agentBackupHelpers';
import {
    type AgentSlideActionType,
    type AgentSlideChangeType,
    applyAgentSlideAction,
    checkIsAgentSlideAction,
    readAgentSlideDocument,
    readAgentSlideRequest,
} from './agentSlideHelpers';

export type AgentFileActionType =
    | 'list'
    | 'info'
    | 'create'
    | 'update'
    | 'rename'
    | 'delete'
    | AgentSlideActionType;

export type AgentFileKindNameType = AgentEditableKindType;

export type AgentFileRequestType = {
    kind?: AgentFileKindNameType;
    action?: AgentFileActionType;
    name?: string;
    newName?: string;
    content?: string;
    slide?: unknown;
    to?: unknown;
    items?: unknown;
};

export type AgentFileResultType = {
    isError?: boolean;
    reason?: string;
} & Record<string, unknown>;

function fail(reason: string): AgentFileResultType {
    return { isError: true, reason };
}

const UNSAVED_NOTE =
    'The change is in the document but NOT on disk yet: it shows a * beside ' +
    'its name, Ctrl+Z undoes it, and the user presses Save to keep it. Tell ' +
    'them that.';

/**
 * The sentence for a change that did not happen. A backup that could not be
 * saved says so in its own words -- nothing was touched; anything else is the
 * change itself failing after its backup was taken, which `owa_undo` can
 * still reverse.
 */
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

// --- what differs between the two file types ----------------------------

type AgentFileKindType = {
    mimetypeName: MimetypeNameType;
    /** How a volunteer would say it, for a sentence the model passes on. */
    label: string;
    /** The reason this content cannot be written, or null. */
    checkContent: (content: string) => Promise<string | null>;
    /** A brand-new file holding this content, landing clean on disk. */
    create: (
        dirPath: string,
        name: string,
        content: string,
    ) => Promise<FileSource | null>;
    /** Into the editing history — never a save. */
    update: (filePath: string, content: string) => Promise<string | null>;
    /** Whatever is worth saying about an existing file. */
    describe: (filePath: string) => Promise<AnyObjectType>;
};

async function getLyricClass() {
    // Dynamic on purpose, everywhere below: a static import from a module this
    // shallow closes an import cycle through the app-document helpers (memory:
    // `app-document-helpers-lyric-cycle`), and nothing here loads until an
    // agent actually asks.
    const { default: Lyric } = await import('../lyric-list/Lyric');
    return Lyric;
}

async function getAppDocumentClass() {
    const { default: AppDocument } =
        await import('../app-document-list/AppDocument');
    return AppDocument;
}

async function getFileSourceClass() {
    const { default: FileSourceClass } = await import('./FileSource');
    return FileSourceClass;
}

/**
 * open-lyric's own validator, loaded on demand.
 *
 * The same call as `checkOpenLyricMarkdown` in
 * `plugins/song-select/songSelectLyricHelpers.ts`, and not imported from there
 * on purpose: a core helper must not depend on a plugin. Unifying the two is
 * `MC-19` in the enhance-mcp backlog.
 */
async function checkLyricContent(content: string) {
    const { EditorOpenLyricPlugin } = await import('open-lyric');
    const api = new EditorOpenLyricPlugin().getOpenLyricApi();
    if (api.document.checkMarkdown(content) === true) {
        return null;
    }
    return (
        'Open Lyric refused that content. A song needs an ```ol:Config fence ' +
        'whose fields are written as list lines -- "- Title: ...", ' +
        '"- Artist: ...", "- Copyright: ...", "- Key: C", "- Tempo: 72bpm" ' +
        '(no space), "- Time: 4/4", "- Structure: V1C" -- and then one fence ' +
        'per section (```ol:Verse 1, ```ol:Chorus). The leading "- " is ' +
        'required and is the usual mistake. Structure is one token string ' +
        'with no separators, naming only parts the document declares, and ' +
        'the same part may not appear twice in a row. Every [ chord ' +
        'annotation must close on the same line. Instrumental and Interlude ' +
        'fences take chord bars only -- free text belongs in a Breakdown ' +
        'fence.'
    );
}

function parseSlideJson(content: string) {
    try {
        return JSON.parse(content) as AnyObjectType;
    } catch {
        return null;
    }
}

const SLIDE_CONTENT_HELP =
    'Slide content is the document as JSON, with an `items` array of slides ' +
    '— each `{id, canvasItems: [...], metadata: {width, height}}`. Read an ' +
    'existing document with action "info" to see the shape this app expects.';

async function checkSlideContent(content: string) {
    const json = parseSlideJson(content);
    if (json === null) {
        return `That is not valid JSON. ${SLIDE_CONTENT_HELP}`;
    }
    if (!Array.isArray(json.items)) {
        return `There is no \`items\` array. ${SLIDE_CONTENT_HELP}`;
    }
    const AppDocument = await getAppDocumentClass();
    try {
        // The app's OWN validator, so what is accepted here is exactly what
        // the app can open — never a second opinion that could drift from it.
        AppDocument.validate({
            metadata: { app: 'open-worship', fileVersion: 1, initDate: '' },
            ...json,
        });
    } catch (error: any) {
        return (
            'This app refused that document: ' +
            String(error?.message ?? error).slice(0, 300)
        );
    }
    return null;
}

export const AGENT_FILE_KIND_MAP: Record<
    AgentFileKindNameType,
    AgentFileKindType
> = {
    lyric: {
        mimetypeName: 'lyric',
        label: 'song',
        checkContent: checkLyricContent,
        create: async (dirPath, name, content) => {
            const Lyric = await getLyricClass();
            return await Lyric.createWithContent(dirPath, name, content);
        },
        update: async (filePath, content) => {
            const Lyric = await getLyricClass();
            const lyric = Lyric.getInstance(filePath);
            if ((await lyric.getJsonData()) === null) {
                return null;
            }
            await lyric.setContent(content);
            return 'ok';
        },
        describe: async (filePath) => {
            const Lyric = await getLyricClass();
            const content = await Lyric.getInstance(filePath).getContent();
            let info: any = null;
            try {
                const { OpenLyric } = await import('open-lyric');
                // `getInfo()` reads the value directly and answers before
                // `mount()`, so this needs no container and paints nothing.
                info = new OpenLyric({ value: content }).getInfo();
            } catch (error) {
                handleError(error);
            }
            return {
                characters: content.length,
                title: info?.title ?? null,
                key: info?.key ?? null,
                metaLine: info?.metaLine ?? null,
                structureLine: info?.structureLine ?? null,
                sections: (info?.sections ?? []).map((one: any) => {
                    return one.partName;
                }),
            };
        },
    },
    slide: {
        mimetypeName: 'appDocument',
        label: 'slide document',
        checkContent: checkSlideContent,
        create: async (dirPath, name, content) => {
            const AppDocument = await getAppDocumentClass();
            const json = parseSlideJson(content) ?? {};
            return await AppDocument.createWithContent(
                dirPath,
                name,
                json.items as AnyObjectType[],
            );
        },
        update: async (filePath, content) => {
            const AppDocument = await getAppDocumentClass();
            const appDocument = AppDocument.getInstance(filePath);
            const current = await appDocument.getJsonData();
            if (current === null) {
                return null;
            }
            const json = parseSlideJson(content) ?? {};
            // The slides are replaced; the document's own metadata is KEPT.
            // A model rewriting `initDate` or the file version would be
            // changing something nobody asked it to touch.
            await appDocument.setJsonData({
                ...current,
                items: json.items,
            } as any);
            return 'ok';
        },
        describe: async (filePath) => {
            const AppDocument = await getAppDocumentClass();
            const json = await AppDocument.getInstance(filePath).getJsonData();
            const items: any[] = (json as any)?.items ?? [];
            return {
                slideCount: items.length,
                dimensions: items[0]?.metadata
                    ? `${items[0].metadata.width}x${items[0].metadata.height}`
                    : null,
            };
        },
    },
};

// --- the lifecycle, written once ----------------------------------------

function getDirPath() {
    // Songs and slide documents share the Documents folder — the lyric list
    // was merged into it (memory: `lyric-in-documents-list`).
    return DirSource.getDirPathBySettingName(
        dirSourceSettingNames.APP_DOCUMENT,
    );
}

function getExtension(kind: AgentFileKindType) {
    return getMimetypeExtensions(kind.mimetypeName)[0];
}

/**
 * The full path of a named file, or null when it would not stay inside the
 * folder. Containment is re-checked on the JOINED path rather than trusted to
 * the name rules: two checks that agree cost nothing, and this is the one
 * actually about staying in the folder.
 */
function toFilePath(dirPath: string, name: string, kind: AgentFileKindType) {
    const filePath = pathJoin(dirPath, `${name}.${getExtension(kind)}`);
    const toPosix = (one: string) => {
        return one.split('\\').join('/');
    };
    const dir = toPosix(dirPath).replace(/\/+$/, '');
    return toPosix(filePath).startsWith(`${dir}/`) ? filePath : null;
}

function genNoSuchFileReason(kind: AgentFileKindType, name: string) {
    return (
        `There is no ${kind.label} called "${name}". Use action "list" to ` +
        'see what is there.'
    );
}

async function handleList(dirPath: string, kind: AgentFileKindType) {
    // The app's own mimetype-aware listing rather than a suffix filter, so
    // "what counts as one of these" is answered in one place.
    const filePathList =
        (await fsListFilesWithMimetype(dirPath, kind.mimetypeName)) ?? [];
    const FileSourceClass = await getFileSourceClass();
    return {
        folder: dirPath,
        count: filePathList.length,
        // Bounded: this rides into a model's context, and a church library is
        // routinely hundreds of files.
        names: filePathList.slice(0, 60).map((one) => {
            return FileSourceClass.getInstance(one).name;
        }),
        isTruncated: filePathList.length > 60,
    };
}

/**
 * Whether the user would see a `*` beside it: the editing-history head
 * against the saved file, the comparison `useEditingHistoryStatus` makes. The
 * history's mere existence is not the answer -- Save keeps the history folder,
 * so a document saved a moment ago still has one. `lastEditDate` is set aside
 * for the same reason the status hook sets it aside: Save stamps it.
 */
async function readHasUnsavedChanges(
    kindName: AgentFileKindNameType,
    filePath: string,
) {
    const DocumentClass =
        kindName === 'lyric'
            ? await getLyricClass()
            : await getAppDocumentClass();
    const document = DocumentClass.getInstance(filePath);
    const toComparable = (json: AnyObjectType | null) => {
        if (json === null) {
            return null;
        }
        const metadata = { ...(json.metadata ?? {}) };
        delete metadata.lastEditDate;
        return JSON.stringify({ ...json, metadata });
    };
    const current = await document.getJsonData();
    const original = await document.getJsonData(true);
    return toComparable(current) !== toComparable(original);
}

async function handleInfo(
    dirPath: string,
    name: string,
    kind: AgentFileKindType,
    kindName: AgentFileKindNameType,
) {
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null || !(await fsCheckFileExist(filePath))) {
        return fail(genNoSuchFileReason(kind, name));
    }
    return {
        name,
        filePath,
        hasUnsavedChanges: await readHasUnsavedChanges(kindName, filePath),
        ...(await kind.describe(filePath)),
    };
}

/** `Name (2)`, `Name (3)` … the first that no file answers to. */
async function findFreeName(
    dirPath: string,
    name: string,
    kind: AgentFileKindType,
) {
    for (let index = 2; index < 100; index += 1) {
        const candidate = `${name} (${index})`;
        const candidatePath = toFilePath(dirPath, candidate, kind);
        if (
            candidatePath !== null &&
            !(await fsCheckFileExist(candidatePath))
        ) {
            return candidate;
        }
    }
    return `${name} (${Date.now().toString(36)})`;
}

async function handleCreate(
    dirPath: string,
    name: string,
    content: string,
    kind: AgentFileKindType,
    kindName: AgentFileKindNameType,
) {
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null) {
        return fail('That name would not stay inside the Documents folder.');
    }
    if (await fsCheckFileExist(filePath)) {
        // Lead with the free name. The refusal used to say `use "update" to
        // change it, or pick another name`, and a model asked to create a
        // song off a page did exactly what it was told: it offered to
        // overwrite the user's existing song of that name (measured
        // 2026-09-08, "Update the existing one" as a button). The window's
        // own Create button never asks -- it takes the next free name, the
        // same `(2)` scheme as here -- and the model should default to the
        // same, leaving `update` for a user who SAID to change the old one.
        const freeName = await findFreeName(dirPath, name, kind);
        return fail(
            `A ${kind.label} called "${name}" is already there and is not ` +
                `overwritten. "${freeName}" is free -- create it under that ` +
                'name, unless the user asked to change the existing one, ' +
                'which is action "update".',
        );
    }
    try {
        // The backup of a file that is not there yet is "there was none":
        // undoing a create moves the new file to the trash.
        const { meta, value: fileSource } = await runWithAgentBackup(
            `Made the ${kind.label} “${name}”`,
            [{ type: 'file', filePath, text: null, kind: kindName }],
            async () => {
                const created = await kind.create(dirPath, name, content);
                if (created === null) {
                    throw new Error(`The ${kind.label} could not be created.`);
                }
                return created;
            },
        );
        fileSource.fireUpdateEvent();
        return {
            created: fileSource.name,
            filePath: fileSource.filePath,
            ...genUndoField(meta),
            note: 'It is on disk and in the Documents list already.',
        };
    } catch (error) {
        return toChangeFailure(error, `Making the ${kind.label} “${name}”`);
    }
}

async function handleUpdate(
    dirPath: string,
    name: string,
    content: string,
    kind: AgentFileKindType,
    kindName: AgentFileKindNameType,
) {
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null || !(await fsCheckFileExist(filePath))) {
        return fail(
            `There is no ${kind.label} called "${name}". Use action "create" ` +
                'to make one, or "list" to see what is there.',
        );
    }
    const editing = await snapshotAgentEditing(kindName, filePath);
    if (editing === null) {
        return fail(`"${name}" could not be read, so it was not changed.`);
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Changed the ${kind.label} “${name}”`,
            [editing],
            async () => {
                if ((await kind.update(filePath, content)) === null) {
                    throw new Error(`"${name}" could not be read.`);
                }
            },
        );
        const FileSourceClass = await getFileSourceClass();
        FileSourceClass.getInstance(filePath).fireUpdateEvent();
        return {
            updated: name,
            filePath,
            isSaved: false,
            ...genUndoField(meta),
            note: UNSAVED_NOTE,
        };
    } catch (error) {
        return toChangeFailure(error, `Changing the ${kind.label} “${name}”`);
    }
}

async function handleRename(
    dirPath: string,
    name: string,
    newName: string,
    kind: AgentFileKindType,
    kindName: AgentFileKindNameType,
) {
    const oldPath = toFilePath(dirPath, name, kind);
    const newPath = toFilePath(dirPath, newName, kind);
    if (newPath === null) {
        return fail(
            'That new name would not stay inside the Documents folder.',
        );
    }
    if (oldPath === null || !(await fsCheckFileExist(oldPath))) {
        return fail(genNoSuchFileReason(kind, name));
    }
    if (await fsCheckFileExist(newPath)) {
        return fail(
            `Something called "${newName}" is already there, so "${name}" ` +
                'was not renamed.',
        );
    }
    try {
        // `renameAgentFile` takes the editing history with the file (or
        // unsaved edits are left behind under the old name and the `*`
        // silently disappears) and its sidecars (or its attached background
        // is).
        const { meta, value: renamedPath } = await runWithAgentBackup(
            `Renamed the ${kind.label} “${name}” to “${newName}”`,
            [{ type: 'rename', from: oldPath, to: newPath, kind: kindName }],
            () => {
                return renameAgentFile(oldPath, newName, kindName);
            },
        );
        return {
            renamedFrom: name,
            renamedTo: newName,
            filePath: renamedPath,
            ...genUndoField(meta),
            note:
                'A presenting flow that referenced the old name no longer ' +
                'finds it — say so if they use run sheets.',
        };
    } catch (error) {
        return toChangeFailure(error, `Renaming the ${kind.label} “${name}”`);
    }
}

async function handleDelete(
    dirPath: string,
    name: string,
    kind: AgentFileKindType,
    kindName: AgentFileKindNameType,
) {
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null || !(await fsCheckFileExist(filePath))) {
        return fail(genNoSuchFileReason(kind, name));
    }
    let restores;
    try {
        // The file as saved, its unsaved state on top, and its sidecars: the
        // OS trash keeps only the first, and cannot be emptied back into a
        // folder by a program anyway.
        restores = await snapshotAgentFileForDelete(filePath, kindName);
    } catch (error) {
        return fail(genNoBackupReason(error));
    }
    try {
        const { meta } = await runWithAgentBackup(
            `Moved the ${kind.label} “${name}” to the trash`,
            restores,
            () => {
                return trashAgentFile(filePath, kindName);
            },
        );
        return {
            deleted: name,
            isInTrash: true,
            ...genUndoField(meta),
            note:
                'It is in the trash, and owa_undo puts it back, unsaved ' +
                'changes and all. A presenting flow that used it cannot find ' +
                'it until then -- say so if they use run sheets. If one of ' +
                'its slides is on a screen, it stays there until something ' +
                'else is shown.',
        };
    } catch (error) {
        return toChangeFailure(
            error,
            `Moving the ${kind.label} “${name}” to the trash`,
        );
    }
}

/**
 * Whether the document a slide action produced is one the app would open --
 * checked with the app's own validators before the backup is even taken. The
 * document validator reads the slides' shape; the canvas item classes read
 * each box the change WROTE, which is where the document validator has holes
 * (an alignment word, a colour).
 */
async function findInvalidSlideReason(change: AgentSlideChangeType) {
    const AppDocument = await getAppDocumentClass();
    try {
        AppDocument.validate(change.json);
    } catch (error: any) {
        return (
            'This app would not open the document after that change, so it ' +
            `was not made: ${String(error?.message ?? error).slice(0, 300)}`
        );
    }
    if (change.checkItems.length === 0) {
        return null;
    }
    const { default: Canvas } = await import('../slide-editor/canvas/Canvas');
    const { CanvasItemError } =
        await import('../slide-editor/canvas/CanvasItem');
    for (const { item } of change.checkItems) {
        const canvasItem = Canvas.canvasItemFromJson(item);
        if (canvasItem === null || canvasItem instanceof CanvasItemError) {
            return (
                `Box ${item.id} would not open in the slide editor after ` +
                'that change, so nothing was changed. Read the slide with ' +
                'action "slides" and send only the fields to change.'
            );
        }
    }
    return null;
}

async function handleSlideAction(
    dirPath: string,
    name: string,
    action: AgentSlideActionType,
    request: AgentFileRequestType,
    kind: AgentFileKindType,
    kindName: AgentFileKindNameType,
) {
    if (kindName !== 'slide') {
        return fail(
            "A song's slides are made from its words, so it has no slides of " +
                'its own to change. Change its words with action "update".',
        );
    }
    // Everything about the request that needs no document, so a malformed
    // one is refused before anything is read off the disk.
    const checked = readAgentSlideRequest(action, request);
    if (checked.isError === true) {
        return fail(checked.reason);
    }
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null || !(await fsCheckFileExist(filePath))) {
        return fail(genNoSuchFileReason(kind, name));
    }
    const AppDocument = await getAppDocumentClass();
    const appDocument = AppDocument.getInstance(filePath);
    // The HEAD, unsaved edits and all: that is the document the user sees,
    // and the one a change must be made to.
    const json = await appDocument.getJsonData();
    if (json === null) {
        return fail(`"${name}" could not be read, so it was not changed.`);
    }
    if (action === 'slides') {
        const read = readAgentSlideDocument(json, name, checked);
        return read.isError === true ? fail(read.reason) : read.slideDocument;
    }
    const { default: CanvasItemText } =
        await import('../slide-editor/canvas/CanvasItemText');
    const { default: Slide } = await import('../app-document-list/Slide');
    const change = applyAgentSlideAction(action, json, checked, {
        name,
        genTextDefaults: () => {
            return CanvasItemText.genDefaultItem().toJson();
        },
        getDefaultDim: () => {
            return Slide.getDefaultDim();
        },
    });
    if (change.isError === true) {
        return fail(change.reason);
    }
    if (!change.didChange) {
        return { ...change.result, didChange: false, note: change.note };
    }
    const invalidReason = await findInvalidSlideReason(change);
    if (invalidReason !== null) {
        return fail(invalidReason);
    }
    const editing = await snapshotAgentEditing('slide', filePath);
    if (editing === null) {
        return fail(`"${name}" could not be read, so it was not changed.`);
    }
    try {
        // ONE history entry for the whole change, so one Ctrl+Z undoes it.
        const { meta } = await runWithAgentBackup(
            change.summary,
            [editing],
            async () => {
                await appDocument.setJsonData(change.json as any);
                // With no data: an editor open on this document ignores its
                // own window's history echoes, and must re-read instead of
                // committing its stale copy over this change.
                const FileSourceClass = await getFileSourceClass();
                FileSourceClass.getInstance(filePath).fireUpdateEvent();
            },
        );
        return {
            ...change.result,
            isSaved: false,
            ...genUndoField(meta),
            note: [change.note, UNSAVED_NOTE].filter(Boolean).join(' '),
        };
    } catch (error) {
        return toChangeFailure(error, change.summary);
    }
}

/**
 * One request from a tool. Always answers with a plain object and never
 * throws: the caller is a page expression whose only channel back is a DOM
 * event, so an exception here would simply hang it.
 */
export async function handleAgentFileRequest(
    request: AgentFileRequestType,
): Promise<AgentFileResultType> {
    try {
        const {
            kind: kindName,
            action,
            name,
            newName,
            content,
        } = request ?? {};
        const kind =
            kindName === undefined ? undefined : AGENT_FILE_KIND_MAP[kindName];
        if (kindName === undefined || kind === undefined) {
            return fail('Unknown kind. Use "lyric" or "slide".');
        }
        const dirPath = getDirPath();
        if (dirPath === null) {
            return fail(
                'No Documents folder is set up yet, so there is nowhere to ' +
                    'keep files. The user chooses one in Settings under Path ' +
                    'Settings.',
            );
        }
        if (action === 'list') {
            return await handleList(dirPath, kind);
        }
        const nameReason = checkAgentFileName(name);
        if (nameReason !== null) {
            return fail(nameReason);
        }
        const safeName = (name as string).trim();
        if (action === 'info') {
            return await handleInfo(dirPath, safeName, kind, kindName);
        }
        if (action === 'delete') {
            return await handleDelete(dirPath, safeName, kind, kindName);
        }
        if (checkIsAgentSlideAction(action)) {
            return await handleSlideAction(
                dirPath,
                safeName,
                action,
                request,
                kind,
                kindName,
            );
        }
        if (action === 'rename') {
            const newNameReason = checkAgentFileName(newName);
            if (newNameReason !== null) {
                return fail(newNameReason);
            }
            return await handleRename(
                dirPath,
                safeName,
                (newName as string).trim(),
                kind,
                kindName,
            );
        }
        if (action === 'create' || action === 'update') {
            if (typeof content !== 'string' || content.trim() === '') {
                return fail(
                    `Content is required to ${action} a ${kind.label}.`,
                );
            }
            const contentReason = await kind.checkContent(content);
            if (contentReason !== null) {
                return fail(contentReason);
            }
            return action === 'create'
                ? await handleCreate(dirPath, safeName, content, kind, kindName)
                : await handleUpdate(
                      dirPath,
                      safeName,
                      content,
                      kind,
                      kindName,
                  );
        }
        return fail(
            'Unknown action. Use list, info, create, update, rename or delete' +
                (kindName === 'slide'
                    ? ', or one slide at a time: slides, add-slide, ' +
                      'update-slide, delete-slide, move-slide, duplicate-slide.'
                    : '.'),
        );
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
