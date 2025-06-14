import Slide, { SlideType } from './Slide';
import AppDocumentSourceAbs from '../helper/DocumentSourceAbs';
import { showAppDocumentContextMenu } from './appDocumentHelpers';
import { AnyObjectType, checkIsSameValues, toMaxId } from '../helper/helpers';
import { MimetypeNameType } from '../server/fileHelpers';
import { DisplayType } from '../_screen/screenHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import EditingHistoryManager from '../others/EditingHistoryManager';
import ItemSourceInf from '../others/ItemSourceInf';
import { OptionalPromise } from '../others/otherHelpers';
import { handleError } from '../helper/errorHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';

type AppDocumentMetadataType = {
    app: string;
    fileVersion: number;
    initDate: string;
    lastEditDate?: string;
};
export type AppDocumentType = {
    items: SlideType[];
    metadata: AppDocumentMetadataType;
};

export type WrongDimensionType = {
    slide: {
        width: number;
        height: number;
    };
    display: {
        width: number;
        height: number;
    };
};

export default class AppDocument
    extends AppDocumentSourceAbs
    implements ItemSourceInf<Slide>
{
    static readonly mimetypeName: MimetypeNameType = 'slide';

    constructor(filePath: string) {
        super(filePath);
    }

    setItemById(_id: number, _slide: Slide): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    get editingHistoryManager() {
        return EditingHistoryManager.getInstance(this.filePath);
    }

    static fromDataText(dataText: string) {
        try {
            const jsonData = JSON.parse(dataText);
            this.validate(jsonData);
            return jsonData as AppDocumentType;
        } catch (error) {
            handleError(error);
        }
        return null;
    }

    async getJsonData(isOriginal = false): Promise<AppDocumentType | null> {
        const jsonText = isOriginal
            ? await this.editingHistoryManager.getOriginalData()
            : await this.editingHistoryManager.getCurrentHistory();
        if (jsonText === null) {
            return null;
        }
        const jsonData = AppDocument.fromDataText(jsonText);
        if (jsonData === null) {
            return null;
        }
        return jsonData;
    }

    async setJsonData(jsonData: AppDocumentType) {
        const jsonString = AppDocument.toJsonString(jsonData);
        this.editingHistoryManager.addHistory(jsonString);
    }

    async getMetadata() {
        const jsonData = await this.getJsonData();
        return jsonData?.metadata ?? {};
    }

    async setMetadata(metadata: AppDocumentMetadataType) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        jsonData.metadata = metadata;
        await this.setJsonData(jsonData);
    }

    async checkSlideIsChanged(
        index: number,
        slide: Slide,
        jsonItems: SlideType[],
    ) {
        const originalSlide = jsonItems[index];
        slide.isChanged =
            originalSlide === undefined ||
            !checkIsSameValues(slide.toJson(), originalSlide);
    }

    async getItems() {
        let jsonData = await this.getJsonData();
        if (jsonData === null) {
            return [];
        }
        const slides = jsonData.items.map((json: any) => {
            try {
                return Slide.fromJson(json, this.filePath);
            } catch (error: any) {
                showSimpleToast('Instantiating Slide', error.message);
            }
            return Slide.fromJsonError(json, this.filePath);
        });
        jsonData = await this.getJsonData(true);
        if (jsonData !== null) {
            slides.forEach((slide, index) => {
                this.checkSlideIsChanged(index, slide, jsonData.items);
            });
        }
        return slides;
    }

    async setItems(newItems: Slide[]) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        jsonData.items = newItems.map((item) => {
            return item.toJson();
        });
        await this.setJsonData(jsonData);
    }

    async getMaxItemId() {
        const slides = await this.getItems();
        if (slides.length) {
            const ids = slides.map((slide) => {
                return slide.id;
            });
            return toMaxId(ids);
        }
        return 0;
    }

    async getItemByIndex(index: number) {
        const slides = await this.getItems();
        return slides[index] ?? null;
    }

    async duplicateSlide(slide: Slide) {
        const slides = await this.getItems();
        const index = slides.findIndex((slide1) => {
            return slide1.checkIsSame(slide);
        });
        if (index === -1) {
            showSimpleToast('Duplicate Slide', 'Unable to find a slide');
            return;
        }
        const newSlide = slide.clone();
        if (newSlide !== null) {
            const maxSlideId = await this.getMaxItemId();
            newSlide.id = maxSlideId + 1;
            slides.splice(index + 1, 0, newSlide);
            await this.setItems(slides);
        }
    }

    async moveSlide(id: number, toIndex: number, isLeft: boolean) {
        const slides = await this.getItems();
        const fromIndex: number = slides.findIndex((slide) => {
            return slide.id === id;
        });
        if (fromIndex > toIndex && !isLeft) {
            toIndex++;
        }
        const target = slides.splice(fromIndex, 1)[0];
        slides.splice(toIndex, 0, target);
        await this.setItems(slides);
        this.fileSource.fireUpdateEvent(slides);
    }

    async addSlide(slide: Slide) {
        const slides = await this.getItems();
        const maxSlideId = await this.getMaxItemId();
        slide.id = maxSlideId + 1;
        slide.filePath = this.filePath;
        slides.push(slide);
        await this.setItems(slides);
    }

    async addNewSlide() {
        const maxSlideId = await this.getMaxItemId();
        const slide = Slide.defaultSlideData(maxSlideId + 1);
        const { width, height } = Slide.getDefaultDim();
        const json = {
            id: slide.id,
            metadata: {
                width,
                height,
            },
            canvasItems: [], // TODO: add default canvas item
        };
        const newSlide = new Slide(this.filePath, json);
        await this.addSlide(newSlide);
    }

    async deleteSlide(slide: Slide) {
        const slides = await this.getItems();
        const newSlides = slides.filter((newSlide) => {
            return newSlide.id !== slide.id;
        });
        await this.setItems(newSlides);
    }

    static toWrongDimensionString({ slide, display }: WrongDimensionType) {
        return (
            `⚠️ slide:${slide.width}x${slide.height} ` +
            `display:${display.width}x${display.height}`
        );
    }

    async getIsWrongDimension(display: DisplayType) {
        const slides = await this.getItems();
        const foundSlide = slides.find((slide) => {
            return slide.checkIsWrongDimension(display);
        });
        if (foundSlide) {
            return {
                slide: foundSlide,
                display: {
                    width: display.bounds.width,
                    height: display.bounds.height,
                },
            } as WrongDimensionType;
        }
        return null;
    }

    static validate(json: AnyObjectType): void {
        if (
            typeof json.items !== 'object' ||
            !Array.isArray(json.items) ||
            typeof json.metadata !== 'object' ||
            typeof json.metadata.app !== 'string' ||
            typeof json.metadata.fileVersion !== 'number' ||
            typeof json.metadata.initDate !== 'string' ||
            (json.metadata.lastEditDate !== undefined &&
                typeof json.metadata.lastEditDate !== 'string')
        ) {
            throw new Error(
                `Invalid app document data json:${JSON.stringify(json)}`,
            );
        }
        json.items = json.items ?? [];
        for (const item of json.items) {
            Slide.validate(item);
        }
    }

    async fixSlideDimension(display: DisplayType) {
        const slides = await this.getItems();
        const newSlidesJson = await Promise.all(
            slides.map((slide) => {
                return (async () => {
                    const json = slide.toJson();
                    if (slide.checkIsWrongDimension(display)) {
                        json.metadata.width = display.bounds.width;
                        json.metadata.height = display.bounds.height;
                    }
                    return json;
                })();
            }),
        );
        const jsonString = AppDocument.toJsonString(newSlidesJson);
        this.editingHistoryManager.addHistory(jsonString);
    }

    showItemContextMenu(
        event: any,
        slide: Slide,
        extraMenuItems: ContextMenuItemType[] = [],
    ) {
        showAppDocumentContextMenu(event, this, slide, extraMenuItems);
    }

    async showContextMenu(event: any) {
        const copiedSlides = await AppDocument.getCopiedSlides();
        showAppContextMenu(event, [
            {
                menuElement: 'New Slide',
                onSelect: () => {
                    this.addNewSlide();
                },
            },
            ...(copiedSlides.length > 0
                ? [
                      {
                          menuElement: 'Paste',
                          onSelect: () => {
                              for (const copiedSlide of copiedSlides) {
                                  this.addSlide(copiedSlide);
                              }
                          },
                      },
                  ]
                : []),
        ]);
    }

    async getItemById(id: number) {
        const slides = await this.getItems();
        return (
            slides.find((slide) => {
                return slide.id === id;
            }) ?? null
        );
    }

    static async create(dir: string, name: string) {
        return super.create(dir, name, [Slide.defaultSlideData(0)]);
    }

    static async getCopiedSlides() {
        const clipboardSlides = await navigator.clipboard.read();
        const copiedSlides: Slide[] = [];
        const textPlainType = 'text/plain';
        for (const clipboardSlide of clipboardSlides) {
            if (
                clipboardSlide.types.some((type) => {
                    return type === textPlainType;
                })
            ) {
                const blob = await clipboardSlide.getType(textPlainType);
                const json = await blob.text();
                const copiedSlideSlide = Slide.clipboardDeserialize(json);
                if (copiedSlideSlide !== null) {
                    copiedSlides.push(copiedSlideSlide);
                }
            }
        }
        return copiedSlides;
    }

    static toJsonString(jsonData: AnyObjectType) {
        return JSON.stringify(jsonData, null, 2);
    }

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }

    static checkIsThisType(varyAppDocument: any) {
        return varyAppDocument instanceof this;
    }

    async setSlide(slide: Slide) {
        const slides = await this.getItems();
        const index = slides.findIndex((item) => {
            return item.id === slide.id;
        });
        if (index === -1) {
            showSimpleToast('Set Slide', 'Unable to find a slide');
            return;
        }
        slides[index] = slide;
        await this.setItems(slides);
    }

    checkIsSame(varyAppDocument: any) {
        if (AppDocument.checkIsThisType(varyAppDocument)) {
            return this.filePath === varyAppDocument.filePath;
        }
    }

    toJson(): AnyObjectType {
        throw new Error('Method not implemented.');
    }

    async save() {
        return await this.editingHistoryManager.save((dataText) => {
            const jsonData = AppDocument.fromDataText(dataText);
            if (jsonData === null) {
                return null;
            }
            jsonData.metadata.lastEditDate = new Date().toISOString();
            return AppDocument.toJsonString(jsonData);
        });
    }
}
