import {
    applyOnChosenScreens,
    chooseScreenIdsOnEvent,
    showDroppedDataOnScreens,
} from '../_screen/managers/screenDroppedHelpers';
import { getScreenManagerByKey } from '../_screen/managers/screenManagerHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { DragDataType, DroppedDataType } from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { deserializeDragData, extractDragData } from '../helper/dragHelpers';
import { tran } from '../lang/langHelpers';
import {
    removeSettingsByPrefix,
    toFilePathSettingKey,
    toFilePathSettingName,
} from '../helper/settingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { firePlaylistRunAction } from './playlistAutoNextHelpers';
import { armPlaylistCcPropagation } from './playlistCcApplyHelpers';
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

// The path→setting-name sanitizer is shared with the documents panel now (its
// floating previews are keyed by file path too), so it lives in
// `settingHelpers`. Kept under the old names here so no playlist call site has
// to move. Forwarding functions rather than `export const … = imported`: the
// latter reads the import while this module is still evaluating, which throws
// in the tests that replace `settingHelpers` with a partial mock.
export function toPlaylistSettingKey(...parts: string[]) {
    return toFilePathSettingKey(...parts);
}

export function toPlaylistSettingName(prefix: string, ...parts: string[]) {
    return toFilePathSettingName(prefix, ...parts);
}

/**
 * Every prefix a playlist persists under. Listed here rather than at each use
 * site so the cleanup below cannot miss one that is added later — the whole
 * point of it is that nothing is left behind.
 */
const PLAYLIST_SETTING_PREFIXES = [
    'playlist-opened',
    'playlist-item-expanded',
    'playlist-preview-collapsed',
];

/**
 * Forget everything a playlist file persisted, once that file is gone.
 *
 * A playlist's settings are named after its path, so a deleted playlist used to
 * leave one file behind per setting it had ever written — including one
 * `playlist-item-expanded-…` per document it held — with nothing left that could
 * ever read or clear them again.
 */
export async function removePlaylistSettings(filePath: string) {
    const key = toPlaylistSettingKey(filePath);
    const removedKeys = await Promise.all(
        PLAYLIST_SETTING_PREFIXES.map((prefix) => {
            return removeSettingsByPrefix(`${prefix}-${key}`);
        }),
    );
    return removedKeys.flat();
}

/**
 * Park an element (or one slide of a document element) out of the run, so a
 * mis-aimed click cannot put it on a screen mid-service. Exported from here for
 * the same reason `genSetSpecificScreenContextMenu` is exported from the
 * component that draws the pin: five menus offer this — the element row, a
 * document's slide rows, and the same two plus the drawn kinds in the floating
 * preview — and they must not drift apart in label, icon or behaviour.
 *
 * A parked element KEEPS its whole menu, this entry included: the menu is the
 * only way back, so it is the one affordance disabling must never take away.
 */
export function genDisableContextMenu(
    isDisabled: boolean,
    setIsDisabled: (isDisabled: boolean) => void,
): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon(
                isDisabled ? 'eye' : 'eye-slash',
            ),
            menuElement: isDisabled ? tran('Enable') : tran('Disable'),
            onSelect: () => {
                setIsDisabled(!isDisabled);
            },
        },
    ];
}

/**
 * How tall the reorder band at each end of an element row is. Kept here with the
 * rule that reads it rather than in the component, so the two cannot drift.
 */
const REORDER_EDGE_HEIGHT = 7;

/**
 * Which of the two things a drag hovering an ELEMENT row would do — the one row
 * in a playlist that answers to both.
 *
 * `position` puts what is being dragged AT that line: an existing row of this
 * playlist MOVES there, anything else is INSERTED there. `cc` attaches it to
 * that line instead.
 *
 * WHERE on the row the pointer is decides by default, but only for a row of this
 * playlist: its EDGES take the position, its MIDDLE attaches. The band is fixed
 * at 7px and never more than a third of the row, so a short row keeps a middle to
 * aim at. Anything dragged in from elsewhere attaches by default — that is what
 * dropping on a line has always meant, and a payload from another panel has no
 * "between two lines" reading to discover by accident.
 *
 * **Ctrl (or ⌘) forces the position and Alt forces the attach**, whatever is
 * being dragged and wherever on the row the pointer is — Ctrl is the only way to
 * land something from another panel at a chosen place rather than at the end of
 * the sheet. Read from the drag event, so the mark under the pointer follows the
 * key being pressed or released mid-drag. Ctrl wins when both are held.
 *
 * A pure rule rather than a closure in the component: both the drag-over mark
 * and the drop itself ask it, and it is the kind of thing that is only ever
 * right by being tested.
 */
export function toPlaylistRowDropKind(
    event: {
        ctrlKey?: boolean;
        metaKey?: boolean;
        altKey?: boolean;
        clientY: number;
        currentTarget: { getBoundingClientRect: () => DOMRect | any };
    },
    isBandPositioning: boolean,
): 'position' | 'cc' {
    if (event.ctrlKey || event.metaKey) {
        return 'position';
    }
    if (event.altKey || !isBandPositioning) {
        return 'cc';
    }
    const { top, height } = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - top;
    const edge = Math.min(REORDER_EDGE_HEIGHT, height / 3);
    return offsetY < edge || offsetY > height - edge ? 'position' : 'cc';
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
 *
 * The two ways this can come back empty are NOT the same thing, and the caller
 * has to tell them apart:
 *
 * - `null` — the drop carried no readable app drag data at all (a file from the
 *   OS, a plain string, nothing). Silence is right: the caller has its own
 *   handling for those.
 * - `'unsupported'` — it WAS an app payload, of a type a playlist cannot take.
 *   That has to be said out loud. It used to fall into the same `null` and the
 *   drop did nothing at all, silently: dragging a bible NOTE onto a run sheet
 *   simply vanished. The toast that was meant to catch this lives further down
 *   (`PlaylistItem.fromDroppedData` returning null) and was unreachable, because
 *   every type `deserializeDragData` can decode is in `acceptedDragTypeList` —
 *   the refusal has to happen HERE, where the decode failed.
 */
export const UNSUPPORTED_DROP_PAYLOAD = 'unsupported';

export function extractDropPayload(event: any):
    | {
          dragData: DragDataType<any>;
          droppedData: DroppedDataType;
      }
    | typeof UNSUPPORTED_DROP_PAYLOAD
    | null {
    const dragData = extractDragData(event);
    if (dragData === null) {
        return null;
    }
    const droppedData = deserializeDragData(dragData);
    if (droppedData === null) {
        return UNSUPPORTED_DROP_PAYLOAD;
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
    if (playlistItem.isDisabled) {
        return;
    }
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
    // A screen action names the screen it runs on the same way content names the
    // screen it lands on — by the previewer it was dropped onto. A RUN action is
    // not draggable to a screen at all (`isScreenReachable` refuses it), so it
    // cannot get here.
    if (playlistItem.isAction) {
        playlistItem.screenAction?.apply(screenManager);
        return;
    }
    const droppedData = await playlistItem.toDroppedData();
    if (droppedData === null) {
        return;
    }
    screenManager.receiveScreenDropped(droppedData);
}

/**
 * The one way a playlist element is FIRED: content is shown on the screens, a
 * screen action is run on them, and a run action drives the run itself. Every
 * affordance that fires an element — the row click, the preview's click, the
 * next-key, the right-click menu — goes through here so the three kinds cannot
 * drift apart, and the two that reach a screen choose it the same way: the ones
 * the entry is PINNED to, else the selected ones, else a menu asking which.
 * `isForceChoosing` still overrides the pin — that is the right-click entry,
 * i.e. the operator asking for this one present to go somewhere else.
 *
 * A PARKED element stops here rather than at each affordance: this is the one
 * gate every one of them passes through, so an element the operator has taken
 * out of the run cannot reach a screen by any route at all.
 *
 * Its CC elements are armed here for the same reason: this one funnel covers the
 * row click, the preview's click, the next-key and the right-click menu at once,
 * and a forced present takes its CCs to the forced screen — a CC follows its host
 * wherever the operator sends it.
 *
 * **Arming happens IMMEDIATELY BEFORE the resolution that answers it**, never
 * once at the top. `armPlaylistCcPropagation` parks a closure in a module-level
 * map keyed by this gesture, and only a screen resolution
 * (`ScreenEventHandler.chooseScreenIds`) ever takes it back out — dismissing the
 * "which screen?" menu included, which resolves to `[]`. So every `return`
 * between an arm and its resolution strands that closure for the life of the
 * app, holding the native event and, through it, the DOM. Two of them used to:
 * a `Screen: Show` naming no screen, and — the one that is not exotic at all —
 * a slide reference that no longer resolves because its document was edited or
 * moved. Keeping each arm adjacent to its own resolution makes that locally
 * checkable instead of a rule the next early return has to remember.
 */
export async function sendPlaylistItemToScreens(
    playlistItem: PlaylistItem,
    event: any,
    isForceChoosing = false,
) {
    if (playlistItem.isDisabled) {
        return;
    }
    // A run action drives the run rather than a screen, so it is peeled off
    // before the CCs are armed — the clocks and the jump choose no screens, so
    // nothing would ever resolve them.
    //
    // With ONE exception, and it is the reason this branch is not a single line:
    // a `Keyboard Event` is nothing BUT its followers. It shows nothing of its
    // own, so if it did not resolve the screens they land on, no part of the
    // gesture would, and pressing its shortcut would do nothing at all. It has no
    // payload to send afterwards — the resolution is the whole of its work, and
    // the followers ride it exactly as they ride a slide's.
    if (playlistItem.isRunAction) {
        const ccItems = playlistItem.hostsCcFollowers
            ? playlistItem.ccItems
            : [];
        if (ccItems.length === 0) {
            // Nothing attached yet: its own `start` says so, the same way an
            // unaimed `Jump to` does, rather than reading as a dead key.
            firePlaylistRunAction(playlistItem);
            return;
        }
        armPlaylistCcPropagation(event, ccItems);
        await chooseScreenIdsOnEvent(
            event,
            isForceChoosing,
            playlistItem.screenIds,
        );
        return;
    }
    const { screenIds } = playlistItem;
    const screenAction = playlistItem.screenAction;
    if (screenAction !== null) {
        // A `Screen: Show`/`Screen: Hide` runs on the screens it NAMES and on no
        // others. `chooseScreenIds` already returns a non-empty preset unchanged,
        // so this only has to refuse the empty case — which is the whole of what
        // the fallbacks would do here: put a screen up wherever the operator's
        // last click happened to leave the selection, or stop on a menu nobody is
        // there to answer. Refused even under `isForceChoosing`: the operator
        // asking "send this one somewhere else" is the one gesture that outranks
        // an ordinary pin, but here the pin is not a preference, it is what the
        // line IS. Barely reachable in practice — the question is asked before
        // the line is written — so this is the hand-edited file.
        if (screenAction.requiresScreenIds && screenIds.length === 0) {
            showSimpleToast(
                tran(screenAction.label),
                tran('Please choose at least one screen'),
            );
            return;
        }
        armPlaylistCcPropagation(event, playlistItem.ccItems);
        await applyOnChosenScreens(
            event,
            isForceChoosing,
            (screenManager) => {
                screenAction.apply(screenManager);
            },
            screenIds,
        );
        return;
    }
    const droppedData = await playlistItem.toDroppedData();
    if (droppedData === null) {
        // A reference that no longer resolves — the document was edited, moved,
        // or the id is gone. Said OUT LOUD: this used to return in silence, so a
        // row that could not be read looked exactly like a row that had been
        // shown, which mid-service is the worst of both.
        showSimpleToast(
            tran('Showing Playlist Item'),
            tran('Fail to read file data'),
        );
        return;
    }
    armPlaylistCcPropagation(event, playlistItem.ccItems);
    await showDroppedDataOnScreens(
        event,
        droppedData,
        isForceChoosing,
        screenIds,
    );
}
