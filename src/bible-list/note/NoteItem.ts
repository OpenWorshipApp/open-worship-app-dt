import DragInf, { DragTypeEnum } from '../../helper/DragInf';
import { handleError } from '../../helper/errorHelpers';
import { cloneJson } from '../../helper/helpers';
import { ItemBase } from '../../helper/ItemBase';
import { appError } from '../../helper/loggerHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';
import DocumentInf from '../../others/DocumentInf';
import { ItemSourceInfBasic } from '../../others/ItemSourceInf';
import { NoteItemType } from './noteItemHelpers';

export default class NoteItem
    extends ItemBase
    implements DragInf<NoteItemType>
{
    private originalJson: NoteItemType;
    _id: number;
    filePath?: string;
    note: (ItemSourceInfBasic<NoteItem> & DocumentInf) | null = null;

    constructor(
        id: number,
        json: NoteItemType,
        filePath?: string,
        note?: (ItemSourceInfBasic<NoteItem> & DocumentInf) | null,
    ) {
        super();
        this._id = id;
        this.filePath = filePath;
        this.originalJson = cloneJson(json);
        this.note = note ?? null;
    }

    get id() {
        return this._id;
    }
    set id(id: number) {
        this._id = id;
        this.originalJson.id = id;
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
    set metadata(metadata: AnyObjectType) {
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
        return new this(json.id, json, filePath);
    }

    static fromJsonError(json: NoteItemType, filePath?: string) {
        const item = new this(
            -1,
            {
                id: -1,
                content: '',
                metadata: {},
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
            id: this.id,
            content: this.content,
            metadata: this.metadata,
        };
    }

    static validate(json: AnyObjectType) {
        if (
            typeof json.id !== 'number' ||
            (json.metadata && typeof json.metadata !== 'object')
        ) {
            appError(json);
            throw new Error('Invalid note item data');
        }
    }

    clone(isKeepId = false) {
        const Class = this.constructor as typeof NoteItem;
        if (!isKeepId) {
            return Class.fromJson({ ...this.toJson(), id: -1 }, this.filePath);
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
}
