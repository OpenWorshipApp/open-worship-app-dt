import EditingHistoryManager from '../editing-manager/EditingHistoryManager';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import type { MimetypeNameType } from '../server/fileHelpers';
import {
    createNewFileDetail,
    getMimetypeExtensions,
} from '../server/fileHelpers';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import type { AnyObjectType } from './typeHelpers';
import { flushPendingEdits } from '../editing-manager/pendingEditFlushHelpers';

export type AppDocumentMetadataType = {
    app: string;
    fileVersion: number;
    initDate: string;
    lastEditDate?: string;
    renderProps?: AnyObjectType;
    note?: string;
};

function validateAppMeta(metadata: any) {
    try {
        if (
            typeof metadata === 'object' &&
            typeof metadata.app === 'string' &&
            typeof metadata.fileVersion === 'number' &&
            typeof metadata.initDate === 'string' &&
            (metadata.lastEditDate === undefined ||
                typeof metadata.lastEditDate === 'string')
        ) {
            return true;
        }
    } catch (error) {
        handleError(error);
    }
    return false;
}

const cache = new Map<string, AppDocumentSourceAbs>();
export abstract class AppDocumentSourceAbs {
    protected static mimetypeName: MimetypeNameType = 'other';
    filePath: string;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    static validate(json: AnyObjectType) {
        if (!validateAppMeta(json.metadata)) {
            throw new Error('Invalid data');
        }
    }

    get fileSource() {
        return FileSource.getInstance(this.filePath);
    }

    /**
     * `cacheKeySuffix` is what lets ONE class hand out more than one instance
     * per file. The key is the class name plus the path, so without it a class
     * is an identity: the lyric stages need the opposite — stage 2 and stage 3
     * share `LyricAppDocumentStage1`'s layout but must not share its instance,
     * or the second pane renders a byte-identical clone of the first. Empty by
     * default, so every existing caller keys exactly as it did before.
     */
    static _getInstance<T extends AppDocumentSourceAbs>(
        filePath: string,
        createInstance: () => T,
        cacheKeySuffix = '',
    ) {
        const extensions = getMimetypeExtensions(this.mimetypeName);
        const fileSource = FileSource.getInstance(filePath);
        if (!extensions.includes(fileSource.extension)) {
            throw new Error(
                `File extension ${fileSource.extension} does not match ` +
                    `expected extensions: ${extensions.join(', ')}`,
            );
        }
        const cacheKey =
            `${this.name}:${this.mimetypeName}:${filePath}` +
            (cacheKeySuffix === '' ? '' : `:${cacheKeySuffix}`);
        if (!cache.has(cacheKey)) {
            const instance = createInstance();
            cache.set(cacheKey, instance as any);
        }
        const instance = cache.get(cacheKey) as T;
        if (instance instanceof this === false) {
            throw new TypeError('Invalid Instance');
        }
        return instance;
    }

    async preDelete() {
        await attachBackgroundManager.deleteMetaDataFile(this.filePath);
    }

    // Fonts the document references that aren't installed on this system.
    // Surfaced as a non-blocking banner in the slides preview; defaults to
    // none and is overridden by document types that can detect missing fonts.
    async getMissingFontFamilyList(): Promise<string[]> {
        return [];
    }

    static getInstance(_filePath: string) {
        throw new Error('getInstance must be implemented in derived class');
    }

    static genMetadata() {
        return {
            fileVersion: 1,
            app: 'OpenWorship',
            initDate: new Date().toJSON(),
        };
    }
}

export default abstract class AppEditableDocumentSourceAbs<
    T extends { metadata: AppDocumentMetadataType },
> extends AppDocumentSourceAbs {
    private get editingHistoryManager() {
        const editingHistoryManager = EditingHistoryManager.getInstance(
            this.filePath,
        );
        return editingHistoryManager;
    }

    static fromDataText<
        T extends {
            metadata: AppDocumentMetadataType;
        },
    >(dataText: string) {
        try {
            const jsonData = JSON.parse(dataText);
            this.validate(jsonData);
            return jsonData as T;
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    async getJsonData(isOriginal = false): Promise<T | null> {
        const jsonText = isOriginal
            ? await this.editingHistoryManager.getOriginalData()
            : await this.editingHistoryManager.getCurrentHistory();
        if (jsonText === null) {
            return null;
        }
        const Class = this.constructor as typeof AppEditableDocumentSourceAbs;
        const jsonData = Class.fromDataText<T>(jsonText);
        if (jsonData === null) {
            return null;
        }
        return jsonData;
    }

    static toJsonString(jsonData: AnyObjectType) {
        return JSON.stringify(jsonData, null, 2);
    }

    /**
     * The edits still on their way into the editing history.
     *
     * Several write paths are fire-and-forget by design — `setCanvasItems`
     * calls the async `updateSlide` without awaiting it, because the canvas
     * must not stutter mid-drag. An undo that arrives before that write lands
     * therefore stepped over the very edit it was meant to take back: measured
     * 2026-09-28, `Ctrl+Z` pressed straight after an arrow-nudge was a silent
     * no-op, and the same press worked after a two-second pause. This is one
     * promise, never a list, so it costs nothing to hold.
     */
    private pendingWrite: Promise<void> = Promise.resolve();

    /**
     * Register an edit that is on its way, SYNCHRONOUSLY, at the moment it is
     * started.
     *
     * It has to be at the start, not where the write finally lands: the canvas
     * path reaches `setJsonData` only after two awaits (`getSlideIndex`, then
     * `getSlides`), so an undo fired in the same breath found nothing pending
     * and raced past it anyway.
     */
    trackPendingWrite<R>(writing: Promise<R>) {
        // Settled, not resolved: a failed write must not leave every later
        // undo waiting on a rejected promise. Wrapped, because a subclass's
        // history manager may answer synchronously.
        const settled = Promise.resolve(writing).then(
            () => {},
            () => {},
        );
        this.pendingWrite = this.pendingWrite.then(() => {
            return settled;
        });
        return writing;
    }

    /** Resolves once every edit made so far is in the editing history. */
    async waitForPendingWrite() {
        await this.pendingWrite;
    }

    async setJsonData(jsonData: T) {
        const Class = this.constructor as typeof AppEditableDocumentSourceAbs;
        const jsonString = Class.toJsonString(jsonData);
        return this.trackPendingWrite(
            this.editingHistoryManager.addHistory(jsonString),
        );
    }

    async getMetadata() {
        const jsonData = await this.getJsonData();
        return jsonData?.metadata ?? {};
    }

    async setMetadata(metadata: AppDocumentMetadataType) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        jsonData.metadata = metadata;
        await this.setJsonData(jsonData);
    }

    async getNote() {
        const jsonData = await this.getJsonData();
        return jsonData?.metadata?.note ?? '';
    }

    async setNote(note: string) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        jsonData.metadata.note = note;
        await this.setJsonData(jsonData);
    }

    static checkIsThisType(appDocument: any) {
        return appDocument instanceof this;
    }

    checkIsSame(appDocument: any) {
        const Class = this.constructor as typeof AppEditableDocumentSourceAbs;
        if (Class.checkIsThisType(appDocument)) {
            return this.filePath === appDocument.filePath;
        }
    }

    _sanitizeDataText(dataText: string): string | null {
        const Class = this.constructor as typeof AppEditableDocumentSourceAbs;
        const jsonData = Class.fromDataText(dataText);
        if (jsonData === null) {
            return null;
        }
        jsonData.metadata.lastEditDate = new Date().toISOString();
        return Class.toJsonString(jsonData);
    }

    // The one save path -- the Save button and every Ctrl+S come here. Ctrl+S
    // used to call `historySave()` bare, which wrote the file without the
    // `lastEditDate` stamp the button wrote; and the button skipped waiting
    // for in-flight edits, so a press right after typing could save the state
    // before it.
    async save() {
        return this.historySave(this._sanitizeDataText.bind(this));
    }

    static genNewJsonData<
        T extends {
            metadata: AppDocumentMetadataType;
        },
    >(extraData: AnyObjectType = {}): T {
        const jsonData = {
            metadata: super.genMetadata(),
            ...extraData,
        };
        return jsonData as T;
    }

    static async create(dir: string, name: string, extraData: AnyObjectType) {
        const jsonData = JSON.stringify(this.genNewJsonData(extraData));
        const filePath = await createNewFileDetail(
            dir,
            name,
            jsonData,
            this.mimetypeName,
        );
        if (filePath !== null) {
            return FileSource.getInstance(filePath);
        }
        return null;
    }

    async preDelete() {
        // Awaited, both: a caller that goes on to make a file of the same name
        // -- `owa_undo` putting a deleted document back, moments later -- must
        // not find the old history folder half-deleted underneath it.
        await super.preDelete();
        await this.editingHistoryManager.deleteHistories();
    }

    // All four wait for the in-flight edits first (see `pendingWrite`): undo,
    // redo and save all mean "of everything done so far", and a discard that
    // raced a write would leave the write landing on top of it. Undo, redo and
    // save first make an editor commit what it is still holding back (see
    // `pendingEditFlushHelpers`), so "done so far" includes the last keystroke.
    async historyUndo() {
        flushPendingEdits(this.filePath);
        await this.waitForPendingWrite();
        return this.editingHistoryManager.undo();
    }
    async historyRedo() {
        flushPendingEdits(this.filePath);
        await this.waitForPendingWrite();
        return this.editingHistoryManager.redo();
    }
    async historyDiscard() {
        await this.waitForPendingWrite();
        return this.editingHistoryManager.discard();
    }
    async historySave(sanitizeData?: (data: string) => string | null) {
        flushPendingEdits(this.filePath);
        await this.waitForPendingWrite();
        return this.editingHistoryManager.save(sanitizeData);
    }
}
