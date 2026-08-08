import type { CSSProperties } from 'react';

import type { SrcData } from '../../helper/FileSource';
import type { AppColorType } from '../../others/color/colorHelpers';
import type { AnyObjectType } from '../../helper/typeHelpers';
import type { UrlMediaSourceType } from '../../helper/mediaSourceHelpers';
import { isSupportedExt, isSupportedMimetype } from '../../server/fileHelpers';

export type CanvasControllerEventType = 'update' | 'scale' | 'reload';

export type CanvasItemMediaDimPropsType = {
    mediaWidth: number;
    mediaHeight: number;
};

// Images embed their data inline (`srcData`) unless they came from a link, in
// which case that link is the source verbatim — `<img>` loads a data URI, a
// remote link and a `file://` attachment link alike. Videos would balloon the
// slide document if inlined, so they reference their source file by path
// instead.
export type CanvasItemMediaPropsType = CanvasItemMediaDimPropsType & {
    srcData: SrcData | UrlMediaSourceType;
};

export type CanvasItemVideoMediaPropsType = CanvasItemMediaDimPropsType & {
    filePath: string;
};

// Audio has no natural dimensions, so unlike a video it carries only its
// source file path — the box sizes the player control itself.
export type CanvasItemFilePathPropsType = {
    filePath: string;
};

// Shared by the URL-embedding canvas items (YouTube, Website): they only need
// the source URL — the box carries its own width/height like any other item.
export type CanvasItemUrlPropsType = {
    url: string;
};

export const cameraObjectFitList = ['cover', 'contain', 'fill'] as const;
export type CameraObjectFitType = (typeof cameraObjectFitList)[number];

// A live camera feed has no source file and no size known ahead of its stream
// opening. `deviceId` is stored alongside the human-readable `label` because
// Chromium rotates device ids per origin and session — reopening the document
// tomorrow has to find the same camera by name.
export type CanvasItemCameraDevicePropsType = {
    deviceId: string;
    label: string;
    isMirrored: boolean;
    objectFit: CameraObjectFitType;
};

// A webcam's resolution is unknown until its stream opens, so a camera box is
// inserted at the same 16:9 the other embeds default to.
export const CAMERA_EMBED_WIDTH = 640;
export const CAMERA_EMBED_HEIGHT = 360;

// A camera box is NOT inserted fully transparent like the other media items.
// It shows a static placeholder until it reaches a screen, and with
// `objectFit: 'contain'` the letterbox bars stay visible even once the feed is
// up, so the box needs a faint backing to read against the slide. It also has
// to be non-zero alpha for the colour picker to be usable at all: the picker
// keeps the item's current alpha and only replaces the RGB, so an item that
// starts at `#00000000` turns every colour the operator picks into a fully
// transparent one.
export const CAMERA_DEFAULT_BACKGROUND_COLOR = '#00000033';

// YouTube's canonical recommended embed dimensions (16:9).
export const YOUTUBE_EMBED_WIDTH = 560;
export const YOUTUBE_EMBED_HEIGHT = 315;

// A generic embedded website has no natural size; default to a comfortable
// 4:3 viewport that fits inside the default slide.
export const WEBSITE_EMBED_WIDTH = 800;
export const WEBSITE_EMBED_HEIGHT = 600;

// An audio item is just a player control, drawn at roughly the native
// `<audio controls>` proportions. Chromium draws that control chrome at a
// FIXED glyph size whatever the element's box is, so these are the unscaled
// proportions and the renderer scales the whole control with CSS `zoom`.
export const AUDIO_CONTROL_WIDTH = 240;
export const AUDIO_CONTROL_HEIGHT = 60;
// The player is an operator affordance shown only in the presenter's mini
// screen (it is preview-only, never projected), where the whole slide is
// scaled down to a few hundred pixels — at 1x the control is too small to read
// or hit. Insert it 5x oversized so it stays usable there.
export const AUDIO_EMBED_SCALE = 5;
export const AUDIO_EMBED_WIDTH = AUDIO_CONTROL_WIDTH * AUDIO_EMBED_SCALE;
export const AUDIO_EMBED_HEIGHT = AUDIO_CONTROL_HEIGHT * AUDIO_EMBED_SCALE;

// How much to `zoom` an audio item's player control for its box. The control
// is laid out in `zoom`-divided units, so `width/height: 100%` still fills the
// box exactly — only the glyphs, text and bar grow. Scaling by whichever axis
// fits worst keeps the control from ever being clipped, and the clamp keeps
// both ends sane: never below 1x, so an item saved at the old control-sized
// box looks exactly as it did, and never above the insert scale, so a
// full-slide box (a lyric audio attachment) doesn't grow a monstrous player.
export function calcAudioControlScale(width: number, height: number) {
    const fitScale = Math.min(
        width / AUDIO_CONTROL_WIDTH,
        height / AUDIO_CONTROL_HEIGHT,
    );
    return Math.min(Math.max(fitScale, 1), AUDIO_EMBED_SCALE);
}

export function validateMediaProps(
    props: AnyObjectType,
    srcKey: 'srcData' | 'filePath' = 'srcData',
) {
    if (
        typeof props[srcKey] !== 'string' ||
        typeof props.mediaWidth !== 'number' ||
        typeof props.mediaHeight !== 'number'
    ) {
        throw new TypeError('Invalid canvas item media data');
    }
}

export function validateFilePathProps(props: AnyObjectType) {
    if (typeof props.filePath !== 'string' || props.filePath === '') {
        throw new TypeError('Invalid canvas item file path data');
    }
}

export function validateUrlProps(props: AnyObjectType) {
    if (typeof props.url !== 'string' || props.url === '') {
        throw new TypeError('Invalid canvas item url data');
    }
}

export function validateCameraProps(props: AnyObjectType) {
    // Only the device identity is required, and either half of it will do: an
    // id alone still resolves right now, a label alone still resolves after
    // Chromium has rotated the id. `isMirrored`/`objectFit` are defaulted in
    // the constructor rather than validated, so an item written by an older
    // build renders instead of collapsing into an error box.
    if (
        typeof props.deviceId !== 'string' ||
        typeof props.label !== 'string' ||
        (props.deviceId === '' && props.label === '')
    ) {
        throw new TypeError('Invalid canvas item camera data');
    }
}

export const hAlignmentList = ['left', 'center', 'right'] as const;
export type HAlignmentType = (typeof hAlignmentList)[number];
export const vAlignmentList = ['start', 'center', 'end'] as const;
export type VAlignmentType = (typeof vAlignmentList)[number];

export function cleanupProps(props: AnyObjectType) {
    delete props.horizontalAlignment;
    delete props.verticalAlignment;
}

export function tooling2BoxProps(
    boxData: ToolingBoxType,
    state: {
        parentWidth: number;
        parentHeight: number;
        width: number;
        height: number;
    },
) {
    const boxProps = {
        top: boxData.top ?? 0,
        left: boxData.left ?? 0,
    };
    if (boxData.verticalAlignment === 'start') {
        boxProps.top = 0;
    } else if (boxData.verticalAlignment === 'center') {
        boxProps.top = (state.parentHeight - state.height) / 2;
    } else if (boxData.verticalAlignment === 'end') {
        boxProps.top = state.parentHeight - state.height;
    }
    if (boxData.horizontalAlignment === 'left') {
        boxProps.left = 0;
    } else if (boxData.horizontalAlignment === 'center') {
        boxProps.left = (state.parentWidth - state.width) / 2;
    } else if (boxData.horizontalAlignment === 'right') {
        boxProps.left = state.parentWidth - state.width;
    }
    return boxProps;
}

export type ToolingBoxType = {
    backgroundColor?: AppColorType | null;
    rotate?: number;
    horizontalAlignment?: HAlignmentType;
    verticalAlignment?: VAlignmentType;
    top?: number;
    left?: number;
};
export const canvasItemList = [
    'text',
    'html',
    'image',
    'video',
    'audio',
    'youtube',
    'website',
    'bible',
    'camera',
    'error',
] as const;
export type CanvasItemKindType = (typeof canvasItemList)[number];

// Only the items that carry their own `mediaWidth`/`mediaHeight`; audio is
// deliberately excluded because it has no intrinsic size to scale a box to.
export function checkIsMediaCanvasItemType(type: string) {
    return type === 'image' || type === 'video';
}

// The canvas items backed by a media source: a file on disk or a remote link.
export function checkIsFilePathCanvasItemType(type: string) {
    return type === 'video' || type === 'audio';
}

// Which media a link points at, taken from its path extension alone — a link
// is never fetched just to find out what kind of file it is.
export function getRemoteMediaMimetypeName(url: string) {
    let fileFullName: string;
    try {
        fileFullName = decodeURIComponent(new URL(url).pathname);
    } catch (_error) {
        return null;
    }
    for (const mimetypeName of ['image', 'video', 'audio'] as const) {
        if (isSupportedExt(fileFullName, mimetypeName)) {
            return mimetypeName;
        }
    }
    return null;
}

export function genTextDefaultBoxStyle(
    width: number = 700,
    height: number = 400,
) {
    return {
        id: -1,
        top: 279,
        left: 356,
        width,
        height,
        rotate: 0,
        backgroundColor: '#0000008b' as AppColorType,
        backdropFilter: 0,
        roundSizePercentage: 0,
        roundSizePixel: 0,
        horizontalAlignment: 'center' as HAlignmentType,
        verticalAlignment: 'center' as VAlignmentType,
    };
}

export function genMediaDefaultBoxStyle(width?: number, height?: number) {
    return {
        ...genTextDefaultBoxStyle(width, height),
        // Media fills its box, so a visible background color would never
        // actually be seen — default to transparent black.
        backgroundColor: '#00000000' as AppColorType,
    };
}

export const SCRIPT_SAFE_LINE_HEIGHT = 1.35;

// Shared by every canvas item that lays out rich text: text, html and bible.
export type TextStylePropsType = {
    color: AppColorType;
    fontSize: number;
    fontFamily: string | null;
    fontWeight: string | null;
    textHorizontalAlignment: HAlignmentType;
    textVerticalAlignment: VAlignmentType;
};

export function genTextStyle(props: TextStylePropsType): CSSProperties {
    return {
        display: 'flex',
        width: '100%',
        height: '100%',
        fontSize: `${props.fontSize}px`,
        // Keep ascenders/combining marks visible for complex scripts (Khmer, etc.).
        lineHeight: SCRIPT_SAFE_LINE_HEIGHT,
        fontFamily: props.fontFamily ?? '',
        fontWeight: props.fontWeight ?? '',
        color: props.color,
        alignItems: props.textVerticalAlignment,
        justifyContent: props.textHorizontalAlignment,
        textAlign: props.textHorizontalAlignment,
        padding: `${props.fontSize / 10}px`,
    };
}

export function checkIsValidTextStyleProps(json: AnyObjectType) {
    return (
        typeof json.color === 'string' &&
        typeof json.fontSize === 'number' &&
        (json.fontFamily === null || typeof json.fontFamily === 'string') &&
        (json.fontWeight === null || typeof json.fontWeight === 'string')
    );
}

export function checkIsSupportMediaType(fileType: string) {
    return (
        isSupportedMimetype(fileType, 'image') ||
        isSupportedMimetype(fileType, 'video')
    );
}

// The slide editor canvas additionally accepts audio files, which become an
// audio player item. Kept apart from `checkIsSupportMediaType` so the callers
// that build a whole slide out of a dropped file (which needs the media's own
// dimensions) keep taking images and videos only.
export function checkIsSupportCanvasMediaType(fileType: string) {
    return (
        checkIsSupportMediaType(fileType) ||
        isSupportedMimetype(fileType, 'audio')
    );
}
