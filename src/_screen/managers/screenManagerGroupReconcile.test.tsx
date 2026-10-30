// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

// Pinned statically: the tests below reset modules, and the mock factory's
// functions must stay the ones the re-imported helpers call.
import {
    rememberVirtualScreensShowing,
    restoreVirtualScreensShowing,
} from './virtualScreenShowingHelpers';

const handleErrorMock = vi.fn();
const instanceSettings: any[] = [];
const cache = new Map<string, any>();
let allScreenManagerBases: any[] = [];

const appProviderMock = {
    isPagePresenter: true,
    systemUtils: { isDev: false },
};

class MockLayerManager {
    isShowing = false;

    constructor(isShowing: boolean) {
        this.isShowing = isShowing;
    }
}

class MockScreenManagerBase {
    static readonly fireInstanceEvent = vi.fn();
}

class MockScreenManager extends MockScreenManagerBase {
    readonly screenId: number;
    isDeleted = false;
    isLocked = false;
    colorNote: string | null = null;
    noSyncGroupMap = new Map<string, boolean>();
    _isSelected = false;

    screenBackgroundManager = new MockLayerManager(false);
    screenVaryAppDocumentManager = new MockLayerManager(false);
    screenLongTextManager = new MockLayerManager(false);
    screenForegroundManager = new MockLayerManager(false);
    screenDrawManager = new MockLayerManager(false);

    sendSyncScreen = vi.fn(async () => {});

    constructor(screenId: number) {
        super();
        this.screenId = screenId;
    }

    get key() {
        return `${this.screenId}`;
    }

    async getColorNote() {
        return this.colorNote;
    }
}

// Keeping and restoring the virtual display screens reads settings; these
// tests are about other things.
vi.mock('./virtualScreenShowingHelpers', () => ({
    rememberVirtualScreensShowing: vi.fn(),
    restoreVirtualScreensShowing: vi.fn(() => []),
}));
vi.mock('../screenHelpers', () => ({
    getAllShowingScreenIds: vi.fn(() => []),
}));

vi.mock('./ScreenManagerBase', () => ({ default: MockScreenManagerBase }));

vi.mock('./ScreenManager', () => ({ default: MockScreenManager }));

vi.mock('./screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: vi.fn(() => allScreenManagerBases),
    getScreenManagersInstanceSetting: vi.fn(() => instanceSettings),
    saveScreenManagersSetting: vi.fn(),
    cache,
    setScreenManagerBaseCache: vi.fn((screenManagerBase: any) => {
        cache.set(screenManagerBase.key, screenManagerBase);
    }),
    getScreenManagerBase: vi.fn(() => null),
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

function genScreenManager(
    screenId: number,
    colorNote: string | null,
    showingLayerNames: string[] = [],
) {
    const screenManager = new MockScreenManager(screenId);
    screenManager.colorNote = colorNote;
    for (const name of showingLayerNames) {
        (screenManager as any)[name].isShowing = true;
    }
    return screenManager;
}

// The reconcile is deferred off a macrotask and internally waits one more
// before clearing the echo guards.
async function flushReconcile() {
    for (let index = 0; index < 5; index++) {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    }
}

async function importAndReconcile() {
    vi.resetModules();
    const screenManagerHelpers = await import('./screenManagerHelpers');
    screenManagerHelpers.getScreenManagersFromSetting();
    await flushReconcile();
}

describe('screen manager group reconcile on load', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cache.clear();
        instanceSettings.length = 0;
        allScreenManagerBases = [];
        appProviderMock.isPagePresenter = true;
    });

    test('the member holding the most content syncs the rest of its group', async () => {
        const empty = genScreenManager(0, 'amber', ['screenDrawManager']);
        const loaded = genScreenManager(1, 'amber', [
            'screenDrawManager',
            'screenVaryAppDocumentManager',
            'screenLongTextManager',
        ]);
        allScreenManagerBases = [empty, loaded];

        await importAndReconcile();

        expect(loaded.sendSyncScreen).toHaveBeenCalledOnce();
        expect(empty.sendSyncScreen).not.toHaveBeenCalled();
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test('a tie is broken by the lowest screen id', async () => {
        const first = genScreenManager(3, 'teal', ['screenLongTextManager']);
        const second = genScreenManager(2, 'teal', ['screenBackgroundManager']);
        allScreenManagerBases = [first, second];

        await importAndReconcile();

        expect(second.sendSyncScreen).toHaveBeenCalledOnce();
        expect(first.sendSyncScreen).not.toHaveBeenCalled();
    });

    test('the echo guard is cleared so the group stays two-way', async () => {
        const other = genScreenManager(0, 'amber');
        other.noSyncGroupMap.set('screen-vary-app-document-m', true);
        const loaded = genScreenManager(1, 'amber', [
            'screenVaryAppDocumentManager',
        ]);
        allScreenManagerBases = [other, loaded];

        await importAndReconcile();

        expect(other.noSyncGroupMap.size).toBe(0);
    });

    test('a locked group keeps its content frozen', async () => {
        const locked = genScreenManager(0, 'amber');
        locked.isLocked = true;
        const loaded = genScreenManager(1, 'amber', ['screenLongTextManager']);
        allScreenManagerBases = [locked, loaded];

        await importAndReconcile();

        expect(loaded.sendSyncScreen).not.toHaveBeenCalled();
    });

    test('an entirely empty group and ungrouped screens are left alone', async () => {
        const emptyGroupMember1 = genScreenManager(0, 'amber');
        const emptyGroupMember2 = genScreenManager(1, 'amber');
        const ungrouped = genScreenManager(2, null, ['screenLongTextManager']);
        allScreenManagerBases = [
            emptyGroupMember1,
            emptyGroupMember2,
            ungrouped,
        ];

        await importAndReconcile();

        expect(emptyGroupMember1.sendSyncScreen).not.toHaveBeenCalled();
        expect(emptyGroupMember2.sendSyncScreen).not.toHaveBeenCalled();
        expect(ungrouped.sendSyncScreen).not.toHaveBeenCalled();
    });

    test('the screen output window never reconciles', async () => {
        appProviderMock.isPagePresenter = false;
        const empty = genScreenManager(0, 'amber');
        const loaded = genScreenManager(1, 'amber', ['screenLongTextManager']);
        allScreenManagerBases = [empty, loaded];

        await importAndReconcile();

        expect(loaded.sendSyncScreen).not.toHaveBeenCalled();
    });
});

describe('screen managers from the setting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        cache.clear();
        instanceSettings.length = 0;
        allScreenManagerBases = [];
        appProviderMock.isPagePresenter = true;
    });

    test('a lone member of a colour has nobody to sync', async () => {
        const alone = genScreenManager(0, 'amber', ['screenLongTextManager']);
        const other = genScreenManager(1, 'teal');
        allScreenManagerBases = [alone, other];

        await importAndReconcile();

        expect(alone.sendSyncScreen).not.toHaveBeenCalled();
        expect(other.sendSyncScreen).not.toHaveBeenCalled();
    });

    test('the persisted selection is put back on every screen', async () => {
        const cachedFirst = genScreenManager(0, null);
        const cachedSecond = genScreenManager(1, null);
        cachedSecond._isSelected = true;
        cache.set('0', cachedFirst);
        cache.set('1', cachedSecond);
        instanceSettings.push(
            { screenId: 0, isSelected: true },
            { screenId: 1 },
        );
        allScreenManagerBases = [cachedFirst, cachedSecond];

        vi.resetModules();
        const helpers = await import('./screenManagerHelpers');
        const screenManagers = helpers.getScreenManagersFromSetting();

        expect(screenManagers).toEqual([cachedFirst, cachedSecond]);
        expect(cachedFirst._isSelected).toBe(true);
        expect(cachedSecond._isSelected).toBe(false);
        await flushReconcile();
    });

    test('with no setting at all, screen 0 is made and selected', async () => {
        vi.resetModules();
        const helpers = await import('./screenManagerHelpers');
        helpers.getScreenManagersFromSetting();
        const created = cache.get('0');
        expect(created).toBeInstanceOf(MockScreenManager);
        allScreenManagerBases = [created];
        helpers.getScreenManagersFromSetting();
        expect(created._isSelected).toBe(true);
        await flushReconcile();
    });

    test('screens up on a virtual display last time are put up again and remembered', async () => {
        const virtualScreen = genScreenManager(0, null) as any;
        virtualScreen.isShowing = false;
        virtualScreen.displayId = -500001;
        const plainScreen = genScreenManager(1, null) as any;
        plainScreen.isShowing = false;
        plainScreen.displayId = 2;
        allScreenManagerBases = [virtualScreen, plainScreen];
        let seenItems: any[] = [];
        vi.mocked(restoreVirtualScreensShowing).mockImplementation(
            (items: any[]) => {
                seenItems = items;
                // The display is read when it is asked for, not copied.
                virtualScreen.displayId = -500002;
                const item = items.find((entry) => {
                    return entry.displayId === -500002;
                });
                item.show();
                return [item.screenId];
            },
        );

        vi.resetModules();
        const helpers = await import('./screenManagerHelpers');
        const shownIds = helpers.restoreVirtualDisplayScreens();

        expect(shownIds).toEqual([0]);
        expect(
            seenItems.map((item) => {
                return [item.screenId, item.isShowing];
            }),
        ).toEqual([
            [0, false],
            [1, false],
        ]);
        expect(virtualScreen.isShowing).toBe(true);
        expect(plainScreen.isShowing).toBe(false);
        // What is up NOW is what the next start brings back.
        expect(rememberVirtualScreensShowing).toHaveBeenCalledWith([
            { screenId: 0, isShowing: true },
            { screenId: 1, isShowing: false },
        ]);
        await flushReconcile();
    });

    test('a screen window never restores virtual displays', async () => {
        appProviderMock.isPagePresenter = false;
        vi.resetModules();
        const helpers = await import('./screenManagerHelpers');
        expect(helpers.restoreVirtualDisplayScreens()).toEqual([]);
        expect(restoreVirtualScreensShowing).not.toHaveBeenCalled();
        expect(rememberVirtualScreensShowing).not.toHaveBeenCalled();
    });
});
