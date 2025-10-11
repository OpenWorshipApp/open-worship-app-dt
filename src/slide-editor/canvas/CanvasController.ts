import EventHandler from '../../event/EventHandler';
import Canvas from './Canvas';
import CanvasItem, { CanvasItemPropsType } from './CanvasItem';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import FileSource from '../../helper/FileSource';
import CanvasItemText from './CanvasItemText';
import CanvasItemImage from './CanvasItemImage';
import CanvasItemBibleItem from './CanvasItemBibleItem';
import BibleItem from '../../bible-list/BibleItem';
import {
    CanvasItemMediaPropsType,
    CanvasControllerEventType,
} from './canvasHelpers';
import CanvasItemVideo from './CanvasItemVideo';
import { showSimpleToast } from '../../toast/toastHelpers';
import { handleError } from '../../helper/errorHelpers';
import { createContext, use } from 'react';
import { showCanvasItemContextMenu } from './canvasContextMenuHelpers';
import AppDocument from '../../app-document-list/AppDocument';
import Slide from '../../app-document-list/Slide';

const EDITOR_SCALE_SETTING_NAME = 'canvas-editor-scale';
export const defaultRangeSize = {
    size: 10,
    min: 1,
    max: 20,
    step: 1,
};

export type CanvasItemEventDataType = { canvasItems: CanvasItem<any>[] };

class CanvasController extends EventHandler<CanvasControllerEventType> {
    static readonly eventNamePrefix: string = 'canvas-c';
    private _scale: number = 1;
    readonly appDocument: AppDocument;
    readonly canvas: Canvas;

    constructor(appDocument: AppDocument, canvas: Canvas) {
        super();
        const defaultData = parseFloat(
            getSetting(EDITOR_SCALE_SETTING_NAME) ?? '',
        );
        if (!isNaN(defaultData)) {
            this._scale = defaultData;
        }
        this.appDocument = appDocument;
        this.canvas = canvas;
    }

    get scale() {
        return this._scale;
    }

    set scale(newScale: number) {
        this._scale = newScale;
        setSetting(EDITOR_SCALE_SETTING_NAME, this._scale.toString());
        this.addPropEvent('scale', { canvasItems: this.canvas.canvasItems });
    }

    addPropEvent(
        eventName: CanvasControllerEventType,
        data: CanvasItemEventDataType,
    ): void {
        super.addPropEvent(eventName, data);
    }

    applyEditItem(canvasItem: CanvasItem<any>) {
        const canvasItems = this.canvas.canvasItems;
        const index = canvasItems.findIndex((item) => {
            return item.checkIsSame(canvasItem);
        });
        if (index === -1) {
            showSimpleToast('Edit Canvas Item', 'Canvas item not found');
            return;
        }
        canvasItems[index] = canvasItem;
        this.setCanvasItems(canvasItems);
        canvasItem.fireEditEvent();
    }

    fireUpdateEvent() {
        this.addPropEvent('update', {
            canvasItems: this.canvas.canvasItems,
        });
    }

    async cloneItem(canvasItem: CanvasItem<any>) {
        const newCanvasItem = canvasItem.clone();
        newCanvasItem.props.top += 20;
        newCanvasItem.props.left += 20;
        newCanvasItem.props.id = this.canvas.maxItemId + 1;
        return newCanvasItem;
    }

    async duplicate(canvasItem: CanvasItem<any>) {
        const newCanvasItems = this.canvas.canvasItems;
        const newCanvasItem = await this.cloneItem(canvasItem);
        if (newCanvasItem === null) {
            return;
        }
        const index = this.canvas.canvasItems.indexOf(canvasItem);
        newCanvasItems.splice(index + 1, 0, newCanvasItem);
        this.setCanvasItems(newCanvasItems);
    }

    deleteItem(canvasItem: CanvasItem<any>) {
        const canvasItems = this.canvas.canvasItems;
        const index = canvasItems.findIndex((item) => {
            return item.checkIsSame(canvasItem);
        });
        if (index === -1) {
            showSimpleToast('Delete Canvas Item', 'Canvas item not found');
            return;
        }
        canvasItems.splice(index, 1);
        this.setCanvasItems(canvasItems);
    }

    addNewItem(canvasItem: CanvasItem<any>) {
        const newCanvasItems = this.canvas.canvasItems;
        canvasItem.props.id = this.canvas.maxItemId + 1;
        newCanvasItems.push(canvasItem);
        this.setCanvasItems(newCanvasItems);
    }

    async addNewTextItem() {
        const newItem = CanvasItemText.genDefaultItem();
        this.addNewItem(newItem);
    }

    getMousePosition(event: any) {
        const rect = (event.target as HTMLDivElement).getBoundingClientRect();
        const x = Math.round((event.clientX - rect.left) / this.scale);
        const y = Math.round((event.clientY - rect.top) / this.scale);
        return { x, y };
    }

    async genNewMediaItemFromFilePath(filePath: string, event: any) {
        try {
            const fileSource = FileSource.getInstance(filePath);
            const mediaType =
                fileSource.metadata?.appMimetype.mimetypeName ?? '';
            if (!['image', 'video'].includes(mediaType)) {
                showSimpleToast(
                    'Insert Medias',
                    'Only image and video files are supported',
                );
                return;
            }
            const { x, y } = this.getMousePosition(event);
            const newItem = await (mediaType === 'image'
                ? CanvasItemImage.genFromInsertion(x, y, filePath)
                : CanvasItemVideo.genFromInsertion(x, y, filePath));
            return newItem;
        } catch (error) {
            handleError(error);
        }
        showSimpleToast('Insert Image or Video', 'Fail to insert medias');
    }

    async genNewImageItemFromFile(file: File | Blob, event: any) {
        try {
            const { x, y } = this.getMousePosition(event);
            const newItem = CanvasItemImage.genFromFile(x, y, file);
            return newItem;
        } catch (error) {
            handleError(error);
        }
        showSimpleToast('Pasting Image', 'Fail to insert image');
    }

    async addNewBibleItem(bibleItem: BibleItem) {
        const id = this.canvas.maxItemId + 1;
        const newItem = await CanvasItemBibleItem.fromBibleItem(id, bibleItem);
        this.addNewItem(newItem);
    }

    applyOrderingData(canvasItem: CanvasItem<any>, isBack: boolean) {
        // move canvasItem to next if isBack is false else move to previous
        const newCanvasItems = this.canvas.canvasItems;
        const index = newCanvasItems.findIndex((item) => {
            return item.checkIsSame(canvasItem);
        });
        if (index === -1) {
            return;
        }
        if (isBack) {
            if (index === 0) {
                return;
            }
            newCanvasItems.splice(index, 1);
            newCanvasItems.splice(index - 1, 0, canvasItem);
        } else {
            if (index === newCanvasItems.length - 1) {
                return;
            }
            newCanvasItems.splice(index, 1);
            newCanvasItems.splice(index + 1, 0, canvasItem);
        }
        this.setCanvasItems(newCanvasItems);
    }

    static scaleCanvasItemToSize(
        canvasItem: CanvasItem<any>,
        targetWidth: number,
        targetHeight: number,
        width: number,
        height: number,
    ) {
        const scale = Math.min(targetWidth / width, targetHeight / height);
        const props = canvasItem.props as CanvasItemPropsType;
        props.width = Math.round(width * scale);
        props.height = Math.round(height * scale);
        const targetDimension = {
            parentWidth: targetWidth,
            parentHeight: targetHeight,
        };
        canvasItem.applyBoxData(targetDimension, {
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
        });
    }

    scaleCanvasItemToSize(
        canvasItem: CanvasItem<any>,
        targetWidth: number,
        targetHeight: number,
        width: number,
        height: number,
    ) {
        CanvasController.scaleCanvasItemToSize(
            canvasItem,
            targetWidth,
            targetHeight,
            width,
            height,
        );
        this.applyEditItem(canvasItem);
    }

    applyCanvasItemFully(canvasItem: CanvasItem<any>) {
        const props = canvasItem.props as CanvasItemPropsType;
        let width = props.width;
        let height = props.height;
        if (['image', 'video'].includes(canvasItem.type)) {
            const mediaProps = props as any as CanvasItemMediaPropsType;
            width = mediaProps.mediaWidth;
            height = mediaProps.mediaHeight;
        }
        const targetWidth = this.canvas.width;
        const targetHeight = this.canvas.height;
        this.scaleCanvasItemToSize(
            canvasItem,
            targetWidth,
            targetHeight,
            width,
            height,
        );
    }

    applyCanvasItemOriginal(canvasItem: CanvasItem<any>) {
        const props = canvasItem.props as CanvasItemPropsType;
        let width = props.width;
        let height = props.height;
        if (['image', 'video'].includes(canvasItem.type)) {
            const mediaProps = props as any as CanvasItemMediaPropsType;
            width = mediaProps.mediaWidth;
            height = mediaProps.mediaHeight;
        }
        this.scaleCanvasItemToSize(canvasItem, width, width, width, height);
    }

    applyCanvasItemMediaStrip(canvasItem: CanvasItem<any>) {
        if (!['image', 'video'].includes(canvasItem.type)) {
            return;
        }
        const props = canvasItem.props as CanvasItemPropsType;
        const targeWidth = props.width;
        const targetHeightHeight = props.height;
        const mediaProps = props as any as CanvasItemMediaPropsType;
        const width = mediaProps.mediaWidth;
        const height = mediaProps.mediaHeight;
        this.scaleCanvasItemToSize(
            canvasItem,
            targeWidth,
            targetHeightHeight,
            width,
            height,
        );
    }

    setCanvasItems(canvasItems: CanvasItem<any>[]) {
        this.canvas.canvasItems = canvasItems;
        this.appDocument.updateSlide(this.canvas.slide);
        this.fireUpdateEvent();
    }

    genHandleContextMenuOpening(
        canvasItem: CanvasItem<any>,
        handleCanvasItemEditing: () => void,
    ) {
        return (event: any) => {
            event.stopPropagation();
            showCanvasItemContextMenu(
                event,
                this,
                canvasItem,
                handleCanvasItemEditing,
            );
        };
    }

    itemRegisterEventListener(
        eventNames: CanvasControllerEventType[],
        listener: (data: CanvasItemEventDataType) => void,
    ) {
        return super.registerEventListener<CanvasItemEventDataType>(
            eventNames,
            listener,
        );
    }

    static initInstance(slide: Slide) {
        const appDocument = AppDocument.getInstance(slide.filePath);
        return new this(appDocument, new Canvas(slide));
    }
}

export default CanvasController;

export const CanvasControllerContext = createContext<CanvasController | null>(
    null,
);
export function useCanvasControllerContext() {
    const context = use(CanvasControllerContext);
    if (context === null) {
        throw new Error('CanvasControllerContext is null');
    }
    return context;
}
