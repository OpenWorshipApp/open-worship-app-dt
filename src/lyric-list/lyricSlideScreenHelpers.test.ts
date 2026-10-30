import { beforeEach, describe, expect, test, vi } from 'vitest';

// The screen's repair path: a lyric slide snapshot taken for one stage, shown
// on a screen set to another, is re-derived for the screen's stage. The stage
// resolver is stubbed (it is dynamic-imported only on that path), and so is
// `LyricSlide`, which this module reads one constant from.
const h = vi.hoisted(() => ({
    getLyricAppDocumentStageByStage: vi.fn(),
    getSlideById: vi.fn(),
}));

vi.mock('./lyricHelpers', () => ({
    getLyricAppDocumentStageByStage: h.getLyricAppDocumentStageByStage,
}));
vi.mock('./LyricSlide', () => ({ LYRIC_SLIDE_TYPE_KEY: 'lyric-slide' }));

import { getTargetLyricSlideItemData } from './lyricSlideScreenHelpers';

const FILE_PATH = '/songs/grace.owl';

function genSlideData(overrides: Record<string, unknown> = {}) {
    return {
        id: 4,
        canvasItems: [],
        metadata: { width: 1920, height: 1080 },
        type: 'lyric-slide',
        stage: 0,
        ...overrides,
    } as any;
}

beforeEach(() => {
    h.getLyricAppDocumentStageByStage.mockImplementation(
        (_filePath: string, stage: number) => [
            stage,
            { getSlideById: h.getSlideById },
        ],
    );
});

describe('getTargetLyricSlideItemData', () => {
    test('an ordinary slide, with no stage, passes straight through', async () => {
        const data = genSlideData({ type: 'slide', stage: undefined });
        await expect(
            getTargetLyricSlideItemData(FILE_PATH, data, 1),
        ).resolves.toBe(data);
        // The lyric helper graph is never even loaded for it.
        expect(h.getLyricAppDocumentStageByStage).not.toHaveBeenCalled();
    });

    test('a slide already on the wanted stage is the steady state', async () => {
        const data = genSlideData({ stage: 1 });
        await expect(
            getTargetLyricSlideItemData(FILE_PATH, data, 1),
        ).resolves.toBe(data);
        expect(h.getLyricAppDocumentStageByStage).not.toHaveBeenCalled();
    });

    test('a staged slide of another kind is left as it is', async () => {
        const data = genSlideData({ type: 'slide', stage: 0 });
        await expect(
            getTargetLyricSlideItemData(FILE_PATH, data, 1),
        ).resolves.toBe(data);
        expect(h.getLyricAppDocumentStageByStage).not.toHaveBeenCalled();
    });

    test('a stage-0 snapshot on a `St: 1` screen is re-derived for stage 1', async () => {
        const stage1Json = genSlideData({ stage: 1, name: 'with chords' });
        h.getSlideById.mockResolvedValue({ toJson: () => stage1Json });

        await expect(
            getTargetLyricSlideItemData(FILE_PATH, genSlideData(), 1),
        ).resolves.toBe(stage1Json);
        expect(h.getLyricAppDocumentStageByStage).toHaveBeenCalledWith(
            FILE_PATH,
            1,
        );
        expect(h.getSlideById).toHaveBeenCalledWith(4);
    });

    test('a slide the target stage no longer has keeps the snapshot', async () => {
        h.getSlideById.mockResolvedValue(null);
        const data = genSlideData();
        await expect(
            getTargetLyricSlideItemData(FILE_PATH, data, 2),
        ).resolves.toBe(data);
    });
});
