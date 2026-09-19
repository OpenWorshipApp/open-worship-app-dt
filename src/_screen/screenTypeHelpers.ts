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

// Drawing coordinates are stored in NATIVE screen pixels (0..width, 0..height)
// so a stroke drawn on the scaled mini-preview renders identically on the
// real (unscaled) output window and on every sync-group member.
export type DrawPaintPointType = {
    x: number;
    y: number;
};
export type DrawPaintStrokeType = {
    id: string;
    color: string;
    size: number;
    points: DrawPaintPointType[];
    isStraight?: boolean;
    is3D?: boolean;
    isDots?: boolean;
    // A manual-eraser stroke: rendered with `destination-out` so it punches
    // transparent holes through everything painted before it (see drawStroke).
    isEraser?: boolean;
};
export type DrawDataType = {
    paintStrokeList: DrawPaintStrokeType[];
};

// Which control the previewer's draw button currently drives. They are two
// independent overlays (`#draw` paints strokes, `#focus` masks the screen), and
// the 3-dots menu only picks WHICH one the button and panel act on.
export const drawModeList = ['paint', 'focus'] as const;
export type DrawModeType = (typeof drawModeList)[number];

// Spotlight state. No strokes and no history: the mask is a single moving hole,
// so the whole thing is four numbers on the wire. Coordinates are NATIVE screen
// pixels, like the draw overlay, so a spotlight aimed on the CSS-scaled
// mini-preview lands in the same place on the unscaled output.
export type FocusDataType = {
    // false = no mask at all (the overlay is fully transparent).
    isSpotlighting: boolean;
    point: DrawPaintPointType | null;
    // Hole diameter in native screen px.
    size: number;
    // `#rrggbb` the mask is tinted with. Black is the usual choice, but a dark
    // brand colour reads better over some backgrounds.
    dimColor: string;
    // The mask colour's ALPHA, 0..100 — how much of the screen it hides.
    dimOpacity: number;
    // Softness of the hole's rim as a percentage of its radius. 0 is a hard
    // cut-out; 100 fades all the way from the centre.
    edgeBlur: number;
    // Inverts the mask: the circle under the pointer becomes the BLOCKED area
    // and the rest of the screen stays clear, instead of the other way round.
    isContrast: boolean;
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
    'vary-app-document-video-time',
    'sync-scroll-percentage',
    'draw',
    'focus',
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
