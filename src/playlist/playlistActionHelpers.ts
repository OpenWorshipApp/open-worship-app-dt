import type ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type ScreenManager from '../_screen/managers/ScreenManager';
import type { ForegroundDragTargetType } from '../presenter-foreground/foregroundDragHelpers';

/**
 * A run sheet holds things to SHOW, and — with this — things to DO.
 *
 * This is the registry of everything the "Add Action" menu offers. Clearing is
 * the first family in it and deliberately not the only shape it can hold: an
 * action is an id, a label and something to do to a screen, so a later one only
 * has to be appended to `playlistActionList` — storage, validation, the row, the
 * preview, the drag and the next-key all read it from here.
 *
 * Stored as its own item type rather than as a `DragTypeEnum`: an action is not
 * draggable content, nothing else in the app produces one, and the drag pipeline
 * must keep refusing it — dropping an "action" on a screen previewer from
 * anywhere but a playlist row is meaningless.
 */
export const PLAYLIST_ACTION_TYPE = 'action';

export type PlaylistActionIdType =
    | 'clear-all'
    | 'clear-background'
    | 'clear-slide'
    | 'clear-bible'
    | 'clear-foreground'
    | `clear-foreground-${ForegroundDragTargetType}`;

export type PlaylistActionType = {
    /** Stored verbatim in the playlist file — never renamed once shipped. */
    id: PlaylistActionIdType;
    /** Translated on display, so a run sheet reads in the app's language. */
    label: string;
    /** Short badge shown before the label, the way a slide shows `#id`. */
    badge: string;
    iconName: string;
    color: string;
    apply: (screenManager: ScreenManager) => void;
};

/**
 * Clearing ONE foreground widget instead of the whole layer, for the eight
 * widgets a screen can actually hold.
 *
 * Keyed by `ForegroundDragTargetType` rather than by `string`, exactly as
 * `foregroundOnScreenMatcherMap` is: a new foreground widget is then a compile
 * error here instead of a widget with no way to clear it on its own.
 *
 * **The Foreground panel's "Background Images Slide Show" is deliberately absent**
 * — it drives `ScreenBackgroundManager`, not this layer, so `Clear Background`
 * already covers it and a clear here would do nothing.
 *
 * Each entry does what the panel's own hide button for that widget does (its
 * setter, sync group and all) — a list widget clears all of its items at once.
 * Written in the panel's top-to-bottom order, which is the order the submenu
 * shows them in.
 */
const foregroundClearMap: Record<
    ForegroundDragTargetType,
    {
        label: string;
        badge: string;
        clear: (manager: ScreenForegroundManager) => void;
    }
> = {
    'marquee-top': {
        label: 'Clear FG Marquee Top',
        badge: 'M↑',
        clear: (manager) => {
            manager.setMarqueeTopData(null);
        },
    },
    'marquee-bottom': {
        label: 'Clear FG Marquee Bottom',
        badge: 'M↓',
        clear: (manager) => {
            manager.setMarqueeBottomData(null);
        },
    },
    'quick-text': {
        label: 'Clear FG Quick Text',
        badge: 'QT',
        clear: (manager) => {
            manager.setQuickTextData(null);
        },
    },
    countdown: {
        label: 'Clear FG Countdown',
        badge: 'CD',
        clear: (manager) => {
            manager.setCountdownData(null);
        },
    },
    stopwatch: {
        label: 'Clear FG Stopwatch',
        badge: 'SW',
        clear: (manager) => {
            manager.setStopwatchData(null);
        },
    },
    time: {
        label: 'Clear FG Time',
        badge: 'TM',
        clear: (manager) => {
            manager.setTimeDataList([]);
        },
    },
    camera: {
        label: 'Clear FG Camera Show',
        badge: 'CM',
        clear: (manager) => {
            manager.setCameraDataList([]);
        },
    },
    web: {
        label: 'Clear FG Web Show',
        badge: 'WB',
        clear: (manager) => {
            manager.setWebDataList([]);
        },
    },
};

/**
 * The per-widget clears, in the order `foregroundClearMap` is written — object
 * key order IS insertion order for these keys, so the map is both exhaustive
 * (the `Record`) and ordered (the panel's own layout) without a second list to
 * keep in step.
 *
 * They all wear `Clear Foreground`'s eraser and colour rather than the widget's
 * own icon: a row that showed the marquee icon would read as the marquee PRESET,
 * which is the opposite of what it does. The badge is what tells them apart.
 */
const foregroundClearActionList: PlaylistActionType[] = Object.entries(
    foregroundClearMap,
).map(([target, { label, badge, clear }]): PlaylistActionType => {
    return {
        id: `clear-foreground-${target as ForegroundDragTargetType}`,
        label,
        badge,
        iconName: 'eraser',
        color: 'var(--bs-gray-500)',
        apply: (screenManager) => {
            clear(screenManager.screenForegroundManager);
        },
    };
});

/**
 * The clearing family. The first five mirror a button of the mini screen's clear
 * bar — same label (so the shipped translations are reused rather than
 * duplicated), same `BG`/`SL`/`BB`/`FG` text as its badge, and kept in the bar's
 * own left-to-right order so the menu reads like the control it mirrors. The
 * per-widget foreground clears follow, since they are a finer version of the
 * `FG` button right above them.
 *
 * The bar's two `secondary` buttons are the one thing not copied literally: the
 * context menu's own background IS `--bs-secondary`, so those icons vanished
 * into it. A lighter neutral reads on the menu and on the row alike.
 */
export const playlistActionList: PlaylistActionType[] = [
    {
        id: 'clear-all',
        label: 'Clear All',
        badge: 'ALL',
        iconName: 'eraser-fill',
        color: 'var(--bs-danger)',
        apply: (screenManager) => {
            screenManager.clear();
        },
    },
    {
        id: 'clear-background',
        label: 'Clear Background',
        badge: 'BG',
        iconName: 'eraser',
        color: 'var(--bs-gray-500)',
        apply: (screenManager) => {
            screenManager.screenBackgroundManager.clear();
        },
    },
    {
        id: 'clear-slide',
        label: 'Clear Slide',
        badge: 'SL',
        iconName: 'eraser',
        color: 'var(--bs-info)',
        apply: (screenManager) => {
            screenManager.screenVaryAppDocumentManager.clear();
        },
    },
    {
        id: 'clear-bible',
        label: 'Clear Bible',
        badge: 'BB',
        iconName: 'eraser',
        color: 'var(--bs-primary)',
        apply: (screenManager) => {
            screenManager.screenBibleManager.clear();
        },
    },
    {
        id: 'clear-foreground',
        label: 'Clear Foreground',
        badge: 'FG',
        iconName: 'eraser',
        color: 'var(--bs-gray-500)',
        apply: (screenManager) => {
            screenManager.screenForegroundManager.clear();
        },
    },
    ...foregroundClearActionList,
];

const playlistActionMap = new Map(
    playlistActionList.map((action) => {
        return [action.id as string, action];
    }),
);

/**
 * The stored id resolved back to its action, or null when nothing answers to it
 * — a playlist written by a later version, or a hand-edited file. Callers treat
 * null as an invalid entry rather than silently doing nothing on click.
 */
export function findPlaylistAction(actionId: any): PlaylistActionType | null {
    if (typeof actionId !== 'string') {
        return null;
    }
    return playlistActionMap.get(actionId) ?? null;
}
