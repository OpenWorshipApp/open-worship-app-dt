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
    /**
     * Which SESSION of the widget put this up. A session is one saved set-up of
     * the panel -- its own words or numbers and its own Properties -- and it is
     * what the panel's session strip marks as being on a screen. Only one of
     * these can be up at a time, so a new one REPLACES whatever was there,
     * whichever session owned it; an entry with no id is the Default session's.
     */
    id?: string;
    dateTime: Date;
    extraStyle?: CSSProperties;
};
export type ForegroundStopwatchDataType = {
    /** The widget SESSION that put this up -- see `ForegroundCountdownDataType`. */
    id?: string;
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
    /** The widget SESSION that put this up -- see `ForegroundCountdownDataType`. */
    id?: string;
    text: string;
    speedPercentage?: number;
    extraStyle?: CSSProperties;
};
/**
 * A line of text put up FAST and left up until somebody takes it down -- the
 * unplanned mid-service message ("blue Toyota, lights on", "the nursery needs
 * a parent").
 *
 * It is deliberately NOT Quick Text, which is markdown, has a delay and a
 * time-to-live, and removes ITSELF. An alert carries no clock at all, because
 * the thing that ends it is the person who put it up -- the operator must
 * never be racing a countdown they cannot see.
 *
 * The text is PLAIN, and that is a safety property as much as a speed one:
 * it is rendered as a React text child, so the markup is escaped by the
 * renderer and never passes through `sanitizeHtml`, which is still a no-op
 * placeholder in a renderer that has node integration.
 */
/**
 * Words put over whatever else is live, and left there until somebody takes
 * them down -- the unplanned mid-service message ("blue Toyota, lights on")
 * and the notice board that runs before a service, which are the same thing
 * with and without a rotation.
 *
 * Deliberately NOT Quick Text, which is markdown, has a delay and a
 * time-to-live, and removes ITSELF. These carry no clock that ends them,
 * because the thing that ends them is the person who put them up -- an
 * operator must never be racing a countdown they cannot see.
 *
 * The text is PLAIN, and that is a safety property as much as a speed one: it
 * is rendered as a React text child, so the renderer escapes it and it never
 * passes through `sanitizeHtml`, which is still a no-op placeholder in a
 * renderer that has node integration.
 */
export type ForegroundMessageDataType = {
    /**
     * Which EDITOR in the panel put this up. A session holds several message
     * editors, each with its own Show button, so several messages can be on a
     * screen at once and each has to be findable to take down again -- exactly
     * how `timeDataList` keys its clocks.
     *
     * The one the "show all in turn" button puts up carries its own reserved
     * id, because it stands for the whole set rather than for one editor.
     */
    id: string;
    /**
     * The message, as LINES. One editor's text is split on newlines, so a
     * message may be several lines; a rotating set carries one entry per
     * message instead.
     */
    textList: string[];
    /**
     * Seconds each entry holds before the next, or `null` to show the FIRST
     * one and never move -- which is what one editor's Show does.
     *
     * Rotation is a timer that swaps the text and transitions `opacity` --
     * there is no `infinite` keyframe anywhere in it, because this is mounted
     * at rest for a whole pre-service slot and an infinite paint animation
     * there is what held the idle Reader at 235 paints/s. Nothing rotates
     * with fewer than two entries, so no timer is started for one.
     */
    intervalSecond: number | null;
    extraStyle?: CSSProperties;
};

export type ForegroundQuickTextDataType = {
    /** The widget SESSION that put this up -- see `ForegroundCountdownDataType`. */
    id?: string;
    htmlText: string;
    timeSecondDelay: number;
    timeSecondToLive: number;
    extraStyle?: CSSProperties;
};
export type ForegroundCameraDataType = {
    /**
     * How this overlay comes in and goes out. Chosen per SESSION in the
     * widget's own Properties, not on the screen's Tr: row -- that one
     * covers a whole layer, and two overlays on the foreground at once
     * is the ordinary case here.
     */
    transitionEffect?: TransitionEffectType;
    id: string;
    extraStyle?: CSSProperties;
};
export type ForegroundWebDataType = {
    /**
     * How this overlay comes in and goes out. Chosen per SESSION in the
     * widget's own Properties, not on the screen's Tr: row -- that one
     * covers a whole layer, and two overlays on the foreground at once
     * is the ordinary case here.
     */
    transitionEffect?: TransitionEffectType;
    filePath: string;
    widthScale: number;
    heightScale: number;
    /** The widget SESSION that put this up -- see `ForegroundVideoDataType`. */
    id?: string;
    extraStyle?: CSSProperties;
};
/**
 * A clip or a picture shown OVER the slide rather than behind it -- the
 * Foreground panel's Video Show and Image Show. Size and place come from
 * `extraStyle` like every other foreground widget, which is also where the
 * blend mode rides, so there is no `scaleType` here: a background fills the
 * screen, an overlay is aimed by hand.
 */
export type ForegroundVideoDataType = {
    /**
     * How this overlay comes in and goes out. Chosen per SESSION in the
     * widget's own Properties, not on the screen's Tr: row -- that one
     * covers a whole layer, and two overlays on the foreground at once
     * is the ordinary case here.
     */
    transitionEffect?: TransitionEffectType;
    filePath: string;
    /**
     * Which SESSION of the widget put this up -- a session is one saved set-up
     * (its own folder, Properties and slide show), and several of them are how
     * one widget holds several overlays at once. Picking a new file replaces
     * the entry with the same id and leaves every other session's alone.
     */
    id?: string;
    extraStyle?: CSSProperties;
    /**
     * Let this clip be HEARD. Off by default and per session, because an
     * overlay is decoration running under whatever the service is doing and
     * an unmuted one fights the song; a clip that IS the moment -- a
     * testimony, a trailer -- turns it on.
     */
    isSoundOn?: boolean;
    /** 0-100, the clip's own level. Only meaningful with `isSoundOn`. */
    soundVolume?: number;
};
export type ForegroundImageDataType = {
    /**
     * How this overlay comes in and goes out. Chosen per SESSION in the
     * widget's own Properties, not on the screen's Tr: row -- that one
     * covers a whole layer, and two overlays on the foreground at once
     * is the ordinary case here.
     */
    transitionEffect?: TransitionEffectType;
    filePath: string;
    id?: string;
    extraStyle?: CSSProperties;
};
export type ForegroundDataType = {
    messageDataList: ForegroundMessageDataType[];
    countdownData: ForegroundCountdownDataType | null;
    stopwatchData: ForegroundStopwatchDataType | null;
    timeDataList: ForegroundTimeDataType[];
    marqueeTopData: ForegroundMarqueeDataType | null;
    marqueeBottomData: ForegroundMarqueeDataType | null;
    quickTextData: ForegroundQuickTextDataType | null;
    cameraDataList: ForegroundCameraDataType[];
    webDataList: ForegroundWebDataType[];
    videoDataList: ForegroundVideoDataType[];
    imageDataList: ForegroundImageDataType[];
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

/**
 * The BLANKING shape for a room -- solid bars that cover the edges of the
 * projector's picture so it stops short of an organ pipe, a window frame, or
 * the bottom of a screen that only comes half way down.
 *
 * Two things it is NOT, both deliberate:
 *
 * - It is not the Focus spotlight. That one is a live pointer, re-aimed by
 *   hand, and it is gone the moment it is switched off. This is ROOM GEOMETRY:
 *   measured once, right for as long as the projector sits where it sits.
 * - It is therefore not content, so `ScreenManager.clear()` does NOT touch it.
 *   `Clear All` mid-service must not hand the congregation a picture spilling
 *   onto the wall above the screen, and an operator who pressed the panic key
 *   is the last person who should have to re-measure a mask.
 *
 * Each inset is a percentage of the screen's own width or height, so one mask
 * is right whatever resolution the display reports and survives the projector
 * being swapped. Cost at rest is zero: four static divs, no timer, no
 * animation, nothing that repaints once painted.
 */
export type MaskDataType = {
    topPercentage: number;
    rightPercentage: number;
    bottomPercentage: number;
    leftPercentage: number;
    // `#rrggbb`. Black for a dark room; a projector with poor black level
    // sometimes reads better masked in the wall's own colour.
    color: string;
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
    'mask',
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
