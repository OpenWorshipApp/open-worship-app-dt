import BibleItem from '../bible-list/BibleItem';
import NoteItem from '../bible-list/note/NoteItem';
import { colorDeserialize } from '../others/color/colorHelpers';
import type { DragDataType, DroppedDataType } from './DragInf';
import type DragInf from './DragInf';
import { DragTypeEnum, genDragMimeType } from './DragInf';
import FileSource from './FileSource';
import PdfSlide from '../app-document-list/PdfSlide';
import PptxSlide from '../app-document-list/PptxSlide';
import DocxSlide from '../app-document-list/DocxSlide';
import { useCallback, useState } from 'react';
import AttachBackgroundManager, {
    attachBackgroundManager,
} from '../others/AttachBackgroundManager';
import { useAppEffectAsync } from './appHooks';
import { useFileSourceEvents } from './dirSourceHelpers';
import { stopDraggingState } from './helpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import Slide from '../app-document-list/Slide';
import { cameraDragDeserialize } from '../background/backgroundHelpers';
import { deserializeBackgroundWebDragItem } from '../background/backgroundWebUrlHelpers';
import { tran } from '../lang/langHelpers';
import LyricSlide from '../lyric-list/LyricSlide';
import { foregroundDragDeserialize } from '../presenter-foreground/foregroundDragHelpers';

export const dragStore: {
    onDropped?: ((event: any) => void) | ((event: any) => Promise<void>) | null;
} = {};

export function handleDragStart(
    event: any,
    item: DragInf<any>,
    type?: DragTypeEnum,
) {
    const data = item.dragSerialize(type);
    event.dataTransfer.setData('text', JSON.stringify(data));
    // A second, VALUELESS entry whose mime type names the kind. The payload
    // above is unreadable during `dragover`, so this is what lets a drop target
    // decide whether it accepts the drag while it is still hovering — see
    // `genDragMimeType`.
    if (data.type) {
        event.dataTransfer.setData(genDragMimeType(data.type), '');
    }
}

// A document travels as a plain reference: only the path goes with the drag.
// Deserialized by the APP_DOCUMENT branch of `deserializeDragData`.
export function handleAppDocumentDragStart(event: any, filePath: string) {
    handleDragStart(event, {
        dragSerialize: () => {
            return {
                type: DragTypeEnum.APP_DOCUMENT,
                data: filePath,
            };
        },
    });
}

// Split out of `extractDropData` so a caller that also needs the raw payload —
// a presenting flow stores it verbatim — does not have to re-implement the parse.
export function extractDragData(event: any): DragDataType<any> | null {
    const data = event.dataTransfer.getData('text');
    if (!data) {
        return null;
    }
    // Dropping plain text (a URL, a word) carries non-JSON data; that must
    // not blow up the drop handler.
    let dragData: any;
    try {
        dragData = JSON.parse(data);
    } catch (_error) {
        return null;
    }
    if (dragData === null || typeof dragData !== 'object' || !dragData.type) {
        return null;
    }
    return dragData;
}

export function extractDropData(event: any) {
    const dragData = extractDragData(event);
    return dragData === null ? null : deserializeDragData(dragData);
}

// A SECOND payload on the same drag, addressed to a different kind of target.
//
// `dataTransfer` holds exactly one `text` entry, so a drag that means two things
// at once -- a verse row is a bible item to the Bibles panel and a note item to
// the Bible Notes panel -- cannot say both there. It can say the second one under
// its own mime type, which `handleDragStart` was already reserving (valueless) for
// the `dragover` gate; this fills that entry in rather than leaving it empty.
export function addDragPayload(
    event: any,
    item: DragInf<any>,
    type?: DragTypeEnum,
) {
    const data = item.dragSerialize(type);
    if (!data.type) {
        return;
    }
    event.dataTransfer.setData(
        genDragMimeType(data.type),
        JSON.stringify(data),
    );
}

// The reader for the above. Falls back to the `text` payload, so a target using
// this reads an ordinary single-kind drag exactly as `extractDropData` would --
// including the valueless mime entry that every `handleDragStart` still writes.
export function extractDropDataOfType(event: any, type: DragTypeEnum) {
    const rawData = event.dataTransfer.getData(genDragMimeType(type));
    if (rawData) {
        try {
            const droppedData = deserializeDragData(JSON.parse(rawData));
            if (droppedData !== null) {
                return droppedData;
            }
        } catch (_error) {
            // Not our JSON. The `text` payload below is still worth a look.
        }
    }
    const droppedData = extractDropData(event);
    return droppedData !== null && droppedData.type === type
        ? droppedData
        : null;
}

function deserializeDocumentSlideData(type: DragTypeEnum, data: any) {
    if (type === DragTypeEnum.PDF_SLIDE) {
        const droppedData = JSON.parse(data);
        if (PdfSlide.tryValidate(droppedData.data)) {
            return new PdfSlide(droppedData.filePath, droppedData.data);
        }
    }
    if (type === DragTypeEnum.PPTX_SLIDE) {
        const droppedData = JSON.parse(data);
        if (PptxSlide.tryValidate(droppedData.data)) {
            return new PptxSlide(droppedData.filePath, droppedData.data);
        }
    }
    if (type === DragTypeEnum.DOCX_SLIDE) {
        const droppedData = JSON.parse(data);
        if (DocxSlide.tryValidate(droppedData.data)) {
            return new DocxSlide(droppedData.filePath, droppedData.data);
        }
    }
    return null;
}

function deserializeBackgroundData(type: DragTypeEnum, data: any) {
    if (
        [
            DragTypeEnum.BACKGROUND_VIDEO,
            DragTypeEnum.BACKGROUND_IMAGE,
            DragTypeEnum.BACKGROUND_AUDIO,
        ].includes(type)
    ) {
        return FileSource.dragDeserialize(data);
    }
    if (type === DragTypeEnum.BACKGROUND_WEB) {
        return deserializeBackgroundWebDragItem(data);
    }
    if (type === DragTypeEnum.BACKGROUND_CAMERA) {
        return cameraDragDeserialize(data);
    }
    if (type === DragTypeEnum.BACKGROUND_COLOR) {
        return colorDeserialize(data);
    }
    return null;
}

export function deserializeDragData({
    type,
    data,
}: DragDataType<any>): DroppedDataType | null {
    let item: any;
    if (type === DragTypeEnum.SLIDE) {
        item = Slide.dragDeserialize(data);
    } else if (type === DragTypeEnum.LYRIC_SLIDE) {
        item = LyricSlide.dragDeserialize(data);
    } else if (type === DragTypeEnum.BIBLE_ITEM) {
        item = BibleItem.dragDeserialize(data);
    } else if (type === DragTypeEnum.NOTE_ITEM) {
        // `NoteItem` has serialized itself for a drag since it was written, but
        // this branch was never here — so `extractDropData` answered `null` for
        // every note item and both of its drop targets (moving one to another
        // note file, reordering one inside a file) were dead code that looked
        // alive.
        item = NoteItem.dragDeserialize(data);
    } else if (type === DragTypeEnum.FOREGROUND) {
        item = foregroundDragDeserialize(data);
    } else if (type === DragTypeEnum.APP_DOCUMENT) {
        item = typeof data === 'string' && data ? { filePath: data } : null;
    } else {
        item =
            deserializeDocumentSlideData(type, data) ??
            deserializeBackgroundData(type, data);
    }
    if (item === null) {
        return null;
    }
    return { type, item };
}

export function handleAttachBackgroundDrop(
    event: DragEvent,
    item: { filePath: string; id?: number },
) {
    stopDraggingState(event);
    const droppedData = extractDropData(event);
    if (
        droppedData !== null &&
        [
            DragTypeEnum.BACKGROUND_COLOR,
            DragTypeEnum.BACKGROUND_IMAGE,
            DragTypeEnum.BACKGROUND_VIDEO,
            DragTypeEnum.BACKGROUND_CAMERA,
            DragTypeEnum.BACKGROUND_WEB,
        ].includes(droppedData.type)
    ) {
        attachBackgroundManager.attachDroppedBackground(
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
    const [backgroundData, setBackgroundData] = useState<
        DroppedDataType | null | undefined
    >();
    useAppEffectAsync(
        async (contextMethods) => {
            contextMethods.setBackgroundData(undefined);
            const data = await attachBackgroundManager.getAttachedBackground(
                filePath,
                id,
            );
            contextMethods.setBackgroundData(data);
        },
        [filePath, id],
        { setBackgroundData },
    );
    const handleFileUpdate = useCallback(() => {
        attachBackgroundManager
            .getAttachedBackground(filePath, id)
            .then((data) => {
                setBackgroundData(data);
            });
    }, [filePath, id]);

    useFileSourceEvents(
        ['update'],
        handleFileUpdate,
        [handleFileUpdate],
        AttachBackgroundManager.genMetaDataFilePath(filePath),
    );

    return backgroundData;
}

export function genRemovingAttachedBackgroundMenu(
    filePath: string,
    id?: string | number,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('x-circle', {
                color: 'var(--bs-danger)',
            }),
            menuElement: tran('Remove background'),
            onSelect: () => {
                attachBackgroundManager.detachBackground(filePath, id);
            },
        },
    ];
}
