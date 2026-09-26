// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: { exists: true, showing: false, opener: null as any },
    mocks: {
        setter: vi.fn(),
        fromPath: vi.fn(),
        show: vi.fn(),
        handleError: vi.fn(),
        lyricStage: vi.fn(),
    },
}));

vi.mock('../app-document-list/appDocumentHelpers', () => ({
    checkIsLyricFilePath: (path: string) => path.endsWith('.owl'),
    useSelectedAppDocumentSetterContext: () => mocks.setter,
    varyAppDocumentFromFilePath: mocks.fromPath,
}));
vi.mock('../app-document-presenter/presenterRendererHelpers', () => ({
    getIsShowingVaryAppDocumentPreviewer: () => state.showing,
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: { showVaryAppDocument: mocks.show },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../server/fileHelpers', () => ({
    fsCheckFileExist: async () => state.exists,
}));
vi.mock('../lyric-list/lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: mocks.lyricStage,
}));
vi.mock('../lyric-list/LyricAppDocument', () => ({}));

import {
    loadVaryAppDocument,
    loadVaryAppDocumentSlides,
    loadVarySlides,
    useVaryAppDocumentOpener,
} from './presentingFlowDocumentHelpers';

beforeEach(() => {
    vi.clearAllMocks();
    state.exists = true;
    state.showing = false;
    state.opener = null;
    mocks.setter.mockResolvedValue(true);
    mocks.fromPath.mockImplementation((path: string) => ({ path }));
});

describe('presenting-flow document behavior', () => {
    test('opens ordinary and lyric documents while respecting pin refusal and existing preview', async () => {
        function Harness() {
            state.opener = useVaryAppDocumentOpener();
            return null;
        }
        const root = createRoot(document.createElement('div'));
        await act(async () => root.render(<Harness />));
        await state.opener('/doc.ows');
        expect(mocks.setter).toHaveBeenCalledWith({ path: '/doc.ows' });
        expect(mocks.show).toHaveBeenCalledWith({ path: '/doc.ows' });

        mocks.setter.mockResolvedValueOnce(false);
        await state.opener('/refused.ows');
        expect(mocks.show).toHaveBeenCalledTimes(1);
        state.showing = true;
        await state.opener('/song.owl');
        expect(mocks.show).toHaveBeenCalledTimes(1);
        mocks.fromPath.mockImplementationOnce(() => {
            throw new Error('bad');
        });
        await state.opener('/bad.ows');
        expect(mocks.handleError).toHaveBeenCalled();
        await act(async () => root.unmount());
    });

    test('loads lyric stages, catches resolver errors, and reads slide failures', async () => {
        const lyricDocument = { getSlides: vi.fn(async () => [{ id: 1 }]) };
        mocks.lyricStage.mockReturnValue([2, lyricDocument]);
        expect(await loadVaryAppDocument('/song.owl', 2)).toBe(lyricDocument);
        expect(mocks.lyricStage).toHaveBeenCalledWith('/song.owl', 2);
        expect(await loadVarySlides(lyricDocument as any)).toEqual([{ id: 1 }]);
        expect(await loadVaryAppDocumentSlides('/song.owl')).toEqual([
            { id: 1 },
        ]);

        expect(
            await loadVarySlides({
                getSlides: async () => {
                    throw new Error('slides');
                },
            } as any),
        ).toBeNull();
        mocks.fromPath.mockImplementationOnce(() => {
            throw new Error('resolver');
        });
        expect(await loadVaryAppDocument('/bad.ows')).toBeNull();
        expect(mocks.handleError).toHaveBeenCalledTimes(2);
    });
});
