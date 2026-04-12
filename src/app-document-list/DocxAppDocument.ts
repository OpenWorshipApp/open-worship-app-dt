import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import type { MimetypeNameType } from '../server/fileHelpers';
import type ItemSourceInf from '../others/ItemSourceInf';
import { showStaticSlideContextMenu } from './appDocumentHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { handleError } from '../helper/errorHelpers';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { appLog } from '../helper/loggerHelpers';
import DocxSlide, { type DocxSlideType } from './DocxSlide';
import {
    getDocxData,
    getDocxToHtmlsVersion,
    removeDocxHtmlsPreview,
} from '../server/docxHelpers';

export default class DocxAppDocument
    extends AppDocumentSourceAbs
    implements ItemSourceInf<DocxSlide>
{
    static readonly mimetypeName: MimetypeNameType = 'docx';
    isEditable = false;

    constructor(filePath: string) {
        super(filePath);
    }

    setMetadata(_metaData: AnyObjectType): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    setSlides(_items: DocxSlide[]): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    setItemById(_id: number, _item: DocxSlide): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    showSlideContextMenu(
        event: any,
        item: DocxSlide,
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
            const docxData = await getDocxData(this.filePath);
            const docxToHtmlsVersion = await getDocxToHtmlsVersion();
            if (
                docxToHtmlsVersion !== null &&
                docxData !== null &&
                docxToHtmlsVersion !== docxData.info.toolVersion
            ) {
                await removeDocxHtmlsPreview(this.filePath);
                appLog(
                    'Docx version mismatch:',
                    docxToHtmlsVersion,
                    docxData.info.toolVersion,
                );
                return [];
            }
            if (docxData === null) {
                return [];
            }
            const dataList = docxData.info.pages.map(
                ({ htmlFilePath, html, width, height }, index) => {
                    const json: DocxSlideType = {
                        id: index + 1,
                        htmlFilePath,
                        html,
                        metadata: { width, height },
                    };
                    return new DocxSlide(this.filePath, json);
                },
            );
            if (dataList.length === 0) {
                return [];
            }
            const slide1 = dataList[0];
            const slide0 = new DocxSlide(this.filePath, {
                id: 0,
                htmlFilePath: '/assets/slide0.html',
                html: '',
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
        if (DocxAppDocument.checkIsThisType(item)) {
            return this.filePath === item.filePath;
        }
        return false;
    }

    toJson(): AnyObjectType {
        throw new Error('Method not implemented.');
    }

    async preDelete() {
        super.preDelete();
        await removeDocxHtmlsPreview(this.filePath);
    }
}
