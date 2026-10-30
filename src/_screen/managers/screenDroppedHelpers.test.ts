import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    chooseScreenIds: vi.fn(),
    screenManagers: new Map<number, any>(),
    showSimpleToast: vi.fn(),
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./ScreenEventHandler', () => ({
    default: { chooseScreenIds: h.chooseScreenIds },
}));
vi.mock('./screenManagerHelpers', () => ({
    getScreenManagerByScreenId: (screenId: number) => {
        return h.screenManagers.get(screenId) ?? null;
    },
}));

import {
    applyOnChosenScreens,
    applyOnScreenIds,
    chooseScreenIdsOnEvent,
    showDroppedDataOnScreenIds,
    showDroppedDataOnScreens,
} from './screenDroppedHelpers';

function addScreenManager(screenId: number) {
    const screenManager = {
        screenId,
        receiveScreenDropped: vi.fn(async () => {}),
    };
    h.screenManagers.set(screenId, screenManager);
    return screenManager;
}

beforeEach(() => {
    h.screenManagers.clear();
});

describe('applyOnScreenIds', () => {
    test('hands every screen its work before awaiting any of them', async () => {
        addScreenManager(1);
        addScreenManager(2);
        const order: string[] = [];
        const releaseList: (() => void)[] = [];
        const applying = applyOnScreenIds([1, 2], (screenManager) => {
            order.push(`start ${screenManager.screenId}`);
            return new Promise<void>((resolve) => {
                releaseList.push(() => {
                    order.push(`done ${screenManager.screenId}`);
                    resolve();
                });
            });
        });
        // Screen 2 started while screen 1 is still rendering.
        expect(order).toEqual(['start 1', 'start 2']);

        let isSettled = false;
        void applying.then(() => {
            isSettled = true;
        });
        releaseList[1]();
        await Promise.resolve();
        expect(isSettled).toBe(false);
        releaseList[0]();
        await applying;
        expect(isSettled).toBe(true);
        expect(order).toEqual(['start 1', 'start 2', 'done 2', 'done 1']);
    });

    test('a closed screen is reported and the others still get their work', async () => {
        const open = addScreenManager(1);
        const apply = vi.fn();
        await applyOnScreenIds([7, 1], apply);
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'Failed to apply to screen. Please make sure the screen is open.',
            'Error',
        );
        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(open);
    });

    test('no screens, no work and no toast', async () => {
        const apply = vi.fn();
        await applyOnScreenIds([], apply);
        expect(apply).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('applyOnChosenScreens', () => {
    test('asks which screens with the caller options, then applies on them', async () => {
        const second = addScreenManager(2);
        h.chooseScreenIds.mockResolvedValue([2]);
        const event = { type: 'click' };
        const apply = vi.fn();
        await applyOnChosenScreens(event, true, apply, [2, 3]);
        expect(h.chooseScreenIds).toHaveBeenCalledWith(event, true, [2, 3]);
        expect(apply).toHaveBeenCalledWith(second);
    });

    test('preset screens default to none', async () => {
        h.chooseScreenIds.mockResolvedValue([]);
        await applyOnChosenScreens({}, false, vi.fn());
        expect(h.chooseScreenIds).toHaveBeenCalledWith({}, false, []);
    });
});

describe('chooseScreenIdsOnEvent', () => {
    test('resolves the choice and does nothing to the screens', async () => {
        const screenManager = addScreenManager(4);
        h.chooseScreenIds.mockResolvedValue([4]);
        await expect(chooseScreenIdsOnEvent({ type: 'key' })).resolves.toEqual([
            4,
        ]);
        expect(h.chooseScreenIds).toHaveBeenCalledWith(
            { type: 'key' },
            false,
            [],
        );
        expect(screenManager.receiveScreenDropped).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});

describe('dropped data', () => {
    test('a click shows the row on the chosen screens the way a drop would', async () => {
        const first = addScreenManager(1);
        const second = addScreenManager(2);
        h.chooseScreenIds.mockResolvedValue([1, 2]);
        const droppedData = { type: 'slide', item: { id: 3 } } as any;
        await showDroppedDataOnScreens({}, droppedData, true, [1]);
        expect(h.chooseScreenIds).toHaveBeenCalledWith({}, true, [1]);
        expect(first.receiveScreenDropped).toHaveBeenCalledWith(droppedData);
        expect(second.receiveScreenDropped).toHaveBeenCalledWith(droppedData);
    });

    test('defaults: no forced choosing and no preset screens', async () => {
        h.chooseScreenIds.mockResolvedValue([]);
        await showDroppedDataOnScreens({}, { type: 'slide' } as any);
        expect(h.chooseScreenIds).toHaveBeenCalledWith({}, false, []);
    });

    test('a follower lands on the screens its host resolved, asking nothing', async () => {
        const third = addScreenManager(3);
        const droppedData = { type: 'background-color', item: '#fff' } as any;
        await showDroppedDataOnScreenIds([3], droppedData);
        expect(h.chooseScreenIds).not.toHaveBeenCalled();
        expect(third.receiveScreenDropped).toHaveBeenCalledWith(droppedData);
    });

    test('an empty follower list does nothing rather than ask', async () => {
        await showDroppedDataOnScreenIds([], { type: 'slide' } as any);
        expect(h.chooseScreenIds).not.toHaveBeenCalled();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });
});
