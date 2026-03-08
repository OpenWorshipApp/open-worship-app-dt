import { AppDocumentSourceAbs } from '../../helper/AppEditableDocumentSourceAbs';
import { defaultDataDirNames } from '../../helper/constants';
import { notifyNewElementAdded } from '../../helper/domHelpers';
import { handleError } from '../../helper/errorHelpers';
import FileSource from '../../helper/FileSource';
import { cloneJson, toMaxId } from '../../helper/helpers';
import { getSetting } from '../../helper/settingHelpers';
import { AnyObjectType } from '../../helper/typeHelpers';
import DocumentInf from '../../others/DocumentInf';
import { ItemSourceInfBasic } from '../../others/ItemSourceInf';
import {
    MimetypeNameType,
    fsListFilesWithMimetype,
    createNewFileDetail,
} from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import NoteItem from './NoteItem';
import { NoteItemType } from './noteItemHelpers';

export type NoteType = {
    items: NoteItemType[];
    metadata: AnyObjectType;
};
export default class Note
    extends AppDocumentSourceAbs
    implements DocumentInf, ItemSourceInfBasic<NoteItem>
{
    static readonly mimetypeName: MimetypeNameType = 'note';
    static readonly DEFAULT_FILE_NAME = 'Default';
    private originalJson: NoteType;

    constructor(filePath: string, json: NoteType) {
        super(filePath);
        this.originalJson = cloneJson(json);
    }

    static fromJson(filePath: string, json: any) {
        this.validate(json);
        return new this(filePath, json);
    }

    get metadata() {
        return this.originalJson.metadata;
    }

    get itemsLength() {
        return this.originalJson.items.length;
    }

    get items() {
        return this.originalJson.items.map((json) => {
            try {
                const noteItem = NoteItem.fromJson(json, this.filePath);
                noteItem.note = this;
                return noteItem;
            } catch (error: any) {
                showSimpleToast('Instantiating Note Item', error.message);
            }
            return NoteItem.fromJsonError(json, this.filePath);
        });
    }

    set items(newNoteItems: NoteItem[]) {
        const noteItems = newNoteItems.map((item) => item.toJson());
        this.originalJson.items = noteItems;
    }

    getItemById(id: number) {
        return (
            this.items.find((item) => {
                return item.id === id;
            }) || null
        );
    }

    setItemById(id: number, item: NoteItem) {
        const items = this.items;
        const newItems = items.map((item1) => {
            if (item1.id === id) {
                return item;
            }
            return item1;
        });
        this.items = newItems;
    }

    get maxItemId() {
        if (this.items.length) {
            const ids = this.items.map((item) => item.id);
            return toMaxId(ids);
        }
        return 0;
    }

    static checkIsDefault(filePath: string) {
        const fileSource = FileSource.getInstance(filePath);
        return fileSource.name === this.DEFAULT_FILE_NAME;
    }

    get isDefault() {
        return Note.checkIsDefault(this.filePath);
    }

    get isOpened() {
        return this.metadata['isOpened'] === true;
    }

    async setIsOpened(isOpened: boolean) {
        this.metadata['isOpened'] = isOpened;
        await this.save();
    }

    static async addNoteItemToDefault(noteItem: NoteItem) {
        const defaultNote = await this.getDefault();
        if (defaultNote !== null) {
            defaultNote.addNoteItem(noteItem);
            if (await defaultNote.save()) {
                return noteItem;
            }
        }
        return null;
    }

    duplicate(index: number) {
        const noteItems = this.items;
        const newItem = noteItems[index].clone();
        newItem.id = this.maxItemId + 1;
        noteItems.splice(index + 1, 0, newItem);
        this.items = noteItems;
    }

    deleteItemAtIndex(index: number): NoteItem | null {
        const noteItems = this.items;
        const removedItems = noteItems.splice(index, 1);
        this.items = noteItems;
        return removedItems[0] ?? null;
    }

    deleteItem(noteItem: NoteItem) {
        const index = this.items.findIndex((noteItem1) => {
            return noteItem1.id === noteItem.id;
        });
        if (index === -1) {
            return;
        }
        this.deleteItemAtIndex(index);
    }

    addNoteItem(noteItem: NoteItem) {
        const newNoteItem = NoteItem.fromJson(noteItem.toJson(), this.filePath);
        newNoteItem.id = this.maxItemId + 1;
        const noteItems = this.items;
        noteItems.push(newNoteItem);
        this.items = noteItems;
        this.notifyNewNoteItemAdded(newNoteItem.id);
    }

    updateNoteItem(noteItem: NoteItem) {
        const index = this.items.findIndex((noteItem1) => {
            return noteItem1.checkIsSame(noteItem);
        });
        if (index === -1) {
            return;
        }
        const newNoteItem = NoteItem.fromJson(noteItem.toJson(), this.filePath);
        newNoteItem.note = this;
        const noteItems = this.items;
        noteItems[index] = newNoteItem;
        this.items = noteItems;
        this.notifyNewNoteItemAdded(newNoteItem.id);
    }

    swapItems(fromIndex: number, toIndex: number) {
        const noteItems = this.items;
        if (
            fromIndex < 0 ||
            fromIndex >= noteItems.length ||
            toIndex < 0 ||
            toIndex >= noteItems.length
        ) {
            return;
        }
        const fromItem = noteItems[fromIndex];
        const toItem = noteItems[toIndex];
        noteItems[fromIndex] = toItem;
        noteItems[toIndex] = fromItem;
        this.items = noteItems;
    }

    getItemIndex(noteItem: NoteItem) {
        return this.items.findIndex((item) => {
            return item.id === noteItem.id;
        });
    }

    moveItemToIndex(noteItem: NoteItem, toIndex: number) {
        const noteItems = this.items;
        if (toIndex < 0 || toIndex >= noteItems.length) {
            return;
        }
        const fromIndex = this.getItemIndex(noteItem);
        if (fromIndex === -1 || fromIndex === toIndex) {
            return;
        }
        const [item] = noteItems.splice(fromIndex, 1);
        noteItems.splice(toIndex, 0, item);
        this.items = noteItems;
    }

    async addAndSaveNoteItem(noteItem: NoteItem) {
        this.addNoteItem(noteItem);
        await this.save();
    }

    async updateAndSaveNoteItem(noteItem: NoteItem) {
        this.updateNoteItem(noteItem);
        await this.save();
    }

    async deleteNoteItem(noteItem: NoteItem) {
        this.deleteItem(noteItem);
        await this.save();
    }

    async moveItemFrom(filePath: string, noteItem?: NoteItem) {
        if (filePath === this.filePath) {
            return;
        }
        try {
            const fromNote = await Note.fromFilePath(filePath);
            if (!fromNote) {
                showSimpleToast('Moving Note Item', 'Cannot source Note');
                return;
            }
            const backupNoteItems = fromNote.items;
            let targetNoteItems: NoteItem[] = backupNoteItems;
            const index =
                noteItem === undefined
                    ? undefined
                    : fromNote.items.findIndex((item) => {
                          return item.id === noteItem.id;
                      });
            if (index !== undefined) {
                if (!backupNoteItems[index]) {
                    showSimpleToast(
                        'Moving Note Item',
                        'Cannot find Note Item',
                    );
                    return;
                }
                targetNoteItems = [backupNoteItems[index]];
            }
            for (const item of targetNoteItems) {
                await this.addAndSaveNoteItem(item);
                await fromNote.deleteNoteItem(item);
            }
        } catch (error: any) {
            showSimpleToast('Moving Note Item', error.message);
        }
    }

    static async getDefault() {
        const dir = getSetting(defaultDataDirNames.NOTES) ?? '';
        if (!dir) {
            return null;
        }
        const filePaths = (await fsListFilesWithMimetype(dir, 'note')) ?? [];
        if (filePaths === null) {
            return null;
        }
        for (const filePath of filePaths) {
            if (Note.checkIsDefault(filePath)) {
                return Note.fromFilePath(filePath);
            }
        }
        const defaultFileSource = await this.create(
            dir,
            Note.DEFAULT_FILE_NAME,
        );
        const filePath = defaultFileSource?.filePath ?? null;
        const defaultNote = filePath ? await Note.fromFilePath(filePath) : null;
        if (!defaultNote) {
            showSimpleToast(
                'Getting Default Note File',
                'Fail to get default note file',
            );
            return null;
        }
        await defaultNote.setIsOpened(true);
        return defaultNote;
    }

    static async create(dir: string, name: string) {
        const data = JSON.stringify({
            metadata: super.genMetadata(),
            items: [],
        });
        const filePath = await createNewFileDetail(
            dir,
            name,
            data,
            this.mimetypeName,
        );
        if (filePath !== null) {
            return FileSource.getInstance(filePath);
        }
        return null;
    }

    clone() {
        return Note.fromJson(this.filePath, this.toJson());
    }

    empty() {
        this.items = [];
    }

    toJson() {
        return this.originalJson;
    }

    async save() {
        const jsonData = this.toJson();
        const jsonString = JSON.stringify(jsonData);
        return await this.fileSource.writeFileData(jsonString);
    }

    notifyNewNoteItemAdded(noteItemId: number) {
        notifyNewElementAdded(() => {
            return document.querySelector(
                `[data-note-item-id="${this.fileSource.name}-${noteItemId}"]`,
            );
        });
    }

    static async fromFilePath(filePath: string) {
        const jsonString = await FileSource.readFileData(filePath);
        if (!jsonString) {
            return null;
        }
        try {
            const jsonData = JSON.parse(jsonString);
            return this.fromJson(filePath, jsonData);
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    async reload() {
        const newNote = await Note.fromFilePath(this.filePath);
        if (newNote === null) {
            return;
        }
        this.originalJson = newNote.toJson();
    }
}
