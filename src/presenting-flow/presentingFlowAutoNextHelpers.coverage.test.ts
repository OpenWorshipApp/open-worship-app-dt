import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { dueTime: null as number | null },
    mocks: { toast: vi.fn() },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('./presentingFlowActionTimeHelpers', () => ({
    toPresentingFlowActionDueTime: () => state.dueTime,
}));

import {
    checkPresentingFlowAutoNextIsRunnable,
    firePresentingFlowRunAction,
    getPresentingFlowAutoNextState,
    jumpPresentingFlowRunToCcItem,
    notifyPresentingFlowRunSelectionChanged,
    registerPresentingFlowRunController,
    setPresentingFlowAutoNextPaused,
    startPresentingFlowAutoNext,
    startPresentingFlowAutoNextAtTime,
    stopPresentingFlowAutoNext,
    stopPresentingFlowAutoNextInterval,
    toPresentingFlowAutoNextCountdownLabel,
} from './presentingFlowAutoNextHelpers';

const cleanups: Array<() => void> = [];

function register(filePath: string, stepForward = vi.fn(() => true)) {
    const controller = { stepForward, jumpToUuid: vi.fn(() => true) };
    cleanups.push(registerPresentingFlowRunController(filePath, controller));
    return controller;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.dueTime = null;
});

afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
    vi.useRealTimers();
});

describe('presenting-flow automatic run control', () => {
    test('registers, replaces, cleans up, and rejects invalid starts', () => {
        expect(checkPresentingFlowAutoNextIsRunnable('/missing')).toBe(false);
        expect(startPresentingFlowAutoNext('/missing', 'timeout', 2)).toBe(
            false,
        );
        expect(stopPresentingFlowAutoNextInterval('/missing')).toBe(false);
        stopPresentingFlowAutoNext('/missing');
        notifyPresentingFlowRunSelectionChanged('/missing');
        setPresentingFlowAutoNextPaused('/missing', true);

        const first = register('/run');
        expect(checkPresentingFlowAutoNextIsRunnable('/run')).toBe(true);
        expect(startPresentingFlowAutoNext('/run', 'timeout', 0)).toBe(false);
        expect(startPresentingFlowAutoNext('/run', 'timeout', Infinity)).toBe(
            false,
        );
        const secondCleanup = registerPresentingFlowRunController('/run', {
            stepForward: vi.fn(() => true),
            jumpToUuid: vi.fn(() => true),
        });
        cleanups.push(secondCleanup);
        cleanups[0]();
        expect(checkPresentingFlowAutoNextIsRunnable('/run')).toBe(true);
        expect(first.stepForward).not.toHaveBeenCalled();
    });

    test('counts down a timeout, cancels it on movement, and pauses cleanly', () => {
        const controller = register('/timeout');
        expect(startPresentingFlowAutoNext('/timeout', 'timeout', 3)).toBe(
            true,
        );
        expect(getPresentingFlowAutoNextState('/timeout')).toMatchObject({
            remainingSeconds: 3,
            isPaused: false,
        });
        vi.advanceTimersByTime(1000);
        expect(
            getPresentingFlowAutoNextState('/timeout')?.remainingSeconds,
        ).toBe(2);
        setPresentingFlowAutoNextPaused('/timeout', true);
        expect(getPresentingFlowAutoNextState('/timeout')).toMatchObject({
            remainingSeconds: 2,
            isPaused: true,
            dueTime: null,
        });
        setPresentingFlowAutoNextPaused('/timeout', true);
        vi.advanceTimersByTime(5000);
        expect(controller.stepForward).not.toHaveBeenCalled();
        setPresentingFlowAutoNextPaused('/timeout', false);
        setPresentingFlowAutoNextPaused('/timeout', false);
        notifyPresentingFlowRunSelectionChanged('/timeout');
        expect(getPresentingFlowAutoNextState('/timeout')).toBeNull();
        stopPresentingFlowAutoNext('/timeout');
    });

    test('restarts an interval on movement and stops at the end of a run', () => {
        const stepForward = vi.fn(() => false);
        register('/interval', stepForward);
        startPresentingFlowAutoNext('/interval', 'interval', 2);
        vi.advanceTimersByTime(1000);
        expect(
            getPresentingFlowAutoNextState('/interval')?.remainingSeconds,
        ).toBe(1);
        notifyPresentingFlowRunSelectionChanged('/interval');
        expect(
            getPresentingFlowAutoNextState('/interval')?.remainingSeconds,
        ).toBe(2);
        notifyPresentingFlowRunSelectionChanged('/interval');
        vi.advanceTimersByTime(2000);
        expect(stepForward).toHaveBeenCalledTimes(1);
        expect(getPresentingFlowAutoNextState('/interval')).toBeNull();
        expect(stopPresentingFlowAutoNextInterval('/interval')).toBe(true);
    });

    test('keeps successful intervals running and borrows one timeout cycle', () => {
        const controller = register('/borrow');
        startPresentingFlowAutoNext('/borrow', 'interval', 5);
        expect(startPresentingFlowAutoNext('/borrow', 'timeout', 2, 123)).toBe(
            true,
        );
        expect(getPresentingFlowAutoNextState('/borrow')).toMatchObject({
            mode: 'interval',
            seconds: 5,
            remainingSeconds: 2,
            dueTime: 123,
        });
        vi.setSystemTime(123_000);
        vi.advanceTimersByTime(1000);
        expect(controller.stepForward).toHaveBeenCalled();
        expect(getPresentingFlowAutoNextState('/borrow')).toMatchObject({
            mode: 'interval',
            remainingSeconds: 5,
            dueTime: null,
        });

        setPresentingFlowAutoNextPaused('/borrow', true);
        startPresentingFlowAutoNext('/borrow', 'timeout', 3);
        expect(getPresentingFlowAutoNextState('/borrow')).toMatchObject({
            remainingSeconds: 3,
            isPaused: true,
        });
        expect(vi.getTimerCount()).toBe(0);
        expect(stopPresentingFlowAutoNextInterval('/borrow')).toBe(true);
        expect(getPresentingFlowAutoNextState('/borrow')).toBeNull();
    });

    test('arms a wall-clock timeout and reports missing or elapsed runs', () => {
        expect(
            startPresentingFlowAutoNextAtTime('/missing', '08:00'),
        ).toContain('Open');
        register('/clock');
        expect(startPresentingFlowAutoNextAtTime('/clock', '08:00')).toContain(
            'already due',
        );
        vi.setSystemTime(1_000);
        state.dueTime = 4_500;
        expect(startPresentingFlowAutoNextAtTime('/clock', '08:00')).toBeNull();
        expect(getPresentingFlowAutoNextState('/clock')).toMatchObject({
            mode: 'timeout',
            seconds: 4,
            dueTime: 4500,
        });
        vi.advanceTimersByTime(1000);
        expect(getPresentingFlowAutoNextState('/clock')?.remainingSeconds).toBe(
            3,
        );
    });

    test('formats labels, fires actions, and jumps by stable identity', () => {
        expect(toPresentingFlowAutoNextCountdownLabel(9)).toBe('9');
        expect(toPresentingFlowAutoNextCountdownLabel(65)).toBe('1:05');
        expect(toPresentingFlowAutoNextCountdownLabel(3665)).toBe('1:01:05');
        firePresentingFlowRunAction({ runAction: null } as any);
        firePresentingFlowRunAction({
            runAction: { label: 'Jump to', start: () => 'No target' },
        } as any);
        expect(mocks.toast).toHaveBeenCalledWith('Jump to', 'No target');
        firePresentingFlowRunAction({
            runAction: { label: 'Jump to', start: () => null },
        } as any);

        expect(
            jumpPresentingFlowRunToCcItem('/missing', { uuid: 'x' } as any),
        ).toContain('Open');
        const controller = register('/jump');
        expect(
            jumpPresentingFlowRunToCcItem('/jump', { uuid: null } as any),
        ).toContain('not in');
        controller.jumpToUuid.mockReturnValueOnce(false);
        expect(
            jumpPresentingFlowRunToCcItem('/jump', { uuid: 'lost' } as any),
        ).toContain('not in');
        expect(
            jumpPresentingFlowRunToCcItem('/jump', { uuid: 'found' } as any),
        ).toBeNull();
    });

    test('does not erase a clock re-armed by the step it fired', () => {
        const controller = register('/generation');
        controller.stepForward.mockImplementation(() => {
            startPresentingFlowAutoNext('/generation', 'interval', 8);
            return false;
        });
        startPresentingFlowAutoNext('/generation', 'interval', 1);
        vi.advanceTimersByTime(1000);
        expect(getPresentingFlowAutoNextState('/generation')).toMatchObject({
            mode: 'interval',
            remainingSeconds: 8,
        });
    });
});
