import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DragTypeEnum } from '../../helper/DragInf';

const appLogMock = vi.fn();
const saveScreenManagersSettingMock = vi.fn(async () => {});
const deleteScreenManagerBaseCacheMock = vi.fn();
const listenForDataMock = vi.fn();
const sendDataSyncMock = vi.fn(() => true);

const appProviderMock = {
    isPageScreen: false,
    messageUtils: {
        messageChannels: {
            screenMessage: 'screen-message-channel',
        },
        listenForData: listenForDataMock,
        sendDataSync: sendDataSyncMock,
    },
};

const baseInstances = new Map<number, any>();

class MockScreenManagerBase {
    static readonly eventNamePrefix = 'screen-m';
    static readonly fireInstanceEvent = vi.fn();

    readonly screenId: number;
    readonly key: string;
    isDeleted = false;
    colorNote: string | null = null;
    noSyncGroupMap = new Map<string, boolean>();
    _isShowing = false;
    _isSelected = false;
    _isLocked = false;
    _stageNumber = 0;

    constructor(screenId: number) {
        this.screenId = screenId;
        this.key = `${screenId}`;
    }

    get isShowing() {
        return this._isShowing;
    }

    set isShowing(value: boolean) {
        this._isShowing = value;
    }

    get isSelected() {
        return this._isSelected;
    }

    set isSelected(value: boolean) {
        this._isSelected = value;
    }

    get isLocked() {
        return this._isLocked;
    }

    set isLocked(value: boolean) {
        this._isLocked = value;
    }

    get stageNumber() {
        return this._stageNumber;
    }

    set stageNumber(value: number) {
        this._stageNumber = value;
    }

    async getColorNote() {
        return this.colorNote;
    }

    hide = vi.fn();
    fireUpdateEvent = vi.fn();
    fireInstanceEvent = vi.fn();
    fireColorNoteUpdateEvent = vi.fn();
    syncScrollPercentage = vi.fn();
    removeOnEventListener = vi.fn();
    checkIsSyncGroupEnabled = vi.fn(() => true);
    async setColorNote(color: string | null) {
        this.colorNote = color;
    }
}

class MockEffectManager {
    static readonly receiveSyncScreen = vi.fn();

    readonly target: string;
    sendSyncScreen = vi.fn();
    delete = vi.fn();

    constructor(_screenManagerBase: unknown, target: string) {
        this.target = target;
    }
}

class MockBackgroundManager {
    static readonly eventNamePrefix = 'screen-bg-m';
    static readonly receiveSyncScreen = vi.fn();
    static readonly receiveSyncVideoTime = vi.fn();

    readonly screenId: number;
    isShowing = true;
    receiveScreenDropped = vi.fn();
    clear = vi.fn();
    delete = vi.fn();
    sendSyncScreen = vi.fn();
    registerEventListener = vi.fn(() => []);

    constructor(screenManagerBase: any, _effectManager: unknown) {
        this.screenId = screenManagerBase.screenId;
    }
}

class MockVaryManager {
    static readonly eventNamePrefix = 'screen-vary-app-document-m';
    static readonly receiveSyncScreen = vi.fn();

    readonly screenId: number;
    isShowing = true;
    receiveScreenDropped = vi.fn();
    clear = vi.fn();
    delete = vi.fn();
    sendSyncScreen = vi.fn();
    registerEventListener = vi.fn(() => []);

    constructor(screenManagerBase: any, _effectManager: unknown) {
        this.screenId = screenManagerBase.screenId;
    }
}

class MockBibleManager {
    static readonly eventNamePrefix = 'screen-ft-m';
    static readonly sendSynTextStyle = vi.fn();
    static readonly receiveSyncScreen = vi.fn();
    static readonly receiveSyncSelectedIndex = vi.fn();
    static readonly receiveSyncTextStyle = vi.fn();

    readonly screenId: number;
    isShowing = true;
    receiveScreenDropped = vi.fn();
    clear = vi.fn();
    delete = vi.fn();
    sendSyncScreen = vi.fn();
    reflectBackgroundColor = vi.fn();
    registerEventListener = vi.fn(() => []);

    constructor(screenManagerBase: any) {
        this.screenId = screenManagerBase.screenId;
    }
}

class MockForegroundManager {
    static readonly eventNamePrefix = 'screen-foreground-m';
    static readonly receiveSyncScreen = vi.fn();

    readonly screenId: number;
    isShowing = true;
    receiveScreenDropped = vi.fn();
    clear = vi.fn();
    delete = vi.fn();
    sendSyncScreen = vi.fn();

    constructor(screenManagerBase: any, _effectManager: unknown) {
        this.screenId = screenManagerBase.screenId;
    }
}

class MockDrawManager {
    static readonly eventNamePrefix = 'screen-draw-m';
    static readonly receiveSyncScreen = vi.fn();

    readonly screenId: number;
    isShowing = true;
    clear = vi.fn();
    delete = vi.fn();
    sendSyncScreen = vi.fn();

    constructor(screenManagerBase: any) {
        this.screenId = screenManagerBase.screenId;
    }
}

vi.mock('../../helper/loggerHelpers', () => ({
    appLog: appLogMock,
}));

vi.mock('./ScreenManagerBase', () => ({
    default: MockScreenManagerBase,
}));

vi.mock('./ScreenEffectManager', () => ({
    default: MockEffectManager,
}));

vi.mock('./ScreenBackgroundManager', () => ({
    default: MockBackgroundManager,
}));

vi.mock('./ScreenVaryAppDocumentManager', () => ({
    default: MockVaryManager,
}));

vi.mock('./ScreenBibleManager', () => ({
    default: MockBibleManager,
}));

vi.mock('./ScreenForegroundManager', () => ({
    default: MockForegroundManager,
}));

vi.mock('./ScreenDrawManager', () => ({
    default: MockDrawManager,
}));

vi.mock('./screenManagerBaseHelpers', () => ({
    deleteScreenManagerBaseCache: deleteScreenManagerBaseCacheMock,
    getAllScreenManagerBases: vi.fn(() => Array.from(baseInstances.values())),
    getScreenManagerBase: vi.fn((screenId: number) => {
        return baseInstances.get(screenId) ?? null;
    }),
    saveScreenManagersSetting: saveScreenManagersSettingMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

describe('ScreenManager runtime orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        baseInstances.clear();
        appProviderMock.isPageScreen = false;
    });

    test('routes dropped content to the correct sub-manager', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(1);
        baseInstances.set(1, screenManager);

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#fff',
        } as any);
        expect(
            screenManager.screenBackgroundManager.receiveScreenDropped,
        ).toHaveBeenCalled();

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.SLIDE,
            item: { id: 1 },
        } as any);
        expect(
            screenManager.screenVaryAppDocumentManager.receiveScreenDropped,
        ).toHaveBeenCalled();

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.BIBLE_ITEM,
            item: { id: 2 },
        } as any);
        expect(
            screenManager.screenBibleManager.receiveScreenDropped,
        ).toHaveBeenCalled();

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.UNKNOWN,
            item: { id: 3 },
        } as any);
        expect(appLogMock).toHaveBeenCalledWith({
            type: DragTypeEnum.UNKNOWN,
            item: { id: 3 },
        });
    });

    test('applies incoming screen messages to the right targets', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(2);
        baseInstances.set(2, screenManager);

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'background',
            data: { src: '#fff' },
        } as any);
        expect(MockBackgroundManager.receiveSyncScreen).toHaveBeenCalled();

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'effect',
            data: { target: 'background', effect: 'fade' },
        } as any);
        expect(MockEffectManager.receiveSyncScreen).toHaveBeenCalled();

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'bible-screen-view-selected-index',
            data: { selectedKJVVerseKey: 'GEN-1-1' },
        } as any);
        expect(MockBibleManager.receiveSyncSelectedIndex).toHaveBeenCalled();

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'bible-screen-view-text-style',
            data: { textStyle: { color: '#fff' } },
        } as any);
        expect(MockBibleManager.receiveSyncTextStyle).toHaveBeenCalled();

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'background-video-time',
            data: {
                videoId: 'video-1',
                videoTime: 2,
                timestamp: Date.now(),
                isFromScreen: false,
            },
        } as any);
        expect(MockBackgroundManager.receiveSyncVideoTime).toHaveBeenCalled();

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'sync-scroll-percentage',
            data: { domSelector: '.sync', scroll: { x: 0.1, y: 0.2 } },
        } as any);
        expect(screenManager.syncScrollPercentage).toHaveBeenCalledWith({
            domSelector: '.sync',
            scroll: { x: 0.1, y: 0.2 },
        });

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'visible',
            data: { isShowing: true },
        } as any);
        expect(screenManager.isShowing).toBe(true);

        ScreenManager.applyScreenManagerSyncScreen({
            screenId: 2,
            type: 'init',
            data: null,
        } as any);
        expect(
            screenManager.backgroundEffectManager.sendSyncScreen,
        ).toHaveBeenCalled();
        expect(MockBibleManager.sendSynTextStyle).toHaveBeenCalled();
    });

    test('logs unsupported sync messages and ignores missing screen managers', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(6);
        baseInstances.set(6, screenManager);

        expect(() => {
            ScreenManager.applyScreenManagerSyncScreen({
                screenId: 999,
                type: 'visible',
                data: { isShowing: false },
            } as any);
        }).not.toThrow();

        const message = {
            screenId: 6,
            type: 'mystery-sync',
            data: { value: 7 },
        };
        ScreenManager.applyScreenManagerSyncScreen(message as any);

        expect(appLogMock).toHaveBeenCalledWith(message);
    });

    test('sends messages, computes sync groups, and deletes cleanly', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(3);
        const sibling = new ScreenManager(4);
        const outsider = new ScreenManager(5);
        screenManager.colorNote = 'red';
        sibling.colorNote = 'red';
        outsider.colorNote = 'blue';
        baseInstances.set(3, screenManager);
        baseInstances.set(4, sibling);
        baseInstances.set(5, outsider);

        expect(
            await ScreenManager.getGroupScreenManagers(screenManager),
        ).toEqual([sibling]);

        const syncSpy = vi.spyOn(ScreenManager, 'syncScreenManagerGroup');
        screenManager.sendScreenMessage(
            {
                screenId: 3,
                type: 'foreground',
                data: { marqueeBottomData: { text: 'hello' } },
            } as any,
            true,
        );
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'screen-message-channel',
            {
                screenId: 3,
                type: 'foreground',
                data: { marqueeBottomData: { text: 'hello' } },
                isScreen: false,
            },
        );
        expect(syncSpy).toHaveBeenCalled();

        ScreenManager.initReceiveScreenMessage();
        expect(listenForDataMock).toHaveBeenCalledWith(
            'screen-message-channel',
            expect.any(Function),
        );

        await screenManager.delete();
        expect(screenManager.hide).toHaveBeenCalled();
        expect(screenManager.screenBackgroundManager.delete).toHaveBeenCalled();
        expect(
            screenManager.screenVaryAppDocumentManager.delete,
        ).toHaveBeenCalled();
        expect(screenManager.screenBibleManager.delete).toHaveBeenCalled();
        expect(screenManager.screenForegroundManager.delete).toHaveBeenCalled();
        expect(deleteScreenManagerBaseCacheMock).toHaveBeenCalledWith('3');
        expect(saveScreenManagersSettingMock).toHaveBeenCalledWith(3);
    });

    test('propagates lock state to same-group members only', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(3);
        const sibling = new ScreenManager(4);
        const outsider = new ScreenManager(5);
        screenManager.colorNote = 'red';
        sibling.colorNote = 'red';
        outsider.colorNote = 'blue';
        baseInstances.set(3, screenManager);
        baseInstances.set(4, sibling);
        baseInstances.set(5, outsider);

        await screenManager.setIsLockedWithSyncGroup(true);

        expect(screenManager.isLocked).toBe(true);
        expect(sibling.isLocked).toBe(true);
        expect(outsider.isLocked).toBe(false);
        expect(saveScreenManagersSettingMock).toHaveBeenCalledTimes(1);
        expect(screenManager.fireInstanceEvent).toHaveBeenCalled();
        expect(sibling.fireInstanceEvent).toHaveBeenCalled();
        expect(outsider.fireInstanceEvent).not.toHaveBeenCalled();

        await screenManager.setIsLockedWithSyncGroup(false);
        expect(screenManager.isLocked).toBe(false);
        expect(sibling.isLocked).toBe(false);
    });

    test('adopts the group lock state when joining a group via color note', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const existing = new ScreenManager(3);
        const joiner = new ScreenManager(4);
        existing.colorNote = 'red';
        existing._isLocked = true;
        baseInstances.set(3, existing);
        baseInstances.set(4, joiner);

        expect(joiner.isLocked).toBe(false);

        await joiner.setColorNote('red');

        expect(joiner.isLocked).toBe(true);
        expect(joiner.fireInstanceEvent).toHaveBeenCalled();
    });

    test('unlocks a member that joins an unlocked group', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const existing = new ScreenManager(3);
        const joiner = new ScreenManager(4);
        existing.colorNote = 'red';
        existing._isLocked = false;
        joiner._isLocked = true;
        baseInstances.set(3, existing);
        baseInstances.set(4, joiner);

        await joiner.setColorNote('red');

        expect(joiner.isLocked).toBe(false);
    });

    test('keeps its own lock state when its color note joins no group', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const existing = new ScreenManager(3);
        const joiner = new ScreenManager(4);
        existing.colorNote = 'red';
        existing._isLocked = true;
        joiner._isLocked = false;
        baseInstances.set(3, existing);
        baseInstances.set(4, joiner);

        await joiner.setColorNote('blue');

        expect(joiner.isLocked).toBe(false);
    });

    test('locks only itself when it has no color-note group', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(3);
        const other = new ScreenManager(4);
        screenManager.colorNote = null;
        other.colorNote = null;
        baseInstances.set(3, screenManager);
        baseInstances.set(4, other);

        await screenManager.setIsLockedWithSyncGroup(true);

        expect(screenManager.isLocked).toBe(true);
        expect(other.isLocked).toBe(false);
    });

    test('maps sync handlers, guards screen-origin sends, and returns ghost bases', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        expect(
            ScreenManager.getSyncGroupScreenEventHandler({
                type: 'background',
            } as any),
        ).toBe(MockBackgroundManager);
        expect(
            ScreenManager.getSyncGroupScreenEventHandler({
                type: 'vary-app-document',
            } as any),
        ).toBe(MockVaryManager);
        expect(
            ScreenManager.getSyncGroupScreenEventHandler({
                type: 'bible-screen-view',
            } as any),
        ).toBe(MockBibleManager);
        expect(
            ScreenManager.getSyncGroupScreenEventHandler({
                type: 'foreground',
            } as any),
        ).toBe(MockForegroundManager);
        expect(
            ScreenManager.getSyncGroupScreenEventHandler({
                type: 'unknown-sync',
            } as any),
        ).toBeNull();

        const screenManager = new ScreenManager(7);
        const sibling = new ScreenManager(8);
        baseInstances.set(7, screenManager);
        baseInstances.set(8, sibling);

        expect(screenManager.getScreenManagerBaseForce(8)).toBe(sibling);

        const ghost = screenManager.getScreenManagerBaseForce(99);
        expect(ghost.isDeleted).toBe(true);
        expect(ghost.screenId).toBe(99);

        appProviderMock.isPageScreen = true;
        screenManager.sendScreenMessage(
            {
                screenId: 7,
                type: 'foreground',
                data: { quickTextData: { text: 'Hidden' } },
            } as any,
            false,
        );
        expect(sendDataSyncMock).not.toHaveBeenCalled();

        screenManager.sendScreenMessage(
            {
                screenId: 7,
                type: 'foreground',
                data: { quickTextData: { text: 'Forced' } },
            } as any,
            true,
        );
        expect(sendDataSyncMock).toHaveBeenCalledWith(
            'screen-message-channel',
            {
                screenId: 7,
                type: 'foreground',
                data: { quickTextData: { text: 'Forced' } },
                isScreen: true,
            },
        );
    });

    test('persists setter state, forwards full syncs, clears sub-managers, and respects sync-group guards', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(9);
        const sibling = new ScreenManager(10);
        baseInstances.set(9, screenManager);
        baseInstances.set(10, sibling);

        screenManager.colorNote = 'green';
        sibling.colorNote = 'green';

        screenManager.isLocked = true;
        screenManager.stageNumber = 4;
        screenManager.isSelected = true;
        await screenManager.setColorNote('green');
        await Promise.resolve();

        expect(screenManager.colorNote).toBe('green');
        expect(saveScreenManagersSettingMock).toHaveBeenCalled();
        expect(screenManager.fireInstanceEvent).toHaveBeenCalled();
        expect(screenManager.fireColorNoteUpdateEvent).toHaveBeenCalled();

        screenManager.sendSyncScreen();
        expect(MockBibleManager.sendSynTextStyle).toHaveBeenCalled();
        expect(
            screenManager.backgroundEffectManager.sendSyncScreen,
        ).toHaveBeenCalled();
        expect(
            screenManager.screenBackgroundManager.sendSyncScreen,
        ).toHaveBeenCalled();
        expect(
            screenManager.screenForegroundManager.sendSyncScreen,
        ).toHaveBeenCalled();
        expect(
            screenManager.screenVaryAppDocumentManager.sendSyncScreen,
        ).toHaveBeenCalled();
        expect(
            screenManager.varyAppDocumentEffectManager.sendSyncScreen,
        ).toHaveBeenCalled();
        expect(
            screenManager.screenBibleManager.sendSyncScreen,
        ).toHaveBeenCalled();

        const initCallback = (
            screenManager.screenBackgroundManager.registerEventListener as any
        ).mock.calls[0]?.[1];
        initCallback?.('#445566');
        expect(
            screenManager.screenBibleManager.reflectBackgroundColor,
        ).toHaveBeenCalledWith('#445566');

        screenManager.clear();
        expect(screenManager.screenBibleManager.clear).toHaveBeenCalled();
        expect(
            screenManager.screenVaryAppDocumentManager.clear,
        ).toHaveBeenCalled();
        expect(screenManager.screenForegroundManager.clear).toHaveBeenCalled();
        expect(screenManager.screenBackgroundManager.clear).toHaveBeenCalled();
        expect(screenManager.fireUpdateEvent).toHaveBeenCalled();

        screenManager.isDeleted = true;
        await ScreenManager.syncScreenManagerGroup({
            screenId: 9,
            type: 'foreground',
            data: { marqueeBottomData: { text: 'ignore' } },
        } as any);
        expect(MockForegroundManager.receiveSyncScreen).not.toHaveBeenCalled();

        screenManager.isDeleted = false;
        (screenManager.checkIsSyncGroupEnabled as any).mockReturnValue(false);
        await ScreenManager.syncScreenManagerGroup({
            screenId: 9,
            type: 'foreground',
            data: { marqueeBottomData: { text: 'blocked' } },
        } as any);
        expect(MockForegroundManager.receiveSyncScreen).not.toHaveBeenCalled();

        (screenManager.checkIsSyncGroupEnabled as any).mockReturnValue(true);
        await ScreenManager.syncScreenManagerGroup({
            screenId: 9,
            type: 'foreground',
            data: { marqueeBottomData: { text: 'allowed' } },
        } as any);
        expect(MockForegroundManager.receiveSyncScreen).toHaveBeenCalledWith({
            screenId: 10,
            type: 'foreground',
            data: { marqueeBottomData: { text: 'allowed' } },
        });
        expect(
            sibling.noSyncGroupMap.get(MockForegroundManager.eventNamePrefix),
        ).toBe(true);

        await ScreenManager.syncScreenManagerGroup({
            screenId: 9,
            type: 'visible',
            data: { isShowing: false },
        } as any);
        expect(MockForegroundManager.receiveSyncScreen).toHaveBeenCalledTimes(
            1,
        );
    });
});
