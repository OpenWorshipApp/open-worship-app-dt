import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import FileSource from '../helper/FileSource';
import { notifyElementHighlight } from '../helper/domHelpers';
import { bringDomToTopView } from '../helper/helpers';
import { openBackgroundAudioTab } from '../background/backgroundAudioTabHelpers';
import { backgroundDragTypeList } from './PlaylistItem';
import type PlaylistItem from './PlaylistItem';

function toElementGetter(selector: string) {
    return () => {
        return document.querySelector(selector);
    };
}

function escapeSelectorValue(value: string) {
    return (globalThis.CSS?.escape ?? ((raw: string) => raw))(value);
}

/**
 * The slide's card in the previewer. Only present while that document is the
 * one being previewed; `notifyElementHighlight` gives up by itself when it is
 * not.
 */
function toVarySlideElementGetter(id: number) {
    return toElementGetter(`[data-vary-app-document-item-id="${id}"]`);
}

function toFileItemElementGetter(src: string) {
    return toElementGetter(
        `[data-file-item-file-src="${escapeSelectorValue(src)}"]`,
    );
}

/**
 * Where a playlist entry came from, as a selector into the rest of the app: the
 * background thumbnail, the document row, the slide in the previewer, the bible
 * item, or the foreground panel. Returns null when the entry has no element
 * that can be pointed at (a colour, for instance, is not a listed file).
 */
function toOriginElementGetter(
    playlistItem: PlaylistItem,
): (() => Element | null) | null {
    const { type } = playlistItem;
    if (
        (backgroundDragTypeList.includes(type as DragTypeEnum) ||
            playlistItem.isAudio) &&
        type !== DragTypeEnum.BACKGROUND_COLOR &&
        type !== DragTypeEnum.BACKGROUND_CAMERA
    ) {
        const src = toBackgroundSrc(playlistItem);
        if (src === null) {
            return null;
        }
        return toFileItemElementGetter(src);
    }
    if (playlistItem.isAppDocument) {
        return toFileItemElementGetter(
            FileSource.getInstance(playlistItem.itemFilePath).src,
        );
    }
    if (playlistItem.isSlide) {
        return toVarySlideElementGetter(playlistItem.id);
    }
    if (playlistItem.isBibleItem) {
        const { filePath, id } = playlistItem.data ?? {};
        if (typeof filePath !== 'string' || typeof id !== 'number') {
            return null;
        }
        const name = FileSource.getInstance(filePath).name;
        return toElementGetter(
            `[data-bible-item-id="${escapeSelectorValue(`${name}-${id}`)}"]`,
        );
    }
    if (playlistItem.isForeground) {
        const target = playlistItem.data?.target;
        if (typeof target !== 'string') {
            return null;
        }
        return toElementGetter(
            `[data-foreground-target="${escapeSelectorValue(target)}"]`,
        );
    }
    return null;
}

function toBackgroundSrc(playlistItem: PlaylistItem) {
    const { data } = playlistItem;
    // Image and video backgrounds serialize to a bare file path; a web
    // background serializes to an object carrying its own `src`.
    if (typeof data === 'string') {
        return FileSource.getInstance(data).src;
    }
    if (typeof data?.src === 'string') {
        return data.src;
    }
    return null;
}

/** Scroll a slide's card in the previewer into view and flash it. */
export function notifyVarySlideOrigin(varySlide: VarySlideType) {
    notifyElementHighlight(toVarySlideElementGetter(varySlide.id), {
        moveToView: bringDomToTopView,
    });
}

/**
 * Scroll the element's origin into view and flash it. Used both by "Reveal
 * Original" and by clicking an entry that has nothing to show on a screen —
 * audio, which is played from the Audios panel it points at.
 */
export function notifyPlaylistItemOrigin(playlistItem: PlaylistItem) {
    const elementGetter = toOriginElementGetter(playlistItem);
    if (elementGetter === null) {
        return false;
    }
    if (playlistItem.isAudio) {
        // The Audios split may well be closed, in which case the track has no
        // element yet — open it first. `notifyElementHighlight` polls for a few
        // seconds, so it waits for the panel to render on its own.
        openBackgroundAudioTab();
    }
    notifyElementHighlight(elementGetter, { moveToView: bringDomToTopView });
    return true;
}
