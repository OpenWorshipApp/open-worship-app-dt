import type { AppDocumentMetadataType } from '../helper/AppEditableDocumentSourceAbs';
import AppEditableDocumentSourceAbs from '../helper/AppEditableDocumentSourceAbs';
import type { DragDataType, DroppedDataType } from '../helper/DragInf';
import { handleError } from '../helper/errorHelpers';
import type { MimetypeNameType } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { PlaylistActionIdType } from './playlistActionHelpers';
import type { PlaylistItemType } from './PlaylistItem';
import PlaylistItem from './PlaylistItem';

export type PlaylistType = {
    items: PlaylistItemType[];
    metadata: AppDocumentMetadataType;
};

export default class Playlist extends AppEditableDocumentSourceAbs<PlaylistType> {
    static readonly mimetypeName: MimetypeNameType = 'playlist';

    static genNewExtraJsonData() {
        return { items: [] as PlaylistItemType[] };
    }

    async getJsonData(isOriginal = false): Promise<PlaylistType | null> {
        const jsonData = await super.getJsonData(isOriginal);
        if (jsonData === null) {
            return null;
        }
        if (!Array.isArray(jsonData.items)) {
            jsonData.items = [];
        }
        return jsonData;
    }

    async getItems() {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return null;
        }
        return jsonData.items.map((json) => {
            try {
                return PlaylistItem.fromJson(this.filePath, json);
            } catch (error: any) {
                showSimpleToast('Instantiating Playlist Item', error.message);
            }
            return PlaylistItem.fromJsonError(this.filePath, json);
        });
    }

    // A playlist has no editor and no save button, so every mutation is written
    // straight through instead of parking in the editing history.
    private async setItems(items: PlaylistItemType[]) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return false;
        }
        jsonData.items = items;
        await this.setJsonData(jsonData);
        return await this.save();
    }

    /**
     * Read the items as plain json, let `handler` rearrange them, write back.
     * A handler returning `false` aborts without writing — that is load bearing:
     * an out-of-range `splice` is a silent no-op, so without it "Move up" on the
     * first row would still save the file and fire its update events.
     */
    private async updateItemJsonList(
        handler: (itemJsonList: PlaylistItemType[]) => boolean | void,
    ) {
        const items = await this.getItems();
        if (items === null) {
            return false;
        }
        const itemJsonList = items.map((item) => {
            return item.toJson();
        });
        if (handler(itemJsonList) === false) {
            return false;
        }
        return await this.setItems(itemJsonList);
    }

    private async insertItemJson(
        newItemJson: PlaylistItemType,
        toIndex?: number,
    ) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (toIndex === undefined || toIndex >= itemJsonList.length) {
                itemJsonList.push(newItemJson);
            } else {
                itemJsonList.splice(Math.max(toIndex, 0), 0, newItemJson);
            }
        });
    }

    async addItem(
        droppedData: DroppedDataType,
        dragData: DragDataType<any>,
        toIndex?: number,
    ) {
        try {
            const newItemJson = await PlaylistItem.fromDroppedData(
                droppedData,
                dragData,
            );
            if (newItemJson === null) {
                showSimpleToast(
                    'Adding Playlist Item',
                    'This item type cannot be added to a playlist',
                );
                return false;
            }
            return await this.insertItemJson(newItemJson, toIndex);
        } catch (error: any) {
            handleError(error);
            showSimpleToast('Adding Playlist Item', error.message);
        }
        return false;
    }

    /**
     * A screen action is not dragged from anywhere — it is chosen from the
     * playlist's own menu, so it has its own way in rather than going through
     * the drop pipeline.
     */
    async addActionItem(actionId: PlaylistActionIdType, toIndex?: number) {
        try {
            return await this.insertItemJson(
                PlaylistItem.fromActionId(actionId),
                toIndex,
            );
        } catch (error: any) {
            handleError(error);
            showSimpleToast('Adding Playlist Action', error.message);
        }
        return false;
    }

    async removeItemAtIndex(index: number) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[index] === undefined) {
                return false;
            }
            itemJsonList.splice(index, 1);
        });
    }

    async moveItemToIndex(fromIndex: number, toIndex: number) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[fromIndex] === undefined) {
                return false;
            }
            const [moving] = itemJsonList.splice(fromIndex, 1);
            itemJsonList.splice(
                Math.min(Math.max(toIndex, 0), itemJsonList.length),
                0,
                moving,
            );
        });
    }

    async setItemColorNote(index: number, colorNote: string | null) {
        return await this.updateItemJsonList((itemJsonList) => {
            if (itemJsonList[index] === undefined) {
                return false;
            }
            itemJsonList[index] = { ...itemJsonList[index], colorNote };
        });
    }

    async clearItems() {
        return await this.setItems([]);
    }

    static async create(dir: string, name: string) {
        return super.create(dir, name, this.genNewExtraJsonData());
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}
