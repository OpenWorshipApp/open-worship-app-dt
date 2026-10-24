// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const showSimpleToastMock = vi.fn();
const mountScreenShowFrameMock = vi.fn((_options: any) => ({
    dispose: vi.fn(async () => {}),
}));
const frameState = { isScreenShowFrame: false };
const screenManagerBaseMap = new Map<number, any>();

const appProviderMock = {
    isPagePresenter: true,
    isPageScreen: false,
    isDesktop: true,
    systemUtils: { isDev: false },
    messageUtils: {
        listenForData: vi.fn(),
        sendData: vi.fn(),
    },
};

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../screenShowFrameHelpers', () => ({
    mountScreenShowFrame: mountScreenShowFrameMock,
    checkIsScreenShowFrame: () => frameState.isScreenShowFrame,
}));
vi.mock('./screenManagerBaseHelpers', () => ({
    getScreenManagerBase: (screenId: number) => {
        return screenManagerBaseMap.get(screenId) ?? null;
    },
    getAllScreenManagerBases: () => {
        return Array.from(screenManagerBaseMap.values());
    },
    getSelectedScreenManagerBases: () => [],
}));
vi.mock('../../helper/settingHelpers', () => ({
    getSetting: vi.fn(() => null),
    setSetting: vi.fn(),
}));
vi.mock('../screenHelpers', () => ({
    getForegroundDataListOnScreenSetting: vi.fn(() => ({})),
}));
vi.mock('./onScreenSettingPersistHelpers', () => ({
    collectLiveOnScreenMap: vi.fn(() => ({})),
    persistOnScreenEntry: vi.fn(),
}));
vi.mock('../../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: vi.fn(async () => () => {}),
    requestCameraAccess: vi.fn(async () => true),
}));
vi.mock('../screenForegroundHelpers', () => ({}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: vi.fn(),
}));

function genScreenManagerBase(
    screenId: number,
    { colorNote = null as string | null, isShowing = true } = {},
) {
    const screenManagerBase = {
        screenId,
        width: 1600,
        height: 1000,
        colorNote,
        isShowing,
        noSyncGroupMap: new Map<string, boolean>(),
        checkIsLockedWithMessage: vi.fn(() => false),
        sendScreenMessage: vi.fn(),
        sendScreenShowSnapshots: vi.fn(),
        genScreenShowPayload: vi.fn(() => ({
            sourceScreenId: screenId,
            width: 1600,
            height: 1000,
            stage: 0,
            isSnapshot: true,
            messages: [],
        })),
        createScreenManagerBaseGhost: vi.fn(() => ({ screenId })),
    } as any;
    screenManagerBaseMap.set(screenId, screenManagerBase);
    return screenManagerBase;
}

async function genManagers(
    list: {
        screenId: number;
        colorNote?: string | null;
        isShowing?: boolean;
    }[],
) {
    const { default: ScreenForegroundManager } =
        await import('./ScreenForegroundManager');
    const effectManager = {
        effectType: 'fade',
        styleAnimList: { fade: { animIn: vi.fn(), animOut: vi.fn() } },
    } as any;
    const managers = list.map(({ screenId, ...options }) => {
        const manager = new ScreenForegroundManager(
            genScreenManagerBase(screenId, options),
            effectManager,
        );
        manager.rootContainer = document.createElement('div');
        return manager;
    });
    return { ScreenForegroundManager, managers };
}

describe('Screen Show foreground', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        screenManagerBaseMap.clear();
        appProviderMock.isPageScreen = false;
        appProviderMock.isPagePresenter = true;
        frameState.isScreenShowFrame = false;
    });

    test('adds one picture per source, replaces it, and takes it off', async () => {
        const {
            managers: [manager],
        } = await genManagers([{ screenId: 1 }, { screenId: 0 }]);

        expect(manager.addScreenData({ id: 0, extraStyle: {} })).toBe(true);
        expect(manager.foregroundData.screenDataList).toEqual([
            { id: 0, extraStyle: {} },
        ]);
        // Properties changed: the same source REPLACES, never stacks.
        const resized = { id: 0, extraStyle: { width: '25%' } };
        expect(manager.addScreenData(resized)).toBe(true);
        expect(manager.foregroundData.screenDataList).toEqual([resized]);

        manager.removeScreenData({ id: 0 });
        expect(manager.foregroundData.screenDataList).toEqual([]);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('refuses the screen itself and a loop, telling the operator', async () => {
        const {
            managers: [screen0, screen1],
        } = await genManagers([{ screenId: 0 }, { screenId: 1 }]);

        expect(screen0.addScreenData({ id: 0 })).toBe(false);
        expect(showSimpleToastMock).toHaveBeenLastCalledWith(
            'Screen Show',
            'A screen cannot show itself',
        );

        expect(screen1.addScreenData({ id: 0 })).toBe(true);
        expect(screen0.addScreenData({ id: 1 })).toBe(false);
        expect(showSimpleToastMock).toHaveBeenLastCalledWith(
            'Screen Show',
            'These screens would show each other',
        );
        expect(screen0.foregroundData.screenDataList).toEqual([]);
    });

    test('refuses a loop closed through the colour-note group', async () => {
        const {
            managers: [screen0, screen1, screen2],
        } = await genManagers([
            { screenId: 0, colorNote: 'red' },
            { screenId: 1, colorNote: 'red' },
            { screenId: 2 },
        ]);
        // 2 shows 1. Putting 2 on 0 is copied to 1 as well -- and 1 showing
        // 2 while 2 shows 1 is a loop.
        expect(screen2.addScreenData({ id: 1 })).toBe(true);
        expect(screen0.addScreenData({ id: 2 })).toBe(false);
        // A group member that IS the source is not a reason to refuse: it
        // skips its own copy when drawing.
        expect(screen0.addScreenData({ id: 1 })).toBe(true);
        expect(screen1.foregroundData.screenDataList).toEqual([]);
    });

    test('shows a hidden source too, sending its state when it goes up', async () => {
        const {
            managers: [manager],
        } = await genManagers([
            { screenId: 1 },
            { screenId: 0, isShowing: false },
        ]);

        manager.addScreenData({ id: 0, extraStyle: {} });
        expect(showSimpleToastMock).not.toHaveBeenCalled();
        expect(
            manager.screenManagerBase.sendScreenShowSnapshots,
        ).toHaveBeenCalledWith([0]);
        // Properties changed: the same source, nothing new to send.
        manager.addScreenData({ id: 0, extraStyle: { width: '20%' } });
        expect(
            manager.screenManagerBase.sendScreenShowSnapshots,
        ).toHaveBeenCalledOnce();
        expect(manager.foregroundData.screenDataList).toHaveLength(1);
    });

    test('names every screen showing a source, never the source itself', async () => {
        const {
            ScreenForegroundManager,
            managers: [screen0, screen1, screen2],
        } = await genManagers([
            { screenId: 0 },
            { screenId: 1 },
            { screenId: 2 },
        ]);
        screen0.addScreenData({ id: 2 });
        screen1.addScreenData({ id: 2 });
        screen2.receiveSyncScreen({
            screenId: 2,
            type: 'foreground',
            data: { screenDataList: [{ id: 2 }] },
        } as any);

        expect(ScreenForegroundManager.getScreenShowTargetIds(2)).toEqual([
            0, 1,
        ]);
        expect(ScreenForegroundManager.getScreenShowTargetIds(0)).toEqual([]);
    });

    test('never toasts on the projector', async () => {
        appProviderMock.isPageScreen = true;
        const {
            managers: [manager],
        } = await genManagers([{ screenId: 0 }]);

        expect(manager.addScreenData({ id: 0 })).toBe(false);
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('draws a source, but never itself', async () => {
        const {
            managers: [screen0],
        } = await genManagers([{ screenId: 0 }, { screenId: 1 }]);

        screen0.renderScreen({ id: 0 });
        expect(mountScreenShowFrameMock).not.toHaveBeenCalled();

        screen0.renderScreen({ id: 1, extraStyle: { width: '30%' } });
        expect(mountScreenShowFrameMock).toHaveBeenCalledOnce();
        const options = mountScreenShowFrameMock.mock.calls[0][0];
        expect(options).toMatchObject({
            sourceScreenId: 1,
            ownScreenId: 0,
            extraStyle: { width: '30%' },
        });
        // The presenter reads the source's whole state from its managers.
        expect(options.getSnapshot()).toMatchObject({
            sourceScreenId: 1,
            width: 1600,
            height: 1000,
            isSnapshot: true,
        });
    });

    test('a projector draws from what the presenter sent it', async () => {
        appProviderMock.isPageScreen = true;
        const {
            managers: [screen0],
        } = await genManagers([{ screenId: 0 }, { screenId: 1 }]);

        screen0.renderScreen({ id: 1 });
        expect(mountScreenShowFrameMock.mock.calls[0][0].getSnapshot).toBe(
            undefined,
        );
    });

    test('a copy never draws a copy of its own', async () => {
        frameState.isScreenShowFrame = true;
        const {
            managers: [screen0],
        } = await genManagers([{ screenId: 0 }, { screenId: 1 }]);

        screen0.renderScreen({ id: 1 });
        expect(mountScreenShowFrameMock).not.toHaveBeenCalled();
    });

    test('lets go of the picture when it is taken off', async () => {
        const {
            managers: [screen0],
        } = await genManagers([{ screenId: 0 }, { screenId: 1 }]);

        screen0.addScreenData({ id: 1 });
        const { dispose } = mountScreenShowFrameMock.mock.results[0].value;
        screen0.removeScreenData({ id: 1 });
        await vi.waitFor(() => {
            expect(dispose).toHaveBeenCalledOnce();
        });
    });

    test('a sync message without the slot leaves an empty list, not null', async () => {
        const {
            managers: [manager],
        } = await genManagers([{ screenId: 3 }]);

        manager.receiveSyncScreen({
            screenId: 3,
            type: 'foreground',
            data: { cameraDataList: [] },
        } as any);
        expect(manager.foregroundData.screenDataList).toEqual([]);
    });

    test('a restored entry keeps only plain screen ids', async () => {
        const { default: ScreenForegroundManager } =
            await import('./ScreenForegroundManager');

        const parsed = ScreenForegroundManager.parseAllForegroundData({
            screenDataList: [
                { id: 2 },
                { id: -1 },
                { id: '3' },
                { id: 1.5 },
                null,
            ],
        });
        expect(parsed.screenDataList).toEqual([{ id: 2 }]);
        expect(
            ScreenForegroundManager.parseAllForegroundData({}).screenDataList,
        ).toEqual([]);
    });

    test('a deleted screen is taken off every screen that showed it', async () => {
        const {
            ScreenForegroundManager,
            managers: [screen0, screen1, screen2],
        } = await genManagers([
            { screenId: 0 },
            { screenId: 1 },
            { screenId: 2 },
        ]);
        screen0.addScreenData({ id: 2 });
        screen1.addScreenData({ id: 2 });
        screen1.addScreenData({ id: 0 });
        const sharedList = screen1.foregroundData.screenDataList;

        ScreenForegroundManager.removeScreenShowSource(2);

        expect(screen0.foregroundData.screenDataList).toEqual([]);
        expect(screen1.foregroundData.screenDataList).toEqual([{ id: 0 }]);
        // A NEW list: group members may share the old one.
        expect(sharedList).toHaveLength(2);
        expect(screen2.foregroundData.screenDataList).toEqual([]);
        expect(screen1.screenManagerBase.sendScreenMessage).toHaveBeenCalled();
    });
});
