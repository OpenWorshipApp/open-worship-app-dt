// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    shown: [] as [string, { src: string }][],
    files: [] as string[],
    options: {
        seconds: 4,
        maxSeconds: 0,
        repeatKind: 'all',
        step: 1,
        isUntilMediaEnd: false,
    },
    playing: true,
    controlProps: null as null | Record<string, any>,
    runners: vi.fn(),
    next: vi.fn(),
    duration: vi.fn(),
    setPlaying: vi.fn(),
    notify: vi.fn(),
    genDelay: vi.fn(),
    webDisplayed: vi.fn(),
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: () => undefined,
}));
vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    default: { getBackgroundSrcListByType: () => state.shown },
}));
vi.mock('../helper/DirSource', () => ({
    default: {
        getInstance: async () => ({ getFilePaths: async () => state.files }),
    },
}));
vi.mock('../helper/videoDurationHelpers', () => ({
    getVideoDurationSeconds: state.duration,
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    applyAutoPlayRunners: state.runners,
}));
vi.mock('../slide-auto-play/SlideAutoPlayComp', () => ({
    default: (props: Record<string, any>) => {
        state.controlProps = props;
        return <div data-testid="auto-play-control" />;
    },
}));
vi.mock('../slide-auto-play/slideAutoPlayHelpers', () => ({
    checkIsSlideAutoPlaying: () => state.playing,
    genNextDelaySeconds: state.genDelay,
    notifySlideAutoPlayStateChanged: state.notify,
    readSlideAutoPlayOptions: () => state.options,
    setIsSlideAutoPlaying: state.setPlaying,
}));
vi.mock('./backgroundAutoPlayHelpers', () => ({
    handleNextBackgroundSelecting: state.next,
}));
vi.mock('./backgroundWebCompHelpers', () => ({
    genBackgroundWebDisplayedSrcList: state.webDisplayed,
}));
vi.mock('./backgroundWebUrlHelpers', () => ({
    getBackgroundWebUrlItemList: () => [{ url: 'https://example.test' }],
    createBackgroundWebUrlSourceList: () => [{ src: 'https://example.test' }],
}));

import BackgroundAutoPlayComp from './BackgroundAutoPlayComp';

let host: HTMLDivElement;
let root: Root;

function latestRunner() {
    return state.runners.mock.lastCall![0][0] as {
        key: string;
        signature: string;
        getDelaySeconds: () => Promise<number>;
        tick: () => Promise<boolean>;
        onEnded: () => void;
    };
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.shown = [['1', { src: 'video.mp4' }]];
    state.files = ['/media/one.mp4'];
    state.options = {
        seconds: 4,
        maxSeconds: 0,
        repeatKind: 'all',
        step: 1,
        isUntilMediaEnd: false,
    };
    state.playing = true;
    state.controlProps = null;
    state.runners.mockReset();
    state.next.mockReset().mockResolvedValue(true);
    state.duration.mockReset().mockResolvedValue(12);
    state.setPlaying.mockReset();
    state.notify.mockReset();
    state.genDelay.mockReset().mockReturnValue(4);
    state.webDisplayed.mockReset().mockReturnValue([]);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('background auto-play control', () => {
    it('runs only a showing, enabled list and scopes reconciliation to its prefix', async () => {
        await act(async () =>
            root.render(
                <BackgroundAutoPlayComp
                    prefix="background-image"
                    backgroundType="image"
                    dirSourceSettingName="select-dir-images"
                />,
            ),
        );
        const runner = latestRunner();
        expect(runner.key).toBe('background-image');
        expect(runner.signature).toBe('4:0:all:1:false');
        expect(await runner.getDelaySeconds()).toBe(4);
        expect(await runner.tick()).toBe(true);
        expect(state.next).toHaveBeenCalledWith({
            backgroundType: 'image',
            dirSourceSettingName: 'select-dir-images',
            filePaths: ['/media/one.mp4'],
            isNext: true,
            options: state.options,
            orderedSrcList: undefined,
        });
        expect(state.runners.mock.lastCall![1]('background-image')).toBe(true);
        expect(state.runners.mock.lastCall![1]('background-video')).toBe(false);
        runner.onEnded();
        expect(state.setPlaying).toHaveBeenCalledWith(
            'background-image',
            false,
        );
        expect(state.notify).toHaveBeenCalledOnce();
        expect(state.controlProps).toMatchObject({
            prefix: 'background-image',
            isTimerExternal: true,
            isInline: true,
            canUntilMediaEnd: false,
        });

        state.playing = false;
        state.controlProps!.onStateChange();
        expect(state.runners.mock.lastCall![0]).toEqual([]);
        state.playing = true;
        state.shown = [];
        state.controlProps!.onStateChange();
        expect(state.runners.mock.lastCall![0]).toEqual([]);
    });

    it('uses saved URL order for web shows, including a folder with no files', async () => {
        state.files = [];
        state.webDisplayed.mockReturnValue([{ src: 'https://example.test' }]);
        await act(async () =>
            root.render(
                <BackgroundAutoPlayComp
                    prefix="background-web"
                    backgroundType="web"
                    dirSourceSettingName="select-dir-web"
                />,
            ),
        );
        expect(await latestRunner().tick()).toBe(true);
        expect(state.webDisplayed).toHaveBeenCalledWith(
            [],
            [{ src: 'https://example.test' }],
        );
        expect(state.next.mock.lastCall![0]).toMatchObject({
            orderedSrcList: [{ src: 'https://example.test' }],
        });

        state.webDisplayed.mockReturnValue([]);
        expect(await state.controlProps!.onNext()).toBe(false);
        expect(state.next).toHaveBeenCalledTimes(1);
    });

    it('waits for a video duration and falls back when the clip is unavailable', async () => {
        state.options = { ...state.options, seconds: 0, isUntilMediaEnd: true };
        await act(async () =>
            root.render(
                <BackgroundAutoPlayComp
                    prefix="background-video"
                    backgroundType="video"
                    dirSourceSettingName="select-dir-videos"
                />,
            ),
        );
        expect(state.controlProps!.canUntilMediaEnd).toBe(true);
        expect(await latestRunner().getDelaySeconds()).toBe(12);
        expect(state.duration).toHaveBeenCalledWith('video.mp4');
        state.duration.mockResolvedValue(null);
        expect(await latestRunner().getDelaySeconds()).toBe(4);
        state.shown = [];
        expect(await latestRunner().getDelaySeconds()).toBe(4);
    });
});
