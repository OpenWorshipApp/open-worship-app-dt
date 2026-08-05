import {
    applyOnChosenScreens,
    showDroppedDataOnScreens,
} from '../_screen/managers/screenDroppedHelpers';
import { getScreenManagerByKey } from '../_screen/managers/screenManagerHelpers';
import type { DragDataType, DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { deserializeDragData, extractDragData } from '../helper/dragHelpers';
import type PlaylistItem from './PlaylistItem';

const dragTypeIconMap: { [key: string]: string } = {
    [DragTypeEnum.BACKGROUND_COLOR]: 'palette',
    [DragTypeEnum.BACKGROUND_IMAGE]: 'file-earmark-image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'file-earmark-play',
    [DragTypeEnum.BACKGROUND_CAMERA]: 'camera-video',
    [DragTypeEnum.BACKGROUND_WEB]: 'globe2',
    [DragTypeEnum.BACKGROUND_AUDIO]: 'file-earmark-music',
    [DragTypeEnum.SLIDE]: 'file-earmark-slides',
    [DragTypeEnum.LYRIC_SLIDE]: 'music-note-list',
    [DragTypeEnum.PDF_SLIDE]: 'file-earmark-pdf',
    [DragTypeEnum.PPTX_SLIDE]: 'file-earmark-ppt',
    [DragTypeEnum.DOCX_SLIDE]: 'file-earmark-word',
    [DragTypeEnum.BIBLE_ITEM]: 'book',
    [DragTypeEnum.APP_DOCUMENT]: 'file-earmark-text',
    [DragTypeEnum.FOREGROUND]: 'front',
};

export function toDragTypeIconName(type: string) {
    return dragTypeIconMap[type] ?? 'question-diamond';
}

/**
 * The icon (and tint) the Documents list gives this very file, so a document
 * entry reads the same in both places. Keyed off the extension rather than the
 * document classes: those are a heavy import graph, and a row only needs to
 * draw an icon.
 */
const documentIconByDotExtension: { [key: string]: [string, string?] } = {
    '.pdf': ['file-earmark-pdf', '#bd0b02'],
    '.pptx': ['file-earmark-ppt', '#d24726'],
    '.ppt': ['file-earmark-ppt', '#d24726'],
    '.docx': ['file-earmark-word', '#2b579a'],
    '.doc': ['file-earmark-word', '#2b579a'],
    '.owl': ['music-note'],
};

export function toDocumentIcon(filePath: string): [string, string?] {
    const dotIndex = filePath.lastIndexOf('.');
    const dotExtension =
        dotIndex === -1 ? '' : filePath.slice(dotIndex).toLowerCase();
    return documentIconByDotExtension[dotExtension] ?? ['file-earmark-slides'];
}

/**
 * Settings are stored as files named after their key, so a raw file path in a
 * setting name becomes a path with directory separators in it and every read
 * logs an ENOENT.
 */
export function toPlaylistSettingName(prefix: string, ...parts: string[]) {
    const key = parts
        .join('-')
        .replace(/[\\/:*?"<>|.]/g, '_')
        .replace(/\s+/g, '_');
    return `${prefix}-${key}`;
}

/**
 * Set while a row is dragged out of a playlist. A drop back into the SAME
 * playlist is then a reorder rather than an add — the dragged payload alone
 * cannot tell the two apart.
 */
export const playlistDraggingStore: {
    current: { filePath: string; index: number } | null;
} = { current: null };

/**
 * A playlist needs both halves of a drag: the deserialized item (to read a
 * slide's file path and id) and the raw payload (stored verbatim for the
 * self-describing kinds).
 */
export function extractDropPayload(event: any): {
    dragData: DragDataType<any>;
    droppedData: DroppedDataType;
} | null {
    const dragData = extractDragData(event);
    if (dragData === null) {
        return null;
    }
    const droppedData = deserializeDragData(dragData);
    if (droppedData === null) {
        return null;
    }
    return { dragData, droppedData };
}

/**
 * Drop a playlist row onto a screen previewer. Slides resolve asynchronously, so
 * this cannot ride the synchronous `dataTransfer` path and goes through
 * `dragStore.onDropped` instead — the screen element is read up front because
 * React clears `currentTarget` once the handler returns.
 */
export async function handlePlaylistItemScreenDropping(
    playlistItem: PlaylistItem,
    event: any,
) {
    const target = event.currentTarget;
    if (
        !(target instanceof HTMLElement) ||
        target.dataset.screenKey === undefined
    ) {
        return;
    }
    const screenManager = getScreenManagerByKey(target.dataset.screenKey);
    if (screenManager === null) {
        return;
    }
    // An action names the screen it runs on the same way content names the
    // screen it lands on — by the previewer it was dropped onto.
    if (playlistItem.isAction) {
        playlistItem.action?.apply(screenManager);
        return;
    }
    const droppedData = await playlistItem.toDroppedData();
    if (droppedData === null) {
        return;
    }
    screenManager.receiveScreenDropped(droppedData);
}

/**
 * The one way a playlist element reaches the screens: content is SHOWN, an
 * action is RUN. Every affordance that points an element at a screen — the row
 * click, the preview's click, the next-key, the right-click menu — goes through
 * here so the two kinds cannot drift apart, and both choose their screens the
 * same way (the selected ones, or a menu asking which).
 */
export async function sendPlaylistItemToScreens(
    playlistItem: PlaylistItem,
    event: any,
    isForceChoosing = false,
) {
    if (playlistItem.isAction) {
        const { action } = playlistItem;
        if (action === null) {
            return;
        }
        await applyOnChosenScreens(event, isForceChoosing, (screenManager) => {
            action.apply(screenManager);
        });
        return;
    }
    const droppedData = await playlistItem.toDroppedData();
    if (droppedData === null) {
        return;
    }
    await showDroppedDataOnScreens(event, droppedData, isForceChoosing);
}
