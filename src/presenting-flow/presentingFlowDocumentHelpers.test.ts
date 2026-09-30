import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fsCheckFileExistMock: vi.fn(),
    getLyricAppDocumentStageByStageMock: vi.fn(),
    handleErrorMock: vi.fn(),
    varyAppDocumentFromFilePathMock: vi.fn(),
}));

vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsLyricFilePath: (filePath: string) => {
        return filePath.endsWith('.owl');
    },
    useSelectedAppDocumentSetterContext: vi.fn(),
    varyAppDocumentFromFilePath: mocks.varyAppDocumentFromFilePathMock,
}));

vi.mock('../app-document-presenter/presenterRendererHelpers', () => ({
    getIsShowingVaryAppDocumentPreviewer: vi.fn(),
}));

vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: {},
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: mocks.fsCheckFileExistMock,
}));

vi.mock('../lyric-list/lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: mocks.getLyricAppDocumentStageByStageMock,
}));

import {
    loadVaryAppDocument,
    loadVaryAppDocumentSlides,
} from './presentingFlowDocumentHelpers';

describe('run sheet document loading', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('a document the run sheet names but the disk lacks is not opened', async () => {
        mocks.fsCheckFileExistMock.mockResolvedValue(false);

        expect(await loadVaryAppDocument('/docs/a.ows')).toBeNull();
        expect(await loadVaryAppDocumentSlides('/docs/a.ows')).toBeNull();
        expect(await loadVaryAppDocument('/lyrics/gone.owl')).toBeNull();

        expect(mocks.varyAppDocumentFromFilePathMock).not.toHaveBeenCalled();
        expect(
            mocks.getLyricAppDocumentStageByStageMock,
        ).not.toHaveBeenCalled();
        expect(mocks.handleErrorMock).not.toHaveBeenCalled();
    });

    test('a document on disk is opened and its slides read', async () => {
        mocks.fsCheckFileExistMock.mockResolvedValue(true);
        const slides = [{ id: 1 }, { id: 2 }];
        const varyAppDocument = { getSlides: vi.fn(async () => slides) };
        mocks.varyAppDocumentFromFilePathMock.mockReturnValue(varyAppDocument);

        expect(await loadVaryAppDocument('/docs/b.ows')).toBe(varyAppDocument);
        expect(await loadVaryAppDocumentSlides('/docs/b.ows')).toBe(slides);
        expect(mocks.fsCheckFileExistMock).toHaveBeenCalledWith('/docs/b.ows');
    });
});
