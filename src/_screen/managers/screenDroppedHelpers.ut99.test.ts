import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    return {
        chooseScreenIds: vi.fn(),
        getScreenManagerByScreenId: vi.fn(),
        showSimpleToast: vi.fn(),
        managers: new Map<number, any>(),
    };
});

vi.mock('./ScreenEventHandler', () => ({
    default: { chooseScreenIds: mocks.chooseScreenIds },
}));
vi.mock('./screenManagerHelpers', () => ({
    getScreenManagerByScreenId: mocks.getScreenManagerByScreenId,
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));

import {
    applyOnChosenScreens,
    applyOnScreenIds,
    chooseScreenIdsOnEvent,
    showDroppedDataOnScreenIds,
    showDroppedDataOnScreens,
} from './screenDroppedHelpers';

const CLOSED_SCREEN_MESSAGE =
    'Failed to apply to screen. Please make sure the screen is open.';

function genScreenManager(screenId: number) {
    const manager = {
        screenId,
        receivedList: [] as any[],
        receiveScreenDropped: vi.fn(async (droppedData: any) => {
            manager.receivedList.push(droppedData);
        }),
    };
    mocks.managers.set(screenId, manager);
    return manager;
}

beforeEach(() => {
    mocks.managers.clear();
    mocks.getScreenManagerByScreenId.mockImplementation((screenId: number) => {
        return mocks.managers.get(screenId) ?? null;
    });
    mocks.chooseScreenIds.mockResolvedValue([]);
});

describe('applyOnChosenScreens', () => {
    test('asks which screens, then applies to each of them', async () => {
        const managerA = genScreenManager(1);
        const managerB = genScreenManager(2);
        mocks.chooseScreenIds.mockResolvedValue([1, 2]);
        const event = { type: 'click' };
        const applied: number[] = [];

        await applyOnChosenScreens(event, true, (screenManager: any) => {
            applied.push(screenManager.screenId);
        });

        expect(mocks.chooseScreenIds).toHaveBeenCalledWith(event, true, []);
        expect(applied).toEqual([1, 2]);
        expect(managerA.receiveScreenDropped).not.toHaveBeenCalled();
        expect(managerB.receiveScreenDropped).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).not.toHaveBeenCalled();
    });

    test('hands every screen its work before awaiting any of it', async () => {
        genScreenManager(1);
        genScreenManager(2);
        mocks.chooseScreenIds.mockResolvedValue([1, 2]);
        const started: number[] = [];
        let resolveFirst = () => {};
        let isDone = false;

        const promise = applyOnChosenScreens(
            {},
            false,
            (screenManager: any) => {
                started.push(screenManager.screenId);
                if (screenManager.screenId !== 1) {
                    return;
                }
                return new Promise<void>((resolve) => {
                    resolveFirst = resolve;
                });
            },
            [1, 2],
        ).then(() => {
            isDone = true;
        });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        // Screen 2 never waited on screen 1's render ...
        expect(started).toEqual([1, 2]);
        // ... but the caller only goes on once every screen has its content.
        expect(isDone).toBe(false);
        resolveFirst();
        await promise;
        expect(isDone).toBe(true);
        expect(mocks.chooseScreenIds).toHaveBeenCalledWith({}, false, [1, 2]);
    });
});

describe('applyOnScreenIds', () => {
    test('a closed screen is reported and the rest still get the work', async () => {
        genScreenManager(3);
        const applied: number[] = [];

        await applyOnScreenIds([7, 3], (screenManager: any) => {
            applied.push(screenManager.screenId);
        });

        expect(applied).toEqual([3]);
        expect(mocks.showSimpleToast).toHaveBeenCalledTimes(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            CLOSED_SCREEN_MESSAGE,
            'Error',
        );
        expect(mocks.chooseScreenIds).not.toHaveBeenCalled();
    });

    test('no screens means nothing applied and nothing said', async () => {
        const apply = vi.fn();
        await applyOnScreenIds([], apply);
        expect(apply).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('chooseScreenIdsOnEvent', () => {
    test('answers which screens without doing anything to them', async () => {
        const manager = genScreenManager(4);
        mocks.chooseScreenIds.mockResolvedValue([4]);

        await expect(chooseScreenIdsOnEvent('event')).resolves.toEqual([4]);
        expect(mocks.chooseScreenIds).toHaveBeenLastCalledWith(
            'event',
            false,
            [],
        );

        await chooseScreenIdsOnEvent('event', true, [4]);
        expect(mocks.chooseScreenIds).toHaveBeenLastCalledWith(
            'event',
            true,
            [4],
        );
        expect(manager.receiveScreenDropped).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('dropped data', () => {
    const droppedData = { type: 'slide', item: { id: 9 } } as any;

    test('a click shows the dropped data on the chosen screens', async () => {
        const managerA = genScreenManager(1);
        const managerB = genScreenManager(2);
        mocks.chooseScreenIds.mockResolvedValue([2]);

        await showDroppedDataOnScreens('click', droppedData);
        expect(mocks.chooseScreenIds).toHaveBeenLastCalledWith(
            'click',
            false,
            [],
        );
        expect(managerA.receivedList).toEqual([]);
        expect(managerB.receivedList).toEqual([droppedData]);

        mocks.chooseScreenIds.mockResolvedValue([1, 2]);
        await showDroppedDataOnScreens('click', droppedData, true, [1, 2]);
        expect(mocks.chooseScreenIds).toHaveBeenLastCalledWith(
            'click',
            true,
            [1, 2],
        );
        expect(managerA.receivedList).toEqual([droppedData]);
        expect(managerB.receivedList).toEqual([droppedData, droppedData]);
    });

    test('a drop names its screens and asks nothing', async () => {
        const managerA = genScreenManager(1);
        const managerB = genScreenManager(2);

        await showDroppedDataOnScreenIds([2, 1, 5], droppedData);

        expect(mocks.chooseScreenIds).not.toHaveBeenCalled();
        expect(managerA.receivedList).toEqual([droppedData]);
        expect(managerB.receivedList).toEqual([droppedData]);
        // Screen 5 is not open.
        expect(mocks.showSimpleToast).toHaveBeenCalledTimes(1);
    });
});
