import type DragInf from '../../helper/DragInf';
import { DragTypeEnum } from '../../helper/DragInf';
import { handleError } from '../../helper/errorHelpers';
import { cloneJson } from '../../helper/helpers';
import { ItemBase } from '../../helper/ItemBase';
import { appError } from '../../helper/loggerHelpers';
import { type AnyObjectType } from '../../helper/typeHelpers';
import type DocumentInf from '../../others/DocumentInf';
import { type ItemSourceInfBasic } from '../../others/ItemSourceInf';
import {
    type NoteItemMetadataType,
    type NoteItemType,
} from './noteItemHelpers';

export default class NoteItem
    extends ItemBase
    implements DragInf<NoteItemType>
{
    private originalJson: NoteItemType;
    filePath?: string;
    note: (ItemSourceInfBasic<NoteItem> & DocumentInf) | null = null;

    constructor(
        json: NoteItemType,
        filePath?: string,
        note?: (ItemSourceInfBasic<NoteItem> & DocumentInf) | null,
    ) {
        super();
        this.filePath = filePath;
        this.originalJson = cloneJson(json);
        this.note = note ?? null;
    }

    get id() {
        return this.originalJson.metadata.id;
    }
    set id(id: number) {
        this.originalJson.metadata.id = id;
    }

    get isOpened() {
        return this.originalJson.metadata.isOpened ?? false;
    }
    set isOpened(isOpened: boolean) {
        this.originalJson.metadata.isOpened = isOpened;
    }

    get title() {
        return this.originalJson.title ?? '';
    }
    set title(newTitle: string) {
        this.originalJson.title = newTitle;
    }

    get content() {
        return this.originalJson.content ?? '';
    }
    set content(newContent: string) {
        this.originalJson.content = newContent;
    }

    get metadata() {
        return this.originalJson.metadata;
    }
    set metadata(metadata: NoteItemMetadataType) {
        this.originalJson.metadata = metadata;
    }

    checkIsSameId(NoteItem: NoteItem | number) {
        if (typeof NoteItem === 'number') {
            return this.id === NoteItem;
        }
        return this.id === NoteItem.id;
    }

    static fromJson(json: NoteItemType, filePath?: string) {
        this.validate(json);
        return new this(json, filePath);
    }

    static fromJsonError(json: NoteItemType, filePath?: string) {
        const item = new this(
            {
                title: '',
                content: '',
                metadata: {
                    id: -1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
            filePath,
        );
        item.jsonError = json;
        return item;
    }

    toJson(): NoteItemType {
        if (this.isError) {
            return this.jsonError;
        }
        return {
            title: this.title,
            content: this.content,
            metadata: this.metadata,
        };
    }

    static validate(json: AnyObjectType) {
        const { metadata, title, content } = json;
        if (typeof metadata?.createdAt === 'string') {
            json.metadata.createdAt = new Date(metadata.createdAt);
        }
        if (typeof metadata?.updatedAt === 'string') {
            json.metadata.updatedAt = new Date(metadata.updatedAt);
        }
        if (
            typeof title !== 'string' ||
            typeof content !== 'string' ||
            typeof metadata !== 'object' ||
            typeof metadata.id !== 'number' ||
            !(metadata.createdAt instanceof Date) ||
            !(metadata.updatedAt instanceof Date)
        ) {
            appError(json);
            throw new Error('Invalid note item data');
        }
    }

    clone(isKeepId = false) {
        const Class = this.constructor as typeof NoteItem;
        if (!isKeepId) {
            return Class.fromJson(
                { ...this.toJson(), metadata: { ...this.metadata, id: -1 } },
                this.filePath,
            );
        }
        return Class.fromJson(this.toJson(), this.filePath);
    }

    async save(note = this.note): Promise<boolean> {
        if (note === null) {
            return false;
        }
        const NoteItem = note.getItemById(this.id) as NoteItem | null;
        if (NoteItem !== null) {
            NoteItem.update(this);
            note.setItemById(this.id, NoteItem);
            return note.save();
        }
        return false;
    }

    update(NoteItem: NoteItem) {
        this.content = NoteItem.content;
        this.metadata = NoteItem.metadata;
    }

    syncData(NoteItem: NoteItem) {
        this.originalJson = NoteItem.originalJson;
    }

    dragSerialize() {
        const data = this.toJson() as any;
        data.filePath = this.filePath;
        return {
            type: DragTypeEnum.NOTE_ITEM,
            data,
        };
    }

    static dragDeserialize(data: any) {
        try {
            const NoteItem = this.fromJson(data);
            if (data.filePath) {
                NoteItem.filePath = data.filePath;
            }
            return NoteItem;
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    static genNewJsonData() {
        const noteItemJsonData: NoteItemType = {
            title: 'Unnamed',
            content: '',
            metadata: {
                id: -1,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        };
        return noteItemJsonData;
    }
}
