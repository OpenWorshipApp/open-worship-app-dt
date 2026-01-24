import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';

import { ItemBase } from '../helper/ItemBase';
import { cloneJson } from '../helper/helpers';
import type DragInf from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import type { ClipboardInf } from '../server/appHelpers';
import type { AnyObjectType } from '../helper/typeHelpers';

import slideSchemaJson from './PDFSlideSchema.json';
const pdfSlideSchema: SchemaNode = compileSchema(slideSchemaJson);

export type PdfSlideType = {
    id: number;
    name?: string;
    imagePreviewSrc: string;
    pdfPageNumber: number;
    metadata: { width: number; height: number };
};

export default class PdfSlide
    extends ItemBase
    implements DragInf<string>, ClipboardInf
{
    private _originalJson: PdfSlideType;
    filePath: string;

    constructor(filePath: string, json: PdfSlideType) {
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

    get name() {
        return this.originalJson.name ?? '';
    }

    clone(): ItemBase {
        throw new Error('Method not implemented.');
    }

    get pdfPreviewSrc() {
        return this.originalJson.imagePreviewSrc ?? null;
    }

    get originalJson() {
        return this._originalJson;
    }
    set originalJson(json: PdfSlideType) {
        this._originalJson = json;
    }

    checkIsSame(varyAppDocumentItem: any) {
        if (PdfSlide.checkIsThisType(varyAppDocumentItem)) {
            return this.id === varyAppDocumentItem.id;
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

    static fromJson(json: PdfSlideType, filePath: string) {
        return new this(filePath, json);
    }

    toJson(): PdfSlideType {
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
        if (pdfSlideSchema.validate(json).valid === false) {
            throw new Error('Invalid slide data');
        }
    }

    async clipboardSerialize() {
        const image = new Image();
        image.src = this.pdfPreviewSrc;
        const imageData = await new Promise<string | null>((resolve) => {
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext('2d');
                if (ctx === null) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(image, 0, 0);
                resolve(canvas.toDataURL());
            };
            image.onerror = () => {
                resolve(null);
            };
        });
        return imageData;
    }

    dragSerialize() {
        return {
            type: DragTypeEnum.PDF_SLIDE,
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
