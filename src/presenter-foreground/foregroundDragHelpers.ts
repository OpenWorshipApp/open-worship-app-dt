import type ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type DragInf from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';
import { withForegroundLayer } from '../_screen/screenTypeHelpers';
import {
    genCountdownTiming,
    genStopwatchTiming,
} from '../_screen/managers/timerStateHelpers';

// Foregrounds used to travel to a screen ONLY through `dragStore.onDropped` — a
// live closure that dies with the drag. That is enough to drop one on a screen,
// but a presenting flow has to store a foreground and replay it days later, so every
// foreground now also serializes itself into the drag payload. The closure is
// still set as well: it stays the fallback for anything that reads it directly.
export const foregroundDragTargetList = [
    'message',
    'countdown',
    'stopwatch',
    'time',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
    'video',
    'image',
    'camera',
    'web',
] as const;
export type ForegroundDragTargetType =
    (typeof foregroundDragTargetList)[number];

export type ForegroundDragDataType = {
    target: ForegroundDragTargetType;
    data: any;
};

/**
 * The ENGLISH key for each widget, translated where the label is BUILT rather
 * than stored: a presenting flow row resolves its title on every render
 * (`PresentingFlowItem`), so a row added in one language still reads in the
 * one the app is shown in. Every value here has to exist in the dictionaries —
 * the lookup below is dynamic, so `tranKeyCoverage.test.ts` cannot see it and
 * a missing one would only show as a throw in a Khmer window.
 */
const targetLabelMap: Record<ForegroundDragTargetType, string> = {
    message: 'Messages',
    countdown: 'Countdown',
    stopwatch: 'Stopwatch',
    time: 'Time',
    'marquee-top': 'Marquee Top',
    'marquee-bottom': 'Marquee Bottom',
    'quick-text': 'Quick Text',
    video: 'Video Show',
    image: 'Image Show',
    camera: 'Camera Show',
    web: 'Web Show',
};

const targetIconMap: Record<ForegroundDragTargetType, string> = {
    message: 'chat-left-text',
    countdown: 'hourglass-split',
    stopwatch: 'stopwatch',
    time: 'clock',
    'marquee-top': 'chevron-bar-up',
    'marquee-bottom': 'chevron-bar-down',
    'quick-text': 'chat-square-text',
    video: 'camera-reels',
    image: 'images',
    camera: 'camera-video',
    web: 'globe2',
};

export function genForegroundDragInf(
    target: ForegroundDragTargetType,
    getData: () => any,
): DragInf<ForegroundDragDataType> {
    return {
        dragSerialize: () => {
            return {
                type: DragTypeEnum.FOREGROUND,
                data: { target, data: getData() },
            };
        },
    };
}

export function foregroundDragDeserialize(
    data: any,
): ForegroundDragDataType | null {
    if (
        data === null ||
        typeof data !== 'object' ||
        !foregroundDragTargetList.includes(data.target) ||
        data.data === null ||
        typeof data.data !== 'object'
    ) {
        return null;
    }
    return { target: data.target, data: data.data };
}

export function toForegroundDragIconName(target: ForegroundDragTargetType) {
    return targetIconMap[target] ?? 'front';
}

/**
 * The second a stored run-sheet row's `durationSecond` carries beyond what was
 * typed. The countdown once added it so its display (rounded down) opened on
 * `05:00` rather than `04:59`; it rounds UP now and needs none, but every row
 * already saved has it, so a row still WRITES it and every reader of a row
 * takes it back off -- one rule for old rows and new.
 */
export const COUNTDOWN_LEAD_SECOND = 1;

/** `1h 5m`, `5m`, `1m 30s`, `45s` -- only the parts that are not zero. */
function toDurationLabel(totalSecond: number) {
    const second = Math.max(0, Math.round(totalSecond));
    const unitList: [number, string][] = [
        [Math.floor(second / 3600), 'h'],
        [Math.floor((second % 3600) / 60), 'm'],
        [second % 60, 's'],
    ];
    const parts = unitList
        .filter(([value]) => {
            return value !== 0;
        })
        .map(([value, unit]) => {
            return `${value}${unit}`;
        });
    return parts.length > 0 ? parts.join(' ') : '0s';
}

/**
 * `translate` is passed IN rather than `tran` being imported here: this module
 * is on the screen path, and `langHelpers` pulls `appHooks` (and React) behind
 * it. Left out, the label comes back in English — which is what the presenting
 * flow file stores, so the record on disk stays language-neutral; the row
 * hands `tran` in so what the operator READS follows the app's language.
 */
export function toForegroundDragLabel(
    { target, data }: ForegroundDragDataType,
    translate: (labelKey: string) => string = (labelKey) => {
        return labelKey;
    },
) {
    // A `target` the map does not know can only come from a hand-edited or
    // future presenting flow file; it is not a dictionary key, so it is shown
    // as it is rather than translated, which would throw in a Khmer window
    // over a file the user cannot see into.
    const labelKey = targetLabelMap[target];
    const label = labelKey === undefined ? target : translate(labelKey);
    if (target === 'marquee-top' || target === 'marquee-bottom') {
        return `${label}: ${(data.text ?? '').substring(0, 60)}`;
    }
    if (target === 'quick-text') {
        return `${label}: ${(data.markdownText ?? '').substring(0, 60)}`;
    }
    if (target === 'message') {
        // One message reads as itself; several are identified by HOW MANY,
        // because a rotating board's first line is rarely the memorable one.
        const textList: string[] = data.textList ?? [];
        return textList.length === 1
            ? `${label}: ${(textList[0] ?? '').substring(0, 60)}`
            : `${label}: ${textList.length}`;
    }
    if (target === 'time') {
        return `${label}: ${data.title || 'UTC' + data.timezoneMinuteOffset}`;
    }
    if (target === 'countdown') {
        if (typeof data.durationSecond === 'number') {
            return `${label}: ${toDurationLabel(
                data.durationSecond - COUNTDOWN_LEAD_SECOND,
            )}`;
        }
        return `${label}: ${data.dateTime ?? ''}`;
    }
    return label;
}

// A countdown dragged from the "duration" form must count from the moment it is
// SHOWN, not from the moment it was dragged — otherwise replaying it out of a
// presenting flow next Sunday would start already expired. The absolute-date form keeps
// its date, which is exactly what that form means.
//
// A row's `isAutoStart` is the panel's switch when it was dragged; a row saved
// before the switch existed has none, and starts at once as it always did.
function toCountdownTiming(data: any) {
    if (typeof data.durationSecond === 'number') {
        return genCountdownTiming(
            data.durationSecond - COUNTDOWN_LEAD_SECOND,
            data.isAutoStart !== false,
        );
    }
    return { dateTime: new Date(data.dateTime) };
}

/**
 * Which stored row put a countdown, a stopwatch or a quick text up.
 *
 * Those three keep nothing of the row on the screen to compare against: a
 * countdown's time is worked out when it is SHOWN, and a quick text holds the
 * rendered html rather than its markdown. So the run sheet marked every such
 * row live while ANY one of that kind was up -- the panel's own included.
 * `applyForegroundDragData` stamps this key, read off the row's own payload,
 * on what it puts up, and `presentingFlowOnScreenHelpers` matches on it. A
 * short hash rather than the payload itself, because the screen data is
 * saved whole into the on-screen setting.
 */
export function toForegroundRowKey(data: unknown) {
    const text = JSON.stringify(data ?? null);
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export async function applyForegroundDragData(
    screenForegroundManager: ScreenForegroundManager,
    { target, data }: ForegroundDragDataType,
) {
    const { extraStyle } = data;
    // The four rebuilt below are built field by field, so the layer has to be
    // carried across by hand; the rest replay `data` whole and keep it.
    const isBehind = data.isBehind === true;
    const rowKey = toForegroundRowKey(data);
    if (target === 'message') {
        screenForegroundManager.addMessageData(
            withForegroundLayer(
                {
                    // A stored run-sheet row replays the whole SESSION, so it
                    // lands under the same reserved id the panel's own "show
                    // all" uses -- replaying twice must not stack two copies
                    // on the screen.
                    id: 'message-all',
                    textList: data.textList ?? [],
                    intervalSecond: data.intervalSecond ?? null,
                    extraStyle,
                },
                isBehind,
            ),
        );
    } else if (target === 'countdown') {
        screenForegroundManager.setCountdownData(
            withForegroundLayer(
                { ...toCountdownTiming(data), extraStyle, rowKey },
                isBehind,
            ),
        );
    } else if (target === 'stopwatch') {
        // `isAutoStart` as for the countdown above.
        screenForegroundManager.setStopwatchData(
            withForegroundLayer(
                {
                    ...genStopwatchTiming(data.isAutoStart !== false),
                    extraStyle,
                    rowKey,
                },
                isBehind,
            ),
        );
    } else if (target === 'time') {
        screenForegroundManager.addTimeData(data);
    } else if (target === 'marquee-top') {
        screenForegroundManager.setMarqueeTopData(data);
    } else if (target === 'marquee-bottom') {
        screenForegroundManager.setMarqueeBottomData(data);
    } else if (target === 'quick-text') {
        // The markdown source travels, not the rendered html: the renderer is a
        // heavy import and a stored presenting flow entry should re-render with the
        // current markdown settings.
        const { renderMarkdown } =
            await import('../lyric-list/markdownHelpers');
        const { html } = await renderMarkdown(data.markdownText ?? '');
        screenForegroundManager.setQuickTextData(
            withForegroundLayer(
                {
                    htmlText: html,
                    timeSecondDelay: data.timeSecondDelay,
                    timeSecondToLive: data.timeSecondToLive,
                    extraStyle,
                    rowKey,
                },
                isBehind,
            ),
        );
    } else if (target === 'camera') {
        screenForegroundManager.addCameraData(data);
    } else if (target === 'web') {
        screenForegroundManager.addWebData(data);
    } else if (target === 'video') {
        screenForegroundManager.addVideoData(data);
    } else if (target === 'image') {
        screenForegroundManager.addImageData(data);
    }
}
