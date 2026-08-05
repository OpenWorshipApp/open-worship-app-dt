import { useCallback, useMemo, useSyncExternalStore } from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import ScreenBibleManager from '../_screen/managers/ScreenBibleManager';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import ScreenVaryAppDocumentManager from '../_screen/managers/ScreenVaryAppDocumentManager';
import { genRefCountedScreenUpdateSubscriber } from '../_screen/managers/screenUpdateSubscriberHelpers';
import {
    getBackgroundSrcListOnScreenSetting,
    getBibleListOnScreenSetting,
    getForegroundDataListOnScreenSetting,
} from '../_screen/screenHelpers';
import { getAppDocumentListOnScreenSetting } from '../_screen/preview/screenPreviewerHelpers';
import BibleItem from '../bible-list/BibleItem';
import { checkIsBibleItemOnScreen } from '../bible-list/bibleHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import type { BackgroundType } from '../_screen/screenTypeHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { deserializeDragData } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import type { ForegroundDragTargetType } from '../presenter-foreground/foregroundDragHelpers';
import Playlist from './Playlist';
import type PlaylistItem from './PlaylistItem';

const backgroundDragTypeMap: { [key: string]: BackgroundType } = {
    [DragTypeEnum.BACKGROUND_COLOR]: 'color',
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_CAMERA]: 'camera',
    [DragTypeEnum.BACKGROUND_WEB]: 'web',
};

/**
 * Cheap "is ANYTHING live at all" gate, read straight from the on-screen
 * settings. Every playlist row and the list header ask this first so the idle
 * case — nothing presenting — costs four setting reads instead of opening every
 * playlist file on every screen event.
 */
export function checkIsAnythingOnScreen() {
    return (
        Object.keys(getAppDocumentListOnScreenSetting()).length > 0 ||
        Object.keys(getBackgroundSrcListOnScreenSetting()).length > 0 ||
        Object.keys(getBibleListOnScreenSetting()).length > 0 ||
        Object.keys(getForegroundDataListOnScreenSetting()).length > 0
    );
}

function checkIsBackgroundOnScreen(playlistItem: PlaylistItem) {
    const backgroundType = backgroundDragTypeMap[playlistItem.type];
    if (backgroundType === undefined) {
        return false;
    }
    if (playlistItem.type === DragTypeEnum.BACKGROUND_COLOR) {
        return (
            ScreenBackgroundManager.getSelectBackgroundSrcList(
                playlistItem.data,
                backgroundType,
            ).length > 0
        );
    }
    // The screen stores whatever `receiveScreenDropped` was handed, so the
    // comparison has to go through the same deserializer rather than guessing
    // at the raw payload.
    const droppedData = deserializeDragData({
        type: playlistItem.type as DragTypeEnum,
        data: playlistItem.data,
    });
    const src = droppedData?.item?.src;
    if (typeof src !== 'string') {
        return false;
    }
    return (
        ScreenBackgroundManager.getSelectBackgroundSrcList(src, backgroundType)
            .length > 0
    );
}

/**
 * Foreground presets have no id of their own, so they are matched on whatever
 * identifies them cheaply: the marquee text, the time/camera id, the web file.
 * A countdown, stopwatch or quick text can only be matched by "that slot is
 * occupied" — they carry nothing stable to compare.
 *
 * Keyed by `ForegroundDragTargetType` rather than `string`, so a new foreground
 * widget is a compile error here instead of a row that silently never marks
 * itself as live.
 */
const foregroundOnScreenMatcherMap: Record<
    ForegroundDragTargetType,
    (foregroundData: any, data: any) => boolean
> = {
    countdown: (foregroundData) => {
        return foregroundData.countdownData != null;
    },
    stopwatch: (foregroundData) => {
        return foregroundData.stopwatchData != null;
    },
    'quick-text': (foregroundData) => {
        return foregroundData.quickTextData != null;
    },
    'marquee-top': (foregroundData, data) => {
        return foregroundData.marqueeTopData?.text === data?.text;
    },
    'marquee-bottom': (foregroundData, data) => {
        return foregroundData.marqueeBottomData?.text === data?.text;
    },
    time: (foregroundData, data) => {
        return (foregroundData.timeDataList ?? []).some((item: any) => {
            return item.id === data?.id;
        });
    },
    camera: (foregroundData, data) => {
        return (foregroundData.cameraDataList ?? []).some((item: any) => {
            return item.id === data?.id;
        });
    },
    web: (foregroundData, data) => {
        return (foregroundData.webDataList ?? []).some((item: any) => {
            return item.filePath === data?.filePath;
        });
    },
};

function checkIsForegroundOnScreen(playlistItem: PlaylistItem) {
    const { target, data } = playlistItem.data ?? {};
    const checkIsMatched =
        foregroundOnScreenMatcherMap[target as ForegroundDragTargetType];
    if (checkIsMatched === undefined) {
        return false;
    }
    return Object.values(getForegroundDataListOnScreenSetting()).some(
        (foregroundData: any) => {
            return checkIsMatched(foregroundData, data);
        },
    );
}

/**
 * Identifies WHICH element a row is currently describing. Handed to
 * `useIsOnScreenChecking` so a row that starts describing a different element —
 * the playlist was reordered under it — drops its previous answer instead of
 * showing it until the next screen event.
 */
export function toPlaylistItemOnScreenKey(playlistItem: PlaylistItem) {
    return `${playlistItem.type}-${playlistItem.itemFilePath}-${playlistItem.id}`;
}

export async function checkIsPlaylistItemOnScreen(playlistItem: PlaylistItem) {
    if (playlistItem.isError) {
        return false;
    }
    if (playlistItem.isSlide) {
        return (
            ScreenVaryAppDocumentManager.getDataList(
                playlistItem.itemFilePath,
                playlistItem.id,
            ).length > 0
        );
    }
    if (playlistItem.isAppDocument) {
        // Matched on file path only — never by materialising the document.
        return (
            ScreenVaryAppDocumentManager.getDataList(playlistItem.itemFilePath)
                .length > 0
        );
    }
    if (playlistItem.isBackground) {
        return checkIsBackgroundOnScreen(playlistItem);
    }
    if (playlistItem.isForeground) {
        return checkIsForegroundOnScreen(playlistItem);
    }
    if (playlistItem.isBibleItem) {
        const bibleItem = BibleItem.dragDeserialize(playlistItem.data);
        if (bibleItem === null) {
            return false;
        }
        return await checkIsBibleItemOnScreen([bibleItem]);
    }
    return false;
}

// The gate is deliberately NOT re-tested here: both callers below check it once
// before they start, and re-asking per file would re-read four settings for
// every playlist in the list.
async function checkIsPlaylistOnScreen(filePath: string) {
    const playlistItems = await Playlist.getInstance(filePath).getItems();
    if (playlistItems === null) {
        return false;
    }
    for (const playlistItem of playlistItems) {
        if (await checkIsPlaylistItemOnScreen(playlistItem)) {
            return true;
        }
    }
    return false;
}

/** Does this playlist hold anything that is live right now? */
export async function checkIsPlaylistFilePathOnScreen(filePath: string) {
    if (!checkIsAnythingOnScreen()) {
        return false;
    }
    return await checkIsPlaylistOnScreen(filePath);
}

export async function checkIsAnyPlaylistOnScreen(filePaths: string[]) {
    if (!checkIsAnythingOnScreen()) {
        return false;
    }
    for (const filePath of filePaths) {
        if (await checkIsPlaylistOnScreen(filePath)) {
            return true;
        }
    }
    return false;
}

/**
 * ONE screen subscription for the whole playlist tree, not one per row.
 *
 * `useScreenUpdateEvents` fans out into seven subscriptions, each holding its
 * own `useState` that fires on every screen event. Used per row that is 7 × N
 * state updates for a single "slide went on screen" — with a document expanded
 * to ~90 slide rows that is ~650 updates in one dispatch, which React rejects
 * with "Maximum update depth exceeded" and which stalls the very present the
 * user just asked for. Here the managers are subscribed once and each row only
 * re-renders when ITS OWN answer flips.
 *
 * A single shared debounce timer is correct in this one case (contrast the
 * per-instance rule in CLAUDE.md): it drives one pass that refreshes every
 * subscriber, so no row is left stale by another row's activity.
 */
type OnScreenSubscriberType = {
    checkIsOnScreen: () => boolean | Promise<boolean>;
    state: { value: boolean };
    notify: () => void;
};

const onScreenSubscribers = new Set<OnScreenSubscriberType>();
const refreshAttemptTimeout = genTimeoutAttempt(500);

async function refreshSubscriber(subscriber: OnScreenSubscriberType) {
    const isOnScreen = await subscriber.checkIsOnScreen();
    if (isOnScreen === subscriber.state.value) {
        return;
    }
    subscriber.state.value = isOnScreen;
    subscriber.notify();
}

function refreshAllSubscribers() {
    refreshAttemptTimeout(refreshOnScreenNow);
}

/**
 * Skip the debounce. The debounce exists to absorb bursts of screen events, but
 * the row the operator just clicked has to confirm itself at once — waiting
 * half a second for its own mark reads as "the playlist is slow" even though
 * the slide reached the screen in a few milliseconds.
 */
export function refreshOnScreenNow() {
    for (const subscriber of onScreenSubscribers) {
        refreshSubscriber(subscriber).catch(handleError);
    }
}

/**
 * What a row calls after it has put something on a screen.
 *
 * Yielded to the next macrotask on purpose: presenting is the operation the
 * operator is waiting on, and re-deriving every row's mark is bookkeeping. Run
 * inline it lands between the click and the frame that paints the new slide,
 * which is a visible stall on the low-spec machines this app targets — the pass
 * walks every subscribed row in the window, and a bible row deserializes its
 * verse to answer.
 *
 * `isImmediate` also cancels the debounced pass the same screen event has
 * already scheduled; that pass exists to answer this very change, so letting it
 * run too would do the identical walk a second time half a second later.
 */
export function refreshOnScreenAfterPresenting() {
    setTimeout(() => {
        refreshAttemptTimeout(refreshOnScreenNow, true);
    }, 0);
}

const screenUpdateSubscriber = genRefCountedScreenUpdateSubscriber(() => {
    return [
        ScreenVaryAppDocumentManager,
        ScreenBackgroundManager,
        ScreenBibleManager,
        ScreenForegroundManager,
    ];
}, refreshAllSubscribers);

function addOnScreenSubscriber(subscriber: OnScreenSubscriberType) {
    const release = screenUpdateSubscriber.acquire();
    onScreenSubscribers.add(subscriber);
    refreshSubscriber(subscriber).catch(handleError);
    return () => {
        release();
        onScreenSubscribers.delete(subscriber);
    };
}

export function useIsOnScreenChecking(
    checkIsOnScreen: () => boolean | Promise<boolean>,
    depsKey: string,
) {
    const checkIsOnScreenRef = useAppCurrentRef(checkIsOnScreen);
    // Re-created when the row starts describing a different element, so the
    // stale answer is dropped rather than shown until the next screen event.
    const state = useMemo(() => {
        return { value: false };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depsKey]);
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            return addOnScreenSubscriber({
                checkIsOnScreen: () => {
                    return checkIsOnScreenRef.current();
                },
                state,
                notify: onStoreChange,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [state],
    );
    const getSnapshot = useCallback(() => {
        return state.value;
    }, [state]);
    return useSyncExternalStore(subscribe, getSnapshot);
}
