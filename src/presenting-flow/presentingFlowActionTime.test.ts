// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import PresentingFlowItem from './PresentingFlowItem';
import { PRESENTING_FLOW_ACTION_TYPE } from './presentingFlowActionHelpers';
import {
    checkIsValidPresentingFlowActionTime,
    toPresentingFlowActionDueTime,
    toPresentingFlowActionTime,
    toPresentingFlowActionTimeLabel,
} from './presentingFlowActionTimeHelpers';
import {
    getPresentingFlowAutoNextState,
    registerPresentingFlowRunController,
    startPresentingFlowAutoNextAtTime,
    stopPresentingFlowAutoNext,
    toPresentingFlowAutoNextCountdownLabel,
} from './presentingFlowAutoNextHelpers';

const PRESENTING_FLOW_FILE_PATH = '/data/presenting-flows/pl1.owpf';

// Mid-afternoon, well away from midnight, so "later today" and "already gone by"
// are both plainly today.
const NOW = new Date(2026, 7, 5, 14, 30, 0, 0).getTime();

function genController(stepForward = () => true) {
    return { stepForward, jumpToUuid: () => false };
}

describe('a run action armed with a time of day', () => {
    test('only the shape this app writes is read back', () => {
        expect(checkIsValidPresentingFlowActionTime('07:05')).toBe(true);
        expect(checkIsValidPresentingFlowActionTime('00:00')).toBe(true);
        expect(checkIsValidPresentingFlowActionTime('23:59')).toBe(true);
        // A hand-edited file must not arm a clock on nonsense.
        expect(checkIsValidPresentingFlowActionTime('7:05')).toBe(false);
        expect(checkIsValidPresentingFlowActionTime('24:00')).toBe(false);
        expect(checkIsValidPresentingFlowActionTime('19:60')).toBe(false);
        expect(checkIsValidPresentingFlowActionTime('19:30:00')).toBe(false);
        expect(checkIsValidPresentingFlowActionTime(1930)).toBe(false);
        expect(checkIsValidPresentingFlowActionTime(undefined)).toBe(false);
    });

    test('it is READ as a 12-hour time, whatever the system says', () => {
        expect(toPresentingFlowActionTimeLabel('07:05')).toBe('7:05 AM');
        expect(toPresentingFlowActionTimeLabel('20:30')).toBe('8:30 PM');
        expect(toPresentingFlowActionTimeLabel('00:15')).toBe('12:15 AM');
        expect(toPresentingFlowActionTimeLabel('12:00')).toBe('12:00 PM');
        expect(toPresentingFlowActionTime(new Date(2026, 7, 5, 8, 7))).toBe(
            '08:07',
        );
    });

    test('a time still to come is TODAY; one gone by is nothing', () => {
        expect(toPresentingFlowActionDueTime('14:31', NOW)).toBe(
            new Date(2026, 7, 5, 14, 31).getTime(),
        );
        // Deliberately NOT rolled over to tomorrow — a silent 23-hour countdown
        // behind a run sheet is the one outcome nobody would want.
        expect(toPresentingFlowActionDueTime('07:05', NOW)).toBe(null);
        // The minute it is already in counts as gone: the operator asked for
        // 14:30, and 14:30 is behind them.
        expect(toPresentingFlowActionDueTime('14:30', NOW)).toBe(null);
        expect(toPresentingFlowActionDueTime('nonsense', NOW)).toBe(null);
    });

    test('the pill stays readable however long the wait is', () => {
        expect(toPresentingFlowAutoNextCountdownLabel(9)).toBe('9');
        expect(toPresentingFlowAutoNextCountdownLabel(59)).toBe('59');
        expect(toPresentingFlowAutoNextCountdownLabel(60)).toBe('1:00');
        expect(toPresentingFlowAutoNextCountdownLabel(605)).toBe('10:05');
        expect(toPresentingFlowAutoNextCountdownLabel(3600)).toBe('1:00:00');
        expect(toPresentingFlowAutoNextCountdownLabel(19_845)).toBe('5:30:45');
    });
});

describe('counting down to a time of day', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => {
        stopPresentingFlowAutoNext(PRESENTING_FLOW_FILE_PATH);
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    test('it needs an open run, exactly as the other clocks do', () => {
        expect(
            startPresentingFlowAutoNextAtTime(
                PRESENTING_FLOW_FILE_PATH,
                '14:35',
            ),
        ).toBe('Open the presenting flow preview to use this action');
        expect(getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH)).toBe(
            null,
        );
    });

    test('it arms a TIMEOUT with the seconds to that time', () => {
        const unregister = registerPresentingFlowRunController(
            PRESENTING_FLOW_FILE_PATH,
            genController(),
        );
        expect(
            startPresentingFlowAutoNextAtTime(
                PRESENTING_FLOW_FILE_PATH,
                '14:35',
            ),
        ).toBe(null);
        expect(
            getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH),
        ).toEqual({
            mode: 'timeout',
            seconds: 300,
            remainingSeconds: 300,
            dueTime: new Date(2026, 7, 5, 14, 35).getTime(),
            isPaused: false,
        });
        unregister();
    });

    test('a time already gone by is SAID, not armed', () => {
        const unregister = registerPresentingFlowRunController(
            PRESENTING_FLOW_FILE_PATH,
            genController(),
        );
        expect(
            startPresentingFlowAutoNextAtTime(
                PRESENTING_FLOW_FILE_PATH,
                '08:30',
            ),
        ).toBe('The set time is already due');
        expect(getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH)).toBe(
            null,
        );
        unregister();
    });

    test('it steps the run when the time comes', () => {
        const stepForward = vi.fn(() => {
            return true;
        });
        const unregister = registerPresentingFlowRunController(
            PRESENTING_FLOW_FILE_PATH,
            genController(stepForward),
        );
        startPresentingFlowAutoNextAtTime(PRESENTING_FLOW_FILE_PATH, '14:32');
        vi.advanceTimersByTime(119_000);
        expect(stepForward).not.toHaveBeenCalled();
        expect(
            getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH)
                ?.remainingSeconds,
        ).toBe(1);
        vi.advanceTimersByTime(1_000);
        expect(stepForward).toHaveBeenCalledTimes(1);
        // A timeout is spent when it fires — it does not go round again.
        expect(getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH)).toBe(
            null,
        );
        unregister();
    });

    test('the remainder is re-read from the CLOCK, not counted down', () => {
        // What a sleeping laptop (or a browser throttling a background tab)
        // does to a one-second interval: the ticks stop coming. A count that
        // subtracted a second per tick would still be minutes out at 7:05.
        const stepForward = vi.fn(() => {
            return true;
        });
        const unregister = registerPresentingFlowRunController(
            PRESENTING_FLOW_FILE_PATH,
            genController(stepForward),
        );
        startPresentingFlowAutoNextAtTime(PRESENTING_FLOW_FILE_PATH, '14:40');
        expect(
            getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH)
                ?.remainingSeconds,
        ).toBe(600);
        // One tick delivered, nine minutes of wall clock gone with it (and the
        // second the tick itself takes).
        vi.setSystemTime(NOW + 9 * 60 * 1000);
        vi.advanceTimersByTime(1_000);
        expect(
            getPresentingFlowAutoNextState(PRESENTING_FLOW_FILE_PATH)
                ?.remainingSeconds,
        ).toBe(59);
        expect(stepForward).not.toHaveBeenCalled();
        unregister();
    });
});

describe('the entry that carries a time of day', () => {
    test('a TIMEOUT is validly armed with a time and nothing else', () => {
        const presentingFlowItem = PresentingFlowItem.fromJson(
            PRESENTING_FLOW_FILE_PATH,
            {
                type: PRESENTING_FLOW_ACTION_TYPE,
                data: 'next-timeout',
                actionTime: '19:30',
            },
        );
        expect(presentingFlowItem.actionTime).toBe('19:30');
        // Read off the row as a time, which is the whole reason to arm one.
        expect(presentingFlowItem.title).toContain('7:30 PM');
        expect(presentingFlowItem.actionArming).toEqual({
            actionTime: '19:30',
        });
    });

    test('an INTERVAL is not, and its stored time is ignored', () => {
        expect(() => {
            PresentingFlowItem.fromJson(PRESENTING_FLOW_FILE_PATH, {
                type: PRESENTING_FLOW_ACTION_TYPE,
                data: 'next-interval',
                actionTime: '19:30',
            });
        }).toThrow();
        // Hand-edited onto one that carries a valid number: the entry survives,
        // and the time it may not be armed with is answered for as absent
        // everywhere at once rather than in each of the row, the question and
        // the clock.
        const presentingFlowItem = PresentingFlowItem.fromJson(
            PRESENTING_FLOW_FILE_PATH,
            {
                type: PRESENTING_FLOW_ACTION_TYPE,
                data: 'next-interval',
                actionNumber: 8,
                actionTime: '19:30',
            },
        );
        expect(presentingFlowItem.actionTime).toBe(null);
        expect(presentingFlowItem.title).toContain('(8)');
    });

    test('a hand-edited time that is not a time is still an error row', () => {
        expect(() => {
            PresentingFlowItem.fromJson(PRESENTING_FLOW_FILE_PATH, {
                type: PRESENTING_FLOW_ACTION_TYPE,
                data: 'next-timeout',
                actionTime: 'half seven',
            });
        }).toThrow();
    });

    test('a CC of one is armed by the ELEMENT it points at', () => {
        // "Show this line, and go on by yourself at 7:05". A CC is a reference,
        // so the time is read off the element every time rather than copied —
        // re-arm the element and every follower of it is re-armed with it.
        const elementJson = PresentingFlowItem.fromActionId('next-timeout', {
            actionTime: '07:05',
        });
        expect(PresentingFlowItem.resolveCcItemJson(elementJson)).toEqual({
            ...elementJson,
            type: PRESENTING_FLOW_ACTION_TYPE,
            data: 'next-timeout',
            actionTime: '07:05',
        });
    });
});
