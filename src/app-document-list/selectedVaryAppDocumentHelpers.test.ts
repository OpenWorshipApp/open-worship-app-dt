import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    getSelectedFilePathMock,
    getSelectedFilePathWithEnsureMock,
    setSelectedFilePathMock,
    getSettingMock,
    setSettingMock,
    removeSettingMock,
} = vi.hoisted(() => ({
    getSelectedFilePathMock: vi.fn(),
    getSelectedFilePathWithEnsureMock: vi.fn(),
    setSelectedFilePathMock: vi.fn(),
    getSettingMock: vi.fn(),
    setSettingMock: vi.fn(),
    removeSettingMock: vi.fn(),
}));

vi.mock('../others/selectedHelpers', () => ({
    getSelectedFilePath: getSelectedFilePathMock,
    getSelectedFilePathWithEnsure: getSelectedFilePathWithEnsureMock,
    setSelectedFilePath: setSelectedFilePathMock,
}));

// `settingHelpers` pulls in `appProvider`, which touches `document` at module
// scope and would kill this node-env suite on import.
vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    setSetting: setSettingMock,
    removeSetting: removeSettingMock,
}));

import {
    SELECTED_APP_DOCUMENT_SETTING_NAME,
    getSelectedVaryAppDocumentFilePath,
    getSelectedVaryAppDocumentFilePathWithEnsure,
    setSelectedVaryAppDocumentFilePath,
} from './selectedVaryAppDocumentHelpers';

const LEGACY_SELECTED_LYRIC_SETTING_NAME = 'selected-lyric';

// The migration runs at most once per module instance, so each case needs a
// fresh import.
async function importFresh() {
    vi.resetModules();
    return await import('./selectedVaryAppDocumentHelpers');
}

describe('selectedVaryAppDocumentHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSelectedFilePathMock.mockReturnValue('/docs/current.ows');
        getSelectedFilePathWithEnsureMock.mockResolvedValue(
            '/docs/current.ows',
        );
        getSettingMock.mockReturnValue(null);
    });

    test('reads the selected app document path', () => {
        expect(getSelectedVaryAppDocumentFilePath()).toBe('/docs/current.ows');
        expect(getSelectedFilePathMock).toHaveBeenCalledWith(
            SELECTED_APP_DOCUMENT_SETTING_NAME,
            'select-dir-app-document',
        );
    });

    test('ensures the selected app document path exists', async () => {
        await expect(
            getSelectedVaryAppDocumentFilePathWithEnsure(),
        ).resolves.toBe('/docs/current.ows');
        expect(getSelectedFilePathWithEnsureMock).toHaveBeenCalledWith(
            SELECTED_APP_DOCUMENT_SETTING_NAME,
            'select-dir-app-document',
        );
    });

    test('writes the selected app document path', () => {
        setSelectedVaryAppDocumentFilePath('/docs/other.ows');
        setSelectedVaryAppDocumentFilePath(null);

        expect(setSelectedFilePathMock).toHaveBeenNthCalledWith(
            1,
            SELECTED_APP_DOCUMENT_SETTING_NAME,
            'select-dir-app-document',
            '/docs/other.ows',
        );
        expect(setSelectedFilePathMock).toHaveBeenNthCalledWith(
            2,
            SELECTED_APP_DOCUMENT_SETTING_NAME,
            'select-dir-app-document',
            null,
        );
    });

    describe('legacy lyric selection migration', () => {
        test('promotes the lyric selection when nothing else is selected', async () => {
            getSettingMock.mockImplementation((key: string) => {
                return key === LEGACY_SELECTED_LYRIC_SETTING_NAME
                    ? 'song.owl'
                    : null;
            });

            const helpers = await importFresh();
            helpers.getSelectedVaryAppDocumentFilePath();

            expect(setSettingMock).toHaveBeenCalledWith(
                SELECTED_APP_DOCUMENT_SETTING_NAME,
                'song.owl',
            );
            expect(removeSettingMock).toHaveBeenCalledWith(
                LEGACY_SELECTED_LYRIC_SETTING_NAME,
            );
        });

        test('keeps an existing document selection', async () => {
            getSettingMock.mockImplementation((key: string) => {
                return key === LEGACY_SELECTED_LYRIC_SETTING_NAME
                    ? 'song.owl'
                    : 'deck.ows';
            });

            const helpers = await importFresh();
            helpers.getSelectedVaryAppDocumentFilePath();

            expect(setSettingMock).not.toHaveBeenCalled();
            expect(removeSettingMock).toHaveBeenCalledWith(
                LEGACY_SELECTED_LYRIC_SETTING_NAME,
            );
        });

        test('runs only once and does nothing without a legacy value', async () => {
            const helpers = await importFresh();
            helpers.getSelectedVaryAppDocumentFilePath();
            await helpers.getSelectedVaryAppDocumentFilePathWithEnsure();

            expect(setSettingMock).not.toHaveBeenCalled();
            expect(removeSettingMock).not.toHaveBeenCalled();
            expect(
                getSettingMock.mock.calls.filter(([key]) => {
                    return key === LEGACY_SELECTED_LYRIC_SETTING_NAME;
                }),
            ).toHaveLength(1);
        });
    });
});
