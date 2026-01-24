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
    private readonly _originalJson: PlaylistType;
    constructor(filePath: string, json: PlaylistType) {
        super(filePath);
        this._originalJson = cloneJson(json);
    }
    static fromJson(filePath: string, json: PlaylistType) {
        this.validate(json);
        return new Playlist(filePath, json);
    }
    get metadata() {
        return this._originalJson.metadata;
    }
    get items() {
        return this._originalJson.items.map((json) => {
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
    addFromData(str: string) {
        try {
            if (isValidJson(str)) {
                const json = JSON.parse(str);
                const item = PlaylistItem.fromJson(this.filePath, json);
                this._originalJson.items.push(item.toJson());
                return true;
            }
        } catch (error: any) {
            showSimpleToast('Adding Playlist Item', error.message);
        }
        return false;
    }
    toJson(): PlaylistType {
        return this._originalJson;
    }
    clone() {
        return Playlist.fromJson(this.filePath, this.toJson());
    }
}
