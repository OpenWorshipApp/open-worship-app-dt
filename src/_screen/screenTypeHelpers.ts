import { DOMAttributes, CSSProperties } from 'react';

import { BibleItemType } from '../bible-list/bibleItemHelpers';
import { BibleItemRenderingType } from './bibleScreenComps';

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

export const transitionEffect = {
    fade: ['bi bi-shadows'],
    move: ['bi bi-align-end'],
    zoom: ['bi bi-arrows-fullscreen'],
} as const;
export type ScreenTransitionEffectType = keyof typeof transitionEffect;
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

const _backgroundTypeList = ['color', 'image', 'video', 'audio'] as const;
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
    extraStyle?: CSSProperties;
};
export type ForegroundMarqueDataType = {
    text: string;
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
export type ForegroundDataType = {
    countdownData: ForegroundCountdownDataType | null;
    stopwatchData: ForegroundStopwatchDataType | null;
    timeDataList: ForegroundTimeDataType[];
    marqueeData: ForegroundMarqueDataType | null;
    quickTextData: ForegroundQuickTextDataType | null;
    cameraDataList: ForegroundCameraDataType[];
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
    'bible-screen-view-scroll',
    'bible-screen-view-text-style',
    'foreground',
    'bible-screen-view-selected-index',
    'display-change',
    'visible',
    'init',
    'effect',
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
    effect: ScreenTransitionEffectType;
};
