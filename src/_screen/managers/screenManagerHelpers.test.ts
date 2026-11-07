// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => {
    const state = {
        cache: new Map<string, any>(),
        instanceSettings: [] as any[],
        showingScreenIds: [] as number[],
        saveCount: 0,
        instanceEventCount: 0,
        errors: [] as unknown[],
        restoredLists: [] as any[][],
        rememberedLists: [] as any[][],
        idsToRestore: [] as number[],
    };
    class FakeScreenManagerBase {
        static fireInstanceEvent() {
            state.instanceEventCount += 1;
        }
        // The real one throws on a key that is not a number.
        static idFromKey(key: string) {
            const id = Number.parseInt(key, 10);
            if (Number.isNaN(id)) {
                throw new TypeError(`Invalid screen key: ${key}`);
            }
            return id;
        }
        readonly screenId: number;
        isDeleted = false;
        constructor(screenId: number) {
            this.screenId = screenId;
        }
        get key() {
            return `${this.screenId}`;
        }
    }
    class FakeLayer {
        isShowing = false;
    }
    class FakeScreenManager extends FakeScreenManagerBase {
        _isSelected = false;
        _isLocked = false;
        _stage = 0;
        colorNote: string | null = null;
        isLocked = false;
        isShowing = false;
        displayId = 0;
        syncCount = 0;
        noSyncGroupMap = new Map<string, boolean>();
        screenBackgroundManager = new FakeLayer();
        screenVaryAppDocumentManager = new FakeLayer();
        screenLongTextManager = new FakeLayer();
        screenForegroundManager = new FakeLayer();
        screenDrawManager = new FakeLayer();
        async sendSyncScreen() {
            this.syncCount += 1;
        }
        async getColorNote() {
            return this.colorNote;
        }
    }
    return {
        state,
        FakeScreenManagerBase,
        FakeScreenManager,
        appProvider: { isPagePresenter: false },
    };
});

vi.mock('./ScreenManagerBase', () => ({
    default: fakes.FakeScreenManagerBase,
}));
vi.mock('./ScreenManager', () => ({
    default: fakes.FakeScreenManager,
}));
vi.mock('./screenManagerBaseHelpers', () => ({
    cache: fakes.state.cache,
    getAllScreenManagerBases: () => {
        return Array.from(fakes.state.cache.values()).sort((a, b) => {
            return a.screenId - b.screenId;
        });
    },
    getScreenManagersInstanceSetting: () => fakes.state.instanceSettings,
    saveScreenManagersSetting: () => {
        fakes.state.saveCount += 1;
    },
    setScreenManagerBaseCache: (screenManagerBase: any) => {
        fakes.state.cache.set(screenManagerBase.key, screenManagerBase);
    },
    getScreenManagerBase: (screenId: number) => {
        return fakes.state.cache.get(`${screenId}`) ?? null;
    },
}));
vi.mock('../screenHelpers', () => ({
    getAllShowingScreenIds: () => fakes.state.showingScreenIds,
}));
vi.mock('../../server/appProvider', () => ({
    default: fakes.appProvider,
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: (error: unknown) => {
        fakes.state.errors.push(error);
    },
}));
vi.mock('./virtualScreenShowingHelpers', () => ({
    // Puts up the screens it was told to, the way the real one does for the
    // remembered virtual-display screens.
    restoreVirtualScreensShowing: (screens: any[]) => {
        fakes.state.restoredLists.push(
            screens.map((screen) => {
                return { ...screen, displayIdRead: screen.displayId };
            }),
        );
        const shown: number[] = [];
        for (const screen of screens) {
            if (fakes.state.idsToRestore.includes(screen.screenId)) {
                screen.show();
                shown.push(screen.screenId);
            }
        }
        return shown;
    },
    rememberVirtualScreensShowing: (screens: any[]) => {
        fakes.state.rememberedLists.push(screens);
    },
}));

const { FakeScreenManager, FakeScreenManagerBase, state } = fakes;

// A fresh module per test: the group reconcile is scheduled once per load.
async function loadHelpers() {
    vi.resetModules();
    return await import('./screenManagerHelpers');
}

function addScreenManager(screenId: number, colorNote: string | null = null) {
    const screenManager = new FakeScreenManager(screenId);
    screenManager.colorNote = colorNote;
    state.cache.set(screenManager.key, screenManager);
    return screenManager;
}

// The reconcile is deferred off a macrotask and waits one more inside.
async function flushReconcile() {
    for (let index = 0; index < 5; index++) {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }
}

beforeEach(() => {
    state.cache.clear();
    state.instanceSettings = [];
    state.showingScreenIds = [];
    state.saveCount = 0;
    state.instanceEventCount = 0;
    state.errors.length = 0;
    state.restoredLists.length = 0;
    state.rememberedLists.length = 0;
    state.idsToRestore = [];
    fakes.appProvider.isPagePresenter = false;
});

describe('finding a screen manager', () => {
    test('only a full screen manager counts', async () => {
        const helpers = await loadHelpers();
        const screenManager = addScreenManager(2);
        const bareBase = new FakeScreenManagerBase(3);
        state.cache.set('3', bareBase);

        expect(helpers.screenManagerFromBase(null)).toBeNull();
        expect(helpers.screenManagerFromBase(bareBase as any)).toBeNull();
        expect(helpers.screenManagerFromBase(screenManager as any)).toBe(
            screenManager,
        );
        expect(helpers.getScreenManagerByScreenId(2)).toBe(screenManager);
        expect(helpers.getScreenManagerByScreenId(3)).toBeNull();
        expect(helpers.getScreenManagerByScreenId(4)).toBeNull();
        expect(helpers.getScreenManagerByKey('2')).toBe(screenManager);
        expect(helpers.getScreenManagerByKey('4')).toBeNull();
    });
});

describe('creating screen managers', () => {
    test('a new screen manager takes its stored selection, lock, stage and colour', async () => {
        const helpers = await loadHelpers();
        state.instanceSettings = [
            {
                screenId: 1,
                isSelected: true,
                isLocked: true,
                stageNumber: 2,
                colorNote: 'amber',
            },
        ];

        const stored = helpers.initNewScreenManager(1) as any;
        expect(stored).toBeInstanceOf(FakeScreenManager);
        expect(stored._isSelected).toBe(true);
        expect(stored._isLocked).toBe(true);
        expect(stored._stage).toBe(2);
        expect(stored.colorNote).toBe('amber');

        // Stored without a stage or a colour: the defaults.
        state.instanceSettings = [{ screenId: 1 }];
        const sparse = helpers.initNewScreenManager(1) as any;
        expect(sparse._isSelected).toBe(false);
        expect(sparse._stage).toBe(0);
        expect(sparse.colorNote).toBeNull();

        const unknown = helpers.initNewScreenManager(5) as any;
        expect(unknown._isSelected).toBe(false);
        expect(state.cache.size).toBe(0);
    });

    test('a screen manager is created, cached and saved once', async () => {
        const helpers = await loadHelpers();

        const first = helpers.createScreenManager(4);
        const second = helpers.createScreenManager(4);

        expect(second).toBe(first);
        expect(state.cache.get('4')).toBe(first);
        expect(state.saveCount).toBe(1);
    });

    test('a new screen takes the lowest free id', async () => {
        const helpers = await loadHelpers();
        addScreenManager(0);
        addScreenManager(2);

        helpers.genNewScreenManagerBase();

        expect(state.cache.has('1')).toBe(true);
        expect(state.instanceEventCount).toBe(1);

        helpers.genNewScreenManagerBase();
        expect(state.cache.has('3')).toBe(true);
    });
});

describe('getAllScreenManagers', () => {
    test('with nothing cached, the screens that are showing are created', async () => {
        const helpers = await loadHelpers();
        state.showingScreenIds = [3, 1];

        const screenManagers = helpers.getAllScreenManagers();

        expect(screenManagers.map(({ screenId }) => screenId)).toEqual([3, 1]);
        expect(state.cache.has('3')).toBe(true);
        expect(state.cache.has('1')).toBe(true);
    });

    test('deleted screens and bare bases are left out', async () => {
        const helpers = await loadHelpers();
        addScreenManager(0);
        addScreenManager(1).isDeleted = true;
        state.cache.set('2', new FakeScreenManagerBase(2));
        addScreenManager(3);

        expect(
            helpers.getAllScreenManagers().map(({ screenId }) => screenId),
        ).toEqual([0, 3]);
    });
});

describe('getScreenManagersFromSetting', () => {
    test('creates every stored screen with its stored selection', async () => {
        const helpers = await loadHelpers();
        state.instanceSettings = [
            { screenId: 0, isSelected: false },
            { screenId: 2, isSelected: true },
        ];

        const screenManagers = helpers.getScreenManagersFromSetting() as any[];

        expect(screenManagers.map(({ screenId }) => screenId)).toEqual([0, 2]);
        expect(screenManagers.map(({ _isSelected }) => _isSelected)).toEqual([
            false,
            true,
        ]);
    });

    test('with nothing stored there is screen 0, and a lone screen is selected', async () => {
        const helpers = await loadHelpers();

        const screenManagers = helpers.getScreenManagersFromSetting() as any[];
        expect(screenManagers.map(({ screenId }) => screenId)).toEqual([0]);
        expect(screenManagers[0]._isSelected).toBe(true);

        state.cache.clear();
        state.instanceSettings = [{ screenId: 6, isSelected: false }];
        const [lone] = helpers.getScreenManagersFromSetting() as any[];
        expect(lone.screenId).toBe(6);
        expect(lone._isSelected).toBe(true);
    });

    test('an output window never repairs the groups', async () => {
        const helpers = await loadHelpers();
        const empty = addScreenManager(0, 'amber');
        const loaded = addScreenManager(1, 'amber');
        loaded.screenDrawManager.isShowing = true;
        state.instanceSettings = [{ screenId: 0 }, { screenId: 1 }];

        helpers.getScreenManagersFromSetting();
        await flushReconcile();

        expect(loaded.syncCount).toBe(0);
        expect(empty.syncCount).toBe(0);
    });

    test('the presenter repairs a drifted group once, leaving a lone colour alone', async () => {
        fakes.appProvider.isPagePresenter = true;
        const helpers = await loadHelpers();
        const empty = addScreenManager(0, 'amber');
        const loaded = addScreenManager(1, 'amber');
        loaded.screenVaryAppDocumentManager.isShowing = true;
        empty.noSyncGroupMap.set('screen-vary-app-document-m', true);
        const lone = addScreenManager(2, 'teal');
        lone.screenLongTextManager.isShowing = true;
        state.instanceSettings = [
            { screenId: 0 },
            { screenId: 1 },
            { screenId: 2 },
        ];

        helpers.getScreenManagersFromSetting();
        // A second read (another component rendering) schedules nothing more.
        helpers.getScreenManagersFromSetting();
        await flushReconcile();

        expect(loaded.syncCount).toBe(1);
        expect(empty.syncCount).toBe(0);
        // A one-member group has nothing to be out of step with.
        expect(lone.syncCount).toBe(0);
        // The echo guard the sync left is cleared so the group stays two-way.
        expect(empty.noSyncGroupMap.size).toBe(0);
        expect(state.errors).toEqual([]);
    });
});

describe('restoreVirtualDisplayScreens', () => {
    test('only the presenter puts screens back up', async () => {
        const helpers = await loadHelpers();
        addScreenManager(0);

        expect(helpers.restoreVirtualDisplayScreens()).toEqual([]);
        expect(state.restoredLists).toEqual([]);
        expect(state.rememberedLists).toEqual([]);
    });

    test('shows the remembered screens and remembers what is up now', async () => {
        fakes.appProvider.isPagePresenter = true;
        const helpers = await loadHelpers();
        const first = addScreenManager(0);
        first.displayId = -500001;
        const second = addScreenManager(1);
        second.isShowing = true;
        second.displayId = 2;
        const third = addScreenManager(2);
        third.displayId = -500002;
        state.instanceSettings = [
            { screenId: 0 },
            { screenId: 1 },
            { screenId: 2 },
        ];
        state.idsToRestore = [2];

        const shownIds = helpers.restoreVirtualDisplayScreens();

        expect(shownIds).toEqual([2]);
        expect(third.isShowing).toBe(true);
        expect(first.isShowing).toBe(false);
        const [restoredList] = state.restoredLists;
        expect(
            restoredList.map(({ screenId, isShowing, displayIdRead }) => {
                return { screenId, isShowing, displayIdRead };
            }),
        ).toEqual([
            { screenId: 0, isShowing: false, displayIdRead: -500001 },
            { screenId: 1, isShowing: true, displayIdRead: 2 },
            { screenId: 2, isShowing: false, displayIdRead: -500002 },
        ]);
        // What the next start brings back is what is up after the restore.
        expect(state.rememberedLists).toEqual([
            [
                { screenId: 0, isShowing: false },
                { screenId: 1, isShowing: true },
                { screenId: 2, isShowing: true },
            ],
        ]);
        // Let the group reconcile the read scheduled settle inside this test.
        await flushReconcile();
        expect(state.errors).toEqual([]);
    });
});
