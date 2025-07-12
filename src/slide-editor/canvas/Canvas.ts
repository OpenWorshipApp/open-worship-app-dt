import { toMaxId } from '../../helper/helpers';
import CanvasItem, { CanvasItemError } from './CanvasItem';
import CanvasItemBibleItem from './CanvasItemBibleItem';
import CanvasItemImage from './CanvasItemImage';
import CanvasItemText from './CanvasItemText';
import CanvasItemVideo from './CanvasItemVideo';
import Slide from '../../app-document-list/Slide';

export default class Canvas {
    slide: Slide;

    constructor(slide: Slide) {
        this.slide = slide;
    }

    get maxItemId() {
        if (this.canvasItems.length) {
            const ids = this.canvasItems.map((item) => item.id);
            return toMaxId(ids);
        }
        return 0;
    }

    // TODO: get and set async from file
    get canvasItems() {
        return this.slide.canvasItemsJson
            .map((json: any) => {
                return Canvas.canvasItemFromJson(json);
            })
            .filter((item) => {
                return item !== null;
            });
    }

    set canvasItems(newCanvasItems: CanvasItem<any>[]) {
        this.slide.canvasItemsJson = newCanvasItems.map((item) => {
            return item.toJson();
        });
    }

    get width() {
        return this.slide.width;
    }

    get height() {
        return this.slide.height;
    }

    static canvasItemFromJson(json: any) {
        switch (json.type) {
            case 'image':
                return CanvasItemImage.fromJson(json);
            case 'video':
                return CanvasItemVideo.fromJson(json);
            case 'text':
            case 'html':
                return CanvasItemText.fromJson(json);
            case 'bible':
                return CanvasItemBibleItem.fromJson(json);
            default:
                return CanvasItemError.fromJsonError(json);
        }
    }

    static clipboardDeserializeCanvasItem(json: string) {
        if (!json) {
            return null;
        }
        try {
            const canvasItemData = JSON.parse(json);
            const canvasItem = this.canvasItemFromJson(canvasItemData);
            if (canvasItem.type !== 'error') {
                return canvasItem;
            }
        } catch (_error) {}
        return null;
    }

    static async getCopiedCanvasItems() {
        const clipboardItems = await navigator.clipboard.read();
        const copiedCanvasItems: CanvasItem<any>[] = [];
        const textPlainType = 'text/plain';
        for (const clipboardItem of clipboardItems) {
            if (
                clipboardItem.types.some((type) => {
                    return type === textPlainType;
                })
            ) {
                const blob = await clipboardItem.getType(textPlainType);
                const json = await blob.text();
                const copiedCanvasItem =
                    this.clipboardDeserializeCanvasItem(json);
                if (copiedCanvasItem !== null) {
                    copiedCanvasItems.push(copiedCanvasItem);
                }
            }
        }
        return copiedCanvasItems;
    }
}
