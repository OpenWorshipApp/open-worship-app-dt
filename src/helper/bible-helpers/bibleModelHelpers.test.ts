import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    freezeObjectMock: vi.fn((value: object) => Object.freeze(value)),
    getItemMock: vi.fn(),
    setItemMock: vi.fn(),
}));

vi.mock('../helpers', () => ({
    freezeObject: mocks.freezeObjectMock,
}));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: mocks.getItemMock,
        setItem: mocks.setItemMock,
    },
}));

import {
    BibleModelInfoEnum,
    bibleModelInfoTitleMap,
    getBibleModelInfo,
    getBibleModelInfoSetting,
    modelNewLinerInfo,
    setBibleModelInfoSetting,
} from './bibleModelHelpers';

describe('bibleModelHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getItemMock.mockReturnValue(null);
        mocks.freezeObjectMock.mockImplementation((value: object) =>
            Object.freeze(value),
        );
    });

    test('exposes frozen model metadata and defaults to KJV when setting is invalid', () => {
        expect(Object.isFrozen(modelNewLinerInfo)).toBe(true);
        expect(Array.isArray(modelNewLinerInfo)).toBe(true);
        expect(bibleModelInfoTitleMap[BibleModelInfoEnum.KJV]).toBeTruthy();
        expect(bibleModelInfoTitleMap[BibleModelInfoEnum.KJVD]).toBeTruthy();
        expect(bibleModelInfoTitleMap[BibleModelInfoEnum.DR]).toBeTruthy();

        mocks.getItemMock.mockReturnValue('INVALID');
        expect(getBibleModelInfoSetting()).toBe(BibleModelInfoEnum.KJV);

        const model = getBibleModelInfo();
        expect(model.title).toBe(
            bibleModelInfoTitleMap[BibleModelInfoEnum.KJV],
        );
        expect(Object.isFrozen(model)).toBe(true);
        expect(model.books.GEN.chapterCount).toBeGreaterThan(0);
    });

    test('returns the configured model variants and persists the setting', () => {
        mocks.getItemMock.mockReturnValue(BibleModelInfoEnum.KJVD);
        expect(getBibleModelInfoSetting()).toBe(BibleModelInfoEnum.KJVD);
        expect(getBibleModelInfo().title).toBe(
            bibleModelInfoTitleMap[BibleModelInfoEnum.KJVD],
        );

        mocks.getItemMock.mockReturnValue(BibleModelInfoEnum.DR);
        expect(getBibleModelInfoSetting()).toBe(BibleModelInfoEnum.DR);
        const drModel = getBibleModelInfo();
        expect(drModel.title).toBe(
            bibleModelInfoTitleMap[BibleModelInfoEnum.DR],
        );
        expect(drModel.bookKeysOrder.length).toBeGreaterThan(0);

        setBibleModelInfoSetting(BibleModelInfoEnum.DR);
        expect(mocks.setItemMock).toHaveBeenCalledWith(
            'model-bible-info',
            BibleModelInfoEnum.DR,
        );
    });
});
