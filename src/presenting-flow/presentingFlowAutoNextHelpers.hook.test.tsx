// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The countdown a run sheet's preview draws: each open run's armed clock,
// through one shared listener set, re-rendering only the panel whose own
// run changed.

vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: vi.fn() }));
vi.mock('./presentingFlowActionTimeHelpers', () => ({
    toPresentingFlowActionDueTime: () => null,
}));

import {
    registerPresentingFlowRunController,
    startPresentingFlowAutoNext,
    stopPresentingFlowAutoNext,
    usePresentingFlowAutoNext,
} from './presentingFlowAutoNextHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const renderCounts = new Map<string, number>();

function CountdownProbeComp({ filePath }: Readonly<{ filePath: string }>) {
    const autoNext = usePresentingFlowAutoNext(filePath);
    renderCounts.set(filePath, (renderCounts.get(filePath) ?? 0) + 1);
    return (
        <span data-file-path={filePath}>
            {autoNext === null
                ? 'idle'
                : `${autoNext.mode} ${autoNext.remainingSeconds}`}
        </span>
    );
}

let container: HTMLDivElement;
let root: Root;
const cleanups: Array<() => void> = [];

function register(filePath: string) {
    cleanups.push(
        registerPresentingFlowRunController(filePath, {
            stepForward: vi.fn(() => true),
            jumpToUuid: vi.fn(() => true),
        }),
    );
}

function shown(filePath: string) {
    return container.querySelector(`[data-file-path="${filePath}"]`)
        ?.textContent;
}

beforeEach(() => {
    vi.useFakeTimers();
    renderCounts.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    while (cleanups.length > 0) {
        cleanups.pop()?.();
    }
    vi.useRealTimers();
});

describe('usePresentingFlowAutoNext', () => {
    test('a panel follows its own run and is not redrawn for another', () => {
        register('/first.owapf');
        register('/second.owapf');
        act(() =>
            root.render(
                <>
                    <CountdownProbeComp filePath="/first.owapf" />
                    <CountdownProbeComp filePath="/second.owapf" />
                </>,
            ),
        );
        expect(shown('/first.owapf')).toBe('idle');
        expect(shown('/second.owapf')).toBe('idle');
        const secondRenders = renderCounts.get('/second.owapf');

        act(() => {
            startPresentingFlowAutoNext('/first.owapf', 'timeout', 3);
        });
        expect(shown('/first.owapf')).toBe('timeout 3');
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(shown('/first.owapf')).toBe('timeout 2');
        expect(shown('/second.owapf')).toBe('idle');
        expect(renderCounts.get('/second.owapf')).toBe(secondRenders);

        act(() => {
            startPresentingFlowAutoNext('/second.owapf', 'interval', 5);
        });
        expect(shown('/second.owapf')).toBe('interval 5');
        act(() => {
            stopPresentingFlowAutoNext('/first.owapf');
        });
        expect(shown('/first.owapf')).toBe('idle');
        expect(shown('/second.owapf')).toBe('interval 5');
    });

    test('a panel mounted on a run already counting opens on its count', () => {
        register('/running.owapf');
        startPresentingFlowAutoNext('/running.owapf', 'interval', 4);
        act(() =>
            root.render(<CountdownProbeComp filePath="/running.owapf" />),
        );
        expect(shown('/running.owapf')).toBe('interval 4');
        // Unmounted, it no longer hears the clock; the run carries on.
        act(() => root.unmount());
        root = createRoot(container);
        expect(() => {
            vi.advanceTimersByTime(1000);
        }).not.toThrow();
        act(() =>
            root.render(<CountdownProbeComp filePath="/running.owapf" />),
        );
        expect(shown('/running.owapf')).toBe('interval 3');
    });
});
