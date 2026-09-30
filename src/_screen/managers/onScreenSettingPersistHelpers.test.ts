import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSetting: vi.fn<(key: string) => string | null>(),
    setSetting: vi.fn(),
    handleError: vi.fn(),
    appProvider: { isPagePresenter: true, isPageScreen: false },
}));

vi.mock('../../helper/settingHelpers', () => ({
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
}));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: async (_key: string, callback: () => unknown) => callback(),
}));
vi.mock('../../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));
vi.mock('../../server/appProvider', () => ({ default: mocks.appProvider }));

import {
    collectLiveOnScreenMap,
    persistOnScreenEntry,
} from './onScreenSettingPersistHelpers';

function persist(
    readMap: () => { [key: string]: string },
    value: string | null = 'new-0',
) {
    const onDone = vi.fn();
    const promise = persistOnScreenEntry<string>({
        lockKey: 'lock',
        settingName: 'on-screen',
        key: '0',
        value,
        readMap,
        collectLive: () => {
            return collectLiveOnScreenMap(
                [
                    { key: '0', value: 'new-0' },
                    { key: '1', value: 'live-1' },
                    { key: '2', value: null },
                ],
                (instance) => {
                    return instance.value;
                },
            );
        },
        onDone,
    });
    return { promise, onDone };
}

function savedMap() {
    expect(mocks.setSetting).toHaveBeenCalledTimes(1);
    const [name, text] = mocks.setSetting.mock.calls[0];
    expect(name).toBe('on-screen');
    return JSON.parse(text);
}

describe('persistOnScreenEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.appProvider.isPagePresenter = true;
        mocks.appProvider.isPageScreen = false;
        mocks.getSetting.mockReturnValue(null);
    });

    test('keeps every other screen when setting its own entry', async () => {
        const { promise, onDone } = persist(() => ({ '1': 'a', '2': 'b' }));
        await promise;
        expect(savedMap()).toEqual({ '0': 'new-0', '1': 'a', '2': 'b' });
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    test('a projector window never writes, but still fires its update', async () => {
        mocks.appProvider.isPagePresenter = false;
        mocks.appProvider.isPageScreen = true;
        const readMap = vi.fn(() => ({ '1': 'a' }));
        const { promise, onDone } = persist(readMap);
        await promise;
        expect(mocks.setSetting).not.toHaveBeenCalled();
        expect(readMap).not.toHaveBeenCalled();
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    test('an unreadable map is rebuilt from the Presenter screens, never saved as one key', async () => {
        // A half-written file: the memoized reader answered `{}`.
        mocks.getSetting.mockReturnValue('{"1":{"itemJson":"xxx');
        const { promise } = persist(() => ({}));
        await promise;
        expect(savedMap()).toEqual({ '0': 'new-0', '1': 'live-1' });
        expect(mocks.handleError).toHaveBeenCalledTimes(1);
    });

    test('an unreadable map is left alone by a window that is not the Presenter', async () => {
        mocks.appProvider.isPagePresenter = false;
        mocks.getSetting.mockReturnValue('{"1":{"itemJson":"xxx');
        const { promise, onDone } = persist(() => ({}));
        await promise;
        expect(mocks.setSetting).not.toHaveBeenCalled();
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    test('an empty file is simply written', async () => {
        mocks.getSetting.mockReturnValue('{}');
        const { promise } = persist(() => ({}));
        await promise;
        expect(savedMap()).toEqual({ '0': 'new-0' });
        expect(mocks.handleError).not.toHaveBeenCalled();
    });

    test('clearing removes only its own entry', async () => {
        const { promise } = persist(() => ({ '0': 'old', '1': 'a' }), null);
        await promise;
        expect(savedMap()).toEqual({ '1': 'a' });
    });
});
