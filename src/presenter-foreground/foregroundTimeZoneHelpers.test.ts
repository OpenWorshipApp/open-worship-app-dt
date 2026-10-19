import { describe, expect, test } from 'vitest';

import {
    checkIsChosenCityLabel,
    getZoneHourOffset,
    toCityLabel,
} from './foregroundTimeZoneHelpers';

describe('foregroundTimeZoneHelpers', () => {
    test('a city is captioned in words, not as its zone path', () => {
        expect(toCityLabel('Asia/Phnom_Penh')).toBe('Phnom Penh');
        expect(toCityLabel('America/Argentina/Buenos_Aires')).toBe(
            'Buenos Aires',
        );
    });

    test('a zone with daylight saving answers the offset of the date asked about', () => {
        // New York is UTC-5 in January and UTC-4 in July: an offset frozen at
        // the day it was picked put the clock an hour out half the year.
        expect(
            getZoneHourOffset(
                'America/New_York',
                new Date('2026-01-15T12:00:00Z'),
            ),
        ).toBe(-5);
        expect(
            getZoneHourOffset(
                'America/New_York',
                new Date('2026-07-15T12:00:00Z'),
            ),
        ).toBe(-4);
        expect(getZoneHourOffset('Asia/Kolkata')).toBe(5.5);
        expect(getZoneHourOffset('')).toBeNull();
        expect(getZoneHourOffset('Nowhere/Atlantis')).toBeNull();
    });

    test('a caption the city picker wrote is told apart from one a person typed', () => {
        expect(checkIsChosenCityLabel('Phnom Penh', 'Asia/Phnom_Penh')).toBe(
            true,
        );
        // The older shape carried its zone, so it is known with no zone kept.
        expect(checkIsChosenCityLabel('Phnom_Penh (Asia/Phnom_Penh)', '')).toBe(
            true,
        );
        expect(checkIsChosenCityLabel('Mission team (Cambodia)', '')).toBe(
            false,
        );
        expect(checkIsChosenCityLabel('Local time', 'Asia/Phnom_Penh')).toBe(
            false,
        );
        expect(checkIsChosenCityLabel('', 'Asia/Phnom_Penh')).toBe(false);
    });
});
