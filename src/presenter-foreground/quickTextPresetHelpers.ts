import { setSetting } from '../helper/settingHelpers';
import type { AppColorType } from '../others/color/colorHelpers';
import { tran } from '../lang/langHelpers';
import {
    genCommonStyleSettingNames,
    genPropsSettingNames,
} from './foregroundStyleSettingNames';
import {
    DEFAULT_FOREGROUND_DECORATION,
    type ForegroundDecorationType,
    genDecorationSettingName,
} from './foregroundDecorationHelpers';

/**
 * Quick Text's own keys, in one place: the panel reads them and a Bible
 * passage's Create Quick Text writes them for a session that is not mounted.
 */
export const QUICK_TEXT_WIDGET_KEY = 'quick-text';

export function toQuickTextPrefix(suffix: string) {
    return `${QUICK_TEXT_WIDGET_KEY}${suffix}`;
}
export function toQuickTextSettingName(suffix: string) {
    return `foreground-quick-text-setting${suffix}`;
}
export function toQuickTextTimeDelaySettingName(suffix: string) {
    return `foreground-quick-text-time-delay${suffix}`;
}
export function toQuickTextTimeToLiveSettingName(suffix: string) {
    return `foreground-quick-text-time-to-live${suffix}`;
}

export type QuickTextPresetIdType =
    | 'bible-verse'
    | 'speaker'
    | 'song-title'
    | 'sermon-title'
    | 'event-session'
    | 'announcement';

type HorizontalAlignmentType = 'left' | 'center' | 'right';
type VerticalAlignmentType = 'start' | 'center' | 'end';

/**
 * A whole LOOK made for one job -- where the box sits, how big the words are,
 * its colours and dressing, and how long it stays. Everything the Properties
 * panel holds for the session except the font (a Khmer or Chinese face the
 * operator chose stays theirs), the transition and the layer.
 *
 * Sizes are screen pixels, like the Font Size box they land in, and pick
 * up the screen's resolution the same way a hand-set value does.
 */
type QuickTextPresetType = {
    id: QuickTextPresetIdType;
    /** A Bootstrap icon name, without its `bi-` prefix. */
    iconName: string;
    timeSecondToLive: number;
    fontSize: number;
    widthPercentage: number;
    horizontalAlignment: HorizontalAlignmentType;
    verticalAlignment: VerticalAlignmentType;
    offsetX: number;
    offsetY: number;
    roundSizePixel: number;
    color: AppColorType;
    backgroundColor: AppColorType;
    backdropFilter: number;
    decoration: Partial<ForegroundDecorationType>;
};

export const QUICK_TEXT_PRESET_LIST: readonly QuickTextPresetType[] = [
    {
        // A lower third across the bottom, long enough to be read aloud.
        id: 'bible-verse',
        iconName: 'book',
        timeSecondToLive: 20,
        fontSize: 44,
        widthPercentage: 90,
        horizontalAlignment: 'center',
        verticalAlignment: 'end',
        offsetX: 0,
        offsetY: 40,
        roundSizePixel: 16,
        color: '#FFFFFF',
        backgroundColor: '#000000B3',
        backdropFilter: 6,
        decoration: {
            shadow: 'soft',
            padding: 0.6,
            textAlign: 'center',
            lineHeight: 1.35,
            textShadow: 'soft',
        },
    },
    {
        // A name tag, bottom left, clear of a centred verse or lyric.
        id: 'speaker',
        iconName: 'person-badge',
        timeSecondToLive: 10,
        fontSize: 40,
        widthPercentage: 40,
        horizontalAlignment: 'left',
        verticalAlignment: 'end',
        offsetX: 60,
        offsetY: 70,
        roundSizePixel: 8,
        color: '#FFFFFF',
        backgroundColor: '#1D4ED8E6',
        backdropFilter: 0,
        decoration: {
            shadow: 'medium',
            padding: 0.5,
            textAlign: 'left',
        },
    },
    {
        // A quiet corner label: the song is the slide, this only names it.
        id: 'song-title',
        iconName: 'music-note-beamed',
        timeSecondToLive: 8,
        fontSize: 34,
        widthPercentage: 45,
        horizontalAlignment: 'left',
        verticalAlignment: 'start',
        offsetX: 60,
        offsetY: 50,
        roundSizePixel: 10,
        color: '#FFFFFF',
        backgroundColor: '#00000099',
        backdropFilter: 6,
        decoration: {
            shadow: 'soft',
            padding: 0.45,
            textAlign: 'left',
        },
    },
    {
        // The middle of the screen, large, for the moment the sermon starts.
        id: 'sermon-title',
        iconName: 'mic',
        timeSecondToLive: 10,
        fontSize: 64,
        widthPercentage: 75,
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        offsetX: 0,
        offsetY: 0,
        roundSizePixel: 20,
        color: '#FFFFFF',
        backgroundColor: '#0F172ACC',
        backdropFilter: 8,
        decoration: {
            shadow: 'strong',
            padding: 0.7,
            textAlign: 'center',
            letterSpacing: 0.02,
            textShadow: 'soft',
        },
    },
    {
        // A banner across the top: what part of the day this is.
        id: 'event-session',
        iconName: 'calendar-event',
        timeSecondToLive: 10,
        fontSize: 40,
        widthPercentage: 70,
        horizontalAlignment: 'center',
        verticalAlignment: 'start',
        offsetX: 0,
        offsetY: 40,
        roundSizePixel: 12,
        color: '#FFFFFF',
        backgroundColor: '#0F766EE6',
        backdropFilter: 0,
        decoration: {
            shadow: 'medium',
            padding: 0.5,
            textAlign: 'center',
            letterSpacing: 0.08,
            isUppercase: true,
        },
    },
    {
        // A notice nobody can miss, framed, in the middle.
        id: 'announcement',
        iconName: 'megaphone',
        timeSecondToLive: 12,
        fontSize: 52,
        widthPercentage: 80,
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        offsetX: 0,
        offsetY: 0,
        roundSizePixel: 16,
        color: '#FFFFFF',
        backgroundColor: '#B45309E6',
        backdropFilter: 0,
        decoration: {
            borderStyle: 'solid',
            borderWidth: 3,
            borderColor: '#FFFFFFB3',
            shadow: 'strong',
            padding: 0.7,
            textAlign: 'center',
        },
    },
];

/**
 * A preset's name, translated in render. Written out one literal at a time so
 * the key coverage test can read every one of them.
 */
export function toQuickTextPresetLabel(id: QuickTextPresetIdType) {
    switch (id) {
        case 'bible-verse':
            return tran('Bible Verse');
        case 'speaker':
            return tran('Speaker');
        case 'song-title':
            return tran('Song Title');
        case 'sermon-title':
            return tran('Sermon Title');
        case 'event-session':
            return tran('Event Session');
        case 'announcement':
            return tran('Announcement');
    }
}

export function getQuickTextPreset(id: QuickTextPresetIdType) {
    return QUICK_TEXT_PRESET_LIST.find((preset) => {
        return preset.id === id;
    });
}

/**
 * Writes a preset over ONE session's look and its seconds on screen. Its words
 * and its delay stay, and so do the font, the transition and the layer. The
 * panel reads these keys when it mounts, so a mounted one has to be remounted
 * to show them -- `ForegroundQuickTextComp` does that.
 */
export function applyQuickTextPreset(
    suffix: string,
    presetId: QuickTextPresetIdType,
) {
    const preset = getQuickTextPreset(presetId);
    if (preset === undefined) {
        return false;
    }
    const prefix = toQuickTextPrefix(suffix);
    const names = genPropsSettingNames(prefix);
    setSetting(names.fontSize, `${preset.fontSize}`);
    setSetting(names.widthPercentage, `${preset.widthPercentage}`);
    setSetting(names.scale, '1');
    setSetting(names.opacityPercentage, '100');
    setSetting(
        names.alignment,
        JSON.stringify({
            horizontalAlignment: preset.horizontalAlignment,
            verticalAlignment: preset.verticalAlignment,
        }),
    );
    setSetting(names.offsetX, `${preset.offsetX}`);
    setSetting(names.offsetY, `${preset.offsetY}`);
    setSetting(names.roundSizePixel, `${preset.roundSizePixel}`);
    const commonNames = genCommonStyleSettingNames(prefix);
    setSetting(commonNames.color, preset.color);
    setSetting(commonNames.backgroundColor, preset.backgroundColor);
    setSetting(commonNames.backdropFilter, `${preset.backdropFilter}`);
    setSetting(
        genDecorationSettingName(prefix),
        JSON.stringify({
            ...DEFAULT_FOREGROUND_DECORATION,
            ...preset.decoration,
        }),
    );
    setSetting(
        toQuickTextTimeToLiveSettingName(suffix),
        `${preset.timeSecondToLive}`,
    );
    return true;
}
