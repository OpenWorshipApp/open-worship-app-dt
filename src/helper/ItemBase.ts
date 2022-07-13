import FileSource from '../helper/FileSource';
import { setSetting, getSetting } from '../helper/settingHelper';
import ColorNoteInf from './ColorNoteInf';
import { MetaDataType } from './fileHelper';

export abstract class ItemBase implements ColorNoteInf {
    abstract id: number;
    abstract fileSource?: FileSource | null;
    abstract metadata?: MetaDataType;
    static SELECT_SETTING_NAME = '';
    jsonError: any;
    static _objectId = 0;
    _objectId: number;
    constructor() {
        this._objectId = ItemBase._objectId++;
    }
    get isError() {
        return !!this.jsonError;
    }
    get colorNote() {
        if (this.metadata && this.metadata['colorNote']) {
            return this.metadata['colorNote'];
        }
        return null;
    }
    set colorNote(c: string | null) {
        this.metadata = this.metadata || {};
        this.metadata['colorNote'] = c;
        this.save();
    }
    get isSelectedEditing() {
        throw new Error('Method not implemented.');
    }
    set isSelectedEditing(b: boolean) {
        throw new Error('Method not implemented.');
    }
    get isSelected() {
        throw new Error('Method not implemented.');
    }
    set isSelected(b: boolean) {
        throw new Error('Method not implemented.');
    }
    async save(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    clone() {
        throw new Error('Method not implemented.');
    }
    toJson() {
        throw new Error('Method not implemented.');
    }
    static fromJson(json: any, fileSource?: FileSource): any {
        throw new Error('Method not implemented.');
    }
    static fromJsonError(json: any, fileSource?: FileSource): any {
        throw new Error('Method not implemented.');
    }
    static validate(json: any) {
        throw new Error('Method not implemented.');
    }
    static _toSelectedItemSetting(fileSource: FileSource | null, id: number | string | null) {
        if (fileSource === null || id === null) {
            return null;
        }
        return `${fileSource.filePath},${id}`;
    }
    toSelectedItemSetting() {
        if (!this.fileSource) {
            return null;
        }
        return ItemBase._toSelectedItemSetting(this.fileSource, this.id);
    }
    static extractItemSetting(selectedItemSetting: string | null) {
        if (selectedItemSetting === null) {
            return null;
        }
        const [bibleFilePath, id] = selectedItemSetting.split(',');
        if (isNaN(Number(id))) {
            return null;
        }
        return {
            fileSource: FileSource.genFileSource(bibleFilePath),
            id: Number(id),
        };
    }
    static _setItemSetting(settingName: string, item: ItemBase | null) {
        if (item === null) {
            setSetting(settingName, '');
            return;
        }
        const selectedStr = item.toSelectedItemSetting();
        if (selectedStr !== null) {
            setSetting(settingName, selectedStr);
            return true;
        }
        return false;
    }
    static _getSettingResult(settingName: string) {
        const selectedStr = getSetting(settingName, '');
        return this.extractItemSetting(selectedStr);
    }
    static setSelectedItem(item: ItemBase | null) {
        return this._setItemSetting(this.SELECT_SETTING_NAME, item);
    }
    static getSelectedResult() {
        return this._getSettingResult(this.SELECT_SETTING_NAME);
    }
    static setSelectedEditingItem(item: ItemBase | null) {
        return this._setItemSetting(`${this.SELECT_SETTING_NAME}-editing`, item);
    }
    static getSelectedEditingResult() {
        return this._getSettingResult(`${this.SELECT_SETTING_NAME}-editing`);
    }
    static async getSelectedItem(): Promise<ItemBase | null | undefined> {
        throw new Error('Method not implemented.');
    }
}