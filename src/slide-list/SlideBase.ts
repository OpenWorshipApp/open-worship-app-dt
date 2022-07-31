import SlideItem, { SlideItemType } from './SlideItem';
import ItemSource from '../helper/ItemSource';
import FileSource from '../helper/FileSource';
import { DisplayType } from '../helper/displayHelper';
import { showAppContextMenu } from '../others/AppContextMenu';
import {
    MAX_THUMBNAIL_SCALE,
    MIN_THUMBNAIL_SCALE,
    THUMBNAIL_SCALE_STEP,
} from './slideHelpers';
import { AnyObjectType } from '../helper/helpers';
import Canvas from '../slide-editor/canvas/Canvas';
import { toastEventListener } from '../event/ToastEventListener';
import SlideEditingCacheManager from './SlideEditingCacheManager';

export type SlideEditingHistoryType = {
    items?: SlideItemType[],
    metadata?: AnyObjectType,
};

export type SlideType = {
    items: SlideItemType[],
    metadata: AnyObjectType,
};

export default class SlideBase extends ItemSource<SlideItem>{
    editingCacheManager: SlideEditingCacheManager;
    constructor(fileSource: FileSource, json: SlideType) {
        super(fileSource);
        this.editingCacheManager = new SlideEditingCacheManager(
            this.fileSource, json);
    }
    get isChanged() {
        return this.editingCacheManager.isChanged;
    }
    get copiedItem() {
        return this.items.find((item) => item.isCopied) || null;
    }
    set copiedItem(newItem: SlideItem | null) {
        this.items.forEach((item) => {
            item.isCopied = false;
        });
        if (newItem !== null) {
            newItem.isCopied = true;
        }
    }
    get selectedIndex() {
        const foundItem = this.items.find((item) => item.isSelected) || null;
        if (foundItem) {
            return this.items.indexOf(foundItem);
        }
        return -1;
    }
    set selectedIndex(newIndex: number) {
        this.items.forEach((item) => {
            item.isSelected = false;
        });
        if (this.items[newIndex]) {
            this.items[newIndex].isSelected = true;
        }
    }
    get metadata() {
        return this.editingCacheManager.latestHistory.metadata;
    }
    get items() {
        const latestHistory = this.editingCacheManager.latestHistory;
        return latestHistory.items.map((json) => {
            try {
                return SlideItem.fromJson(json as any,
                    this.fileSource, this.editingCacheManager);
            } catch (error: any) {
                toastEventListener.showSimpleToast({
                    title: 'Instantiating Bible Item',
                    message: error.message,
                });
            }
            return SlideItem.fromJsonError(json, this.fileSource,
                this.editingCacheManager);
        });
    }
    set items(newItems: SlideItem[]) {
        const slideItems = newItems.map((item) => item.toJson());
        this.editingCacheManager.pushSlideItems(slideItems);
    }
    get maxItemId() {
        if (this.items.length) {
            const ids = this.items.map((item) => item.id);
            return Math.max.apply(Math, ids);
        }
        return 0;
    }
    getItemByIndex(index: number) {
        return this.items[index] || null;
    }
    getItemById(id: number) {
        return this.items.find((item) => item.id === id) || null;
    }
    async save(): Promise<boolean> {
        const isSuccess = await super.save();
        if (isSuccess) {
            this.editingCacheManager.delete();
        }
        return isSuccess;
    }
    duplicateItem(slideItem: SlideItem) {
        const items = this.items;
        const newItem = slideItem.clone();
        if (newItem !== null) {
            newItem.id = this.maxItemId + 1;
            const index = this.items.indexOf(slideItem);
            items.splice(index + 1, 0, newItem);
            this.items = items;
        }
    }
    pasteItem() {
        if (this.copiedItem === null) {
            return;
        }
        const newItem = this.copiedItem.clone();
        if (newItem !== null) {
            newItem.id = this.maxItemId + 1;
            const newItems: SlideItem[] = [...this.items, newItem];
            this.items = newItems;
        }
    }
    moveItem(id: number, toIndex: number) {
        const fromIndex: number = this.items.findIndex((item) => {
            return item.id === id;
        });
        const items = this.items;
        const target = items.splice(fromIndex, 1)[0];
        items.splice(toIndex, 0, target);
        this.items = items;
    }
    addItem(slideItem: SlideItem) {
        const items = this.items;
        slideItem.id = this.maxItemId + 1;
        items.push(slideItem);
        this.items = items;
    }
    deleteItem(slideItem: SlideItem) {
        const newItems = this.items.filter((item) => {
            return item !== slideItem;
        });
        const result = SlideItem.getSelectedResult();
        if (result?.id === slideItem.id) {
            SlideItem.setSelectedItem(null);
        }
        this.items = newItems;
    }
    static toWrongDimensionString({ slide, display }: {
        slide: { width: number, height: number },
        display: { width: number, height: number },
    }) {
        return `⚠️ slide:${slide.width}x${slide.height} `
            + `display:${display.width}x${display.height}`;
    }
    checkIsWrongDimension({ bounds }: DisplayType) {
        const found = this.items.map((item) => {
            return {
                width: item.width,
                height: item.height,
            };
        }).find(({ width, height }: { width: number, height: number }) => {
            return bounds.width !== width || bounds.height !== height;
        });
        if (found) {
            return {
                slide: found,
                display: {
                    width: bounds.width,
                    height: bounds.height,
                },
            };
        }
        return null;
    }
    async fixSlideDimension({ bounds }: DisplayType) {
        this.items.forEach((item) => {
            item.width = bounds.width;
            item.height = bounds.height;
        });
        this.editingCacheManager.pushSlideItems(this.items.map((item) => {
            return item.toJson();
        }));
    }
    showSlideItemContextMenu(e: any) {
        showAppContextMenu(e, [{
            title: 'New Slide Item', onClick: () => {
                const item = SlideItem.defaultSlideItemData(this.maxItemId + 1);
                const { width, height } = Canvas.getDefaultDim();
                this.addItem(new SlideItem(item.id, this.fileSource, {
                    id: item.id,
                    metadata: { width, height },
                    canvasItems: [], // TODO: add default canvas item
                }, this.editingCacheManager));
            },
        }, {
            title: 'Paste', disabled: SlideItem.copiedItem === null,
            onClick: () => this.pasteItem(),
        }]);
    }
    async discardChanged() {
        this.editingCacheManager.delete();
        this.fileSource.fireUpdateEvent();
    }
    static toScaleThumbSize(isUp: boolean, currentScale: number) {
        let newScale = currentScale + (isUp ? -1 : 1) * THUMBNAIL_SCALE_STEP;
        if (newScale < MIN_THUMBNAIL_SCALE) {
            newScale = MIN_THUMBNAIL_SCALE;
        }
        if (newScale > MAX_THUMBNAIL_SCALE) {
            newScale = MAX_THUMBNAIL_SCALE;
        }
        return newScale;
    }
}
