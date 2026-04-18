import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    getSelectedFilePathMock,
    getSelectedFilePathWithEnsureMock,
    setSelectedFilePathMock,
} = vi.hoisted(() => ({
    getSelectedFilePathMock: vi.fn(),
    getSelectedFilePathWithEnsureMock: vi.fn(),
    setSelectedFilePathMock: vi.fn(),
}));

vi.mock('../others/selectedHelpers', () => ({
    getSelectedFilePath: getSelectedFilePathMock,
    getSelectedFilePathWithEnsure: getSelectedFilePathWithEnsureMock,
    setSelectedFilePath: setSelectedFilePathMock,
}));

import {
    SELECTED_APP_DOCUMENT_SETTING_NAME,
    getSelectedVaryAppDocumentFilePath,
    getSelectedVaryAppDocumentFilePathWithEnsure,
    setSelectedVaryAppDocumentFilePath,
} from './selectedVaryAppDocumentHelpers';

describe('selectedVaryAppDocumentHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSelectedFilePathMock.mockReturnValue('/docs/current.ows');
        getSelectedFilePathWithEnsureMock.mockResolvedValue(
            '/docs/current.ows',
        );
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
});
