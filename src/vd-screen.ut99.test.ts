// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// `vd-screen.ts` gives the screen page its stand-in provider BEFORE the page
// loads (`appProvider` reads `globalThis.provider` once, at import), so the
// order is the behaviour. `./screen` is re-registered with `vi.doMock` after
// each reset so its factory runs on every import and records which provider
// it found; the other mocks read the hoisted bundle through getters.
const h = vi.hoisted(() => {
    return {
        events: [] as string[],
        ensureRandomUUID: vi.fn(),
        connectWebScreen: vi.fn(),
        connectScreenShowFrame: vi.fn(),
        reportScreenEmptiness: vi.fn(),
    };
});

vi.mock('./virtual-display/webScreenProvider', () => ({
    ensureRandomUUID: h.ensureRandomUUID,
    connectWebScreen: h.connectWebScreen,
}));
vi.mock('./_screen/screenShowFrameProvider', () => ({
    get connectScreenShowFrame() {
        h.events.push('load:screen-show-frame-provider');
        return h.connectScreenShowFrame;
    },
}));
vi.mock('./virtual-display/webScreenEmptyReporter', () => ({
    get reportScreenEmptiness() {
        h.events.push('load:empty-reporter');
        return h.reportScreenEmptiness;
    },
}));

const originalUrl = globalThis.location.href;
const hadProvider = 'provider' in globalThis;
const originalProvider = (globalThis as any).provider;

function openAt(search: string) {
    globalThis.history.replaceState(null, '', `/vd-screen.html${search}`);
}

beforeEach(() => {
    vi.resetModules();
    h.events.length = 0;
    vi.doMock('./screen', () => {
        h.events.push(`load:screen@${(globalThis as any).provider?.kind}`);
        return {};
    });
    h.ensureRandomUUID.mockImplementation(() => {
        h.events.push('ensure-uuid');
    });
    h.connectWebScreen.mockImplementation(async () => {
        h.events.push('connect-web-screen');
        return { provider: { kind: 'web-screen' } };
    });
    h.connectScreenShowFrame.mockImplementation(() => {
        h.events.push('connect-screen-show-frame');
        return { kind: 'screen-show-frame' };
    });
    h.reportScreenEmptiness.mockImplementation((screenId: number) => {
        h.events.push(`report-emptiness:${screenId}`);
    });
});

afterEach(() => {
    vi.doUnmock('./screen');
    globalThis.history.replaceState(null, '', originalUrl);
    if (hadProvider) {
        (globalThis as any).provider = originalProvider;
    } else {
        delete (globalThis as any).provider;
    }
});

describe('vd-screen.ts', () => {
    test('a virtual display screen connects first, then loads the screen, then reports for its own id', async () => {
        openAt('?screenId=4');
        await import('./vd-screen');

        expect(h.events).toEqual([
            'ensure-uuid',
            'connect-web-screen',
            'load:screen@web-screen',
            'load:empty-reporter',
            'report-emptiness:4',
        ]);
        expect(h.reportScreenEmptiness).toHaveBeenCalledExactlyOnceWith(4);
        expect((globalThis as any).provider).toEqual({ kind: 'web-screen' });
    });

    test('a Screen Show frame takes the frame provider and never connects or reports', async () => {
        openAt('?screenShow=1&screenId=2');
        await import('./vd-screen');

        expect(h.events).toEqual([
            'ensure-uuid',
            'load:screen-show-frame-provider',
            'connect-screen-show-frame',
            'load:screen@screen-show-frame',
        ]);
        expect(h.connectWebScreen).not.toHaveBeenCalled();
        expect(h.reportScreenEmptiness).not.toHaveBeenCalled();
        expect((globalThis as any).provider).toEqual({
            kind: 'screen-show-frame',
        });
    });
});
