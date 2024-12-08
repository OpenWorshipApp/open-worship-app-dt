import { ItemBase } from '../helper/ItemBase';
import { AnyObjectType, cloneJson } from '../helper/helpers';
import Canvas from '../slide-editor/canvas/Canvas';
import SlideEditorCacheManager from './SlideEditorCacheManager';
import { CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import { DisplayType } from '../_screen/screenHelpers';
import { PdfImageDataType } from '../pdf/PdfController';
import DragInf, { DragTypeEnum } from '../helper/DragInf';
import { log } from '../helper/loggerHelpers';
import { createContext, useContext } from 'react';

export type SlideItemType = {
    id: number,
    canvasItems: CanvasItemPropsType[],
    pdfImageData?: PdfImageDataType,
    metadata: AnyObjectType,
};

export default class SlideItem extends ItemBase implements DragInf<string> {
    private _originalJson: SlideItemType;
    static readonly SELECT_SETTING_NAME = 'slide-item-selected';
    id: number;
    filePath: string;
    isCopied: boolean;
    showingType: 'solo' | 'merge' = 'solo'; // TODO: implement this
    // TODO: implement copying elements
    static copiedItem: SlideItem | null = null;
    editorCacheManager: SlideEditorCacheManager;
    constructor(
        id: number, filePath: string, json: SlideItemType,
        editorCacheManager?: SlideEditorCacheManager,
    ) {
        super();
        this.id = id;
        this._originalJson = cloneJson(json);
        this.filePath = filePath;
        if (editorCacheManager !== undefined) {
            this.editorCacheManager = editorCacheManager;
        } else {
            this.editorCacheManager = new SlideEditorCacheManager(
                filePath, {
                items: [json],
                metadata: {},
            });
            this.editorCacheManager.isUsingHistory = false;
        }
        this.isCopied = false;
    }

    get key() {
        return SlideItem.genKeyByFileSource(this.filePath, this.id);
    }

    get pdfImageData() {
        return this.originalJson.pdfImageData || null;
    }

    get isPdf() {
        return this.pdfImageData !== null;
    }

    get originalJson() {
        return this._originalJson;
    }

    checkIsSame(slideItem: SlideItemType | SlideItem) {
        return this.id === slideItem.id;
    }

    set originalJson(json: SlideItemType) {
        this._originalJson = json;
        const items = this.editorCacheManager.presenterJson.items;
        const newItems = items.map((item) => {
            if (this.checkIsSame(item)) {
                return this.toJson();
            }
            return item;
        });
        this.editorCacheManager.pushSlideItems(newItems);
    }

    get metadata() {
        return this.originalJson.metadata;
    }

    set metadata(metadata: AnyObjectType) {
        const json = cloneJson(this.originalJson);
        json.metadata = metadata;
        this.originalJson = json;
    }

    get pdfImageSrc() {
        return this.pdfImageData?.src || '';
    }

    get canvas() {
        return Canvas.fromJson({
            metadata: this.metadata,
            canvasItems: this.canvasItemsJson,
        });
    }

    set canvas(canvas: Canvas) {
        this.canvasItemsJson = canvas.canvasItems.map((item) => {
            return item.toJson();
        });
    }

    get canvasItemsJson() {
        return this.originalJson.canvasItems;
    }

    set canvasItemsJson(canvasItemsJson: CanvasItemPropsType[]) {
        const json = cloneJson(this.originalJson);
        json.canvasItems = canvasItemsJson;
        this.originalJson = json;
    }

    get width() {
        if (this.isPdf) {
            return Math.floor(this.pdfImageData?.width || 0);
        }
        return this.metadata.width;
    }

    set width(width: number) {
        const metadata = this.metadata;
        metadata.width = width;
        this.metadata = metadata;
    }

    get height() {
        if (this.isPdf) {
            return Math.floor(this.pdfImageData?.height || 0);
        }
        return this.metadata.height;
    }

    set height(height: number) {
        const metadata = this.metadata;
        metadata.height = height;
        this.metadata = metadata;
    }

    get isChanged() {
        return this.editorCacheManager.checkIsSlideItemChanged(this.id);
    }

    static defaultSlideItemData(id: number) {
        const { width, height } = Canvas.getDefaultDim();
        return {
            id,
            metadata: {
                width,
                height,
            },
            canvasItems: [],
        };
    }

    static fromJson(
        json: SlideItemType, filePath: string,
        editorCacheManager?: SlideEditorCacheManager,
    ) {
        return new SlideItem(json.id, filePath, json, editorCacheManager);
    }

    static fromJsonError(
        json: AnyObjectType, filePath: string,
        editorCacheManager?: SlideEditorCacheManager,
    ) {
        const newJson = {
            id: -1,
            metadata: {},
            canvasItems: [],
        };
        const item = new SlideItem(-1, filePath, newJson, editorCacheManager);
        item.jsonError = json;
        return item;
    }

    toJson(): SlideItemType {
        if (this.isError) {
            return this.jsonError;
        }
        return {
            id: this.id,
            canvasItems: this.canvasItemsJson,
            pdfImageData: this.pdfImageData || undefined,
            metadata: this.metadata,
        };
    }

    static validate(json: AnyObjectType) {
        if (typeof json.id !== 'number' ||
            typeof json.metadata !== 'object' ||
            typeof json.metadata.width !== 'number' ||
            typeof json.metadata.height !== 'number' ||
            !(json.canvasItems instanceof Array)) {
            log(json);
            throw new Error('Invalid slide item data');
        }
    }

    clone(isDuplicateId?: boolean) {
        const slideItem = SlideItem.fromJson(this.toJson(), this.filePath);
        if (!isDuplicateId) {
            slideItem.id = -1;
        }
        return slideItem;
    }

    static genKeyByFileSource(filePath: string, id: number) {
        return `${filePath}:${id}`;
    }

    checkIsWrongDimension({ bounds }: DisplayType) {
        return bounds.width !== this.width ||
            bounds.height !== this.height;
    }

    dragSerialize() {
        return {
            type: DragTypeEnum.SLIDE_ITEM,
            data: this.key,
        };
    }
}

export const SelectedSlideItemContext = createContext<{
    selectedSlideItem: SlideItem,
    setSelectedSlideItem: (newSelectedSlideItem: SlideItem) => void,
} | null>(null);

export function useSelectedSlideItemContext() {
    const context = useContext(SelectedSlideItemContext);
    if (!context) {
        throw new Error(
            'useSelectedSlideItem must be used within a ' +
            'SelectedSlideItemProvider'
        );
    }
    return context;
}
