import { getSetting, setSetting } from '../helper/settingHelpers';
import type { SlideAutoPlayOptionsType } from './slideAutoPlayRuleHelpers';
import {
    MAX_SLIDE_AUTO_PLAY_STEP,
    toValidRepeatKind,
} from './slideAutoPlayRuleHelpers';

/**
 * Where a slide show's rules are KEPT.
 *
 * Three surfaces run a show -- the slides previewer, the foreground media
 * widgets and the background media lists -- and only the first of them keeps
 * its clock inside React. The rules therefore have to be readable with nothing
 * rendered, so they live in settings and are read through here rather than
 * held in a component. What the rules MEAN is `slideAutoPlayRuleHelpers`,
 * re-exported below so a caller that wants both still has one import.
 */
export * from './slideAutoPlayRuleHelpers';

export function toIsPlayingSettingName(prefix: string) {
    return `${prefix}-slide-auto-play-playing`;
}

export function toSecondsSettingName(prefix: string) {
    return `${prefix}-slide-auto-play-timer-seconds`;
}

export function toMaxSecondsSettingName(prefix: string) {
    return `${prefix}-slide-auto-play-timer-max-seconds`;
}

export function toRepeatKindSettingName(prefix: string) {
    return `${prefix}-slide-auto-play-repeat`;
}

export function toStepSettingName(prefix: string) {
    return `${prefix}-slide-auto-play-step`;
}

export function toIsUntilMediaEndSettingName(prefix: string) {
    return `${prefix}-slide-auto-play-until-media-end`;
}

/**
 * Every setting one show keeps, for a caller that has to FORGET a show --
 * removing a media session takes its slide show with it. Listed here beside
 * the names themselves so a rule added later cannot be left behind.
 */
export function genSlideAutoPlaySettingNames(prefix: string) {
    return [
        toIsPlayingSettingName(prefix),
        toSecondsSettingName(prefix),
        toMaxSecondsSettingName(prefix),
        toRepeatKindSettingName(prefix),
        toStepSettingName(prefix),
        toIsUntilMediaEndSettingName(prefix),
    ];
}

function readNumberSetting(settingName: string, defaultValue: number) {
    const value = Number.parseInt(getSetting(settingName) ?? '');
    if (Number.isNaN(value)) {
        return defaultValue;
    }
    return value;
}

/**
 * The rules in force for one show, read off disk so a clock running with its
 * panel closed obeys the same ones the panel is showing.
 */
export function readSlideAutoPlayOptions(
    prefix: string,
): SlideAutoPlayOptionsType {
    const seconds = Math.max(
        0,
        readNumberSetting(toSecondsSettingName(prefix), 5),
    );
    return {
        seconds,
        maxSeconds: Math.max(
            0,
            readNumberSetting(toMaxSecondsSettingName(prefix), 0),
        ),
        repeatKind: toValidRepeatKind(
            getSetting(toRepeatKindSettingName(prefix)),
        ),
        step: Math.min(
            MAX_SLIDE_AUTO_PLAY_STEP,
            Math.max(1, readNumberSetting(toStepSettingName(prefix), 1)),
        ),
        isUntilMediaEnd:
            getSetting(toIsUntilMediaEndSettingName(prefix)) === 'true',
    };
}

export function checkIsSlideAutoPlaying(prefix: string) {
    return getSetting(toIsPlayingSettingName(prefix)) === 'true';
}

export function setIsSlideAutoPlaying(prefix: string, isPlaying: boolean) {
    setSetting(toIsPlayingSettingName(prefix), `${isPlaying}`);
}
