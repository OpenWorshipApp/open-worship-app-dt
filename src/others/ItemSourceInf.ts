import { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';

export interface ItemSourceInfBasic<T> {
    getItemById(id: number): OptionalPromise<T | null>;
    setItemById(id: number, item: T): OptionalPromise<void>;
}

export default interface ItemSourceInf<T> extends ItemSourceInfBasic<T> {
    getMetadata(): OptionalPromise<AnyObjectType>;
    setMetadata(metaData: AnyObjectType): OptionalPromise<void>;

    getSlides(): OptionalPromise<T[]>;
    setSlides(items: T[]): OptionalPromise<void>;

    getSlideByIndex(index: number): OptionalPromise<T | null>;

    showContextMenu(event: any): OptionalPromise<void>;
    showSlideContextMenu(event: any, item: T): OptionalPromise<void>;
}
