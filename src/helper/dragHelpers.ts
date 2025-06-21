import BibleItem from '../bible-list/BibleItem';
import { colorDeserialize } from '../others/color/colorHelpers';
import DragInf, {
    DragDataType,
    DragTypeEnum,
    DroppedDataType,
} from './DragInf';
import FileSource from './FileSource';
import { appDocumentItemFromKey } from '../app-document-list/appDocumentHelpers';
import PdfSlide from '../app-document-list/PdfSlide';
import { useState } from 'react';
import AttachBackgroundManager, {
    attachBackgroundManager,
} from '../others/AttachBackgroundManager';
import { useAppEffectAsync } from './debuggerHelpers';
import { useFileSourceEvents } from './dirSourceHelpers';
import { stopDraggingState } from './helpers';
import { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';

export function handleDragStart(
    event: any,
    item: DragInf<any>,
    type?: DragTypeEnum,
) {
    const data = item.dragSerialize(type);
    event.dataTransfer.setData('text', JSON.stringify(data));
}

export function extractDropData(event: any) {
    const data = event.dataTransfer.getData('text');
    if (!data) {
        return null;
    }
    const dragData = JSON.parse(data);
    return deserializeDragData(dragData);
}

async function deserializeDragData({
    type,
    data,
}: DragDataType<any>): Promise<DroppedDataType | null> {
    let item: any = null;
    if (type === DragTypeEnum.SLIDE) {
        const droppedData = JSON.parse(data);
        item = await appDocumentItemFromKey(droppedData.key);
    } else if (type === DragTypeEnum.PDF_SLIDE) {
        const droppedData = JSON.parse(data);
        if (PdfSlide.tryValidate(droppedData.data)) {
            item = new PdfSlide(droppedData.filePath, droppedData.data);
        }
    } else if (type === DragTypeEnum.BIBLE_ITEM) {
        item = BibleItem.dragDeserialize(data);
    } else if (
        [DragTypeEnum.BACKGROUND_VIDEO, DragTypeEnum.BACKGROUND_IMAGE].includes(
            type,
        )
    ) {
        item = FileSource.dragDeserialize(data);
    } else if (type === DragTypeEnum.BACKGROUND_COLOR) {
        item = colorDeserialize(data);
    }
    if (item === null) {
        return null;
    }
    return { type, item };
}

export async function handleAttachBackgroundDrop(
    event: React.DragEvent<HTMLElement>,
    item: { filePath: string; id?: number },
) {
    stopDraggingState(event);
    const droppedData = await extractDropData(event);
    if (
        droppedData !== null &&
        [
            DragTypeEnum.BACKGROUND_COLOR,
            DragTypeEnum.BACKGROUND_IMAGE,
            DragTypeEnum.BACKGROUND_VIDEO,
        ].includes(droppedData.type)
    ) {
        await attachBackgroundManager.attachDroppedBackground(
            droppedData,
            item.filePath,
            item.id,
        );
    }
}

export function useAttachedBackgroundData(
    filePath: string,
    id?: string | number,
) {
    const [droppedData, setDroppedData] = useState<
        DroppedDataType | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (contextMethods) => {
            const data = await attachBackgroundManager.getAttachedBackground(
                filePath,
                id,
            );
            contextMethods.setDroppedData(data);
        },
        [filePath, id],
        { setDroppedData },
    );
    useFileSourceEvents(
        ['update'],
        () => {
            attachBackgroundManager
                .getAttachedBackground(filePath, id)
                .then((data) => {
                    setDroppedData(data);
                });
        },
        [filePath, id],
        AttachBackgroundManager.genMetaDataFilePath(filePath),
    );
    return droppedData;
}

export function genRemovingAttachedBackgroundMenu(
    filePath: string,
    id?: string | number,
): ContextMenuItemType[] {
    return [
        {
            menuElement: 'Remove background',
            onSelect: () => {
                attachBackgroundManager.detachBackground(filePath, id);
            },
        },
    ];
}
