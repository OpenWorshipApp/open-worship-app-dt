import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { MimetypeNameType } from '../server/fileHelpers';
import ItemSourceInf from '../others/ItemSourceInf';
import {
    genPdfImagesPreview,
    removePdfImagesPreview,
} from '../helper/pdfHelpers';
import PdfSlide from './PdfSlide';
import { showPdfDocumentContextMenu } from './appDocumentHelpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { handleError } from '../helper/errorHelpers';
import { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';

export default class PdfAppDocument
    extends AppDocumentSourceAbs
    implements ItemSourceInf<PdfSlide>
{
    static readonly mimetypeName: MimetypeNameType = 'pdf';
    isEditable = false;

    constructor(filePath: string) {
        super(filePath);
    }

    setMetadata(_metaData: AnyObjectType): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }
    setSlides(_items: PdfSlide[]): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }
    setItemById(_id: number, _item: PdfSlide): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    showSlideContextMenu(
        event: any,
        item: PdfSlide,
        extraMenuItems: ContextMenuItemType[] = [],
    ) {
        showPdfDocumentContextMenu(event, item, extraMenuItems);
    }

    async showContextMenu(_event: any) {
        throw new Error('Method not implemented.');
    }

    async getMetadata() {
        return {};
    }

    async getSlides() {
        try {
            const imageFileInfoList = await genPdfImagesPreview(this.filePath);
            if (imageFileInfoList === null) {
                return [];
            }
            return imageFileInfoList.map(
                ({ src, pageNumber, width, height }) => {
                    return new PdfSlide(this.filePath, {
                        id: pageNumber,
                        imagePreviewSrc: src,
                        pdfPageNumber: pageNumber,
                        metadata: { width, height },
                    });
                },
            );
        } catch (error) {
            handleError(error);
        }
        return [];
    }

    async getSlideByIndex(index: number) {
        const items = await this.getSlides();
        return items[index] ?? null;
    }

    async getItemById(id: number) {
        const items = await this.getSlides();
        return items.find((item) => item.id === id) ?? null;
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }

    static checkIsThisType(item: any) {
        return item instanceof this;
    }

    checkIsSame(item: any) {
        if (PdfAppDocument.checkIsThisType(item)) {
            return this.filePath === item.filePath;
        }
    }

    toJson(): AnyObjectType {
        throw new Error('Method not implemented.');
    }

    async preDelete() {
        super.preDelete();
        removePdfImagesPreview(this.filePath);
    }
}
