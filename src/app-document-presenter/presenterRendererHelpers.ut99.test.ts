import { beforeEach, describe, expect, test, vi } from 'vitest';

// Which presenter tab is open, and whether what a tab shows is on a screen.
// Every collaborator is mocked, so no module here reaches the app provider.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        screenManagers: [] as { isShowingForeground: boolean }[],
    },
    mocks: {
        getSelected: vi.fn(),
        checkFileOnScreen: vi.fn(),
        checkBibleOnScreen: vi.fn(),
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => state.settings.get(key) ?? null,
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    getSelectedVaryAppDocument: mocks.getSelected,
    checkIsVaryAppDocumentFilePathOnScreen: mocks.checkFileOnScreen,
}));
vi.mock('../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => state.screenManagers,
}));
vi.mock('../bible-list/bibleHelpers', () => ({
    checkIsBibleItemOnScreen: mocks.checkBibleOnScreen,
}));

import {
    PRESENT_FOREGROUND_FLOATING_SETTING_NAME,
    PRESENT_TAB_SETTING_NAME,
    checkIsOnScreen,
    getIsShowingVaryAppDocumentPreviewer,
} from './presenterRendererHelpers';

const viewController = {
    straightBibleItems: [{ id: 'John 3:16' }],
} as any;

beforeEach(() => {
    state.settings.clear();
    state.screenManagers = [];
});

describe('presenterRendererHelpers', () => {
    test('names its settings', () => {
        expect(PRESENT_TAB_SETTING_NAME).toBe('presenter-tab');
        expect(PRESENT_FOREGROUND_FLOATING_SETTING_NAME).toBe(
            'presenter-foreground-floating',
        );
    });

    test.each([
        [null, false],
        ['b', false],
        ['d', true],
        // Every open tab's key concatenated: membership, not equality.
        ['bdf', true],
    ])('documents tab open for tab setting %j: %s', (value, expected) => {
        if (value !== null) {
            state.settings.set('presenter-tab', value);
        }
        expect(getIsShowingVaryAppDocumentPreviewer()).toBe(expected);
    });

    test('the documents tab is on screen when its selected file is', async () => {
        mocks.getSelected.mockResolvedValue(null);
        await expect(checkIsOnScreen('d', viewController)).resolves.toBe(false);
        expect(mocks.checkFileOnScreen).not.toHaveBeenCalled();

        mocks.getSelected.mockResolvedValue({ filePath: '/lyrics/song.owl' });
        mocks.checkFileOnScreen.mockResolvedValue(true);
        await expect(checkIsOnScreen('d', viewController)).resolves.toBe(true);
        expect(mocks.checkFileOnScreen).toHaveBeenCalledExactlyOnceWith(
            '/lyrics/song.owl',
        );
        mocks.checkFileOnScreen.mockResolvedValue(false);
        await expect(checkIsOnScreen('d', viewController)).resolves.toBe(false);
    });

    test('the foreground tab is on screen while any screen shows a foreground', async () => {
        await expect(checkIsOnScreen('f', viewController)).resolves.toBe(false);
        state.screenManagers = [
            { isShowingForeground: false },
            { isShowingForeground: false },
        ];
        await expect(checkIsOnScreen('f', viewController)).resolves.toBe(false);
        state.screenManagers[1].isShowingForeground = true;
        await expect(checkIsOnScreen('f', viewController)).resolves.toBe(true);
    });

    test('the bibles tab asks about the passages it is showing', async () => {
        mocks.checkBibleOnScreen.mockResolvedValue(true);
        await expect(checkIsOnScreen('b', viewController)).resolves.toBe(true);
        expect(mocks.checkBibleOnScreen).toHaveBeenCalledExactlyOnceWith(
            viewController.straightBibleItems,
        );
    });

    test('any other tab is never on screen', async () => {
        await expect(checkIsOnScreen('x', viewController)).resolves.toBe(false);
        expect(mocks.getSelected).not.toHaveBeenCalled();
        expect(mocks.checkBibleOnScreen).not.toHaveBeenCalled();
    });
});
