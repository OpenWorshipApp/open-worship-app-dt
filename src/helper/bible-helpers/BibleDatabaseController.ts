import appProvider from '../../server/appProvider';
import type { ItemParamsType } from '../../db/databaseHelpers';
import { IndexedDbController } from '../../db/databaseHelpers';

const { base64Encode } = appProvider.appUtils;

export default class BibleDatabaseController extends IndexedDbController {
    get storeName() {
        return 'bible';
    }

    static instantiate() {
        return new this();
    }

    async addItem(item: ItemParamsType) {
        item.id = base64Encode(item.id);
        return super.addItem(item);
    }

    async getItem<T>(id: string) {
        const b64Id = base64Encode(id);
        return super.getItem<T>(b64Id);
    }

    async getKeys(bibleKey: string) {
        return super.getKeys(bibleKey);
    }

    static async getInstance() {
        const instance = await super.getInstance();
        return instance as any as BibleDatabaseController;
    }
}
