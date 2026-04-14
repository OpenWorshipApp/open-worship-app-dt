import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    freezeObjectMock: vi.fn((value: object) => Object.freeze(value)),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
}));

vi.mock('../helpers', () => ({
    freezeObject: mocks.freezeObjectMock,
}));

vi.mock('../settingHelpers', () => ({
    getSetting: mocks.getSettingMock,
    setSetting: mocks.setSettingMock,
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
        mocks.getSettingMock.mockReturnValue(undefined);
        mocks.freezeObjectMock.mockImplementation((value: object) => Object.freeze(value));
    });

    test('exposes frozen model metadata and defaults to KJV when setting is invalid', () => {
        expect(Object.isFrozen(modelNewLinerInfo)).toBe(true);
        expect(Array.isArray(modelNewLinerInfo)).toBe(true);
        expect(bibleModelInfoTitleMap[BibleModelInfoEnum.KJV]).toBeTruthy();
        expect(bibleModelInfoTitleMap[BibleModelInfoEnum.KJVD]).toBeTruthy();
        expect(bibleModelInfoTitleMap[BibleModelInfoEnum.DR]).toBeTruthy();

        mocks.getSettingMock.mockReturnValue('INVALID');
        expect(getBibleModelInfoSetting()).toBe(BibleModelInfoEnum.KJV);

        const model = getBibleModelInfo();
        expect(model.title).toBe(bibleModelInfoTitleMap[BibleModelInfoEnum.KJV]);
        expect(Object.isFrozen(model)).toBe(true);
        expect(model.books.GEN.chapterCount).toBeGreaterThan(0);
    });

    test('returns the configured model variants and persists the setting', () => {
        mocks.getSettingMock.mockReturnValue(BibleModelInfoEnum.KJVD);
        expect(getBibleModelInfoSetting()).toBe(BibleModelInfoEnum.KJVD);
        expect(getBibleModelInfo().title).toBe(
            bibleModelInfoTitleMap[BibleModelInfoEnum.KJVD],
        );

        mocks.getSettingMock.mockReturnValue(BibleModelInfoEnum.DR);
        expect(getBibleModelInfoSetting()).toBe(BibleModelInfoEnum.DR);
        const drModel = getBibleModelInfo();
        expect(drModel.title).toBe(bibleModelInfoTitleMap[BibleModelInfoEnum.DR]);
        expect(drModel.bookKeysOrder.length).toBeGreaterThan(0);

        setBibleModelInfoSetting(BibleModelInfoEnum.DR);
        expect(mocks.setSettingMock).toHaveBeenCalledWith(
            'model-bible-info',
            BibleModelInfoEnum.DR,
        );
    });
});
