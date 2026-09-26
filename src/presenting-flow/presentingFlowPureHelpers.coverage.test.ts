import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        checkIsControlKeys: vi.fn(),
        toEnUsKey: vi.fn(),
        applyMediaControl: vi.fn(),
        startAutoNext: vi.fn(),
        startAtTime: vi.fn(),
        stopInterval: vi.fn(),
        jumpTo: vi.fn(),
    },
}));

vi.mock('../event/KeyboardEventListener', () => ({
    default: { toEnUsKey: mocks.toEnUsKey },
    checkIsControlKeys: mocks.checkIsControlKeys,
}));
vi.mock('../_screen/managers/screenSlideMediaControlHelpers', () => ({
    applyScreenSlideMediaControl: mocks.applyMediaControl,
}));
vi.mock('./presentingFlowAutoNextHelpers', () => ({
    startPresentingFlowAutoNext: mocks.startAutoNext,
    startPresentingFlowAutoNextAtTime: mocks.startAtTime,
    stopPresentingFlowAutoNextInterval: mocks.stopInterval,
    jumpPresentingFlowRunToCcItem: mocks.jumpTo,
}));

import {
    checkIsValidPresentingFlowActionKey,
    readPresentingFlowActionKeyFromEvent,
    toPresentingFlowActionKeyEventMapper,
} from './presentingFlowActionKeyHelpers';
import {
    checkIsValidPresentingFlowActionTime,
    toPresentingFlowActionDueTime,
    toPresentingFlowActionTime,
    toPresentingFlowActionTimeLabel,
} from './presentingFlowActionTimeHelpers';
import {
    checkIsValidPresentingFlowItemUuid,
    genPresentingFlowItemUuid,
    intersectCcScreenIds,
    resolveCcScreenIds,
    toPresentingFlowCcActionArming,
} from './presentingFlowCcHelpers';
import {
    applyPresentingFlowMediaControlPause,
    presentingFlowMediaControlModeLabelMap,
    presentingFlowMediaControlModeList,
    presentingFlowMediaControlPauseKindList,
    toPresentingFlowMediaControl,
    toPresentingFlowMediaControlPauseKind,
    toPresentingFlowMediaControlSummary,
} from './presentingFlowMediaControlHelpers';
import {
    checkIsPresentingFlowActionGroup,
    findPresentingFlowAction,
    presentingFlowActionList,
    presentingFlowActionMenuList,
} from './presentingFlowActionHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkIsControlKeys.mockReturnValue(false);
    mocks.toEnUsKey.mockImplementation((event: any) => event.key);
    mocks.startAutoNext.mockReturnValue(true);
    mocks.stopInterval.mockReturnValue(true);
    mocks.startAtTime.mockReturnValue(null);
    mocks.jumpTo.mockReturnValue(null);
});

describe('presenting-flow pure helper contracts', () => {
    test('validates, formats, and schedules time-of-day arming', () => {
        expect(checkIsValidPresentingFlowActionTime('00:00')).toBe(true);
        expect(checkIsValidPresentingFlowActionTime('23:59')).toBe(true);
        expect(checkIsValidPresentingFlowActionTime('24:00')).toBe(false);
        expect(checkIsValidPresentingFlowActionTime(null)).toBe(false);
        expect(toPresentingFlowActionTimeLabel('00:05')).toBe('12:05 AM');
        expect(toPresentingFlowActionTimeLabel('12:30')).toBe('12:30 PM');
        expect(toPresentingFlowActionTimeLabel('19:30')).toBe('7:30 PM');
        expect(toPresentingFlowActionTimeLabel('bad')).toBe('bad');

        const date = new Date(2026, 0, 2, 7, 5, 44);
        expect(toPresentingFlowActionTime(date)).toBe('07:05');
        expect(toPresentingFlowActionDueTime('07:06', date.getTime())).toBe(
            new Date(2026, 0, 2, 7, 6).getTime(),
        );
        expect(
            toPresentingFlowActionDueTime('07:05', date.getTime()),
        ).toBeNull();
        expect(toPresentingFlowActionDueTime('bad', date.getTime())).toBeNull();
    });

    test('canonicalizes portable keyboard shortcuts and explains refusals', () => {
        expect(checkIsValidPresentingFlowActionKey('Ctrl+A')).toBe(true);
        expect(checkIsValidPresentingFlowActionKey('Ctrl+Shift+Enter')).toBe(
            true,
        );
        for (const invalid of [
            null,
            '',
            'A',
            'Shift+Ctrl+A',
            'Ctrl+a',
            'Alt+A',
        ]) {
            expect(checkIsValidPresentingFlowActionKey(invalid)).toBe(false);
            expect(toPresentingFlowActionKeyEventMapper(invalid)).toBeNull();
        }
        expect(toPresentingFlowActionKeyEventMapper('Ctrl+Shift+A')).toEqual({
            key: 'A',
            allControlKey: ['Ctrl', 'Shift'],
        });

        mocks.checkIsControlKeys.mockReturnValueOnce(true);
        expect(
            readPresentingFlowActionKeyFromEvent({ key: 'Shift' }),
        ).toBeNull();
        expect(
            readPresentingFlowActionKeyFromEvent({ key: 'a', altKey: true }),
        ).toEqual({
            actionKey: null,
            message: 'Only Ctrl and Shift may be used',
        });
        expect(readPresentingFlowActionKeyFromEvent({ key: 'a' })).toEqual({
            actionKey: null,
            message: 'Hold Ctrl or Shift with the key',
        });
        mocks.toEnUsKey.mockReturnValueOnce('');
        expect(
            readPresentingFlowActionKeyFromEvent({ key: '', ctrlKey: true }),
        ).toEqual({
            actionKey: null,
            message: 'This key cannot be used',
        });
        expect(
            readPresentingFlowActionKeyFromEvent({
                key: 'a',
                ctrlKey: true,
                shiftKey: true,
            }),
        ).toEqual({ actionKey: 'Ctrl+Shift+A', message: null });
    });

    test('normalizes CC identity, arming, and screen inheritance', () => {
        const randomUUID = vi
            .spyOn(globalThis.crypto, 'randomUUID')
            .mockReturnValue('00000000-0000-4000-8000-000000000000');
        expect(genPresentingFlowItemUuid()).toBe(
            '00000000-0000-4000-8000-000000000000',
        );
        expect(randomUUID).toHaveBeenCalled();
        expect(checkIsValidPresentingFlowItemUuid('id')).toBe(true);
        expect(checkIsValidPresentingFlowItemUuid('')).toBe(false);
        expect(checkIsValidPresentingFlowItemUuid(4)).toBe(false);
        expect(toPresentingFlowCcActionArming(null)).toBeNull();
        expect(
            toPresentingFlowCcActionArming({
                actionTime: '08:20',
                actionNumber: 4,
            }),
        ).toEqual({ actionTime: '08:20' });
        expect(toPresentingFlowCcActionArming({ actionNumber: 4 })).toEqual({
            actionNumber: 4,
        });
        expect(toPresentingFlowCcActionArming({ actionNumber: 0 })).toBeNull();
        expect(resolveCcScreenIds([], [1, 2])).toEqual([1, 2]);
        expect(resolveCcScreenIds([3], [1, 2])).toEqual([3]);
        expect(intersectCcScreenIds([], [1, 2])).toEqual([1, 2]);
        expect(intersectCcScreenIds([2, 4], [1, 2, 3])).toEqual([2]);
    });

    test('sanitizes media-control settings and produces concise summaries', () => {
        expect(presentingFlowMediaControlModeList).toEqual([
            'play',
            'pause',
            'stop',
        ]);
        expect(presentingFlowMediaControlPauseKindList).toEqual([
            'none',
            'after',
            'at',
        ]);
        expect(presentingFlowMediaControlModeLabelMap.stop).toBe('Stop');
        expect(toPresentingFlowMediaControl(null)).toBeNull();
        expect(toPresentingFlowMediaControl({ mode: 'unknown' })).toBeNull();
        expect(
            toPresentingFlowMediaControl({
                mode: 'play',
                delaySecond: 2,
                startAtSecond: 10,
                pauseAfterSecond: 20,
                pauseAtSecond: 30,
                volume: 70,
                speed: 2,
            }),
        ).toEqual({
            mode: 'play',
            delaySecond: 2,
            startAtSecond: 10,
            pauseAtSecond: 30,
            volume: 70,
            speed: 2,
        });
        expect(
            toPresentingFlowMediaControl({
                mode: 'pause',
                delaySecond: -1,
                startAtSecond: Infinity,
                pauseAfterSecond: 5,
                volume: 101,
                speed: 0,
            }),
        ).toEqual({ mode: 'pause', pauseAfterSecond: 5 });
        expect(
            applyPresentingFlowMediaControlPause(
                { mode: 'play', pauseAtSecond: 3 },
                'after',
                8,
            ),
        ).toEqual({ mode: 'play', pauseAfterSecond: 8 });
        expect(
            applyPresentingFlowMediaControlPause(
                { mode: 'play', pauseAfterSecond: 8 },
                'at',
                12,
            ),
        ).toEqual({ mode: 'play', pauseAtSecond: 12 });
        expect(
            applyPresentingFlowMediaControlPause(
                { mode: 'play', pauseAtSecond: 3 },
                'none',
                0,
            ),
        ).toEqual({ mode: 'play' });
        expect(toPresentingFlowMediaControlPauseKind(null)).toBe('none');
        expect(
            toPresentingFlowMediaControlPauseKind({
                mode: 'play',
                pauseAtSecond: 3,
            }),
        ).toBe('at');
        expect(
            toPresentingFlowMediaControlPauseKind({
                mode: 'play',
                pauseAfterSecond: 3,
            }),
        ).toBe('after');
        expect(toPresentingFlowMediaControlPauseKind({ mode: 'play' })).toBe(
            'none',
        );
        expect(
            toPresentingFlowMediaControlSummary({
                mode: 'play',
                delaySecond: 2,
                startAtSecond: 10,
                pauseAtSecond: 30,
                volume: 70,
                speed: 2,
            }),
        ).toBe('+2s 10s→30s 70% 2x');
        expect(
            toPresentingFlowMediaControlSummary({
                mode: 'pause',
                startAtSecond: 10,
                pauseAfterSecond: 4,
            }),
        ).toBe('4s');
        expect(
            toPresentingFlowMediaControlSummary({
                mode: 'stop',
                startAtSecond: 6,
            }),
        ).toBe('6s');
    });

    test('exercises every registered action and its outcome branches', () => {
        expect(
            checkIsPresentingFlowActionGroup(presentingFlowActionMenuList[0]),
        ).toBe(true);
        expect(
            checkIsPresentingFlowActionGroup(presentingFlowActionList[0]),
        ).toBe(false);
        expect(findPresentingFlowAction(null)).toBeNull();
        expect(findPresentingFlowAction('missing')).toBeNull();

        const foreground = new Proxy({}, { get: () => vi.fn() });
        const screenManager: any = {
            isShowing: false,
            clear: vi.fn(),
            screenBackgroundManager: { clear: vi.fn() },
            screenVaryAppDocumentManager: { clear: vi.fn() },
            screenBibleManager: { clear: vi.fn() },
            screenForegroundManager: foreground,
        };
        const item: any = {
            filePath: '/run',
            actionNumber: 9,
            actionTime: null,
            mediaControl: { mode: 'play' },
            ccItems: [],
        };
        for (const action of presentingFlowActionList) {
            expect(findPresentingFlowAction(action.id)).toBe(action);
            if (action.target === 'screen') action.apply(screenManager, item);
            else action.start(item);
        }
        const show: any = findPresentingFlowAction('screen-show');
        show.apply(screenManager, item);
        const hide: any = findPresentingFlowAction('screen-hide');
        hide.apply(screenManager, item);
        hide.apply(screenManager, item);
        expect(screenManager.isShowing).toBe(false);
        expect(mocks.applyMediaControl).toHaveBeenCalledWith(
            screenManager.screenVaryAppDocumentManager,
            item.mediaControl,
        );

        mocks.startAutoNext.mockReturnValue(false);
        expect(
            (findPresentingFlowAction('next-interval') as any).start(item),
        ).toContain('Open');
        mocks.stopInterval.mockReturnValue(false);
        expect(
            (findPresentingFlowAction('next-clear-interval') as any).start(
                item,
            ),
        ).toContain('Open');
        item.actionTime = '09:30';
        expect(
            (findPresentingFlowAction('next-timeout') as any).start(item),
        ).toBeNull();
        expect(mocks.startAtTime).toHaveBeenCalledWith('/run', '09:30');
        expect(
            (findPresentingFlowAction('jump-to') as any).start(item),
        ).toContain('Attach');
        item.ccItems = [{ uuid: 'target' }];
        expect(
            (findPresentingFlowAction('jump-to') as any).start(item),
        ).toBeNull();
        expect(
            (findPresentingFlowAction('keyboard-event') as any).start({
                ccItems: [],
            }),
        ).toContain('Attach');
        expect(
            (findPresentingFlowAction('keyboard-event') as any).start({
                ccItems: [{}],
            }),
        ).toBeNull();
    });
});
