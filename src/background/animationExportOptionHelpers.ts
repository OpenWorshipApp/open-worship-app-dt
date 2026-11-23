import { dirSourceSettingNames } from '../helper/constants';
import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    resolveActiveSessionId,
    toSessionSuffix,
} from '../media-sessions/mediaSessionData';
import type { AnimationAgentPlaceType } from './animationAgentEditorRegistry';
import { toArchiveFileName } from '../helper/archiveNameHelpers';
import {
    ANIMATION_SPEED_FACTOR_MAP,
    ANIMATION_STILL_TIME_SECONDS,
    type AnimationType,
} from './animationValueHelpers';

/**
 * What Save as Image / Save as Video on the Animations picker are asked for
 * and where they write -- the part of it that is plain values, so a test
 * can hold it without a window. Loaded only once one of those buttons is
 * pressed (`AnimationExportButtonsComp`).
 */

export type AnimationExportKindType = 'image' | 'video';

export type AnimationExportOptionsType = {
    width: number;
    height: number;
    /** Video only. */
    seconds: number;
    /** Video only. */
    frameRate: number;
};

export type AnimationExportSizeType = { width: number; height: number };

export const ANIMATION_EXPORT_SIZE_PRESET_LIST: AnimationExportSizeType[] = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
];
export const ANIMATION_EXPORT_FRAME_RATE_LIST = [24, 30, 60];
export const MIN_ANIMATION_EXPORT_EDGE = 16;
export const MAX_ANIMATION_EXPORT_EDGE = 4096;
export const MIN_ANIMATION_EXPORT_SECONDS = 1;
export const MAX_ANIMATION_EXPORT_SECONDS = 300;

export const DEFAULT_ANIMATION_EXPORT_OPTIONS: AnimationExportOptionsType = {
    width: 1920,
    height: 1080,
    seconds: 10,
    frameRate: 30,
};

const OPTIONS_SETTING_NAME = 'animation-export-options';

/** An edge H.264 can take: whole, even, within bounds. */
export function toAnimationExportEdge(value: unknown) {
    const number = Math.round(Number(value) || 0);
    const clamped = Math.max(
        MIN_ANIMATION_EXPORT_EDGE,
        Math.min(MAX_ANIMATION_EXPORT_EDGE, number),
    );
    return clamped - (clamped % 2);
}

export function toAnimationExportSeconds(value: unknown) {
    const number = Math.round(Number(value) || 0);
    return Math.max(
        MIN_ANIMATION_EXPORT_SECONDS,
        Math.min(MAX_ANIMATION_EXPORT_SECONDS, number),
    );
}

export function toAnimationExportFrameRate(value: unknown) {
    const number = Number(value);
    return ANIMATION_EXPORT_FRAME_RATE_LIST.includes(number)
        ? number
        : DEFAULT_ANIMATION_EXPORT_OPTIONS.frameRate;
}

export function toValidAnimationExportOptions(
    value: Partial<AnimationExportOptionsType> | null | undefined,
): AnimationExportOptionsType {
    const options = { ...DEFAULT_ANIMATION_EXPORT_OPTIONS, ...(value ?? {}) };
    return {
        width: toAnimationExportEdge(options.width),
        height: toAnimationExportEdge(options.height),
        seconds: toAnimationExportSeconds(options.seconds),
        frameRate: toAnimationExportFrameRate(options.frameRate),
    };
}

/** The last options chosen, for either button: one size for both. */
export function readAnimationExportOptions() {
    try {
        const raw = getSetting(OPTIONS_SETTING_NAME);
        return toValidAnimationExportOptions(raw ? JSON.parse(raw) : null);
    } catch {
        return { ...DEFAULT_ANIMATION_EXPORT_OPTIONS };
    }
}

export function saveAnimationExportOptions(
    options: AnimationExportOptionsType,
) {
    setSetting(
        OPTIONS_SETTING_NAME,
        JSON.stringify(toValidAnimationExportOptions(options)),
    );
}

/** Each size once, in the order given, an odd edge made even. */
export function listAnimationExportSizes(
    displaySizes: AnimationExportSizeType[],
) {
    const found: AnimationExportSizeType[] = [];
    for (const size of [
        ...ANIMATION_EXPORT_SIZE_PRESET_LIST,
        ...displaySizes,
    ]) {
        const width = toAnimationExportEdge(size.width);
        const height = toAnimationExportEdge(size.height);
        if (
            !found.some((item) => {
                return item.width === width && item.height === height;
            })
        ) {
            found.push({ width, height });
        }
    }
    return found;
}

const DIR_SETTING_NAME_MAP: Record<
    AnimationAgentPlaceType,
    Record<AnimationExportKindType, string>
> = {
    background: {
        image: dirSourceSettingNames.BACKGROUND_IMAGE,
        video: dirSourceSettingNames.BACKGROUND_VIDEO,
    },
    foreground: {
        image: dirSourceSettingNames.FOREGROUND_IMAGE,
        video: dirSourceSettingNames.FOREGROUND_VIDEO,
    },
};

/**
 * The folder setting of the session in use in the panel a picture or video
 * of `place` belongs in: the Background Images / Videos tab, or Image Show /
 * Video Show. Each session owns a folder (`${base}-${id}`, Default the base
 * itself), and its session list lives under `${place}-${kind}` -- which is
 * NOT the folder setting's name, so `getActiveDirSourceSettingName` does
 * not apply here.
 */
export function toAnimationExportDirSettingName(
    place: AnimationAgentPlaceType,
    kind: AnimationExportKindType,
) {
    const base = DIR_SETTING_NAME_MAP[place][kind];
    return `${base}${toSessionSuffix(resolveActiveSessionId(`${place}-${kind}`))}`;
}

export function genAnimationExportFileName(
    label: string,
    kind: AnimationExportKindType,
    options: AnimationExportOptionsType,
) {
    const size = `${options.width}x${options.height}`;
    return toArchiveFileName(
        `${label} ${size}`,
        kind === 'image' ? '.png' : '.mp4',
        `animation ${size}`,
    );
}

/**
 * The moment of the animation frame `frameIndex` shows, in seconds as it
 * runs: it starts at the still its tile shows rather than at nothing yet.
 * A shader is drawn at that moment times its speed (its `iTime`); a CSS
 * page's own clock is wall time, its speed in its durations and
 * `playbackRate` (`animationCaptureHelpers`).
 */
export function toAnimationExportWallSeconds(
    frameIndex: number,
    frameRate: number,
) {
    return ANIMATION_STILL_TIME_SECONDS + frameIndex / frameRate;
}

export function toAnimationShaderTime(
    animation: AnimationType,
    wallSeconds: number,
) {
    return wallSeconds * ANIMATION_SPEED_FACTOR_MAP[animation.speed];
}

// H.264 levels: the most macroblocks a frame and a second each allows.
const H264_LEVEL_LIST = [
    { hex: '1F', frameMacroblocks: 3600, secondMacroblocks: 108000 },
    { hex: '28', frameMacroblocks: 8192, secondMacroblocks: 245760 },
    { hex: '2A', frameMacroblocks: 8704, secondMacroblocks: 522240 },
    { hex: '32', frameMacroblocks: 22080, secondMacroblocks: 589824 },
    { hex: '33', frameMacroblocks: 36864, secondMacroblocks: 983040 },
    { hex: '34', frameMacroblocks: 36864, secondMacroblocks: 2073600 },
];

/**
 * The H.264 codecs tried, High then Main then Baseline, at the lowest level
 * that holds this size and frame rate -- the encoder refuses a level too
 * small, and a player may refuse one too big.
 */
export function listAnimationExportCodecs(
    width: number,
    height: number,
    frameRate: number,
) {
    const frameMacroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
    const secondMacroblocks = frameMacroblocks * frameRate;
    const level =
        H264_LEVEL_LIST.find((item) => {
            return (
                frameMacroblocks <= item.frameMacroblocks &&
                secondMacroblocks <= item.secondMacroblocks
            );
        }) ?? H264_LEVEL_LIST[H264_LEVEL_LIST.length - 1];
    return [
        `avc1.6400${level.hex}`,
        `avc1.4D00${level.hex}`,
        `avc1.42E0${level.hex}`,
    ];
}

/** About 0.1 bit a pixel a frame: 1080p30 ~6 Mbps, never past 40. */
export function toAnimationExportBitrate(
    width: number,
    height: number,
    frameRate: number,
) {
    return Math.min(
        40_000_000,
        Math.max(1_000_000, Math.round(width * height * frameRate * 0.1)),
    );
}
