// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    hideProgressBarMock,
    showProgressBarMock,
    useTransitionMock,
} = vi.hoisted(() => ({
    hideProgressBarMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    useTransitionMock: vi.fn(),
}));

vi.mock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react');
    return {
        ...actual,
        useTransition: useTransitionMock,
    };
});

vi.mock('../event/ProgressBarEventListener', () => ({
    default: {
        showProgressBar: showProgressBarMock,
        hideProgressBar: hideProgressBarMock,
    },
}));

import ProgressBarComp, { useProgressBarComp } from './ProgressBarComp';
import {
    hideProgressBar,
    showProgressBar,
    showProgressBarMessage,
} from './progressBarHelpers';

describe('progressBar helpers and components', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        vi.useFakeTimers();
        useTransitionMock.mockReturnValue([false, vi.fn()]);
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    async function render(element: React.ReactElement) {
        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            if (!root) {
                root = createRoot(container);
            }
            root.render(element);
        });
    }

    test('forwards show and hide events to the progress listener', () => {
        showProgressBar('syncing');
        hideProgressBar('syncing');

        expect(showProgressBarMock).toHaveBeenCalledWith('syncing');
        expect(hideProgressBarMock).toHaveBeenCalledWith('syncing');
    });

    test('updates visible progress-bar text and clears it on timeout', () => {
        const visibleText = document.createElement('div');
        visibleText.className = 'progress-bar-content-text';
        document.body.appendChild(visibleText);

        const ignoredSvg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );
        ignoredSvg.setAttribute('class', 'progress-bar-content-text');
        ignoredSvg.textContent = 'keep';
        document.body.appendChild(ignoredSvg);

        showProgressBarMessage('Syncing', 'now');

        expect(visibleText.textContent).toBe('Syncing now');
        expect(ignoredSvg.textContent).toBe('keep');

        vi.advanceTimersByTime(3000);

        expect(visibleText.textContent).toBe('');
    });

    test('renders progress bars with and without a title attribute', async () => {
        await render(<ProgressBarComp title="Uploading" />);

        const titledBar = container?.querySelector<HTMLDivElement>(
            '.app-progress-bar',
        );
        expect(titledBar?.getAttribute('title')).toBe('Progress: Uploading');
        expect(
            container?.querySelector('[role="progressbar"]')?.getAttribute(
                'aria-valuenow',
            ),
        ).toBe('100');

        await render(<ProgressBarComp />);

        const untitledBar = container?.querySelector<HTMLDivElement>(
            '.app-progress-bar',
        );
        expect(untitledBar?.getAttribute('title')).toBeNull();
    });

    test('returns an idle progress child and forwards startTransaction calls', async () => {
        const startTransactionMock = vi.fn((callback?: () => void) => {
            callback?.();
        });
        const onStarted = vi.fn();
        useTransitionMock.mockReturnValue([false, startTransactionMock]);

        function Host() {
            const { progressBarChild, startTransaction } = useProgressBarComp();
            return (
                <div>
                    <button onClick={() => startTransaction(onStarted)}>
                        start
                    </button>
                    {progressBarChild}
                </div>
            );
        }

        await render(<Host />);

        expect(container?.querySelector('.app-progress-bar')).toBeNull();

        await act(async () => {
            container
                ?.querySelector('button')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(startTransactionMock).toHaveBeenCalledWith(onStarted);
        expect(onStarted).toHaveBeenCalledTimes(1);
    });

    test('renders the inline progress bar child while pending', async () => {
        useTransitionMock.mockReturnValue([true, vi.fn()]);

        function Host() {
            const { progressBarChild } = useProgressBarComp();
            return <div>{progressBarChild}</div>;
        }

        await render(<Host />);

        const progressContainer = container?.querySelector<HTMLDivElement>(
            '.w-100',
        );
        expect(progressContainer?.style.height).toBe('1px');
        expect(container?.querySelector('.app-progress-bar')).not.toBeNull();
    });
});
