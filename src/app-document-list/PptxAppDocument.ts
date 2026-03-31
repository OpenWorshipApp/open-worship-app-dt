import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import type { MimetypeNameType } from '../server/fileHelpers';
import type ItemSourceInf from '../others/ItemSourceInf';
import { showStaticSlideContextMenu } from './appDocumentHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { handleError } from '../helper/errorHelpers';
import type { AnyObjectType, OptionalPromise } from '../helper/typeHelpers';
import { appLog } from '../helper/loggerHelpers';
import PptxSlide, { type PptxSlideType } from './PptxSlide';
import {
    getPptxData,
    getPptxToHtmlsVersion,
    removePptxHtmlsPreview,
} from '../server/pptxHelpers';

export default class PptxAppDocument
    extends AppDocumentSourceAbs
    implements ItemSourceInf<PptxSlide>
{
    static readonly mimetypeName: MimetypeNameType = 'pptx';
    isEditable = false;

    constructor(filePath: string) {
        super(filePath);
    }

    setMetadata(_metaData: AnyObjectType): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }
    setSlides(_items: PptxSlide[]): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }
    setItemById(_id: number, _item: PptxSlide): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    showSlideContextMenu(
        event: any,
        item: PptxSlide,
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
            const pptxData = await getPptxData(this.filePath);
            const pptxToHtmlsVersion = await getPptxToHtmlsVersion();
            if (
                pptxToHtmlsVersion !== null &&
                pptxData !== null &&
                pptxToHtmlsVersion !== pptxData.info.toolVersion
            ) {
                await removePptxHtmlsPreview(this.filePath);
                appLog(
                    'Pptx version mismatch:',
                    pptxToHtmlsVersion,
                    pptxData?.info.toolVersion,
                );
                return [];
            }
            if (pptxData === null) {
                return [];
            }
            const slide0 = new PptxSlide(this.filePath, {
                id: 0,
                htmlFilePath: '/assets/slide0.html',
                isDisabled: false,
                note: null,
                metadata: pptxData.info.dimensions,
                images: [],
                videos: [],
                audios: [],
            });
            const dataList = pptxData.info.slides.map(
                (
                    { htmlFilePath, isDisabled, note, images, videos, audios },
                    i,
                ) => {
                    const json: PptxSlideType = {
                        id: i + 1,
                        htmlFilePath,
                        isDisabled,
                        note,
                        metadata: pptxData.info.dimensions,
                        images: images ?? [],
                        videos: videos ?? [],
                        audios: audios ?? [],
                    };
                    return new PptxSlide(this.filePath, json);
                },
            );
            return [slide0, ...dataList];
        } catch (error) {
            handleError(error);
        }
        return [];
    }

    async getAudioFilePaths() {
        const slides = await this.getSlides();
        const audioSlideDataList = [];
        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            if (slide.audioFilePaths.length === 0) {
                continue;
            }
            audioSlideDataList.push({
                slideIndex: i,
                filePaths: slide.audioFilePaths,
            });
        }
        return audioSlideDataList;
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
        if (PptxAppDocument.checkIsThisType(item)) {
            return this.filePath === item.filePath;
        }
    }

    toJson(): AnyObjectType {
        throw new Error('Method not implemented.');
    }

    async preDelete() {
        super.preDelete();
        await removePptxHtmlsPreview(this.filePath);
    }
}
