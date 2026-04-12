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
import { pathJoin } from '../server/fileHelpers';
const pptxSlideSchema: SchemaNode = compileSchema(slideSchemaJson);

export type PptxSlideType = {
    id: number;
    htmlFilePath: string;
    subHtmlFilePaths: string[];
    html?: string;
    subHtmls?: string[];
    isDisabled: boolean;
    note: string | null;
    metadata: { width: number; height: number };
    images: string[];
    videos: string[];
    audios: string[];
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

    get subSlides() {
        const subHtmls = this.originalJson.subHtmls ?? [];
        return this.originalJson.subHtmlFilePaths.map((htmlFilePath, index) => {
            const json: PptxSlideType = {
                id: this.id + 999 + index,
                htmlFilePath,
                subHtmlFilePaths: [],
                html: subHtmls[index],
                subHtmls: [],
                isDisabled: this.isDisabled,
                note: null,
                metadata: cloneJson(this.metadata),
                images: [],
                videos: [],
                audios: [],
            };
            return new PptxSlide(this.filePath, json);
        });
    }

    get isDisabled() {
        return this.originalJson.isDisabled;
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

    get html() {
        return this.originalJson.html;
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

    get audioFilePaths() {
        const fileSource = FileSource.getInstance(this.htmlFilePath);
        const baseDirPath = fileSource.baseDirPath;
        return this.originalJson.audios.map((audioPath) => {
            return pathJoin(baseDirPath, audioPath);
        });
    }

    static fromJson(json: PptxSlideType, filePath: string) {
        return new this(filePath, json);
    }

    toJson(): PptxSlideType {
        return this._originalJson;
    }

    private toDragJson(): PptxSlideType {
        const json = cloneJson(this.toJson());
        delete (json as Partial<PptxSlideType>).html;
        delete (json as Partial<PptxSlideType>).subHtmls;
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
                data: this.toDragJson(),
            }),
        };
    }

    static checkIsThisType(item: any) {
        return item instanceof this;
    }

    static calcIndex(i: number, j: number) {
        return i + (j + 1) * 0.01;
    }
}
