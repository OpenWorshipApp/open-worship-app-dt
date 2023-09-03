import {
    fsListFilesWithMimetype,
    MimetypeNameType,
} from '../server/fileHelper';
import FileSource from '../helper/FileSource';
import {
    AnyObjectType,
    cloneJson,
    toMaxId,
} from '../helper/helpers';
import ItemSource from '../helper/ItemSource';
import { getSetting } from '../helper/settingHelper';
import BibleItem, { BibleItemType } from './BibleItem';
import { showSimpleToast } from '../toast/toastHelpers';

export type BibleType = {
    items: BibleItemType[],
    metadata: AnyObjectType,
}
export default class Bible extends ItemSource<BibleItem>{
    static SELECT_DIR_SETTING = 'bible-list-selected-dir';
    static DEFAULT_FILE_NAME = 'Default';
    _originalJson: BibleType;
    constructor(fileSource: FileSource, json: BibleType) {
        super(fileSource);
        this._originalJson = cloneJson(json);
    }
    static fromJson(fileSource: FileSource, json: any) {
        this.validate(json);
        return new Bible(fileSource, json);
    }
    get metadata() {
        return this._originalJson.metadata;
    }
    get itemsLength() {
        return this._originalJson.items.length;
    }
    get items() {
        return this._originalJson.items.map((json) => {
            try {
                return BibleItem.fromJson(json, this.fileSource);
            } catch (error: any) {
                showSimpleToast('Instantiating Bible Item', error.message);
            }
            return BibleItem.fromJsonError(json, this.fileSource);
        });
    }
    set items(newItems: BibleItem[]) {
        const items = newItems.map((item) => item.toJson());
        this._originalJson.items = items;
    }
    get maxItemId() {
        if (this.items.length) {
            const ids = this.items.map((item) => item.id);
            return toMaxId(ids);
        }
        return 0;
    }
    static checkIsDefault(fileSource: FileSource) {
        return fileSource.name === Bible.DEFAULT_FILE_NAME;
    }
    get isDefault() {
        return Bible.checkIsDefault(this.fileSource);
    }
    get isSelected() {
        return false;
    }
    get isOpened() {
        return this.metadata['isOpened'] === true;
    }
    async setIsOpened(b: boolean) {
        this.metadata['isOpened'] = b;
        this.save();
    }
    getItemById(id: number) {
        return this.items.find((item) => item.id === id) || null;
    }
    setItemById(id: number, item: BibleItem) {
        const items = this.items;
        const newItems = items.map((item1) => {
            if (item1.id === id) {
                return item;
            }
            return item1;
        });
        this.items = newItems;
    }
    static async updateOrToDefault(bibleItem: BibleItem) {
        const bible = await Bible.getDefault();
        if (bible) {
            bible.addItem(bibleItem);
            if (await bible.save()) {
                return bibleItem;
            }
        }
        return null;
    }
    duplicate(index: number) {
        const items = this.items;
        const newItem = items[index].clone();
        newItem.id = this.maxItemId + 1;
        items.splice(index + 1, 0, newItem);
        this.items = items;
    }
    removeItemAtIndex(index: number): BibleItem | null {
        const items = this.items;
        const removedItems = items.splice(index, 1);
        this.items = items;
        return removedItems[0] ?? null;
    }
    removeItem(bibleItem: BibleItem) {
        const items = this.items;
        const index = items.indexOf(bibleItem);
        if (index !== -1) {
            this.removeItemAtIndex(index);
        }
    }
    addItem(item: BibleItem) {
        item.fileSource = this.fileSource;
        item.id = this.maxItemId + 1;
        const items = this.items;
        items.push(item);
        this.items = items;
    }
    swapItem(fromIndex: number, toIndex: number) {
        const items = this.items;
        const fromItem = items[fromIndex];
        const toItem = items[toIndex];
        items[fromIndex] = toItem;
        items[toIndex] = fromItem;
        this.items = items;
    }
    async moveItemFrom(fileSource: FileSource, index?: number) {
        try {
            const fromBible = await Bible.readFileToData(fileSource);
            if (!fromBible) {
                showSimpleToast('Moving Bible Item', 'Cannot source Bible');
                return;
            }
            const backupBibleItems = fromBible.items;
            let targetBibleItems: BibleItem[] = backupBibleItems;
            if (index !== undefined) {
                if (!backupBibleItems[index]) {
                    showSimpleToast('Moving Bible Item', 'Cannot find Bible Item');
                    return;
                }
                targetBibleItems = [backupBibleItems[index]];
            }
            this.items = this.items.concat(targetBibleItems);
            await this.save();

            fromBible.items = backupBibleItems.filter((item) => {
                return !targetBibleItems.includes(item);
            });
            await fromBible.save();

        } catch (error: any) {
            showSimpleToast('Moving Bible Item', error.message);
        }
    }
    static mimetype: MimetypeNameType = 'bible';
    static async readFileToDataNoCache(fileSource: FileSource | null) {
        return super.readFileToDataNoCache(fileSource) as Promise<Bible | null | undefined>;
    }
    static async readFileToData(fileSource: FileSource | null, isForceCache?: boolean) {
        return super.readFileToData(fileSource, isForceCache) as Promise<Bible | null | undefined>;
    }
    static async getDefault() {
        const dir = getSetting(Bible.SELECT_DIR_SETTING, '');
        if (!dir) {
            return null;
        }
        const fileSources = await fsListFilesWithMimetype(dir, 'bible') || [];
        if (fileSources === null) {
            return null;
        }
        for (const fileSource of fileSources) {
            if (Bible.checkIsDefault(fileSource)) {
                return Bible.readFileToData(fileSource);
            }
        }
        const defaultFS = await this.create(dir, Bible.DEFAULT_FILE_NAME);
        const defaultBible = await Bible.readFileToData(defaultFS);
        if (!defaultBible) {
            showSimpleToast('Getting Default Bible File',
                'Fail to get default bible file');
            return null;
        }
        await defaultBible.setIsOpened(true);
        return defaultBible;
    }
    static async create(dir: string, name: string) {
        return super.create(dir, name, []);
    }
    clone() {
        return Bible.fromJson(this.fileSource, this.toJson());
    }
    empty() {
        this.items = [];
    }
}
