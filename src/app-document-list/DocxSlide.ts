import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';

import { ItemBaseFilePath } from '../helper/ItemBase';
import { cloneJson } from '../helper/helpers';
import { DragTypeEnum } from '../helper/DragInf';
import type DragInf from '../helper/DragInf';
import type { ClipboardInf } from '../server/appHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';

import slideSchemaJson from './DocxSlideSchema.json';

const docxSlideSchema: SchemaNode = compileSchema(slideSchemaJson);

export type DocxSlideType = {
    id: number;
    htmlFilePath: string;
    html?: string;
    metadata: { width: number; height: number };
};

export default class DocxSlide
    extends ItemBaseFilePath
    implements DragInf<string>, ClipboardInf
{
    private _originalJson: DocxSlideType;
    filePath: string;

    constructor(filePath: string, json: DocxSlideType) {
        super();
        this._originalJson = cloneJson(json);
        this.filePath = filePath;
    }

    get isDisabled() {
        return false;
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

    get html() {
        return this.originalJson.html;
    }

    get name() {
        return '';
    }

    clone(): ItemBaseFilePath {
        throw new Error('Method not implemented.');
    }

    get originalJson() {
        return this._originalJson;
    }

    set originalJson(json: DocxSlideType) {
        this._originalJson = json;
    }

    checkIsSame(varySlide: any) {
        if (DocxSlide.checkIsThisType(varySlide)) {
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

    static fromJson(json: DocxSlideType, filePath: string) {
        return new this(filePath, json);
    }

    toJson(): DocxSlideType {
        return this._originalJson;
    }

    private toDragJson(): DocxSlideType {
        const json = cloneJson(this.toJson());
        delete (json as Partial<DocxSlideType>).html;
        return json;
    }

    static tryValidate(json: AnyObjectType) {
        try {
            this.validate(json);
            return true;
        } catch (_error) {}
        return false;
    }

    static validate(json: AnyObjectType) {
        if (docxSlideSchema.validate(json).valid === false) {
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
            type: DragTypeEnum.DOCX_SLIDE,
            data: JSON.stringify({
                filePath: this.filePath,
                data: this.toDragJson(),
            }),
        };
    }

    static checkIsThisType(item: any) {
        return item instanceof this;
    }
}
