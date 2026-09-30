import DirSource from './DirSource';
import {
    checkIsAppFile,
    getFileDotExtension,
    fsCheckFileExist,
    fsCreateFile,
    fsDeleteFile,
    fsReadFile,
    fsRenameFile,
    fsWriteFile,
    getFileMetaData,
    pathJoin,
    getFileName,
    splitFilePath,
    toFilePathFromFileUrl,
    writeFileFromBase64Sync,
    fsCloneFile,
    describePortableFileNameProblem,
    getPortableFileNameProblem,
} from '../server/fileHelpers';
import { isValidJson } from './helpers';
import { pathToFileURL } from '../server/calcHelpers';
import EventHandler, { type ListenerType } from '../event/EventHandler';
import appProvider from '../server/appProvider';
import type DragInf from './DragInf';
import { DragTypeEnum } from './DragInf';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from './errorHelpers';
import FileSourceMetaManager from './FileSourceMetaManager';
import type ColorNoteInf from './ColorNoteInf';
import { electronSendAsync } from '../server/appHelpers';
import { unlocking } from '../server/unlockingHelpers';
import type { AnyObjectType } from './typeHelpers';
import CacheManager from '../others/CacheManager';
import { tran } from '../lang/langHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import { watchDataDir } from './dirWatchingHelpers';
import { escapeHtmlText } from './sanitizeHelpers';

export type SrcData = `data:${string}`;

export type FileSourceEventType = 'select' | 'update' | 'delete';

/**
 * What a `<event>:with-path` listener is handed.
 *
 * The unscoped `select`/`update`/`delete` events carry the FIRING CODE's `data`
 * (`EditingHistoryManager` publishes `{isHistoryEditing, eventType}`, and
 * `writeFileData` publishes nothing at all), so a listener that wants to know
 * WHICH file moved cannot get it from there — `data` is whatever the caller
 * chose, and is usually `undefined`. Anything that has to filter by path
 * listens on this channel instead.
 */
export type FileSourcePathEventDataType<T = any> = {
    filePath: string;
    data?: T;
};

/**
 * Kept out of `FileSourceEventType` on purpose: these names are derived, never
 * fired by hand, and nothing may subscribe to them except through
 * `registerFileSourcePathEventListener`.
 */
const PATH_EVENT_SUFFIX = ':with-path';

const fileDataCacheManager = new CacheManager<string | null>(2);
const instantCache = new Map<string, FileSource>();
export default class FileSource
    extends EventHandler<FileSourceEventType>
    implements DragInf<string>, ColorNoteInf
{
    static readonly eventNamePrefix: string = 'file-source';
    baseDirPath: string;
    fullName: string;
    // `undefined` until the list has read it; `null` is "read, none set".
    colorNote: string | null | undefined = undefined;

    constructor(baseDirFullPath: string, fileFullName: string) {
        super();
        this.baseDirPath = baseDirFullPath;
        this.fullName = fileFullName;
    }

    get filePath() {
        return pathJoin(this.baseDirPath, this.fullName);
    }

    get src() {
        return pathToFileURL(this.filePath);
    }

    get isAppFile() {
        return checkIsAppFile(this.fullName);
    }

    getSrcData() {
        return new Promise<SrcData>((resolve, reject) => {
            appProvider.fileUtils.readFile(
                this.filePath,
                {
                    encoding: 'base64',
                },
                (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const metadata = this.metadata;
                    if (metadata === null) {
                        reject(new Error('metadata not found'));
                        return;
                    }
                    const [mimetypeSignature] =
                        metadata.appMimetype.mimetypeSignatures;
                    resolve(`data:${mimetypeSignature};base64,${data}`);
                },
            );
        });
    }

    getColorNote() {
        return FileSourceMetaManager.getColorNote(this.filePath);
    }

    async setColorNote(color: string | null) {
        await FileSourceMetaManager.setColorNote(this.filePath, color);
        this.dirSource?.fireRefreshEvent();
    }

    get metadata() {
        return getFileMetaData(this.fullName);
    }

    get name() {
        return getFileName(this.fullName);
    }
    set name(newName: string) {
        this.fullName = newName + this.dotExtension;
    }

    get dotExtension() {
        return getFileDotExtension(this.fullName);
    }

    get extension() {
        return this.dotExtension.substring(1);
    }

    get dirSource() {
        return DirSource.getInstanceByDirPath(this.baseDirPath);
    }

    static toRWLockingKey(filePath: string) {
        return `rw-${filePath}`;
    }

    static toDataCacheKey(filePath: string) {
        return `file-data-${filePath}`;
    }

    /**
     * Forget what the short read cache holds for a path whose bytes changed
     * some way OTHER than `writeFileData` -- a rename onto it, a copy onto it,
     * a delete. The editing history does exactly that on every step (`N`
     * becomes `N-head` by a rename) and reuses its paths once a history is
     * cleared, so a path read inside the cache's two seconds read back its OLD
     * bytes: measured 2026-09-14, a document whose history was cleared and
     * rebuilt within that window came back two edits old, and the diff patch
     * the history wrote from that stale read would have broken its Ctrl+Z.
     */
    static forgetCachedData(filePath: string) {
        fileDataCacheManager.deleteSync(this.toDataCacheKey(filePath));
    }

    /** `forgetCachedData` for every path inside a folder deleted whole. */
    static forgetCachedDataUnder(dirPath: string) {
        const prefix = this.toDataCacheKey(dirPath);
        fileDataCacheManager.deleteMatchedSync((key) => {
            return (
                key.startsWith(`${prefix}/`) || key.startsWith(`${prefix}\\`)
            );
        });
    }

    static async readFileData(filePath: string, isSilent?: boolean) {
        const key = this.toDataCacheKey(filePath);
        // Same lock as writeFileData — with separate locks a read can slip in
        // mid-write, re-cache the pre-write bytes, and serve stale data.
        return await unlocking(this.toRWLockingKey(filePath), async () => {
            const cachedData = await fileDataCacheManager.get(key);
            if (cachedData !== null) {
                return cachedData;
            }
            try {
                let dataText = await fsReadFile(filePath);
                if (dataText.codePointAt(0) === 0xfeff) {
                    dataText = dataText.substring(1);
                }
                await fileDataCacheManager.set(key, dataText);
                return dataText;
            } catch (error: any) {
                if (!isSilent) {
                    handleError(
                        new Error(
                            'Reader File Data, Error occurred during reading ' +
                                `file: "${filePath}", error: ${error.message}`,
                        ),
                    );
                }
            }
            return null;
        });
    }

    async readFileData() {
        if ((await fsCheckFileExist(this.filePath)) === false) {
            return null;
        }
        return await FileSource.readFileData(this.filePath);
    }

    async writeFileData(data: string) {
        const key = FileSource.toDataCacheKey(this.filePath);
        return await unlocking(
            FileSource.toRWLockingKey(this.filePath),
            async () => {
                // invalidate inside the lock — doing it before taking the
                // lock lets a concurrent read re-cache the old content
                await fileDataCacheManager.delete(key);
                try {
                    const isFileExist = await fsCheckFileExist(this.filePath);
                    if (isFileExist) {
                        await fsWriteFile(this.filePath, data);
                    } else {
                        await fsCreateFile(this.filePath, data, true);
                    }
                    this.fireUpdateEvent();
                    return true;
                } catch (error: any) {
                    showSimpleToast(tran('Saving File'), error.message);
                }
                return false;
            },
        );
    }

    writeFileBase64DataSync(srcData: SrcData) {
        try {
            writeFileFromBase64Sync(this.filePath, srcData);
            return true;
        } catch (error) {
            handleError(error);
        }
        return false;
    }

    static async writeFilePlainText(filePath: string, plainText: string) {
        const fileSource = this.getInstance(filePath);
        return await fileSource.writeFileData(plainText);
    }

    static async writeFileBase64Data(filePath: string, base64Data: SrcData) {
        const fileSource = this.getInstance(filePath);
        return fileSource.writeFileBase64DataSync(base64Data);
    }

    async readFileJsonData() {
        try {
            const dataText = await this.readFileData();
            if (dataText !== null && isValidJson(dataText)) {
                return JSON.parse(dataText) as AnyObjectType;
            }
        } catch (_error) {}
        return null;
    }

    static getInstanceNoCache(filePath: string, fileFullName?: string) {
        if (fileFullName) {
            return new FileSource(filePath, fileFullName);
        }
        const splitPath = splitFilePath(filePath);
        return new FileSource(splitPath.dirPath, splitPath.fileFullName);
    }

    static getInstance(
        filePath: string,
        fileFullName?: string,
        refreshCache?: boolean,
    ) {
        const fileSource = this.getInstanceNoCache(filePath, fileFullName);
        if (refreshCache) {
            instantCache.delete(fileSource.filePath);
        }
        if (instantCache.has(fileSource.filePath)) {
            return instantCache.get(fileSource.filePath)!;
        }
        instantCache.set(fileSource.filePath, fileSource);
        return fileSource;
    }

    static async getInstanceBySrc(src: string) {
        const filePath = toFilePathFromFileUrl(src);
        if ((await fsCheckFileExist(filePath)) === false) {
            return null;
        }
        return this.getInstance(filePath);
    }

    dragSerialize(type?: DragTypeEnum) {
        return {
            type: type ?? DragTypeEnum.UNKNOWN,
            data: this.filePath,
        };
    }

    static dragDeserialize(data: any) {
        return this.getInstance(data);
    }

    async renameTo(newName: string) {
        if (newName === this.name) {
            return null;
        }
        const problem = getPortableFileNameProblem(newName);
        if (problem !== null) {
            showSimpleToast(
                tran('Renaming File'),
                describePortableFileNameProblem(problem),
            );
            return null;
        }
        try {
            await fsRenameFile(
                this.baseDirPath,
                this.fullName,
                newName + this.dotExtension,
            );
            const newFilePath = pathJoin(
                this.baseDirPath,
                newName + this.dotExtension,
            );
            return FileSource.getInstance(newFilePath);
        } catch (error: any) {
            handleError(error);
            showSimpleToast(
                tran('Renaming File'),
                `${tran('Unable to rename file')}: ${error.message}`,
            );
        }
        return null;
    }

    private async _duplicate() {
        let i = 1;
        let newName = this.name + ' (Copy)';
        while (
            await fsCheckFileExist(
                this.baseDirPath,
                newName + this.dotExtension,
            )
        ) {
            newName = this.name + ' (Copy ' + i + ')';
            i++;
        }
        const newFilePath = pathJoin(
            this.baseDirPath,
            newName + this.dotExtension,
        );
        await fsCloneFile(this.filePath, newFilePath);
    }

    async duplicate() {
        try {
            await this._duplicate();
        } catch (error) {
            showSimpleToast(
                tran('Duplicating File'),
                tran('Unable to duplicate file'),
            );
            handleError(error);
        }
    }

    static registerFileSourceEventListener<T>(
        events: FileSourceEventType[],
        callback: ListenerType<T>,
        filePath?: string,
    ) {
        watchDataDir();
        const newEvents = events.map((event) => {
            return filePath ? `${event}@${filePath}` : event;
        });
        return super.registerEventListener(newEvents, callback);
    }

    registerEventListener<T>(
        events: FileSourceEventType[],
        callback: ListenerType<T>,
    ) {
        watchDataDir();
        return super.registerEventListener(events, callback);
    }

    /**
     * Listen for an event on EVERY file and be told which one it was.
     *
     * The unscoped registration hands the listener the firing code's `data`, so
     * a listener that filters by path (only the bible-note folder, say) cannot
     * use it — see `FileSourcePathEventDataType`. Registering per file is not an
     * answer either when the set of files is itself what changes.
     */
    static registerFileSourcePathEventListener<T>(
        events: FileSourceEventType[],
        callback: ListenerType<FileSourcePathEventDataType<T>>,
    ) {
        const newEvents = events.map((event) => {
            return `${event}${PATH_EVENT_SUFFIX}`;
        });
        return super.registerEventListener(newEvents, callback);
    }

    static addFileSourcePropEvent(
        eventName: FileSourceEventType,
        filePath: string,
        data?: any,
    ): void {
        const newEventName = `${eventName}@${filePath}` as FileSourceEventType;
        super.addPropEvent(eventName, data);
        super.addPropEvent(newEventName, data);
        // A third dispatch rather than a richer payload on the two above: their
        // `data` is the caller's and is read by existing listeners as-is.
        super.addPropEvent(
            `${eventName}${PATH_EVENT_SUFFIX}` as FileSourceEventType,
            { filePath, data } satisfies FileSourcePathEventDataType,
        );
    }

    fireSelectEvent(data?: any) {
        this.addPropEvent('select', data);
        FileSource.addFileSourcePropEvent('select', this.filePath, data);
    }

    fireUpdateEvent(data?: any) {
        this.addPropEvent('update', data);
        FileSource.addFileSourcePropEvent('update', this.filePath, data);
    }

    fireDeleteEvent() {
        this.addPropEvent('delete', this.filePath);
        FileSource.addFileSourcePropEvent(
            'delete',
            this.filePath,
            this.filePath,
        );
    }

    async genNextFilePath() {
        let i = 0;
        let nextFilePath = pathJoin(
            this.baseDirPath,
            `${this.name}.${this.extension}`,
        );
        while (await fsCheckFileExist(nextFilePath)) {
            i++;
            nextFilePath = pathJoin(
                this.baseDirPath,
                `${this.name} (${i}).${this.extension}`,
            );
        }
        return nextFilePath;
    }

    /**
     * Move this file to the OS trash. `permanentFallback` says what happens
     * when the trash REFUSES it -- a USB flash drive on Windows has no Recycle
     * Bin, so every delete on one used to fail after five seconds of retries:
     * - `ask`: put the question to the person, as Windows Explorer does there;
     * - `delete`: delete outright, for the side files of a file the person
     *   already answered for;
     * - `none`: report the failure. What an agent gets: only a person decides
     *   that something cannot be undone.
     * Answers what happened, `null` when the file is still there.
     */
    async trash(
        permanentFallback: 'none' | 'ask' | 'delete' = 'none',
    ): Promise<'trashed' | 'deleted' | null> {
        const filePath = this.filePath;
        const progressBarKey = 'trash-file-' + filePath;
        showProgressBar(progressBarKey);
        let isTrashed = false;
        try {
            isTrashed = await electronSendAsync<boolean>(
                'main:app:trash-path',
                {
                    path: filePath,
                },
            );
        } catch (error) {
            handleError(error);
        } finally {
            hideProgressBar(progressBarKey);
        }
        if (isTrashed) {
            this.fireDeleteEvent();
            instantCache.delete(filePath);
            return 'trashed';
        }
        if (
            permanentFallback !== 'none' &&
            (await fsCheckFileExist(filePath))
        ) {
            const isDeleting =
                permanentFallback === 'delete' ||
                (await this.askToDeletePermanently());
            if (!isDeleting) {
                // Kept on the person's own word: nothing failed.
                return null;
            }
            try {
                await fsDeleteFile(filePath);
                this.fireDeleteEvent();
                instantCache.delete(filePath);
                return 'deleted';
            } catch (error) {
                handleError(error);
            }
        }
        showSimpleToast(
            tran('Trashing File'),
            tran('Unable to trash file. Please try again.'),
        );
        return null;
    }

    private async askToDeletePermanently() {
        // Loaded on the question, not with `FileSource`, which every window
        // imports at start.
        const { showAppConfirm } =
            await import('../popup-widget/popupWidgetHelpers');
        return showAppConfirm(
            tran('Delete Permanently'),
            `"${escapeHtmlText(this.fullName)}" ` +
                tran(
                    'could not be moved to the Recycle Bin or Trash. A USB flash drive has none on Windows. Delete it permanently? This cannot be undone.',
                ),
            {
                cancelButtonLabel: 'Cancel',
                confirmButtonLabel: 'Delete Permanently',
            },
        );
    }

    static getSrcDataFromFrom(file: File | Blob) {
        return new Promise<SrcData | null>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result as SrcData);
            };
            reader.onerror = () => {
                resolve(null);
            };
            reader.readAsDataURL(file);
        });
    }
}
