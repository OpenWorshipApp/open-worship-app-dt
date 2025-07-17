import { ItemBase } from '../helper/ItemBase';
import { cloneJson } from '../helper/helpers';
import { CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import DragInf, { DragTypeEnum } from '../helper/DragInf';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import { ClipboardInf } from '../server/appHelpers';
import { handleError } from '../helper/errorHelpers';
import { AnyObjectType } from '../helper/typeHelpers';
import { DisplayType } from '../_screen/screenTypeHelpers';

export type SlideType = {
    id: number;
    canvasItems: CanvasItemPropsType[];
    metadata: {
        width: number;
        height: number;
    };
};

export default class Slide
    extends ItemBase
    implements DragInf<string>, ClipboardInf
{
    private _originalJson: SlideType;
    filePath: string;
    isChanged = false;

    constructor(filePath: string, json: SlideType) {
        super();
        this._originalJson = cloneJson(json);
        this.filePath = filePath;
    }

    get id() {
        return this.originalJson.id;
    }

    set id(id: number) {
        const json = cloneJson(this.originalJson);
        json.id = id;
        this.originalJson = json;
    }

    get originalJson() {
        return this._originalJson;
    }

    set originalJson(json: SlideType) {
        this.isChanged = true;
        this._originalJson = json;
    }

    get metadata() {
        return this.originalJson.metadata;
    }

    set metadata(metadata: { width: number; height: number }) {
        const json = cloneJson(this.originalJson);
        json.metadata = metadata;
        this.originalJson = json;
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
        return this.metadata.width;
    }

    set width(width: number) {
        const metadata = this.metadata;
        metadata.width = width;
        this.metadata = metadata;
    }

    get height() {
        return this.metadata.height;
    }

    set height(height: number) {
        const metadata = this.metadata;
        metadata.height = height;
        this.metadata = metadata;
    }

    static getDefaultDim() {
        const display = getDefaultScreenDisplay();
        const { width, height } = display.bounds;
        return { width, height };
    }

    static defaultSlideData(id: number) {
        const { width, height } = this.getDefaultDim();
        return {
            id,
            metadata: {
                width,
                height,
            },
            canvasItems: [],
        };
    }

    toJson(): SlideType {
        if (this.isError) {
            return this.jsonError;
        }
        return this.originalJson;
    }

    checkIsWrongDimension({ bounds }: DisplayType) {
        return bounds.width !== this.width || bounds.height !== this.height;
    }

    static validate(json: AnyObjectType) {
        if (
            typeof json.id !== 'number' ||
            typeof json.metadata !== 'object' ||
            typeof json.metadata.width !== 'number' ||
            typeof json.metadata.height !== 'number' ||
            !(json.canvasItems instanceof Array)
        ) {
            throw new Error(`Invalid slide data json:${JSON.stringify(json)}`);
        }
    }

    clone(isDuplicateId?: boolean) {
        const slide = Slide.fromJson(this.toJson(), this.filePath);
        if (!isDuplicateId) {
            slide.id = -1;
        }
        return slide;
    }

    clipboardSerialize() {
        const json = this.toJson();
        return JSON.stringify({
            filePath: this.filePath,
            data: json,
        });
    }

    static clipboardDeserialize(jsonString: string) {
        if (!jsonString) {
            return null;
        }
        try {
            const { filePath, data } = JSON.parse(jsonString);
            this.validate(data);
            return this.fromJson(data, filePath);
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    dragSerialize() {
        return {
            type: DragTypeEnum.SLIDE,
            data: this.clipboardSerialize(),
        };
    }

    static dragDeserialize(data: string) {
        try {
            return this.clipboardDeserialize(data);
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    static fromJson(json: SlideType, filePath: string) {
        return new this(filePath, json);
    }

    static fromJsonError(json: AnyObjectType, filePath: string) {
        const newJson = {
            id: -1,
            metadata: {
                width: 0,
                height: 0,
            },
            canvasItems: [],
        };
        const slide = new Slide(filePath, newJson);
        slide.jsonError = json;
        return slide;
    }

    static checkIsThisType(anyAppDocumentItem: any): boolean {
        return anyAppDocumentItem instanceof Slide;
    }

    checkIsSame(item: ItemBase) {
        if (Slide.checkIsThisType(item)) {
            return super.checkIsSame(item);
        }
        return false;
    }
}
