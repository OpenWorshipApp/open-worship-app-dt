import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getSettingMock: vi.fn(),
    getSelectedVaryAppDocumentMock: vi.fn(),
    checkIsVaryAppDocumentFilePathOnScreenMock: vi.fn(),
    getAllScreenManagersMock: vi.fn(),
    checkIsBibleItemOnScreenMock: vi.fn(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: mocks.getSettingMock,
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsVaryAppDocumentFilePathOnScreen:
        mocks.checkIsVaryAppDocumentFilePathOnScreenMock,
    getSelectedVaryAppDocument: mocks.getSelectedVaryAppDocumentMock,
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: mocks.getAllScreenManagersMock,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    checkIsBibleItemOnScreen: mocks.checkIsBibleItemOnScreenMock,
}));

import type BibleItemsViewController from '../bible-reader/BibleItemsViewController';
import {
    checkIsOnScreen,
    getIsShowingVaryAppDocumentPreviewer,
    PRESENT_FOREGROUND_FLOATING_SETTING_NAME,
    PRESENT_TAB_SETTING_NAME,
} from './presenterRendererHelpers';

const viewController = {
    straightBibleItems: [{ target: 'John 3:16' }],
} as unknown as BibleItemsViewController;

beforeEach(() => {
    mocks.getAllScreenManagersMock.mockReturnValue([]);
});

describe('getIsShowingVaryAppDocumentPreviewer', () => {
    test.each([
        ['d', true],
        ['db', true],
        ['bd', true],
        ['b', false],
        ['', false],
        [null, false],
        [undefined, false],
    ])('tabs %j show the documents previewer: %s', (setting, expected) => {
        mocks.getSettingMock.mockReturnValue(setting);

        expect(getIsShowingVaryAppDocumentPreviewer()).toBe(expected);
        expect(mocks.getSettingMock).toHaveBeenCalledWith(
            PRESENT_TAB_SETTING_NAME,
        );
    });

    test('names its settings', () => {
        expect(PRESENT_TAB_SETTING_NAME).toBe('presenter-tab');
        expect(PRESENT_FOREGROUND_FLOATING_SETTING_NAME).toBe(
            'presenter-foreground-floating',
        );
    });
});

describe('checkIsOnScreen', () => {
    test('the documents tab asks about the selected document by its path', async () => {
        mocks.getSelectedVaryAppDocumentMock.mockResolvedValue({
            filePath: '/docs/song.owl',
        });
        mocks.checkIsVaryAppDocumentFilePathOnScreenMock.mockResolvedValue(
            true,
        );

        expect(await checkIsOnScreen('d', viewController)).toBe(true);
        expect(
            mocks.checkIsVaryAppDocumentFilePathOnScreenMock,
        ).toHaveBeenCalledWith('/docs/song.owl');

        mocks.checkIsVaryAppDocumentFilePathOnScreenMock.mockResolvedValue(
            false,
        );
        expect(await checkIsOnScreen('d', viewController)).toBe(false);
    });

    test('the documents tab with nothing selected is not on screen', async () => {
        mocks.getSelectedVaryAppDocumentMock.mockResolvedValue(null);

        expect(await checkIsOnScreen('d', viewController)).toBe(false);
        expect(
            mocks.checkIsVaryAppDocumentFilePathOnScreenMock,
        ).not.toHaveBeenCalled();
    });

    test('the foreground tab is on screen when any screen shows a foreground', async () => {
        mocks.getAllScreenManagersMock.mockReturnValue([
            { isShowingForeground: false },
            { isShowingForeground: false },
        ]);
        expect(await checkIsOnScreen('f', viewController)).toBe(false);

        mocks.getAllScreenManagersMock.mockReturnValue([
            { isShowingForeground: false },
            { isShowingForeground: true },
        ]);
        expect(await checkIsOnScreen('f', viewController)).toBe(true);
    });

    test('the Bible tab asks about the passages in the reader', async () => {
        mocks.checkIsBibleItemOnScreenMock.mockResolvedValue(true);

        expect(await checkIsOnScreen('b', viewController)).toBe(true);
        expect(mocks.checkIsBibleItemOnScreenMock).toHaveBeenCalledWith(
            viewController.straightBibleItems,
        );
    });

    test('any other tab is never on screen', async () => {
        expect(await checkIsOnScreen('x', viewController)).toBe(false);
        expect(mocks.getSelectedVaryAppDocumentMock).not.toHaveBeenCalled();
        expect(mocks.checkIsBibleItemOnScreenMock).not.toHaveBeenCalled();
    });
});
