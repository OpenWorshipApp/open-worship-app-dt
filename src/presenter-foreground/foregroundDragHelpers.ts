import type ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type DragInf from '../helper/DragInf';
import { DragTypeEnum } from '../helper/DragInf';

// Foregrounds used to travel to a screen ONLY through `dragStore.onDropped` — a
// live closure that dies with the drag. That is enough to drop one on a screen,
// but a presenting flow has to store a foreground and replay it days later, so every
// foreground now also serializes itself into the drag payload. The closure is
// still set as well: it stays the fallback for anything that reads it directly.
export const foregroundDragTargetList = [
    'countdown',
    'stopwatch',
    'time',
    'marquee-top',
    'marquee-bottom',
    'quick-text',
    'camera',
    'web',
] as const;
export type ForegroundDragTargetType =
    (typeof foregroundDragTargetList)[number];

export type ForegroundDragDataType = {
    target: ForegroundDragTargetType;
    data: any;
};

const targetLabelMap: Record<ForegroundDragTargetType, string> = {
    countdown: 'Countdown',
    stopwatch: 'Stopwatch',
    time: 'Time',
    'marquee-top': 'Marquee Top',
    'marquee-bottom': 'Marquee Bottom',
    'quick-text': 'Quick Text',
    camera: 'Camera Show',
    web: 'Web Show',
};

const targetIconMap: Record<ForegroundDragTargetType, string> = {
    countdown: 'hourglass-split',
    stopwatch: 'stopwatch',
    time: 'clock',
    'marquee-top': 'chevron-bar-up',
    'marquee-bottom': 'chevron-bar-down',
    'quick-text': 'chat-square-text',
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

export function toForegroundDragLabel({
    target,
    data,
}: ForegroundDragDataType) {
    const label = targetLabelMap[target] ?? target;
    if (target === 'marquee-top' || target === 'marquee-bottom') {
        return `${label}: ${(data.text ?? '').substring(0, 60)}`;
    }
    if (target === 'quick-text') {
        return `${label}: ${(data.markdownText ?? '').substring(0, 60)}`;
    }
    if (target === 'time') {
        return `${label}: ${data.title || 'UTC' + data.timezoneMinuteOffset}`;
    }
    if (target === 'countdown') {
        if (typeof data.durationSecond === 'number') {
            return `${label}: ${Math.round(data.durationSecond / 60)}m`;
        }
        return `${label}: ${data.dateTime ?? ''}`;
    }
    return label;
}

// A countdown dragged from the "duration" form must count from the moment it is
// SHOWN, not from the moment it was dragged — otherwise replaying it out of a
// presenting flow next Sunday would start already expired. The absolute-date form keeps
// its date, which is exactly what that form means.
function toCountdownDateTime(data: any) {
    if (typeof data.durationSecond === 'number') {
        return new Date(Date.now() + data.durationSecond * 1000);
    }
    return new Date(data.dateTime);
}

export async function applyForegroundDragData(
    screenForegroundManager: ScreenForegroundManager,
    { target, data }: ForegroundDragDataType,
) {
    const { extraStyle } = data;
    if (target === 'countdown') {
        screenForegroundManager.setCountdownData({
            dateTime: toCountdownDateTime(data),
            extraStyle,
        });
    } else if (target === 'stopwatch') {
        screenForegroundManager.setStopwatchData({
            dateTime: new Date(),
            extraStyle,
        });
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
        screenForegroundManager.setQuickTextData({
            htmlText: html,
            timeSecondDelay: data.timeSecondDelay,
            timeSecondToLive: data.timeSecondToLive,
            extraStyle,
        });
    } else if (target === 'camera') {
        screenForegroundManager.addCameraData(data);
    } else if (target === 'web') {
        screenForegroundManager.addWebData(data);
    }
}
