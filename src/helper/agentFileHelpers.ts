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
 * reason: a third file type should be a descriptor, not a third copy.
 *
 * ## What it will not do
 *
 * These are the app's own rules, not the tools', because this module is what
 * actually touches the disk and a check placed further out is one a later
 * caller can forget:
 *
 *  - **It never deletes anything, and never overwrites on `create`.**
 *    `fsCreateFile` throws on an existing path unless told to override, and it
 *    is never told to.
 *  - **`update` writes the EDITING HISTORY, never the saved file.** That is
 *    the whole safety story for the destructive half: the change is undoable
 *    with Ctrl+Z, the document shows its `*` dirty marker, and a human presses
 *    Save. It is "the assistant may point, the human presses" applied to
 *    content rather than to a button. It also leaves anything already ON a
 *    screen alone — a presented slide is a snapshot until re-presented.
 *  - **A name is REFUSED, never quietly cleaned.** `createNewFileDetail` still
 *    carries a `// TODO: verify file name before create`, so a separator or a
 *    `..` in a name would land wherever it pointed. Writing to a different
 *    file than the caller named is worse than saying no.
 *  - **Content must satisfy the app's own validator** before any write —
 *    open-lyric's for a song, `AppDocument.validate` for a slide document. A
 *    file the app cannot parse is one that renders as nothing on a projector,
 *    which is the failure a volunteer cannot debug mid-service.
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

export type AgentFileActionType =
    'list' | 'info' | 'create' | 'update' | 'rename';

export type AgentFileKindNameType = 'lyric' | 'slide';

export type AgentFileRequestType = {
    kind?: AgentFileKindNameType;
    action?: AgentFileActionType;
    name?: string;
    newName?: string;
    content?: string;
};

export type AgentFileResultType = {
    isError?: boolean;
    reason?: string;
} & Record<string, unknown>;

function fail(reason: string): AgentFileResultType {
    return { isError: true, reason };
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

async function handleInfo(
    dirPath: string,
    name: string,
    kind: AgentFileKindType,
) {
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null || !(await fsCheckFileExist(filePath))) {
        return fail(
            `There is no ${kind.label} called "${name}". Use action "list" ` +
                'to see what is there.',
        );
    }
    const { default: EditingHistoryManager } =
        await import('../editing-manager/EditingHistoryManager');
    // A document with histories has edits that are not on disk yet — the `*`
    // the operator sees beside its name.
    const hasUnsavedChanges =
        await EditingHistoryManager.getInstance(filePath).checkHasHistories();
    return {
        name,
        filePath,
        hasUnsavedChanges,
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
    const fileSource = await kind.create(dirPath, name, content);
    if (fileSource === null) {
        return fail(`The ${kind.label} could not be created.`);
    }
    fileSource.fireUpdateEvent();
    return {
        created: fileSource.name,
        filePath: fileSource.filePath,
        note: `It is on disk and in the Documents list already.`,
    };
}

async function handleUpdate(
    dirPath: string,
    name: string,
    content: string,
    kind: AgentFileKindType,
) {
    const filePath = toFilePath(dirPath, name, kind);
    if (filePath === null || !(await fsCheckFileExist(filePath))) {
        return fail(
            `There is no ${kind.label} called "${name}". Use action "create" ` +
                'to make one, or "list" to see what is there.',
        );
    }
    if ((await kind.update(filePath, content)) === null) {
        return fail(`"${name}" could not be read, so it was not changed.`);
    }
    const FileSourceClass = await getFileSourceClass();
    FileSourceClass.getInstance(filePath).fireUpdateEvent();
    return {
        updated: name,
        filePath,
        isSaved: false,
        note:
            'The change is in the document but NOT on disk yet: it shows a * ' +
            'beside its name, Ctrl+Z undoes it, and the user presses Save to ' +
            'keep it. Tell them that.',
    };
}

async function handleRename(
    dirPath: string,
    name: string,
    newName: string,
    kind: AgentFileKindType,
) {
    if (toFilePath(dirPath, newName, kind) === null) {
        return fail(
            'That new name would not stay inside the Documents folder.',
        );
    }
    const FileSourceClass = await getFileSourceClass();
    const fileSource = FileSourceClass.getInstance(
        dirPath,
        `${name}.${getExtension(kind)}`,
    );
    const oldFilePath = fileSource.filePath;
    const renamed = await fileSource.renameTo(newName);
    if (renamed === null) {
        return fail(
            `"${name}" could not be renamed. Either it is not there, or ` +
                `something called "${newName}" already is.`,
        );
    }
    // The editing history has to follow the document, or unsaved edits are
    // left behind under the old name and the `*` silently disappears.
    // `EditingHistoryManager.moveFilePath` exists for this and had no
    // production caller at all before these tools -- `renameTo` itself had
    // none either, so nothing had ever exercised the pair together.
    const { default: EditingHistoryManager } =
        await import('../editing-manager/EditingHistoryManager');
    await EditingHistoryManager.moveFilePath(oldFilePath, renamed.filePath);
    renamed.fireUpdateEvent();
    return {
        renamedFrom: name,
        renamedTo: renamed.name,
        filePath: renamed.filePath,
        note:
            'A presenting flow that referenced the old name no longer finds ' +
            'it — say so if they use run sheets.',
    };
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
        if (kind === undefined) {
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
            return await handleInfo(dirPath, safeName, kind);
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
                ? await handleCreate(dirPath, safeName, content, kind)
                : await handleUpdate(dirPath, safeName, content, kind);
        }
        return fail(
            'Unknown action. Use list, info, create, update or rename.',
        );
    } catch (error: any) {
        handleError(error);
        return fail(String(error?.message ?? error));
    }
}
