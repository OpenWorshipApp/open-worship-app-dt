import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    dueAt: vi.fn(),
    drawnSeconds: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('./slideAutoPlayRuleHelpers', () => ({
    setSlideAutoPlayDueAt: state.dueAt,
    setSlideAutoPlayDrawnSeconds: state.drawnSeconds,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: state.handleError }));

import {
    applyAutoPlayRunners,
    getRunningAutoPlayKeys,
    stopAllAutoPlay,
    type AutoPlayRunnerType,
} from './autoPlayRunnerHelpers';

async function flushPromises() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
}

function runner(
    key: string,
    overrides: Partial<AutoPlayRunnerType> = {},
): AutoPlayRunnerType {
    return {
        key,
        signature: 'fixed-2',
        getDelaySeconds: () => 2,
        tick: () => true,
        ...overrides,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    state.dueAt.mockReset();
    state.drawnSeconds.mockReset();
    state.handleError.mockReset();
});

afterEach(() => {
    stopAllAutoPlay();
    vi.useRealTimers();
});

describe('slide auto-play runners', () => {
    it('keeps an unchanged countdown, reschedules after a live tick, and ends once', async () => {
        const getDelaySeconds = vi.fn().mockReturnValue(2);
        const tick = vi
            .fn()
            .mockResolvedValueOnce(true)
            .mockResolvedValue(false);
        const onEnded = vi.fn();
        const first = runner('foreground:one', {
            getDelaySeconds,
            tick,
            onEnded,
        });

        applyAutoPlayRunners([first]);
        await flushPromises();
        expect(state.dueAt).toHaveBeenLastCalledWith('foreground:one', 3_000);
        expect(state.drawnSeconds).toHaveBeenLastCalledWith(
            'foreground:one',
            2,
        );
        vi.advanceTimersByTime(1_000);
        applyAutoPlayRunners([runner('foreground:one')]);
        await flushPromises();
        expect(getDelaySeconds).toHaveBeenCalledOnce();

        await vi.advanceTimersByTimeAsync(1_000);
        expect(tick).toHaveBeenCalledOnce();
        expect(getDelaySeconds).toHaveBeenCalledTimes(2);
        expect(state.dueAt).toHaveBeenLastCalledWith('foreground:one', 5_000);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(tick).toHaveBeenCalledTimes(2);
        expect(onEnded).toHaveBeenCalledOnce();
        expect(getRunningAutoPlayKeys()).toEqual([]);
        expect(state.dueAt).toHaveBeenLastCalledWith('foreground:one', null);
        expect(state.drawnSeconds).toHaveBeenLastCalledWith(
            'foreground:one',
            null,
        );
    });

    it('reconciles only owned keys and replaces a changed signature', async () => {
        const firstTick = vi.fn();
        const nextTick = vi.fn().mockReturnValue(false);
        applyAutoPlayRunners([
            runner('foreground:one', { tick: firstTick }),
            runner('background:one'),
        ]);
        await flushPromises();
        expect(getRunningAutoPlayKeys()).toEqual([
            'foreground:one',
            'background:one',
        ]);

        applyAutoPlayRunners(
            [
                runner('foreground:one', {
                    signature: 'changed',
                    tick: nextTick,
                }),
            ],
            (key) => key.startsWith('foreground:'),
        );
        await flushPromises();
        expect(getRunningAutoPlayKeys()).toEqual([
            'background:one',
            'foreground:one',
        ]);
        expect(state.dueAt).toHaveBeenCalledWith('foreground:one', null);
        await vi.advanceTimersByTimeAsync(2_000);
        expect(firstTick).not.toHaveBeenCalled();
        expect(nextTick).toHaveBeenCalledOnce();

        applyAutoPlayRunners([], (key) => key.startsWith('background:'));
        expect(getRunningAutoPlayKeys()).toEqual([]);
    });

    it('ignores an async delay that resolves after its runner is stopped', async () => {
        let resolveDelay!: (seconds: number) => void;
        const delay = new Promise<number>((resolve) => {
            resolveDelay = resolve;
        });
        const tick = vi.fn();
        applyAutoPlayRunners([
            runner('foreground:pending', {
                getDelaySeconds: () => delay,
                tick,
            }),
        ]);
        await flushPromises();
        applyAutoPlayRunners([]);
        resolveDelay(4);
        await flushPromises();
        await vi.advanceTimersByTimeAsync(4_000);
        expect(tick).not.toHaveBeenCalled();
        expect(getRunningAutoPlayKeys()).toEqual([]);
        expect(state.dueAt).not.toHaveBeenCalledWith(
            'foreground:pending',
            5_000,
        );
    });

    it('stops nonpositive delays and reports failures from delay and tick', async () => {
        applyAutoPlayRunners([runner('zero', { getDelaySeconds: () => 0 })]);
        await flushPromises();
        expect(getRunningAutoPlayKeys()).toEqual([]);
        expect(state.dueAt).toHaveBeenCalledWith('zero', null);

        const delayError = new Error('delay failed');
        applyAutoPlayRunners([
            runner('bad-delay', {
                getDelaySeconds: () => Promise.reject(delayError),
            }),
        ]);
        await flushPromises();
        expect(state.handleError).toHaveBeenCalledWith(delayError);
        expect(getRunningAutoPlayKeys()).toEqual([]);

        const tickError = new Error('tick failed');
        const onEnded = vi.fn();
        applyAutoPlayRunners([
            runner('bad-tick', {
                getDelaySeconds: () => 1,
                tick: () => Promise.reject(tickError),
                onEnded,
            }),
        ]);
        await flushPromises();
        await vi.advanceTimersByTimeAsync(1_000);
        expect(state.handleError).toHaveBeenCalledWith(tickError);
        expect(onEnded).toHaveBeenCalledOnce();
        expect(getRunningAutoPlayKeys()).toEqual([]);
    });
});
