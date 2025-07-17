import Bible from '../bible-list/Bible';
import { cloneJson } from '../helper/helpers';
import * as loggerHelpers from '../helper/loggerHelpers';
import { AnyObjectType } from '../helper/typeHelpers';

const itemTypeList = ['error', 'slide', 'bible-item', 'lyric'] as const;
type ItemType = (typeof itemTypeList)[number];
export type PlaylistItemType = {
    type: ItemType;
    filePath: string;
    id?: number;
};

export default class PlaylistItem {
    private readonly originalJson: Readonly<PlaylistItemType>;
    filePath: string;
    jsonError: any;
    constructor(filePath: string, json: PlaylistItemType) {
        this.filePath = filePath;
        this.originalJson = Object.freeze(cloneJson(json));
    }
    get isError() {
        return this.type === 'error';
    }
    get type() {
        return this.originalJson.type;
    }
    get isSlide() {
        return this.type === 'slide';
    }

    get isBibleItem() {
        return this.type === 'bible-item';
    }
    async getBibleItem() {
        if (this.isBibleItem) {
            const bible = await Bible.fromFilePath(this.filePath);
            if (bible) {
                return bible.getItemById(this.originalJson.id as number);
            }
        }
        return null;
    }
    get isLyric() {
        return this.type === 'lyric';
    }
    async getLyric() {
        return null;
    }
    static fromJson(filePath: string, json: PlaylistItemType) {
        this.validate(json);
        return new PlaylistItem(filePath, json);
    }
    static fromJsonError(filePath: string, json: AnyObjectType) {
        const item = new PlaylistItem(filePath, {
            type: 'error',
            filePath: '',
        });
        item.jsonError = json;
        return item;
    }
    toJson(): PlaylistItemType {
        if (this.isError) {
            return this.jsonError;
        }
        return {
            type: this.type,
            filePath: this.originalJson.filePath,
            id: this.originalJson.id,
        };
    }
    static validate(json: AnyObjectType) {
        if (
            !itemTypeList.includes(json.type) ||
            (json.path && typeof json.path !== 'string') ||
            (json.type === 'bible-item' && typeof json.id !== 'number')
        ) {
            loggerHelpers.error(json);
            throw new Error('Invalid playlist item data');
        }
    }
    clone() {
        return PlaylistItem.fromJson(this.filePath, this.toJson());
    }
}
