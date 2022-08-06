import FileSource from '../helper/FileSource';
import { ItemBase } from '../helper/ItemBase';
import Lyric from './Lyric';
import { AnyObjectType, cloneObject } from '../helper/helpers';
import LyricEditingCacheManager from './LyricEditingCacheManager';

export type LyricItemType = {
    id: number,
    title: string,
    content: string,
    metadata: AnyObjectType,
};

export default class LyricItem extends ItemBase {
    _originalJson: Readonly<LyricItemType>;
    static SELECT_SETTING_NAME = 'lyric-item-selected';
    id: number;
    fileSource: FileSource;
    isCopied: boolean;
    presentType: 'solo' | 'merge' = 'solo'; // TODO: implement this
    static copiedItem: LyricItem | null = null;
    editingCacheManager: LyricEditingCacheManager;
    static _cache = new Map<string, LyricItem>();
    constructor(id: number, fileSource: FileSource,
        json: LyricItemType,
        editingCacheManager?: LyricEditingCacheManager) {
        super();
        this.id = id;
        this._originalJson = Object.freeze(json);
        this.fileSource = fileSource;
        if (editingCacheManager !== undefined) {
            this.editingCacheManager = editingCacheManager;
        } else {
            this.editingCacheManager = new LyricEditingCacheManager(this.fileSource, {
                items: [json],
                metadata: {},
            });
            this.editingCacheManager.isUsingHistory = false;
        }
        this.isCopied = false;
        const key = LyricItem.genKeyByFileSource(fileSource, id);
        LyricItem._cache.set(key, this);
    }
    get metadata() {
        const json = this.editingCacheManager.getLyricItemById(this.id);
        return json?.metadata || this._originalJson.metadata;
    }
    get lyricItemJson() {
        const items = this.editingCacheManager.presentJson.items;
        const lyricItemJson = items.find((item) => {
            return item.id === this.id;
        });
        return lyricItemJson || this._originalJson;
    }
    get title() {
        return this.lyricItemJson.title;
    }
    set title(title: string) {
        const items = this.editingCacheManager.presentJson.items;
        items.forEach((item) => {
            if (item.id === this.id) {
                item.title = title;
            }
        });
        this.editingCacheManager.pushLyricItems(items);
    }
    get content() {
        return this.lyricItemJson.content;
    }
    set content(content: string) {
        const items = this.editingCacheManager.presentJson.items;
        items.forEach((item) => {
            if (item.id === this.id) {
                item.content = content;
            }
        });
        this.editingCacheManager.pushLyricItems(items);
    }
    get isChanged() {
        return this.editingCacheManager.checkIsLyricItemChanged(this.id);
    }
    static getSelectedEditingResult() {
        const selected = this.getSelectedResult();
        const lyricSelected = Lyric.getSelectedFileSource();
        if (selected?.fileSource.filePath === lyricSelected?.filePath) {
            return selected;
        }
        return null;
    }
    static fromJson(json: LyricItemType, fileSource: FileSource,
        editingCacheManager?: LyricEditingCacheManager) {
        this.validate(json);
        const key = LyricItem.genKeyByFileSource(fileSource, json.id);
        if (LyricItem._cache.has(key)) {
            return LyricItem._cache.get(key) as LyricItem;
        }
        return new LyricItem(json.id, fileSource, json,
            editingCacheManager);
    }
    static fromJsonError(json: AnyObjectType,
        fileSource: FileSource,
        editingCacheManager?: LyricEditingCacheManager) {
        const item = new LyricItem(-1, fileSource, {
            id: -1,
            metadata: {},
            title: 'Error',
            content: 'Error',
        }, editingCacheManager);
        item.jsonError = json;
        return item;
    }
    toJson() {
        if (this.isError) {
            return this.jsonError;
        }
        return {
            id: this.id,
            title: this.title,
            content: this.content,
        };
    }
    static validate(json: AnyObjectType) {
        if (!json.title || !json.content) {
            console.log(json);
            throw new Error('Invalid lyric item data');
        }
    }
    clone(isDuplicateId?: boolean) {
        const lyricItem = cloneObject(this);
        if (!isDuplicateId) {
            lyricItem.id = -1;
        }
        return lyricItem;
    }
    static genKeyByFileSource(fileSource: FileSource, id: number) {
        return `${fileSource.filePath}:${id}`;
    }
    static genDefaultLyric(name: string): LyricItemType {
        return {
            id: -1,
            title: name,
            content: 'Block1\n===\nBlock2\n===\nBlock3',
            metadata: {},
        };
    }
    static clearCache() {
        this._cache = new Map();
    }
}
