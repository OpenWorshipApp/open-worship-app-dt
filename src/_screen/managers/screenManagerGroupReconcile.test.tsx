// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

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
    screenBibleManager = new MockLayerManager(false);
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
            'screenBibleManager',
        ]);
        allScreenManagerBases = [empty, loaded];

        await importAndReconcile();

        expect(loaded.sendSyncScreen).toHaveBeenCalledOnce();
        expect(empty.sendSyncScreen).not.toHaveBeenCalled();
        expect(handleErrorMock).not.toHaveBeenCalled();
    });

    test('a tie is broken by the lowest screen id', async () => {
        const first = genScreenManager(3, 'teal', ['screenBibleManager']);
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
        const loaded = genScreenManager(1, 'amber', ['screenBibleManager']);
        allScreenManagerBases = [locked, loaded];

        await importAndReconcile();

        expect(loaded.sendSyncScreen).not.toHaveBeenCalled();
    });

    test('an entirely empty group and ungrouped screens are left alone', async () => {
        const emptyGroupMember1 = genScreenManager(0, 'amber');
        const emptyGroupMember2 = genScreenManager(1, 'amber');
        const ungrouped = genScreenManager(2, null, ['screenBibleManager']);
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
        const loaded = genScreenManager(1, 'amber', ['screenBibleManager']);
        allScreenManagerBases = [empty, loaded];

        await importAndReconcile();

        expect(loaded.sendSyncScreen).not.toHaveBeenCalled();
    });
});
