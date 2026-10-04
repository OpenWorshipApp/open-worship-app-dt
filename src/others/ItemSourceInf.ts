import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';

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

    /**
     * The document's own menu -- its slides preview's ⋮ and a right-click on
     * the previewer's empty area. `extraMenuItems` are rows the previewer adds
     * for every kind of document alike (its transition), appended last.
     */
    showContextMenu(
        event: any,
        extraMenuItems?: ContextMenuItemType[],
    ): OptionalPromise<void>;
    showSlideContextMenu(event: any, item: T): OptionalPromise<void>;
}
