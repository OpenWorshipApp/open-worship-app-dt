import { AppDocumentSourceAbs } from '../../helper/AppEditableDocumentSourceAbs';
import EditingHistoryManager from '../../editing-manager/EditingHistoryManager';
import { dirSourceSettingNames } from '../../helper/constants';
import { notifyElementHighlight } from '../../helper/domHelpers';
import { handleError } from '../../helper/errorHelpers';
import FileSource from '../../helper/FileSource';
import { cloneJson, toMaxId } from '../../helper/helpers';
import { getSetting } from '../../helper/settingHelpers';
import { type AnyObjectType } from '../../helper/typeHelpers';
import type DocumentInf from '../../others/DocumentInf';
import { type ItemSourceInfBasic } from '../../others/ItemSourceInf';
import {
    type MimetypeNameType,
    fsListFilesWithMimetype,
    createNewFileDetail,
} from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import NoteItem from './NoteItem';
import { type NoteItemType } from './noteItemHelpers';

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
                showSimpleToast(tran('Instantiating Note Item'), error.message);
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

    /**
     * One item as the note WINDOW has it -- its unsaved text when there is
     * any, the saved item otherwise.
     *
     * The LIST holds what is saved, which is what the panel is for; an EXPORT
     * is the item leaving the machine, and handing the other side a copy from
     * before the last thing typed loses that work with nothing on screen to
     * say so. Falls back to this instance's own item, so a head that cannot be
     * read costs the caller nothing.
     */
    async getEditingItemById(id: number) {
        const headNote = await Note.fromFilePathEditing(this.filePath);
        return headNote?.getItemById(id) ?? this.getItemById(id);
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
        return await this.save();
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
        // A copy is a new item, dated when it was made -- it used to carry its
        // source's dates, created and last edited alike.
        const now = new Date();
        newItem.metadata = {
            ...newItem.metadata,
            createdAt: now,
            updatedAt: now,
        };
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

    updateNoteItem(noteItem: NoteItem, isSilent = false) {
        const index = this.items.findIndex((noteItem1) => {
            return noteItem1.checkIsSame(noteItem);
        });
        if (index === -1) {
            return;
        }
        const newNoteItem = NoteItem.fromJson(noteItem.toJson(), this.filePath);
        newNoteItem.metadata.updatedAt = new Date();
        newNoteItem.note = this;
        const noteItems = this.items;
        noteItems[index] = newNoteItem;
        this.items = noteItems;
        if (!isSilent) {
            this.notifyNewNoteItemAdded(newNoteItem.id);
        }
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
        return await this.save();
    }

    async updateAndSaveNoteItem(noteItem: NoteItem, isSilent = false) {
        this.updateNoteItem(noteItem, isSilent);
        return await this.save();
    }

    async deleteNoteItem(noteItem: NoteItem) {
        this.deleteItem(noteItem);
        return await this.save();
    }

    async moveItemFrom(filePath: string, noteItem?: NoteItem) {
        if (filePath === this.filePath) {
            return;
        }
        try {
            const fromNote = await Note.fromFilePath(filePath);
            if (!fromNote) {
                showSimpleToast(
                    tran('Moving Note Item'),
                    tran('Cannot source Note'),
                );
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
                        tran('Moving Note Item'),
                        tran('Cannot find Note Item'),
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
            showSimpleToast(tran('Moving Note Item'), error.message);
        }
    }

    static async getDefault() {
        const dir = getSetting(dirSourceSettingNames.BIBLE_NOTES) ?? '';
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
                tran('Getting Default Note File'),
                tran('Fail to get default note file'),
            );
            return null;
        }
        await defaultNote.setIsOpened(true);
        if (defaultNote.items.length === 0) {
            const noteItemJsonData = NoteItem.genNewJsonData();
            noteItemJsonData.metadata.id = 0;
            const newNoteItem = new NoteItem(noteItemJsonData);
            await defaultNote.addAndSaveNoteItem(newNoteItem);
        }
        return defaultNote;
    }

    static async create(dir: string, name: string) {
        const data = Note.toJsonString({
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

    get editingHistoryManager() {
        return EditingHistoryManager.getInstance(this.filePath);
    }

    /**
     * A structural change made from the LIST -- an item added, deleted,
     * reordered or recoloured, a verse marked -- still goes straight to the
     * file: it is one press with nothing to review, and a highlight that only
     * appears once somebody presses Save is a highlight that gets lost.
     *
     * What it must not do is leave a note WINDOW's editing head behind. That
     * head carries the whole file as it was when the window last wrote to it,
     * so a Save pressed there afterwards would put a deleted item back or drop
     * a mark made since. The head is rebased instead: this file's structure,
     * keeping whatever unsaved text the head holds.
     */
    async save() {
        const jsonString = Note.toJsonString(this.toJson());
        const isSuccess = await this.fileSource.writeFileData(jsonString);
        if (isSuccess) {
            await this.rebaseEditingHistory();
        }
        return isSuccess;
    }

    /**
     * The note EDITOR writes here, never to the file. An autosave that reaches
     * the disk is how a note is lost -- the editor serializes whatever state it
     * is in, including a cleared one -- so its writes land in the editing
     * history, where they are undoable and restorable, and the human presses
     * Save.
     */
    async addEditingHistory() {
        await this.editingHistoryManager.addHistory(
            Note.toJsonString(this.toJson()),
        );
    }

    /**
     * One note ITEM's text, written onto whatever the head holds NOW.
     *
     * Rebased every time rather than written from this instance, because a
     * second note window on the same file writes into the SAME history and its
     * own copy of the note is as old as the moment it opened -- so writing that
     * copy straight out would drop whatever the other window has typed since,
     * and the list's structural changes with it. This instance is moved on to
     * match, so the next write starts from the same place.
     */
    async addItemEditingHistory(noteItem: NoteItem) {
        const headNote =
            (await Note.fromFilePathEditing(this.filePath)) ?? this;
        headNote.updateNoteItem(noteItem, true);
        await headNote.addEditingHistory();
        this.originalJson = headNote.toJson();
    }

    /**
     * Bring a leftover editing head into step for ONE item whose text was just
     * written to the FILE from outside a note window.
     *
     * `save()` rebases the other way round on purpose: a note window's unsaved
     * typing has to survive the list adding, deleting or recolouring an item.
     * That rule assumes the WINDOW is the only thing that ever writes item
     * text, which is true of the app itself and not of the agent note tools --
     * they write the file (refusing while a window is open), and the leftover
     * head then holds OLDER words than the file does. The window shows the
     * head, and so does an export, so without this the change reads as never
     * having happened.
     *
     * Only ever for a file that already HAS a history: a note nobody has
     * opened a window on must not gain one here -- its first entry is a whole
     * clone of the file, which for a 300KB note is 300KB for nothing.
     */
    async syncItemEditingHistory(noteItem: NoteItem) {
        if (!(await this.editingHistoryManager.checkHasHistories())) {
            return;
        }
        await this.addItemEditingHistory(noteItem);
    }

    /**
     * INDENTED, and that is a performance decision, not a taste one.
     *
     * The editing history keeps a LINE diff of every step
     * (`EditingHistoryManager`'s `createPatch`). Written as one long line, a
     * note file has no lines to diff -- a single typed letter came back as
     * "replace the whole file", so one word of typing left 5.6MB of patches
     * beside a 300KB file. Indented, only the edited item's own `content` line
     * changes, and the file itself grows by a few hundred bytes. The saved file
     * is written this way too, because the history's first entry is a CLONE of
     * it and a format that disagreed would diff the whole file once more.
     */
    static toJsonString(jsonData: NoteType) {
        return JSON.stringify(jsonData, null, 2);
    }

    private async rebaseEditingHistory() {
        const editingHistoryManager = this.editingHistoryManager;
        // One cheap stat for the usual case: no note window has ever been
        // opened on this file, so there is nothing to keep in step.
        if (!(await editingHistoryManager.checkHasHistories())) {
            return;
        }
        const headJsonString = await editingHistoryManager.getCurrentHistory();
        const headNote = Note.fromJsonString(this.filePath, headJsonString);
        if (headNote === null) {
            return;
        }
        const rebasedNote = this.clone();
        rebasedNote.takeItemContentsFrom(headNote);
        const rebasedJsonString = Note.toJsonString(rebasedNote.toJson());
        // Already in step -- appending here would only make the window's Save
        // button light up over a change nobody made.
        if (rebasedJsonString === headJsonString) {
            return;
        }
        await editingHistoryManager.addHistory(rebasedJsonString);
    }

    /**
     * Only the items' own TEXT is taken -- the list owns which items exist, in
     * what order and with what titles; a note window owns what is typed inside
     * one. A verse item's `content` is its verse reference rather than editor
     * text, so it is left alone.
     */
    private takeItemContentsFrom(otherNote: Note) {
        const otherItemMap = new Map(
            otherNote.items.map((item) => [item.id, item]),
        );
        const noteItems = this.items;
        for (const noteItem of noteItems) {
            const otherItem = otherItemMap.get(noteItem.id);
            if (otherItem === undefined || noteItem.isVerseItem) {
                continue;
            }
            noteItem.content = otherItem.content;
        }
        this.items = noteItems;
    }

    historyUndo() {
        return this.editingHistoryManager.undo();
    }

    historyRedo() {
        return this.editingHistoryManager.redo();
    }

    historyDiscard() {
        return this.editingHistoryManager.discard();
    }

    /**
     * What the note window's Save press does: the editing head becomes the
     * file. NOT `save()`, which writes this in-memory instance -- the head is
     * what the editor has been writing into and what its Undo walks.
     */
    saveEditingHistory() {
        return this.editingHistoryManager.save();
    }

    notifyNewNoteItemAdded(noteItemId: number) {
        notifyElementHighlight(() => {
            return document.querySelector(
                `[data-note-item-id="${this.fileSource.name}-${noteItemId}"]`,
            );
        });
    }

    private static fromJsonString(filePath: string, jsonString: string | null) {
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

    static async fromFilePath(filePath: string) {
        const note = this.fromJsonString(
            filePath,
            await FileSource.readFileData(filePath),
        );
        if (note !== null) {
            return note;
        }
        // RECOVERY, and only that: the file is missing or no longer readable as
        // a note, and the editing head is the last copy of it anything here
        // still has. A readable file never reaches this line, so nothing about
        // the ordinary case changes.
        return this.fromFilePathEditing(filePath);
    }

    /**
     * The note as the note WINDOW has it: the editing head while something is
     * unsaved, the file on disk otherwise. Only that window reads this way --
     * the Bible Notes list shows what is saved, which is what the panel is for.
     */
    static async fromFilePathEditing(filePath: string) {
        const editingHistoryManager =
            EditingHistoryManager.getInstance(filePath);
        return this.fromJsonString(
            filePath,
            await editingHistoryManager.getCurrentHistory(),
        );
    }

    async reload() {
        const newNote = await Note.fromFilePath(this.filePath);
        if (newNote === null) {
            return;
        }
        this.originalJson = newNote.toJson();
    }

    async reloadEditing() {
        const newNote = await Note.fromFilePathEditing(this.filePath);
        if (newNote === null) {
            return;
        }
        this.originalJson = newNote.toJson();
    }
}
