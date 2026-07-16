import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import type { MimetypeNameType } from '../server/fileHelpers';
import type ItemSourceInf from '../others/ItemSourceInf';
import {
    genPdfImagesPreview,
    removePdfImagesPreview,
} from '../helper/pdfHelpers';
import PdfSlide from './PdfSlide';
import {
    BLANK_IMAGE_SLIDE_SRC,
    showStaticSlideContextMenu,
} from './appDocumentHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { handleError } from '../helper/errorHelpers';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { appLog } from '../helper/loggerHelpers';

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
        return showStaticSlideContextMenu(event, item, extraMenuItems);
    }

    async showContextMenu(_event: any) {
        appLog('Method not implemented.');
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
            const dataList = imageFileInfoList.map(
                ({ src, pageNumber, width, height }) => {
                    return new PdfSlide(this.filePath, {
                        id: pageNumber + 1,
                        imagePreviewSrc: src,
                        pdfPageNumber: pageNumber,
                        metadata: { width, height },
                    });
                },
            );
            if (dataList.length === 0) {
                return [];
            }
            const slide1 = dataList[0];
            const slide0 = new PdfSlide(this.filePath, {
                id: 0,
                imagePreviewSrc: BLANK_IMAGE_SLIDE_SRC,
                pdfPageNumber: 0,
                metadata: { width: slide1.width, height: slide1.height },
            });
            return [slide0, ...dataList];
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
