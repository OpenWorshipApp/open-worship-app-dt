// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const saveScreenManagersSettingMock = vi.fn();
const getAllShowingScreenIdsMock = vi.fn(() => [5, 6]);
const showAppContextMenuMock = vi.fn(() => ({
    promiseDone: Promise.resolve(),
}));
const getAttachedBackgroundMock = vi.fn();
const receiveScreenDroppedMock = vi.fn();

const appProviderMock = {
    isPagePresenter: true,
    getIsMouseOverApp: vi.fn(() => true),
    getIsWindowFocused: vi.fn(() => true),
};

const instanceSettings: any[] = [];
const cache = new Map<string, any>();
let selectedScreenManagerBases: any[] = [];
let allScreenManagerBases: any[] = [];
const screenManagerBaseById = new Map<number, any>();

class MockScreenManagerBase {
    static readonly fireInstanceEvent = vi.fn();

    readonly screenId: number;
    isDeleted = false;
    noSyncGroupMap = new Map<string, boolean>();
    _isSelected = false;
    _isLocked = false;
    _stageNumber = 0;
    colorNote: string | null = null;

    constructor(screenId: number) {
        this.screenId = screenId;
        screenManagerBaseById.set(screenId, this);
    }

    static idFromKey(key: string) {
        if (key === 'missing') {
            return null;
        }
        const id = Number.parseInt(key, 10);
        return Number.isNaN(id) ? null : id;
    }

    get key() {
        return `${this.screenId}`;
    }

    sendScreenMessage = vi.fn();
    createScreenManagerBaseGhost = vi.fn((screenId: number) => ({ screenId }));
}

class MockScreenManager extends MockScreenManagerBase {
    fireRefreshEvent = vi.fn();
}

vi.mock('../screenHelpers', () => ({
    getAllShowingScreenIds: getAllShowingScreenIdsMock,
}));

vi.mock('./ScreenManagerBase', () => ({
    default: MockScreenManagerBase,
}));

vi.mock('./ScreenManager', () => ({
    default: MockScreenManager,
}));

vi.mock('./screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: vi.fn(() => {
        return allScreenManagerBases.length > 0
            ? allScreenManagerBases
            : Array.from(cache.values());
    }),
    getSelectedScreenManagerBases: vi.fn(() => selectedScreenManagerBases),
    getScreenManagersInstanceSetting: vi.fn(() => instanceSettings),
    saveScreenManagersSetting: saveScreenManagersSettingMock,
    cache,
    setScreenManagerBaseCache: vi.fn((screenManagerBase: any) => {
        cache.set(screenManagerBase.key, screenManagerBase);
        screenManagerBaseById.set(screenManagerBase.screenId, screenManagerBase);
    }),
    getScreenManagerBase: vi.fn((screenId: number) => {
        return screenManagerBaseById.get(screenId) ?? null;
    }),
}));

vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: getAttachedBackgroundMock,
    },
}));

vi.mock('./ScreenBackgroundManager', () => ({
    default: class ScreenBackgroundManager {
        static readonly getInstance = vi.fn(() => ({
            receiveScreenDropped: receiveScreenDroppedMock,
        }));
    },
}));

describe('manager helper coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cache.clear();
        instanceSettings.length = 0;
        selectedScreenManagerBases = [];
        allScreenManagerBases = [];
        screenManagerBaseById.clear();
        appProviderMock.isPagePresenter = true;
        appProviderMock.getIsMouseOverApp.mockReturnValue(true);
        appProviderMock.getIsWindowFocused.mockReturnValue(true);
    });

    test('manages screen manager instances, selection state, and cached lookups', async () => {
        const screenManagerHelpers = await import('./screenManagerHelpers');

        expect(screenManagerHelpers.screenManagerFromBase(null)).toBeNull();
        expect(
            screenManagerHelpers.screenManagerFromBase(new MockScreenManagerBase(1) as any),
        ).toBeNull();

        instanceSettings.push({
            screenId: 9,
            isSelected: true,
            isLocked: true,
            stageNumber: 4,
            colorNote: 'amber',
        });
        const initialManager = screenManagerHelpers.initNewScreenManager(9);
        expect(initialManager._isSelected).toBe(true);
        expect(initialManager._isLocked).toBe(true);
        expect(initialManager._stageNumber).toBe(4);
        expect(initialManager.colorNote).toBe('amber');

        cache.clear();
        const created = screenManagerHelpers.createScreenManager(9);
        const again = screenManagerHelpers.createScreenManager(9);
        expect(created).toBe(again);
        expect(saveScreenManagersSettingMock).toHaveBeenCalledOnce();
        expect(screenManagerHelpers.getScreenManagerByScreenId(9)).toBe(created);
        expect(screenManagerHelpers.getScreenManagerByKey('9')).toBe(created);
        expect(screenManagerHelpers.getScreenManagerByKey('missing')).toBeNull();

        allScreenManagerBases = [
            new MockScreenManager(0),
            new MockScreenManager(2),
        ];
        screenManagerHelpers.genNewScreenManagerBase();
        expect(cache.has('1')).toBe(true);
        expect(MockScreenManagerBase.fireInstanceEvent).toHaveBeenCalledOnce();

        cache.clear();
        allScreenManagerBases = [];
        instanceSettings.length = 0;
        const fromDefault = screenManagerHelpers.getScreenManagersFromSetting();
        expect(fromDefault).toHaveLength(1);
        expect(fromDefault[0]._isSelected).toBe(true);

        cache.clear();
        allScreenManagerBases = [];
        instanceSettings.length = 0;
        getAllShowingScreenIdsMock.mockReturnValueOnce([3, 4]);
        const fromShowing = screenManagerHelpers.getAllScreenManagers();
        expect(fromShowing.map(({ screenId }) => screenId)).toEqual([3, 4]);

        const deleted = new MockScreenManager(11);
        deleted.isDeleted = true;
        allScreenManagerBases = [new MockScreenManager(10), deleted];
        expect(
            screenManagerHelpers.getAllScreenManagers().map(({ screenId }) => screenId),
        ).toEqual([10]);
    });

    test('covers screen event handler static selection and cache helpers', async () => {
        const { default: ScreenEventHandler } = await import('./ScreenEventHandler');

        class TestHandler extends ScreenEventHandler<'update'> {
            static readonly eventNamePrefix = 'test-handler';

            get isShowing() {
                return true;
            }

            toSyncMessage() {
                return {
                    type: 'background',
                    data: { ok: true },
                } as any;
            }

            receiveSyncScreen() {
                return undefined;
            }

            render() {
                return undefined;
            }

            clear() {
                return undefined;
            }
        }

        const base = new MockScreenManagerBase(20) as any;
        const handler = new TestHandler(base);

        expect(TestHandler.getInstanceBase(20)).toBe(handler);
        expect(() => ScreenEventHandler.receiveSyncScreen({} as any)).toThrow(
            'receiveSyncScreen is not implemented.',
        );
        expect(() => TestHandler.getInstance(20)).toThrow(
            'getInstance is not implemented.',
        );

        screenManagerBaseById.set(20, base);
        TestHandler.disableSyncGroup(20);
        TestHandler.enableSyncGroup(20);
        expect(base.noSyncGroupMap.get('test-handler')).toBe(false);

        appProviderMock.isPagePresenter = false;
        await expect(
            TestHandler.chooseScreenIds(new MouseEvent('contextmenu') as any, false),
        ).resolves.toEqual([]);

        appProviderMock.isPagePresenter = true;
        selectedScreenManagerBases = [{ screenId: 7 }, { screenId: 8 }];
        await expect(
            TestHandler.chooseScreenIds(new MouseEvent('contextmenu') as any, false),
        ).resolves.toEqual([7, 8]);

        selectedScreenManagerBases = [];
        allScreenManagerBases = [{ screenId: 3 }, { screenId: 4 }];
        showAppContextMenuMock.mockImplementationOnce((_event, items) => {
            queueMicrotask(() => {
                items[1]?.onSelect();
            });
            return { promiseDone: Promise.resolve() };
        });
        await expect(
            TestHandler.chooseScreenIds(new MouseEvent('contextmenu') as any, true),
        ).resolves.toEqual([4]);

        showAppContextMenuMock.mockImplementationOnce(() => {
            return { promiseDone: Promise.resolve() };
        });
        await expect(
            TestHandler.chooseScreenIds(new MouseEvent('contextmenu') as any, true),
        ).resolves.toEqual([]);

        handler.delete();
        expect(base.createScreenManagerBaseGhost).toHaveBeenCalledWith(20);
    });

    test('attaches dropped backgrounds using explicit and fallback lookups', async () => {
        const { applyAttachBackground } = await import('./screenBackgroundHelpers');

        getAttachedBackgroundMock
            .mockResolvedValueOnce({ type: 'bg-color', item: '#fff' })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ type: 'bg-image', item: '/bg.png' })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);

        await applyAttachBackground(1, '/slides/sample.app', 5);
        await applyAttachBackground(1, '/slides/sample.app', 6);
        await applyAttachBackground(1, '/slides/sample.app', 7);

        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            1,
            '/slides/sample.app',
            5,
        );
        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            2,
            '/slides/sample.app',
            6,
        );
        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            3,
            '/slides/sample.app',
        );
        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            4,
            '/slides/sample.app',
            7,
        );
        expect(getAttachedBackgroundMock).toHaveBeenNthCalledWith(
            5,
            '/slides/sample.app',
        );

        expect(receiveScreenDroppedMock).toHaveBeenCalledWith({
            type: 'bg-color',
            item: '#fff',
        });
        expect(receiveScreenDroppedMock).toHaveBeenCalledWith({
            type: 'bg-image',
            item: '/bg.png',
        });
        expect(receiveScreenDroppedMock).toHaveBeenCalledTimes(2);
    });
});
