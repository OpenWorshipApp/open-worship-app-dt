import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';

export default interface ItemSourceInf<T> {
    getMetadata(): OptionalPromise<AnyObjectType>;

    getItems(): OptionalPromise<T[]>;

    getItemByIndex(index: number): OptionalPromise<T | null>;

    getItemById(id: number): OptionalPromise<T | null>;
}
