// @vitest-environment jsdom

import { act } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// `init` is deferred here on purpose: the bug this file guards against was the
// bar rendering BEFORE the language data arrived, which throws in `tran()` and
// leaves an empty white view where the find bar should be.
const state = vi.hoisted(() => ({
    callback: null as null | (() => void),
    resolveInit: () => {},
    rejectInit: (_error: unknown) => {},
    render: vi.fn(),
    stopFinding: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('./boot', () => ({
    init: (callback: () => void) => {
        state.callback = callback;
        return new Promise<void>((resolve, reject) => {
            state.resolveInit = resolve;
            state.rejectInit = reject;
        });
    },
}));
vi.mock('./others/rootHelpers', () => ({
    getReactRoot: () => ({ render: state.render }),
}));
vi.mock('./find/FinderAppComp', () => ({
    default: () => <div id="finder-app" />,
}));
vi.mock('./find/finderHelpers', () => ({
    stopFindingString: state.stopFinding,
}));
vi.mock('./helper/errorHelpers', () => ({
    handleError: state.handleError,
}));

async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
}

beforeEach(() => {
    vi.resetModules();
    state.callback = null;
    state.resolveInit = () => {};
    state.rejectInit = () => {};
    state.render.mockReset();
    state.stopFinding.mockReset();
    state.handleError.mockReset();
});

describe('finder entry point', () => {
    test('waits for the app language before drawing the bar', async () => {
        await import('./finder');
        expect(state.callback).not.toBeNull();
        expect(state.render).not.toHaveBeenCalled();

        await act(async () => {
            state.callback!();
        });
        await act(async () => {
            state.resolveInit();
        });
        expect(state.render).toHaveBeenCalledOnce();

        globalThis.dispatchEvent(new Event('beforeunload'));
        expect(state.stopFinding).toHaveBeenCalled();
    });

    test('still draws, after reporting, when init fails', async () => {
        await import('./finder');
        const error = new Error('init failed');
        await act(async () => {
            state.rejectInit(error);
        });
        await flush();
        expect(state.handleError).toHaveBeenCalledWith(error);
        expect(state.render).toHaveBeenCalledOnce();
    });
});
