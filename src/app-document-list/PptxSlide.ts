import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';

import { ItemBaseFilePath } from '../helper/ItemBase';
import { cloneJson } from '../helper/helpers';
import { DragTypeEnum } from '../helper/DragInf';
import type DragInf from '../helper/DragInf';
import type { ClipboardInf } from '../server/appHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';

import slideSchemaJson from './PptxSlideSchema.json';
import FileSource from '../helper/FileSource';
const pptxSlideSchema: SchemaNode = compileSchema(slideSchemaJson);

export type PptxSlideType = {
    id: number;
    htmlFilePath: string;
    isDisabled: boolean;
    note: string | null;
    metadata: { width: number; height: number };
};

export default class PptxSlide
    extends ItemBaseFilePath
    implements DragInf<string>, ClipboardInf
{
    private _originalJson: PptxSlideType;
    filePath: string;

    constructor(filePath: string, json: PptxSlideType) {
        super();
        this._originalJson = cloneJson(json);
        this.filePath = filePath;
    }

    get uuid() {
        const fileSource = FileSource.getInstance(this.filePath);
        return `${fileSource.fullName}-${this.id}`;
    }

    get id() {
        return this.originalJson.id;
    }
    set id(id: number) {
        const json = cloneJson(this.originalJson);
        json.id = id;
        this.originalJson = json;
    }

    get htmlFilePath() {
        return this.originalJson.htmlFilePath;
    }

    get name() {
        return '';
    }

    get note() {
        return this.originalJson.note;
    }

    clone(): ItemBaseFilePath {
        throw new Error('Method not implemented.');
    }

    get originalJson() {
        return this._originalJson;
    }
    set originalJson(json: PptxSlideType) {
        this._originalJson = json;
    }

    checkIsSame(varySlide: any) {
        if (PptxSlide.checkIsThisType(varySlide)) {
            return this.id === varySlide.id;
        }
        return false;
    }

    get metadata() {
        return this.originalJson.metadata;
    }

    get width() {
        return this.metadata.width;
    }

    get height() {
        return this.metadata.height;
    }

    static fromJson(json: PptxSlideType, filePath: string) {
        return new this(filePath, json);
    }

    toJson(): PptxSlideType {
        return this._originalJson;
    }

    static tryValidate(json: AnyObjectType) {
        try {
            this.validate(json);
            return true;
        } catch (_error) {}
        return false;
    }

    static validate(json: AnyObjectType) {
        if (pptxSlideSchema.validate(json).valid === false) {
            throw new Error('Invalid slide data');
        }
    }

    async clipboardSerialize() {
        return null;
    }

    getItemFilePath() {
        return Promise.resolve(this.htmlFilePath);
    }

    dragSerialize() {
        return {
            type: DragTypeEnum.PPTX_SLIDE,
            data: JSON.stringify({
                filePath: this.filePath,
                data: this.toJson(),
            }),
        };
    }

    static checkIsThisType(item: any) {
        return item instanceof this;
    }
}
