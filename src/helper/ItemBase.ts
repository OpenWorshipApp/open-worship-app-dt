import ColorNoteInf from './ColorNoteInf';
import FileSource from './FileSource';
import { cloneJson } from './helpers';
import { AnyObjectType } from './typeHelpers';

export abstract class ItemBase implements ColorNoteInf {
    abstract id: number;
    abstract filePath?: string | null;
    protected static copiedItem: ItemBase | null = null;

    jsonError: any;

    get isError() {
        return !!this.jsonError;
    }

    abstract get metadata(): AnyObjectType;

    abstract set metadata(metadata: AnyObjectType);

    checkIsSame(item: ItemBase) {
        return this.id === item.id;
    }

    async getColorNote() {
        if (this.metadata?.['colorNote']) {
            return this.metadata['colorNote'];
        }
        return null;
    }

    async setColorNote(c: string | null) {
        const metadata = cloneJson(this.metadata);
        metadata['colorNote'] = c;
        this.metadata = metadata;
        this.save();
    }

    get fileSource() {
        if (!this.filePath) {
            return null;
        }
        return FileSource.getInstance(this.filePath);
    }

    get isSelectedEditing() {
        throw new Error('Method not implemented.');
    }

    set isSelectedEditing(_b: boolean) {
        throw new Error('Method not implemented.');
    }

    async save(_?: any): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    abstract clone(): ItemBase;

    toJson(): AnyObjectType {
        throw new Error('Method not implemented.');
    }
    static fromJson(_json: AnyObjectType, _filePath?: string): any {
        throw new Error('Method not implemented.');
    }
    static fromJsonError(_json: AnyObjectType, _filePath?: string): any {
        throw new Error('Method not implemented.');
    }

    static validate(_json: AnyObjectType) {
        throw new Error('Method not implemented.');
    }
}
