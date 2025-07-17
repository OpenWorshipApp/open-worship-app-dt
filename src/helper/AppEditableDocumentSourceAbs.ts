import EditingHistoryManager from '../editing-manager/EditingHistoryManager';
import { attachBackgroundManager } from '../others/AttachBackgroundManager';
import {
    MimetypeNameType,
    createNewFileDetail,
    getMimetypeExtensions,
} from '../server/fileHelpers';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { AnyObjectType } from './typeHelpers';

export type AppDocumentMetadataType = {
    app: string;
    fileVersion: number;
    initDate: string;
    lastEditDate?: string;
    renderProps?: AnyObjectType;
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

    static _getInstance<T extends AppDocumentSourceAbs>(
        filePath: string,
        createInstance: () => T,
    ) {
        const extensions = getMimetypeExtensions(this.mimetypeName);
        const fileSource = FileSource.getInstance(filePath);
        if (!extensions.includes(fileSource.extension)) {
            throw new Error(
                `File extension ${fileSource.extension} does not match ` +
                    `expected extensions: ${extensions.join(', ')}`,
            );
        }
        if (!cache.has(filePath)) {
            const instance = createInstance();
            cache.set(filePath, instance as any);
        }
        const instance = cache.get(filePath) as any as T;
        if (instance instanceof this === false) {
            throw new Error('Invalid Instance');
        }
        return instance;
    }

    async preDelete() {
        attachBackgroundManager.deleteMetaDataFile(this.filePath);
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
    get editingHistoryManager() {
        return EditingHistoryManager.getInstance(this.filePath);
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

    async setJsonData(jsonData: T) {
        const Class = this.constructor as typeof AppEditableDocumentSourceAbs;
        const jsonString = Class.toJsonString(jsonData);
        this.editingHistoryManager.addHistory(jsonString);
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

    static checkIsThisType(appDocument: any) {
        return appDocument instanceof this;
    }

    checkIsSame(appDocument: any) {
        const Class = this.constructor as typeof AppEditableDocumentSourceAbs;
        if (Class.checkIsThisType(appDocument)) {
            return this.filePath === appDocument.filePath;
        }
    }

    async save() {
        return await this.editingHistoryManager.save((dataText) => {
            const Class = this
                .constructor as typeof AppEditableDocumentSourceAbs;
            const jsonData = Class.fromDataText(dataText);
            if (jsonData === null) {
                return null;
            }
            jsonData.metadata.lastEditDate = new Date().toISOString();
            return Class.toJsonString(jsonData);
        });
    }

    static async create(dir: string, name: string, extraData: AnyObjectType) {
        const data = JSON.stringify({
            metadata: super.genMetadata(),
            ...extraData,
        });
        const filePath = await createNewFileDetail(
            dir,
            name,
            data,
            this.mimetypeName,
        );
        if (filePath !== null) {
            return FileSource.getInstance(filePath);
        }
        return null;
    }

    async preDelete() {
        super.preDelete();
        this.editingHistoryManager.discard();
    }
}
