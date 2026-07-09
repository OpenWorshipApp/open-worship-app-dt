import type { DOMAttributes, CSSProperties } from 'react';

import type { BibleItemType } from '../bible-list/bibleItemHelpers';
import type { BibleItemRenderingType } from './bibleScreenComps';
import { type TransitionEffectType } from './transitionEffectHelpers';

export type CustomEvents<K extends string> = {
    [key in K]: (event: CustomEvent) => void;
};
export type CustomElement<T, K extends string> = Partial<
    T &
        DOMAttributes<T> & {
            children: any;
        } & CustomEvents<`on${K}`>
>;

export type StyleAnimType = {
    styleText: string;
    animIn: (
        targetElement: HTMLElement,
        parentElement: HTMLElement,
    ) => Promise<void>;
    animOut: (targetElement: HTMLElement) => Promise<void>;
    duration: number;
};

export type PTFEventType = 'update';

export const bibleDataTypeList = ['bible-item', 'lyric'] as const;
export type BibleDataType = (typeof bibleDataTypeList)[number];
export type BibleItemDataType = {
    locale: string;
    type: BibleDataType;
    bibleItemData?: {
        renderedList: BibleItemRenderingType[];
        bibleItem: BibleItemType;
    };
    scroll: number;
    selectedKJVVerseKey: string | null;
};
export type BibleListType = {
    [key: string]: BibleItemDataType;
};

export const scaleTypeList = [
    'fill',
    'fit',
    'stretch',
    'tile',
    'center',
    'span',
] as const;
export type ImageScaleType = (typeof scaleTypeList)[number];

const _backgroundTypeList = [
    'color',
    'image',
    'video',
    'camera',
    'web',
    'audio',
] as const;
export type BackgroundType = (typeof _backgroundTypeList)[number];
export type BackgroundDataType = {
    src: string | null;
    scaleType?: ImageScaleType;
    extraStyle?: CSSProperties;
};
export type BackgroundSrcType = {
    type: BackgroundType;
    src: string;
    width?: number;
    height?: number;
    scaleType?: ImageScaleType;
    extraStyle?: CSSProperties;
};
export type BackgroundSrcListType = {
    [key: string]: BackgroundSrcType;
};

export type ForegroundCountdownDataType = {
    dateTime: Date;
    extraStyle?: CSSProperties;
};
export type ForegroundStopwatchDataType = {
    dateTime: Date;
    extraStyle?: CSSProperties;
};
export type ForegroundTimeDataType = {
    id: string;
    timezoneMinuteOffset: number;
    title: string | null;
    is24HourFormat?: boolean;
    extraStyle?: CSSProperties;
};
export const marqueePositionList = ['top', 'bottom'] as const;
export type MarqueePositionType = (typeof marqueePositionList)[number];
// Scroll speed as a percentage of the default pace: 200 scrolls twice as fast.
export const DEFAULT_MARQUEE_SPEED_PERCENTAGE = 100;
export const MIN_MARQUEE_SPEED_PERCENTAGE = 10;
export const MAX_MARQUEE_SPEED_PERCENTAGE = 1000;
export type ForegroundMarqueeDataType = {
    text: string;
    speedPercentage?: number;
    extraStyle?: CSSProperties;
};
export type ForegroundQuickTextDataType = {
    htmlText: string;
    timeSecondDelay: number;
    timeSecondToLive: number;
    extraStyle?: CSSProperties;
};
export type ForegroundCameraDataType = {
    id: string;
    extraStyle?: CSSProperties;
};
export type ForegroundWebDataType = {
    filePath: string;
    widthScale: number;
    heightScale: number;
    extraStyle?: CSSProperties;
};
export type ForegroundDataType = {
    countdownData: ForegroundCountdownDataType | null;
    stopwatchData: ForegroundStopwatchDataType | null;
    timeDataList: ForegroundTimeDataType[];
    marqueeTopData: ForegroundMarqueeDataType | null;
    marqueeBottomData: ForegroundMarqueeDataType | null;
    quickTextData: ForegroundQuickTextDataType | null;
    cameraDataList: ForegroundCameraDataType[];
    webDataList: ForegroundWebDataType[];
};
export type ForegroundSrcListType = {
    [key: string]: ForegroundDataType;
};

export type BoundsType = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type DisplayType = {
    id: number;
    bounds: BoundsType;
};
export type AllDisplayType = {
    primaryDisplay: DisplayType;
    displays: DisplayType[];
};

export const screenTypeList = [
    'background',
    'vary-app-document',
    'bible-screen-view',
    'bible-screen-view-text-style',
    'foreground',
    'bible-screen-view-selected-index',
    'display-change',
    'visible',
    'init',
    'effect',
    'background-video-time',
    'sync-scroll-percentage',
] as const;
export type ScreenType = (typeof screenTypeList)[number];
export type BasicScreenMessageType = {
    type: ScreenType;
    data: any;
};
export type ScreenMessageType = BasicScreenMessageType & {
    screenId: number;
};

export type SetDisplayType = {
    screenId: number;
    displayId: number;
};

export type ShowScreenDataType = {
    screenId: number;
    displayId: number;
};

export type PTEffectDataType = {
    target: string;
    effect: TransitionEffectType;
};
