// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A dev build with the effect warnings on: `useAppEffect` is picked once, at
// import, so the flags are set before the module loads.
const { mocks, providerMock } = vi.hoisted(() => ({
    mocks: { appWarning: vi.fn(), handleError: vi.fn() },
    providerMock: {
        systemUtils: { isDev: true },
        envUtils: { isFEUseEffectWarning: true },
    },
}));

vi.mock('./loggerHelpers', () => ({ appWarning: mocks.appWarning }));
vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../server/appProvider', () => ({ default: providerMock }));

import {
    TestInfiniteComp,
    useAppCurrentRef,
    useAppEffect,
    useAppEffectAsync,
} from './appHooks';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    providerMock.envUtils.isFEUseEffectWarning = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    providerMock.envUtils.isFEUseEffectWarning = true;
    vi.useRealTimers();
});

describe('the repeated-effect warning', () => {
    function RepeatProbeComp({ tick }: Readonly<{ tick: number }>) {
        useAppEffect(() => undefined, [tick], 'reset-key');
        return null;
    }

    function countRepeatWarnings() {
        return mocks.appWarning.mock.calls.filter(([message]) => {
            return String(message).includes(
                'reset-key is called more than 10 times',
            );
        }).length;
    }

    let tick = 0;
    async function rerun(times: number) {
        for (let index = 0; index < times; index++) {
            tick += 1;
            await act(async () => {
                root.render(<RepeatProbeComp tick={tick} />);
            });
        }
    }

    test('the count starts over a second after the last run', async () => {
        await rerun(6);
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        // Six more: twelve in all, but never more than ten in one window.
        await rerun(6);
        expect(countRepeatWarnings()).toBe(0);

        // Five more inside this window make eleven, and that is reported.
        await rerun(5);
        expect(countRepeatWarnings()).toBe(1);
    });
});

describe('a method called after its effect was unmounted', () => {
    test('is reported only while the effect warning is switched on', async () => {
        let captured: Record<string, (value: string) => void> = {};
        function AsyncProbeComp() {
            useAppEffectAsync(
                async (methodContext) => {
                    captured = methodContext;
                },
                [],
                { setValue: (_value: string) => {} },
                'late-call-key',
            );
            return null;
        }

        await act(async () => {
            root.render(<AsyncProbeComp />);
        });
        await act(async () => {
            root.render(<span>gone</span>);
        });

        providerMock.envUtils.isFEUseEffectWarning = false;
        captured.setValue('late');
        expect(mocks.appWarning).not.toHaveBeenCalledWith(
            '[useAppEffect] setValue is called after unmounting',
        );

        providerMock.envUtils.isFEUseEffectWarning = true;
        captured.setValue('late');
        expect(mocks.appWarning).toHaveBeenCalledWith(
            '[useAppEffect] setValue is called after unmounting',
        );
    });
});

describe('TestInfiniteComp', () => {
    test('Stop lets the tick already scheduled land, then the count holds', async () => {
        await act(async () => {
            root.render(<TestInfiniteComp />);
        });
        await act(async () => {
            vi.advanceTimersByTime(20);
        });
        expect(container.textContent).toBe('StopCount: 1');

        await act(async () => {
            container.querySelector('button')!.click();
        });
        expect(container.textContent).toBe('StoppedCount: 1');

        await act(async () => {
            vi.advanceTimersByTime(20);
        });
        expect(container.textContent).toBe('StoppedCount: 2');
        await act(async () => {
            vi.advanceTimersByTime(200);
        });
        expect(container.textContent).toBe('StoppedCount: 2');
    });
});

describe('useAppCurrentRef', () => {
    test('one ref for the life of the component, holding the latest value', async () => {
        const refs: Array<{ current: string }> = [];
        function RefProbeComp({ label }: Readonly<{ label: string }>) {
            refs.push(useAppCurrentRef(label));
            return null;
        }

        await act(async () => {
            root.render(<RefProbeComp label="first" />);
        });
        expect(refs[0].current).toBe('first');

        await act(async () => {
            root.render(<RefProbeComp label="second" />);
        });
        expect(refs).toHaveLength(2);
        expect(refs[1]).toBe(refs[0]);
        expect(refs[0].current).toBe('second');
    });
});
