import { describe, expect, test, vi } from 'vitest';

vi.mock('../presenter-foreground/foregroundDragHelpers', () => ({
    COUNTDOWN_LEAD_SECOND: 1,
}));

import {
    checkIsPickedForegroundWidget,
    genAgentForegroundData,
    pickForegroundLook,
} from './agentFlowForegroundRules';

const genId = () => 'clock-id';

describe('a new foreground line, from words', () => {
    test('a countdown by its length carries the lead second and starts itself', () => {
        expect(
            genAgentForegroundData('countdown', { seconds: 300 }, {}, genId),
        ).toEqual({ data: { durationSecond: 301, isAutoStart: true } });
    });

    test('a countdown to a time keeps the date and drops a length', () => {
        const result = genAgentForegroundData(
            'countdown',
            { dateTime: '2026-11-15T10:00:00Z', autoStart: false },
            {},
            genId,
        );
        expect(result).toEqual({
            data: {
                dateTime: '2026-11-15T10:00:00.000Z',
                isAutoStart: false,
            },
        });
    });

    test('a countdown needs one of the two, never both', () => {
        expect(genAgentForegroundData('countdown', {}, {}, genId)).toEqual({
            reason: expect.stringContaining('how long'),
        });
        expect(
            genAgentForegroundData(
                'countdown',
                { seconds: 60, dateTime: '2026-11-15T10:00' },
                {},
                genId,
            ),
        ).toEqual({ reason: expect.stringContaining('never both') });
        expect(
            genAgentForegroundData('countdown', { seconds: -5 }, {}, genId),
        ).toHaveProperty('reason');
    });

    test("a clock gets its own id and this device's offset", () => {
        const result = genAgentForegroundData(
            'time',
            { title: 'Phnom Penh', utcOffset: 7 },
            {},
            genId,
        );
        expect(result).toEqual({
            data: {
                id: 'clock-id',
                timezoneMinuteOffset: 7,
                title: 'Phnom Penh',
                is24HourFormat: false,
            },
        });
        expect(
            genAgentForegroundData('time', { utcOffset: 30 }, {}, genId),
        ).toHaveProperty('reason');
    });

    test('one message is its lines; several rotate', () => {
        expect(
            genAgentForegroundData(
                'message',
                { text: 'Welcome\n  Please be seated  ' },
                {},
                genId,
            ),
        ).toEqual({
            data: {
                textList: ['Welcome', 'Please be seated'],
                intervalSecond: null,
            },
        });
        expect(
            genAgentForegroundData(
                'message',
                { texts: ['One', 'Two'], intervalSecond: 6 },
                {},
                genId,
            ),
        ).toEqual({ data: { textList: ['One', 'Two'], intervalSecond: 6 } });
    });

    test('a marquee is one line at a normal pace', () => {
        expect(
            genAgentForegroundData(
                'marquee-bottom',
                { text: 'Coffee\nafter the service' },
                {},
                genId,
            ),
        ).toEqual({
            data: { text: 'Coffee after the service', speedPercentage: 100 },
        });
        expect(
            genAgentForegroundData(
                'marquee-top',
                { text: 'x', speed: 5000 },
                {},
                genId,
            ),
        ).toHaveProperty('reason');
    });

    test('a quick text stays five seconds unless told', () => {
        expect(
            genAgentForegroundData(
                'quick-text',
                { text: '**Pray**' },
                {},
                genId,
            ),
        ).toEqual({
            data: {
                markdownText: '**Pray**',
                timeSecondDelay: 0,
                timeSecondToLive: 5,
            },
        });
    });

    test('seconds asked for take an until-hidden quick text off infinite', () => {
        expect(
            genAgentForegroundData(
                'quick-text',
                { liveSecond: 8 },
                {
                    existing: {
                        markdownText: 'Pray',
                        timeSecondDelay: 0,
                        timeSecondToLive: 5,
                        isInfinite: true,
                    },
                },
                genId,
            ),
        ).toEqual({
            data: {
                markdownText: 'Pray',
                timeSecondDelay: 0,
                timeSecondToLive: 8,
            },
        });
    });

    test('a widget the person picks in the panel is refused', () => {
        for (const widget of ['video', 'image', 'camera', 'screen', 'web']) {
            expect(checkIsPickedForegroundWidget(widget)).toBe(true);
            expect(genAgentForegroundData(widget, {}, {}, genId)).toEqual({
                reason: expect.stringContaining('Foreground panel'),
            });
        }
        expect(genAgentForegroundData('banner', {}, {}, genId)).toEqual({
            reason: expect.stringContaining('`widget` is one of'),
        });
    });
});

describe('the look', () => {
    test('a new line borrows layer, transition and style, nothing else', () => {
        const lookFrom = {
            durationSecond: 61,
            extraStyle: { color: 'red' },
            transitionEffect: 'fade',
            isBehind: true,
        };
        expect(pickForegroundLook(lookFrom)).toEqual({
            extraStyle: { color: 'red' },
            transitionEffect: 'fade',
            isBehind: true,
        });
        expect(
            genAgentForegroundData('stopwatch', {}, { lookFrom }, genId),
        ).toEqual({
            data: {
                extraStyle: { color: 'red' },
                transitionEffect: 'fade',
                isBehind: true,
                isAutoStart: true,
            },
        });
    });

    test('a line being changed keeps all it had but the fields given', () => {
        expect(
            genAgentForegroundData(
                'message',
                { intervalSecond: 12 },
                {
                    existing: {
                        textList: ['A', 'B'],
                        intervalSecond: 5,
                        extraStyle: { fontSize: 40 },
                    },
                },
                genId,
            ),
        ).toEqual({
            data: {
                textList: ['A', 'B'],
                intervalSecond: 12,
                extraStyle: { fontSize: 40 },
            },
        });
    });
});
