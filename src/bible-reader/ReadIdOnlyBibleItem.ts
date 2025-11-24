import BibleItem from '../bible-list/BibleItem';

export class ReadIdOnlyBibleItem extends BibleItem {
    get id() {
        return super.id;
    }
    set id(_id: number) {
        throw new Error('ReadOnlyBibleItem: id cannot be set');
    }
}
