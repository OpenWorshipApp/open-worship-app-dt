import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DragTypeEnum } from '../../helper/DragInf';

const appLogMock = vi.fn();
const saveScreenManagersSettingMock = vi.fn(async () => {});
const deleteScreenManagerBaseCacheMock = vi.fn();
const listenForDataMock = vi.fn();
const sendDataSyncMock = vi.fn(() => true);

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
    createScreenManagerBaseGhost = vi.fn((screenId: number) => ({ screenId }));
    checkIsSyncGroupEnabled = vi.fn(() => true);
    setColorNote = vi.fn(async (color: string | null) => {
        this.colorNote = color;
    });
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

vi.mock('./screenManagerBaseHelpers', () => ({
    deleteScreenManagerBaseCache: deleteScreenManagerBaseCacheMock,
    getAllScreenManagerBases: vi.fn(() => Array.from(baseInstances.values())),
    getScreenManagerBase: vi.fn((screenId: number) => {
        return baseInstances.get(screenId) ?? null;
    }),
    saveScreenManagersSetting: saveScreenManagersSettingMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        messageUtils: {
            messageChannels: {
                screenMessage: 'screen-message-channel',
            },
            listenForData: listenForDataMock,
            sendDataSync: sendDataSyncMock,
        },
    },
}));

describe('ScreenManager runtime orchestration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        baseInstances.clear();
    });

    test('routes dropped content to the correct sub-manager', async () => {
        const { default: ScreenManager } = await import('./ScreenManager');

        const screenManager = new ScreenManager(1);
        baseInstances.set(1, screenManager);

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#fff',
        } as any);
        expect(screenManager.screenBackgroundManager.receiveScreenDropped).toHaveBeenCalled();

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.SLIDE,
            item: { id: 1 },
        } as any);
        expect(screenManager.screenVaryAppDocumentManager.receiveScreenDropped).toHaveBeenCalled();

        screenManager.receiveScreenDropped({
            type: DragTypeEnum.BIBLE_ITEM,
            item: { id: 2 },
        } as any);
        expect(screenManager.screenBibleManager.receiveScreenDropped).toHaveBeenCalled();

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
            data: { videoId: 'video-1', videoTime: 2, timestamp: Date.now(), isFromScreen: false },
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
        expect(screenManager.backgroundEffectManager.sendSyncScreen).toHaveBeenCalled();
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

        expect(await ScreenManager.getGroupScreenManagers(screenManager)).toEqual([
            sibling,
        ]);

        const syncSpy = vi.spyOn(ScreenManager, 'syncScreenManagerGroup');
        screenManager.sendScreenMessage(
            {
                screenId: 3,
                type: 'foreground',
                data: { marqueeData: { text: 'hello' } },
            } as any,
            true,
        );
        expect(sendDataSyncMock).toHaveBeenCalledWith('screen-message-channel', {
            screenId: 3,
            type: 'foreground',
            data: { marqueeData: { text: 'hello' } },
            isScreen: false,
        });
        expect(syncSpy).toHaveBeenCalled();

        ScreenManager.initReceiveScreenMessage();
        expect(listenForDataMock).toHaveBeenCalledWith(
            'screen-message-channel',
            expect.any(Function),
        );

        await screenManager.delete();
        expect(screenManager.hide).toHaveBeenCalled();
        expect(screenManager.screenBackgroundManager.delete).toHaveBeenCalled();
        expect(screenManager.screenVaryAppDocumentManager.delete).toHaveBeenCalled();
        expect(screenManager.screenBibleManager.delete).toHaveBeenCalled();
        expect(screenManager.screenForegroundManager.delete).toHaveBeenCalled();
        expect(deleteScreenManagerBaseCacheMock).toHaveBeenCalledWith('3');
        expect(saveScreenManagersSettingMock).toHaveBeenCalledWith(3);
    });
});
