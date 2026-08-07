import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import FileSource from '../helper/FileSource';
import { notifyElementHighlight } from '../helper/domHelpers';
import { bringDomToTopView } from '../helper/helpers';
import { openBackgroundAudioTab } from '../background/backgroundAudioTabHelpers';
import { backgroundDragTypeList } from './PlaylistItem';
import type PlaylistItem from './PlaylistItem';
import { PLAYLIST_ITEM_UUID_ATTR } from './playlistCcHelpers';

function toElementGetter(selector: string) {
    return () => {
        return document.querySelector(selector);
    };
}

export function escapeSelectorValue(value: string) {
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

// The two surfaces a run sheet is read on. Scoped rather than searched globally
// so each is answered on its own: the widget may be closed, or open on another
// sheet, while the tree lists every playlist at once.
const PLAYLIST_TREE_ROOT_SELECTOR = '.playlist-list';
const PLAYLIST_PREVIEW_ROOT_SELECTOR = '.app-playlist-preview';

/**
 * Reveal the element a CC points at, on BOTH surfaces at once.
 *
 * What clicking a CC row does — a CC is never presented on its own, so the one
 * useful thing a click on it can do is take the operator to the line it belongs
 * to. Both the tree and the floating preview are pointed at, because a run sheet
 * is read in whichever of the two happens to be open.
 *
 * By UUID, so there is nothing to disambiguate: a CC names one line of one sheet,
 * and the two identical-looking lines that used to make this a guess are two
 * different uuids. Each surface is asked SYNCHRONOUSLY and only handed to
 * `notifyElementHighlight` once it has answered — that helper polls for three
 * seconds when its getter returns null, which is right for
 * `notifyPlaylistItemOrigin` (it may have to open a panel first) and wrong here:
 * a closed widget is an answer, not something to wait for.
 */
export function notifyPlaylistCcOrigin(ccItem: PlaylistItem) {
    const { uuid } = ccItem;
    if (uuid === null) {
        return;
    }
    const selector = `[${PLAYLIST_ITEM_UUID_ATTR}="${escapeSelectorValue(uuid)}"]`;
    for (const rootSelector of [
        PLAYLIST_TREE_ROOT_SELECTOR,
        PLAYLIST_PREVIEW_ROOT_SELECTOR,
    ]) {
        const element =
            document.querySelector(rootSelector)?.querySelector(selector) ??
            null;
        if (element !== null) {
            notifyElementHighlight(() => {
                return element;
            });
        }
    }
}
