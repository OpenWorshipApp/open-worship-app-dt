import Slide, { SlideType } from './Slide';
import AppDocumentSourceAbs, {
    AppDocumentMetadataType,
} from '../helper/AppEditableDocumentSourceAbs';
import { gemSlideContextMenuItems } from './appDocumentHelpers';
import { AnyObjectType, checkIsSameValues, toMaxId } from '../helper/helpers';
import { MimetypeNameType } from '../server/fileHelpers';
import { DisplayType } from '../_screen/screenHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import EditingHistoryManager from '../editing-manager/EditingHistoryManager';
import ItemSourceInf from '../others/ItemSourceInf';
import { OptionalPromise } from '../others/otherHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';

export type AppDocumentType = {
    metadata: AppDocumentMetadataType;
    items: SlideType[];
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
    extends AppDocumentSourceAbs<AppDocumentType>
    implements ItemSourceInf<Slide>
{
    static readonly mimetypeName: MimetypeNameType = 'appDocument';
    isEditable = true;

    async getSlides() {
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

    async setSlides(newSlides: Slide[]) {
        const jsonData = await this.getJsonData();
        if (jsonData === null) {
            return;
        }
        jsonData.items = newSlides.map((slide) => {
            return slide.toJson();
        });
        await this.setJsonData(jsonData);
    }

    async getSlideIndex(slide: Slide) {
        const slides = await this.getSlides();
        const index = slides.findIndex((slide1) => {
            return slide1.checkIsSame(slide);
        });
        return index;
    }

    async updateSlide(slide: Slide) {
        const index = await this.getSlideIndex(slide);
        if (index === -1) {
            return;
        }
        const slides = await this.getSlides();
        slides[index] = slide;
        await this.setSlides(slides);
    }

    async getSlideByIndex(index: number) {
        const slides = await this.getSlides();
        return slides[index] ?? null;
    }

    async getItemById(id: number) {
        const slides = await this.getSlides();
        return (
            slides.find((slide) => {
                return slide.id === id;
            }) ?? null
        );
    }

    setItemById(_id: number, _slide: Slide): OptionalPromise<void> {
        throw new Error('Method not implemented.');
    }

    get editingHistoryManager() {
        return EditingHistoryManager.getInstance(this.filePath);
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

    async getMaxSlideId() {
        const slides = await this.getSlides();
        if (slides.length) {
            const ids = slides.map((slide) => {
                return slide.id;
            });
            return toMaxId(ids);
        }
        return 0;
    }

    async duplicateSlide(slide: Slide) {
        const index = await this.getSlideIndex(slide);
        if (index === -1) {
            return;
        }
        const newSlide = slide.clone();
        const maxSlideId = await this.getMaxSlideId();
        newSlide.id = maxSlideId + 1;
        const slides = await this.getSlides();
        slides.splice(index + 1, 0, newSlide);
        await this.setSlides(slides);
    }

    async moveSlideToIndex(slide: Slide, toIndex: number) {
        const slides = await this.getSlides();
        if (toIndex < 0 || toIndex >= slides.length) {
            return;
        }
        const fromIndex = await this.getSlideIndex(slide);
        if (fromIndex === -1 || fromIndex === toIndex) {
            return;
        }
        const [item] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, item);
        await this.setSlides(slides);
    }

    async addSlide(slide: Slide) {
        const slides = await this.getSlides();
        const maxSlideId = await this.getMaxSlideId();
        slide.id = maxSlideId + 1;
        slide.filePath = this.filePath;
        slides.push(slide);
        await this.setSlides(slides);
    }

    async swapSlides(fromIndex: number, toIndex: number) {
        const slides = await this.getSlides();
        if (fromIndex < 0 || fromIndex >= slides.length) {
            return;
        }
        if (toIndex < 0 || toIndex >= slides.length) {
            return;
        }
        const fromSlide = slides[fromIndex];
        const toSlide = slides[toIndex];
        slides[fromIndex] = toSlide;
        slides[toIndex] = fromSlide;
        await this.setSlides(slides);
    }

    async moveSlide(slide: Slide, isForward: boolean) {
        const index = await this.getSlideIndex(slide);
        if (index === -1) {
            return;
        }
        const slides = await this.getSlides();
        let toIndex = 0;
        if (isForward) {
            toIndex = (index + 1) % slides.length;
        } else {
            toIndex = (index - 1 + slides.length) % slides.length;
        }
        return this.moveSlideToIndex(slide, toIndex);
    }

    async addNewSlide() {
        const maxSlideId = await this.getMaxSlideId();
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
        const slides = await this.getSlides();
        const newSlides = slides.filter((newSlide) => {
            return newSlide.id !== slide.id;
        });
        await this.setSlides(newSlides);
    }

    static toWrongDimensionString({ slide, display }: WrongDimensionType) {
        return (
            `⚠️ slide:${slide.width}x${slide.height} ` +
            `display:${display.width}x${display.height}`
        );
    }

    async getIsWrongDimension(display: DisplayType) {
        const slides = await this.getSlides();
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
        super.validate(json);
        if (typeof json.items !== 'object' || !Array.isArray(json.items)) {
            throw new Error(
                `Invalid app document data json:${JSON.stringify(json)}`,
            );
        }
        for (const item of json.items) {
            Slide.validate(item);
        }
    }

    async fixSlideDimension(display: DisplayType) {
        const slides = await this.getSlides();
        const newSlides = await Promise.all(
            slides.map((slide) => {
                return (async () => {
                    const json = slide.toJson();
                    if (slide.checkIsWrongDimension(display)) {
                        json.metadata.width = display.bounds.width;
                        json.metadata.height = display.bounds.height;
                    }
                    return Slide.fromJson(json, this.filePath);
                })();
            }),
        );
        await this.setSlides(newSlides);
    }

    showSlideContextMenu(
        event: any,
        slide: Slide,
        extraMenuItems: ContextMenuItemType[] = [],
    ) {
        const contextMenuItems = gemSlideContextMenuItems(
            this,
            slide,
            extraMenuItems,
        );
        showAppContextMenu(event, contextMenuItems);
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

    static async create(dir: string, name: string) {
        return super.create(dir, name, { items: [Slide.defaultSlideData(0)] });
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

    static getInstance(filePath: string) {
        return this._getInstance(filePath, () => {
            return new this(filePath);
        });
    }
}
