import { MimetypeNameType } from '../server/fileHelper';
import FileSource from '../helper/FileSource';
import {
    AnyObjectType,
    cloneJson,
    isValidJson,
} from '../helper/helpers';
import ItemSource from '../helper/ItemSource';
import PlaylistItem, { PlaylistItemType } from './PlaylistItem';
import { showSimpleToast } from '../toast/toastHelpers';

export type PlaylistType = {
    items: PlaylistItemType[],
    metadata: AnyObjectType,
}

export default class Playlist extends ItemSource<PlaylistItem>{
    static SELECT_DIR_SETTING = 'playlist-list-selected-dir';
    static mimetype: MimetypeNameType = 'playlist';
    _originalJson: PlaylistType;
    constructor(fileSource: FileSource, json: PlaylistType) {
        super(fileSource);
        this._originalJson = cloneJson(json);
    }
    static fromJson(fileSource: FileSource, json: PlaylistType) {
        this.validate(json);
        return new Playlist(fileSource, json);
    }
    get metadata() {
        return this._originalJson.metadata;
    }
    get items() {
        return this._originalJson.items.map((json) => {
            try {
                return PlaylistItem.fromJson(this.fileSource, json);
            } catch (error: any) {
                showSimpleToast('Instantiating Playlist Item', error.message);
            }
            return PlaylistItem.fromJsonError(this.fileSource, json);
        });
    }
    get maxItemId() {
        return 0;
    }
    static async readFileToDataNoCache(fileSource: FileSource | null) {
        return super.readFileToDataNoCache(fileSource) as
            Promise<Playlist | null | undefined>;
    }
    static async readFileToData(fileSource: FileSource | null, isForceCache?: boolean) {
        return super.readFileToData(fileSource, isForceCache) as
            Promise<Playlist | null | undefined>;
    }
    static async create(dir: string, name: string) {
        return super.create(dir, name, []);
    }
    addFromData(str: string) {
        try {
            if (isValidJson(str)) {
                const json = JSON.parse(str);
                const item = PlaylistItem.fromJson(this.fileSource, json);
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
        return Playlist.fromJson(this.fileSource, this.toJson());
    }
}
