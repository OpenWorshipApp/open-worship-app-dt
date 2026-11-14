// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        foregroundData: {} as Record<string, unknown>,
        byScreenId: null as any,
        byKey: null as any,
        managers: [] as any[],
    },
    mocks: {
        parse: vi.fn((value) => ({ parsed: value })),
        toast: vi.fn(),
    },
}));

vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: { parseAllForegroundData: mocks.parse },
}));
vi.mock('../_screen/screenHelpers', () => ({
    getForegroundDataListOnScreenSetting: () => state.foregroundData,
}));
vi.mock('../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => state.managers,
    getScreenManagerByKey: () => state.byKey,
    getScreenManagerByScreenId: () => state.byScreenId,
}));

import {
    getForegroundSessionShowingList,
    getForegroundShowingScreenIdDataList,
    getIsAnyForegroundShowing,
    getScreenForegroundManagerByDropped,
    getScreenForegroundManagerInstances,
} from './foregroundHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.foregroundData = {
        3: { message: 'Welcome' },
        9: { message: 'Later' },
    };
    state.byScreenId = null;
    state.byKey = null;
    state.managers = [];
});

describe('foreground helpers', () => {
    test('parses saved foreground data before filtering it by screen', () => {
        const result = getForegroundShowingScreenIdDataList((data) => {
            return (
                (data as unknown as { parsed: { message: string } }).parsed
                    .message === 'Welcome'
            );
        });

        expect(mocks.parse).toHaveBeenCalledTimes(2);
        expect(result).toEqual([[3, { parsed: { message: 'Welcome' } }]]);
    });

    // Each session owns its own overlay on a screen: two sessions up on one
    // screen are two rows, each marked on its own tab and hidden by its own
    // Hide.
    test('lists one row per session entry of a kind, screen by screen', () => {
        // As the real parse: every list there, empty when the entry has none.
        mocks.parse.mockImplementation((value) => ({
            quickTextDataList: [],
            countdownDataList: [],
            marqueeTopDataList: [],
            ...value,
        }));
        const matthew = { id: 'a', htmlText: 'Matthew' };
        const session6 = { id: 'b', htmlText: 'Session 6' };
        const fallback = { htmlText: 'Default' };
        state.foregroundData = {
            3: { quickTextDataList: [matthew, session6] },
            5: { quickTextDataList: [] },
            9: { quickTextDataList: [fallback], countdownDataList: [{}] },
        };
        expect(getForegroundSessionShowingList('quickTextDataList')).toEqual([
            [3, matthew],
            [3, session6],
            [9, fallback],
        ]);
        expect(getForegroundSessionShowingList('countdownDataList')).toEqual([
            [9, {}],
        ]);
        expect(getForegroundSessionShowingList('marqueeTopDataList')).toEqual(
            [],
        );
    });

    test('reports a missing screen manager and otherwise passes its foreground manager through', () => {
        getScreenForegroundManagerInstances(4, vi.fn());
        expect(mocks.toast).toHaveBeenCalledWith(
            'ScreenManager not found',
            'error',
        );

        const foregroundManager = { isShowing: true };
        const callback = vi.fn();
        state.byScreenId = { screenForegroundManager: foregroundManager };
        getScreenForegroundManagerInstances(4, callback);
        expect(callback).toHaveBeenCalledWith(foregroundManager);
    });

    test('finds live foreground state and only accepts a screen-key drop target', () => {
        state.managers = [
            { screenForegroundManager: { isShowing: false } },
            { screenForegroundManager: { isShowing: true } },
        ];
        expect(getIsAnyForegroundShowing()).toBe(true);

        const target = document.createElement('div');
        target.dataset.screenKey = 'stage-a';
        const foregroundManager = { isShowing: true };
        state.byKey = { screenForegroundManager: foregroundManager };
        expect(
            getScreenForegroundManagerByDropped({ currentTarget: target }),
        ).toBe(foregroundManager);
        expect(
            getScreenForegroundManagerByDropped({
                currentTarget: document.body,
            }),
        ).toBeNull();
        state.byKey = null;
        expect(
            getScreenForegroundManagerByDropped({ currentTarget: target }),
        ).toBeNull();
    });
});
