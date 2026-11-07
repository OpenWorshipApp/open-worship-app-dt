import { beforeEach, describe, expect, test, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
    mocks: {
        handleError: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
        showSimpleToast: vi.fn(),
    },
}));

vi.mock('./errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `tr:${key}`,
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.showProgressBar,
    hideProgressBar: mocks.hideProgressBar,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));

import { runMenuAction, runWithProgress } from './archiveFlowHelpers';

const events: string[] = [];

beforeEach(() => {
    events.length = 0;
    mocks.showProgressBar.mockImplementation((title: string) => {
        events.push(`show:${title}`);
    });
    mocks.hideProgressBar.mockImplementation((title: string) => {
        events.push(`hide:${title}`);
    });
});

describe('runWithProgress', () => {
    test('runs the step under the progress bar and answers its value', async () => {
        const result = await runWithProgress('Export', async () => {
            events.push('run');
            return 42;
        });
        expect(result).toBe(42);
        expect(events).toEqual(['show:Export', 'run', 'hide:Export']);
    });

    test('takes the progress bar down when the step throws', async () => {
        await expect(
            runWithProgress('Import', async () => {
                events.push('run');
                throw new Error('disk full');
            }),
        ).rejects.toThrow('disk full');
        expect(events).toEqual(['show:Import', 'run', 'hide:Import']);
    });
});

describe('runMenuAction', () => {
    test('says nothing when the flow succeeds', async () => {
        const run = vi.fn(async () => {});
        await runMenuAction('Export Data', run);
        expect(run).toHaveBeenCalledOnce();
        expect(mocks.handleError).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).not.toHaveBeenCalled();
    });

    test('logs a failure and says it under the translated title', async () => {
        const error = new Error('Wrong password');
        await runMenuAction('Import Data', async () => {
            throw error;
        });
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'tr:Import Data',
            'Wrong password',
        );
    });

    test('names the flow when the failure carries no message', async () => {
        await runMenuAction('Import Data', async () => {
            throw null;
        });
        expect(mocks.handleError).toHaveBeenCalledWith(null);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'tr:Import Data',
            'Unable to complete Import Data',
        );
    });
});
