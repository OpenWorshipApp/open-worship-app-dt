import type { VarySlideType } from '../app-document-list/appDocumentTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import FileSource from '../helper/FileSource';
import { notifyElementHighlight } from '../helper/domHelpers';
import { bringDomToTopView } from '../helper/helpers';
import { openBackgroundAudioTab } from '../background/backgroundAudioTabHelpers';
import { backgroundDragTypeList } from './PresentingFlowItem';
import type PresentingFlowItem from './PresentingFlowItem';
import { PRESENTING_FLOW_ITEM_UUID_ATTR } from './presentingFlowCcHelpers';

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
 * Where a presenting flow entry came from, as a selector into the rest of the app: the
 * background thumbnail, the document row, the slide in the previewer, the bible
 * item, or the foreground panel. Returns null when the entry has no element
 * that can be pointed at (a colour, for instance, is not a listed file).
 */
function toOriginElementGetter(
    presentingFlowItem: PresentingFlowItem,
): (() => Element | null) | null {
    const { type } = presentingFlowItem;
    if (
        (backgroundDragTypeList.includes(type as DragTypeEnum) ||
            presentingFlowItem.isAudio) &&
        type !== DragTypeEnum.BACKGROUND_COLOR &&
        type !== DragTypeEnum.BACKGROUND_CAMERA
    ) {
        const src = toBackgroundSrc(presentingFlowItem);
        if (src === null) {
            return null;
        }
        return toFileItemElementGetter(src);
    }
    if (presentingFlowItem.isAppDocument) {
        return toFileItemElementGetter(
            FileSource.getInstance(presentingFlowItem.itemFilePath).src,
        );
    }
    if (presentingFlowItem.isSlide) {
        return toVarySlideElementGetter(presentingFlowItem.id);
    }
    if (presentingFlowItem.isBibleItem) {
        const { filePath, id } = presentingFlowItem.data ?? {};
        if (typeof filePath !== 'string' || typeof id !== 'number') {
            return null;
        }
        const name = FileSource.getInstance(filePath).name;
        return toElementGetter(
            `[data-bible-item-id="${escapeSelectorValue(`${name}-${id}`)}"]`,
        );
    }
    if (presentingFlowItem.isForeground) {
        const target = presentingFlowItem.data?.target;
        if (typeof target !== 'string') {
            return null;
        }
        return toElementGetter(
            `[data-foreground-target="${escapeSelectorValue(target)}"]`,
        );
    }
    return null;
}

function toBackgroundSrc(presentingFlowItem: PresentingFlowItem) {
    const { data } = presentingFlowItem;
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
export function notifyPresentingFlowItemOrigin(
    presentingFlowItem: PresentingFlowItem,
) {
    const elementGetter = toOriginElementGetter(presentingFlowItem);
    if (elementGetter === null) {
        return false;
    }
    if (presentingFlowItem.isAudio) {
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
// sheet, while the tree lists every presenting flow at once.
const PRESENTING_FLOW_TREE_ROOT_SELECTOR = '.presenting-flow-list';
const PRESENTING_FLOW_PREVIEW_ROOT_SELECTOR = '.app-presenting-flow-preview';

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
 * `notifyPresentingFlowItemOrigin` (it may have to open a panel first) and wrong here:
 * a closed widget is an answer, not something to wait for.
 */
export function notifyPresentingFlowCcOrigin(ccItem: PresentingFlowItem) {
    const { uuid } = ccItem;
    if (uuid === null) {
        return;
    }
    const selector = `[${PRESENTING_FLOW_ITEM_UUID_ATTR}="${escapeSelectorValue(uuid)}"]`;
    for (const rootSelector of [
        PRESENTING_FLOW_TREE_ROOT_SELECTOR,
        PRESENTING_FLOW_PREVIEW_ROOT_SELECTOR,
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
