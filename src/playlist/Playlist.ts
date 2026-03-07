import { cloneJson, isValidJson } from '../helper/helpers';
import type { AppDocumentMetadataType } from '../helper/AppEditableDocumentSourceAbs';
import AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { PlaylistItemType } from './PlaylistItem';
import PlaylistItem from './PlaylistItem';
import { showSimpleToast } from '../toast/toastHelpers';

export type PlaylistType = {
    items: PlaylistItemType[];
    metadata: AppDocumentMetadataType;
};

export default class Playlist extends AppEditableDocumentSourceAbs<PlaylistType> {
    constructor(filePath: string) {
        super(filePath);
    }

    async getOriginalJson() {
        return {} as any as PlaylistType;
    }

    async setOriginalJson(_jsonData: PlaylistType) {
        return true;
    }

    async getMetadata() {
        const originalJson = await this.getOriginalJson();
        return originalJson.metadata;
    }
    async getItems() {
        const originalJson = await this.getOriginalJson();
        return originalJson.items.map((json) => {
            try {
                return PlaylistItem.fromJson(this.filePath, json);
            } catch (error: any) {
                showSimpleToast('Instantiating Playlist Item', error.message);
            }
            return PlaylistItem.fromJsonError(this.filePath, json);
        });
    }
    get maxItemId() {
        return 0;
    }
    static async create(dir: string, name: string) {
        return super.create(dir, name, []);
    }

    async addFromData(str: string) {
        try {
            if (isValidJson(str)) {
                const json = JSON.parse(str);
                const item = PlaylistItem.fromJson(this.filePath, json);
                const originalJson = await this.getOriginalJson();
                originalJson.items.push(item.toJson());
                return await this.setJsonData(cloneJson(originalJson));
            }
        } catch (error: any) {
            showSimpleToast('Adding Playlist Item', error.message);
        }
        return false;
    }

    static getInstance(filePath: string) {
        return new this(filePath);
    }
}
