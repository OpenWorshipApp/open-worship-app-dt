import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';

import { ItemBase } from '../helper/ItemBase';
import { cloneJson } from '../helper/helpers';
import type { CanvasItemPropsType } from '../slide-editor/canvas/CanvasItem';
import type DragInf from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { getDefaultScreenDisplay } from '../_screen/managers/screenHelpers';
import type { ClipboardInf } from '../server/appHelpers';
import { handleError } from '../helper/errorHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';
import { getFontFamilies } from '../server/fontHelpers';

import slideSchemaJson from './SlideSchema.json';
const slideSchema: SchemaNode = compileSchema(slideSchemaJson);

export type SlideType = {
    id: number;
    name?: string;
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

    get cloneOriginalJson() {
        const json = cloneJson(this.originalJson);
        return json;
    }

    get name() {
        return this.originalJson.name ?? '';
    }
    set name(name: string) {
        const json = this.cloneOriginalJson;
        json.name = name;
        this.originalJson = json;
    }

    get id() {
        return this.originalJson.id;
    }

    set id(id: number) {
        const json = this.cloneOriginalJson;
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
        const json = this.cloneOriginalJson;
        json.metadata = metadata;
        this.originalJson = json;
    }

    get canvasItemsJson() {
        return this.originalJson.canvasItems;
    }

    set canvasItemsJson(canvasItemsJson: CanvasItemPropsType[]) {
        const json = this.cloneOriginalJson;
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

    fontFamilies() {
        const fontFamilies = new Set<string>();
        for (const canvasItem of this.canvasItemsJson) {
            if (canvasItem.type === 'text') {
                const fontFamily = (canvasItem as any).fontFamily;
                if (fontFamily) {
                    fontFamilies.add(fontFamily);
                }
            }
        }
        return fontFamilies;
    }

    getUnavailableFontFamilies() {
        const availableFontFamilies = getFontFamilies();
        if (availableFontFamilies === null) {
            return [];
        }
        const fontFamilies = this.fontFamilies();
        const unavailableFonts: string[] = [];
        for (const fontFamily of fontFamilies) {
            const isFontAvailable = availableFontFamilies.includes(
                fontFamily.trim().toLowerCase(),
            );
            if (!isFontAvailable) {
                unavailableFonts.push(fontFamily);
            }
        }
        return unavailableFonts;
    }

    static getDefaultDim() {
        const display = getDefaultScreenDisplay();
        const { width, height } = display.bounds;
        return { width, height };
    }

    static defaultSlideData(id: number) {
        const { width, height } = this.getDefaultDim();
        const canvasItems: CanvasItemPropsType[] = [];
        return {
            id,
            metadata: {
                width,
                height,
            },
            canvasItems,
        };
    }

    toJson(): SlideType {
        if (this.isError) {
            return this.jsonError;
        }
        return this.originalJson;
    }

    checkIsWrongDimension(dim: { width: number; height: number }) {
        return dim.width !== this.width || dim.height !== this.height;
    }

    static validate(json: AnyObjectType) {
        if (slideSchema.validate(json).valid === false) {
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
        } catch (_error) {}
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
