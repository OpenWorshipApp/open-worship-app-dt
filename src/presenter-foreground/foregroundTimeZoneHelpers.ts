import { tz } from 'moment-timezone';

/**
 * The words a city is shown with above its clock: `Phnom Penh` for
 * `Asia/Phnom_Penh`. The caption used to be the menu row itself,
 * `Phnom_Penh (Asia/Phnom_Penh)` -- underscores and all, on the projector,
 * and one word too long for the box, so it was cut off mid-word.
 */
export function toCityLabel(zoneName: string) {
    return (zoneName.split('/').at(-1) ?? zoneName).replace(/_/g, ' ');
}

/**
 * The offset in HOURS a timezone has at `date` -- daylight saving included --
 * or `null` for no zone or one this build does not know. A city's clock takes
 * it each time it is shown, so it does not go an hour out at the next change.
 */
export function getZoneHourOffset(zoneName: string, date = new Date()) {
    if (zoneName === '' || tz.zone(zoneName) === null) {
        return null;
    }
    return tz(date, zoneName).utcOffset() / 60;
}

/**
 * Whether a caption is one Choose City wrote rather than one a person typed:
 * the city of `zoneName`, or the older `Phnom_Penh (Asia/Phnom_Penh)` shape,
 * which carried its zone in it.
 */
export function checkIsChosenCityLabel(label: string, zoneName: string) {
    const text = label.trim();
    if (text === '') {
        return false;
    }
    if (zoneName !== '' && text === toCityLabel(zoneName)) {
        return true;
    }
    const match = /^(.+) \(([^()\s]+\/[^()\s]+)\)$/.exec(text);
    return (
        match !== null &&
        tz.zone(match[2]) !== null &&
        match[1] === match[2].split('/').at(-1)
    );
}
