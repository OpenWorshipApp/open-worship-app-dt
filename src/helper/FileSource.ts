import DirSource from './DirSource';
import {
    checkIsAppFile,
    getFileDotExtension,
    fsCheckFileExist,
    fsCreateFile,
    fsReadFile,
    fsRenameFile,
    fsWriteFile,
    getFileMetaData,
    pathBasename,
    pathJoin,
    pathSeparator,
    getFileName,
    writeFileFromBase64,
} from '../server/fileHelpers';
import { isValidJson } from './helpers';
import { pathToFileURL } from '../server/calcHelpers';
import EventHandler from '../event/EventHandler';
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

export type SrcData = `data:${string}`;

export type FileSourceEventType = 'select' | 'update' | 'delete';

const cache = new Map<string, FileSource>();
export default class FileSource
    extends EventHandler<FileSourceEventType>
    implements DragInf<string>, ColorNoteInf
{
    static readonly eventNamePrefix: string = 'file-source';
    basePath: string;
    fullName: string;
    colorNote: string | null = null;

    constructor(baseFullPath: string, fileFullName: string) {
        super();
        this.basePath = baseFullPath;
        this.fullName = fileFullName;
    }

    get filePath() {
        return pathJoin(this.basePath, this.fullName);
    }

    get src() {
        return pathToFileURL(this.filePath);
    }

    get isAppFile() {
        return !checkIsAppFile(this.fullName);
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
                    const { mimetypeSignature } = metadata.appMimetype;
                    resolve(`data:${mimetypeSignature};base64,${data}`);
                },
            );
        });
    }

    getColorNote() {
        return FileSourceMetaManager.getColorNote(this.filePath);
    }

    async setColorNote(color: string | null) {
        FileSourceMetaManager.setColorNote(this.filePath, color);
        this.dirSource?.fireReloadEvent();
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
        return DirSource.getInstanceByDirPath(this.basePath);
    }

    static toRWLockingKey(filePath: string) {
        return `rw-${filePath}`;
    }

    static async readFileData(filePath: string, isSilent?: boolean) {
        return await unlocking(this.toRWLockingKey(filePath), async () => {
            try {
                const dataText = await fsReadFile(filePath);
                return dataText;
            } catch (error: any) {
                if (!isSilent) {
                    showSimpleToast(
                        'Reader File Data',
                        'Error occurred during reading ' +
                            `file: "${filePath}", error: ${error.message}`,
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
        return await unlocking(
            FileSource.toRWLockingKey(this.filePath),
            async () => {
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
                    showSimpleToast('Saving File', error.message);
                }
                return false;
            },
        );
    }

    async writeFileBase64Data(srcData: SrcData) {
        try {
            writeFileFromBase64(this.filePath, srcData);
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
        return await fileSource.writeFileBase64Data(base64Data);
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
        let baseFullPath;
        if (fileFullName) {
            baseFullPath = filePath;
        } else {
            const index = filePath.lastIndexOf(pathSeparator);
            baseFullPath = filePath.substring(0, index);
            fileFullName = pathBasename(filePath);
        }
        return new FileSource(baseFullPath, fileFullName);
    }

    static getInstance(
        filePath: string,
        fileFullName?: string,
        refreshCache?: boolean,
    ) {
        const fileSource = this.getInstanceNoCache(filePath, fileFullName);
        if (refreshCache) {
            cache.delete(fileSource.filePath);
        }
        if (cache.has(fileSource.filePath)) {
            return cache.get(fileSource.filePath) as FileSource;
        }
        cache.set(fileSource.filePath, fileSource);
        return fileSource;
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
        try {
            await fsRenameFile(
                this.basePath,
                this.fullName,
                newName + this.dotExtension,
            );
            const newFilePath = pathJoin(
                this.basePath,
                newName + this.dotExtension,
            );
            return FileSource.getInstance(newFilePath);
        } catch (error: any) {
            handleError(error);
            showSimpleToast(
                'Renaming File',
                `Unable to rename file: ${error.message}`,
            );
        }
        return null;
    }

    private async _duplicate() {
        let i = 1;
        let newName = this.name + ' (Copy)';
        while (
            await fsCheckFileExist(this.basePath, newName + this.dotExtension)
        ) {
            newName = this.name + ' (Copy ' + i + ')';
            i++;
        }
        const newFilePath = pathJoin(
            this.basePath,
            newName + this.dotExtension,
        );
        const data = await this.readFileJsonData();
        if (data !== null) {
            await fsCreateFile(newFilePath, JSON.stringify(data));
        }
    }

    async duplicate() {
        try {
            await this._duplicate();
        } catch (error) {
            showSimpleToast('Duplicating File', 'Unable to duplicate file');
            handleError(error);
        }
    }

    static registerFileSourceEventListener<T>(
        events: FileSourceEventType[],
        callback: (data: T) => void,
        filePath?: string,
    ) {
        const newEvents = events.map((event) => {
            return filePath ? `${event}@${filePath}` : event;
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
    }

    fireSelectEvent(data?: any) {
        FileSource.addFileSourcePropEvent('select', this.filePath, data);
    }

    fireUpdateEvent(data?: any) {
        FileSource.addFileSourcePropEvent('update', this.filePath, data);
    }

    fireDeleteEvent() {
        FileSource.addFileSourcePropEvent(
            'delete',
            this.filePath,
            this.filePath,
        );
    }

    async trash() {
        await electronSendAsync<void>('main:app:trash-path', {
            path: this.filePath,
        });
        FileSource.getInstance(this.filePath).fireDeleteEvent();
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
