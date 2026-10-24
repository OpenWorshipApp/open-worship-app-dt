import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    getBackgroundSrcListByType: vi.fn(),
    getInstance: vi.fn(),
    initBackgroundSrcDim: vi.fn(),
    applyBackgroundSrcWithSyncGroup: vi.fn(),
    toDisplayedFilePaths: vi.fn(),
    getFileSource: vi.fn(),
}));

vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: {
        getBackgroundSrcListByType: h.getBackgroundSrcListByType,
        getInstance: h.getInstance,
        initBackgroundSrcDim: h.initBackgroundSrcDim,
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getFileSource },
}));
vi.mock('../others/fileListFilterHelpers', () => ({
    toDisplayedFilePaths: h.toDisplayedFilePaths,
}));
vi.mock('./BackgroundMediaComp', () => ({
    sortMediaFilePaths: (paths: string[]) => [...paths].sort(),
}));

import { DEFAULT_SLIDE_AUTO_PLAY_OPTIONS } from '../slide-auto-play/slideAutoPlayRuleHelpers';
import { handleNextBackgroundSelecting } from './backgroundAutoPlayHelpers';

const options = { ...DEFAULT_SLIDE_AUTO_PLAY_OPTIONS };

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    h.getBackgroundSrcListByType.mockReturnValue([]);
    h.getInstance.mockReturnValue({
        applyBackgroundSrcWithSyncGroup: h.applyBackgroundSrcWithSyncGroup,
    });
    h.initBackgroundSrcDim.mockImplementation(async (src: string) => ({
        src,
        scaleType: 'default',
        extraStyle: {},
    }));
    h.toDisplayedFilePaths.mockImplementation(
        (_setting: string, paths: string[]) => paths,
    );
    h.getFileSource.mockImplementation((filePath: string) => ({
        src: `url:${filePath}`,
    }));
});

afterEach(() => {
    vi.useRealTimers();
});

describe('background slide-show stepping', () => {
    it('advances each matching screen in grid order while carrying its fit', async () => {
        h.getBackgroundSrcListByType.mockReturnValue([
            [
                '1',
                { src: 'b', scaleType: 'cover', extraStyle: { opacity: 0.5 } },
            ],
            [
                '2',
                {
                    src: 'c',
                    scaleType: 'contain',
                    extraStyle: { opacity: 0.8 },
                },
            ],
            ['3', { src: 'outside', scaleType: 'fill', extraStyle: {} }],
        ]);
        expect(
            handleNextBackgroundSelecting({
                backgroundType: 'image',
                dirSourceSettingName: 'images',
                filePaths: [],
                isNext: true,
                options,
                orderedSrcList: ['a', 'b', 'c'],
            }),
        ).toBe(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(h.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith({
            src: 'c',
            scaleType: 'cover',
            extraStyle: { opacity: 0.5 },
        });
        await vi.advanceTimersByTimeAsync(100);
        expect(h.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith({
            src: 'a',
            scaleType: 'contain',
            extraStyle: { opacity: 0.8 },
        });
        expect(h.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledTimes(2);
        expect(h.getInstance).toHaveBeenNthCalledWith(1, 1);
        expect(h.getInstance).toHaveBeenNthCalledWith(2, 2);
    });

    it('leaves the last background up when no-repeat reaches the end', async () => {
        h.getBackgroundSrcListByType.mockReturnValue([
            ['1', { src: 'b', scaleType: 'cover', extraStyle: {} }],
        ]);
        expect(
            handleNextBackgroundSelecting({
                backgroundType: 'image',
                dirSourceSettingName: 'images',
                filePaths: [],
                isNext: true,
                options: { ...options, repeatKind: 'none' },
                orderedSrcList: ['a', 'b'],
            }),
        ).toBe(false);
        await vi.runAllTimersAsync();
        expect(h.applyBackgroundSrcWithSyncGroup).not.toHaveBeenCalled();
    });

    it('uses the displayed file order when no mixed URL list is supplied', async () => {
        h.getBackgroundSrcListByType.mockReturnValue([
            ['4', { src: 'url:b', scaleType: 'stretch', extraStyle: {} }],
        ]);
        h.toDisplayedFilePaths.mockReturnValue(['b', 'a']);
        expect(
            handleNextBackgroundSelecting({
                backgroundType: 'video',
                dirSourceSettingName: 'video-dir',
                filePaths: ['a', 'b'],
                isNext: false,
                options,
            }),
        ).toBe(true);
        expect(h.toDisplayedFilePaths).toHaveBeenCalledWith(
            'video-dir',
            ['a', 'b'],
            expect.any(Function),
        );
        await vi.runAllTimersAsync();
        expect(h.applyBackgroundSrcWithSyncGroup).toHaveBeenCalledWith({
            src: 'url:a',
            scaleType: 'stretch',
            extraStyle: {},
        });
    });

    it('does not apply a change to a screen that has closed', async () => {
        h.getBackgroundSrcListByType.mockReturnValue([
            ['1', { src: 'a', scaleType: 'cover', extraStyle: {} }],
        ]);
        h.getInstance.mockReturnValue(null);
        expect(
            handleNextBackgroundSelecting({
                backgroundType: 'image',
                dirSourceSettingName: 'images',
                filePaths: [],
                isNext: true,
                options,
                orderedSrcList: ['a', 'b'],
            }),
        ).toBe(true);
        await vi.runAllTimersAsync();
        expect(h.initBackgroundSrcDim).not.toHaveBeenCalled();
        expect(h.applyBackgroundSrcWithSyncGroup).not.toHaveBeenCalled();
    });

    it('does nothing without any visible tiles', () => {
        expect(
            handleNextBackgroundSelecting({
                backgroundType: 'image',
                dirSourceSettingName: 'images',
                filePaths: [],
                isNext: true,
                options,
                orderedSrcList: [],
            }),
        ).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });
});
