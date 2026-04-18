// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getWindowDim: vi.fn(() => ({ width: 1440, height: 900 })),
    setSetting: vi.fn(),
    getAllShowingScreenIds: vi.fn(() => [1]),
    hideScreen: vi.fn(),
    setDisplay: vi.fn(),
    showScreen: vi.fn(),
    getDisplayByScreenId: vi.fn((screenId: number) => ({
        id: screenId + 100,
        bounds: {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
        },
    })),
    getDisplayIdByScreenId: vi.fn((screenId: number) => screenId + 100),
    showSimpleToast: vi.fn(),
    enableBackgroundSyncGroup: vi.fn(),
    enableVarySyncGroup: vi.fn(),
    enableBibleSyncGroup: vi.fn(),
    enableForegroundSyncGroup: vi.fn(),
    appProvider: {
        isPagePresenter: true,
        isPageScreen: false,
        systemUtils: {
            isDev: false,
        },
    },
}));

let TestScreenManagerBase: any;

vi.mock('../../helper/helpers', () => ({
    getWindowDim: mocks.getWindowDim,
}));

vi.mock('../../helper/settingHelpers', () => ({
    setSetting: mocks.setSetting,
}));

vi.mock('../screenHelpers', () => ({
    getAllShowingScreenIds: mocks.getAllShowingScreenIds,
    hideScreen: mocks.hideScreen,
    setDisplay: mocks.setDisplay,
    showScreen: mocks.showScreen,
}));

vi.mock('./screenHelpers', () => ({
    getDisplayByScreenId: mocks.getDisplayByScreenId,
    getDisplayIdByScreenId: mocks.getDisplayIdByScreenId,
    SCREEN_MANAGER_SETTING_NAME: 'screen-manager',
}));

vi.mock('../../server/appProvider', () => ({
    default: mocks.appProvider,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));

vi.mock('./ScreenBackgroundManager', () => ({
    default: class ScreenBackgroundManager {
        static enableSyncGroup = mocks.enableBackgroundSyncGroup;
    },
}));

vi.mock('./ScreenVaryAppDocumentManager', () => ({
    default: class ScreenVaryAppDocumentManager {
        static enableSyncGroup = mocks.enableVarySyncGroup;
    },
}));

vi.mock('./ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static enableSyncGroup = mocks.enableBibleSyncGroup;
    },
}));

vi.mock('./ScreenForegroundManager', () => ({
    default: class ScreenForegroundManager {
        static enableSyncGroup = mocks.enableForegroundSyncGroup;
    },
}));

describe('ScreenManagerBase', () => {
    beforeAll(async () => {
        const { default: ScreenManagerBase } =
            await import('./ScreenManagerBase');

        TestScreenManagerBase = class extends ScreenManagerBase {
            sendSyncScreen = vi.fn();
            clear = vi.fn();
            delete = vi.fn(async () => {});
            receiveScreenDropped = vi.fn();
            sendScreenMessage = vi.fn();
            createScreenManagerBaseGhost = vi.fn((screenId: number) => {
                return new TestScreenManagerBase(screenId);
            });
            getScreenManagerBaseForce = vi.fn((screenId: number) => {
                return new TestScreenManagerBase(screenId);
            });
        };
    });

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.appProvider.isPagePresenter = true;
        mocks.appProvider.isPageScreen = false;
        mocks.getAllShowingScreenIds.mockReturnValue([1]);
        mocks.getWindowDim.mockReturnValue({ width: 1440, height: 900 });
    });

    test('parses keys, derives dimensions, and toggles visibility', () => {
        const manager = new TestScreenManagerBase(1);

        expect(TestScreenManagerBase.idFromKey('42')).toBe(42);
        expect(() => TestScreenManagerBase.idFromKey('nope')).toThrow(
            'Invalid screen key: nope',
        );
        expect(manager.width).toBe(1920);
        expect(manager.height).toBe(1080);
        expect(manager.checkIsLockedWithMessage()).toBe(false);
        expect(mocks.showSimpleToast).not.toHaveBeenCalled();

        const target = document.createElement('div');
        const scrollToMock = vi.fn();
        Object.defineProperties(target, {
            scrollWidth: { configurable: true, value: 600 },
            clientWidth: { configurable: true, value: 200 },
            scrollHeight: { configurable: true, value: 500 },
            clientHeight: { configurable: true, value: 100 },
            scrollTo: { configurable: true, value: scrollToMock },
        });
        manager.getElementsByDomSelector = vi.fn(() => [target]);
        manager.syncScrollPercentage({
            domSelector: '.sync-target',
            scroll: { x: 0.25, y: 0.5 },
        });
        expect(scrollToMock).toHaveBeenCalledWith({ left: 100, top: 200 });

        manager.isShowing = true;
        manager.isShowing = false;

        expect(mocks.showScreen).toHaveBeenCalledWith({
            screenId: 1,
            displayId: 101,
        });
        expect(mocks.hideScreen).toHaveBeenCalledWith(1);
    });

    test('uses window dimensions on screen pages and reports locked state', () => {
        mocks.appProvider.isPageScreen = true;
        const manager = new TestScreenManagerBase(2);
        expect(manager.width).toBe(1440);
        expect(manager.height).toBe(900);

        manager.isLocked = true;
        expect(manager.isLocked).toBe(true);
        expect(manager.checkIsLockedWithMessage()).toBe(true);
        expect(mocks.showSimpleToast).toHaveBeenCalledOnce();

        mocks.appProvider.isPagePresenter = false;
        expect(manager.isLocked).toBe(false);
    });

    test('validates stage numbers, persists display ids, and checks sync groups', () => {
        const manager = new TestScreenManagerBase(3);
        manager.stageNumber = 2;
        expect(manager.stageNumber).toBe(2);
        expect(() => {
            manager.stageNumber = -1;
        }).toThrow('Stage number cannot be negative');

        manager.noSyncGroupMap.set('test-sync', true);
        expect(
            manager.checkIsSyncGroupEnabled({ eventNamePrefix: 'test-sync' }),
        ).toBe(false);
        expect(
            manager.checkIsSyncGroupEnabled({
                eventNamePrefix: 'missing-sync',
            }),
        ).toBe(true);

        manager.displayId = 66;
        expect(mocks.setDisplay).not.toHaveBeenCalled();

        manager.isShowing = true;
        manager.displayId = 77;

        expect(mocks.setSetting).toHaveBeenCalledWith(
            'screen-manager-pid-3',
            '77',
        );
        expect(mocks.setDisplay).toHaveBeenCalledWith({
            screenId: 3,
            displayId: 77,
        });
    });

    test('syncs color notes across managers and fires events safely', async () => {
        const manager = new TestScreenManagerBase(4);

        await manager.setColorNote('amber');
        expect(manager.colorNote).toBe('amber');
        expect(mocks.enableBackgroundSyncGroup).toHaveBeenCalledWith(4);
        expect(mocks.enableVarySyncGroup).toHaveBeenCalledWith(4);
        expect(mocks.enableBibleSyncGroup).toHaveBeenCalledWith(4);
        expect(mocks.enableForegroundSyncGroup).toHaveBeenCalledWith(4);
        expect(manager.sendSyncScreen).toHaveBeenCalledOnce();

        expect(() => {
            manager.fireUpdateEvent();
            manager.fireColorNoteUpdateEvent();
            manager.fireInstanceEvent();
            manager.fireVisibleEvent();
            manager.fireRefreshEvent();
            TestScreenManagerBase.fireUpdateEvent();
            TestScreenManagerBase.fireColorNoteUpdateEvent();
            TestScreenManagerBase.fireInstanceEvent();
            TestScreenManagerBase.fireVisibleEvent();
            TestScreenManagerBase.fireRefreshEvent();
        }).not.toThrow();
    });
});
