// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    order: [] as string[],
    webProvider: { kind: 'web-screen' },
    frameProvider: { kind: 'screen-show-frame' },
    ensureRandomUUID: vi.fn(),
    reportScreenEmptiness: vi.fn(),
}));

vi.mock('./virtual-display/webScreenProvider', () => ({
    ensureRandomUUID: () => {
        state.order.push('uuid');
        state.ensureRandomUUID();
    },
    connectWebScreen: async () => {
        state.order.push('connect-web-screen');
        return { provider: state.webProvider };
    },
}));
vi.mock('./_screen/screenShowFrameProvider', () => ({
    connectScreenShowFrame: () => {
        state.order.push('connect-frame');
        return state.frameProvider;
    },
}));
vi.mock('./virtual-display/webScreenEmptyReporter', () => ({
    reportScreenEmptiness: (screenId: number) => {
        state.order.push(`report:${screenId}`);
        state.reportScreenEmptiness(screenId);
    },
}));

beforeEach(() => {
    vi.resetModules();
    state.order = [];
    delete (globalThis as any).provider;
    // A fresh factory per test, so importing the screen page is recorded
    // every time, with the provider it found in place.
    vi.doMock('./screen', () => {
        state.order.push(`screen:${(globalThis as any).provider?.kind}`);
        return {};
    });
});

afterEach(() => {
    vi.doUnmock('./screen');
    delete (globalThis as any).provider;
});

describe('virtual display screen page', () => {
    test('connects to the web screen before the screen page loads, then reports emptiness for its screen', async () => {
        globalThis.history.replaceState({}, '', '/vd-screen.html?screenId=5');

        await import('./vd-screen');

        expect(state.order).toEqual([
            'uuid',
            'connect-web-screen',
            'screen:web-screen',
            'report:5',
        ]);
        expect((globalThis as any).provider).toBe(state.webProvider);
    });

    test('a Screen Show frame takes its provider from the window holding it and reports nothing', async () => {
        globalThis.history.replaceState(
            {},
            '',
            '/vd-screen.html?screenId=2&screenShow=1',
        );

        await import('./vd-screen');

        expect(state.order).toEqual([
            'uuid',
            'connect-frame',
            'screen:screen-show-frame',
        ]);
        expect(state.reportScreenEmptiness).not.toHaveBeenCalled();
    });
});
