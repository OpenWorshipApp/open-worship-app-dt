// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        appDocumentAudioData: null as any,
        audioPlaying: false,
        fileMetaType: null as string | null,
        mediaProps: null as any,
        posterDataUrl: null as string | null,
        sessionOptions: null as any,
    },
    mocks: {
        repeatSetter: vi.fn(),
        playMediaElement: vi.fn(),
        releaseMediaElementWhenDetached: vi.fn(),
        showAudioPlayingToast: vi.fn(),
        showSimpleToast: vi.fn(),
    },
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (_dirPathOrFilePath: string, fileName?: string) => {
            const filePath = fileName ?? _dirPathOrFilePath;
            return {
                src: `file:///${filePath}`,
                name: filePath.split(/[\\/]/).at(-1),
                fullName: filePath.split(/[\\/]/).at(-1),
                filePath,
                genNextFilePath: async () => `${filePath}.1`,
            };
        },
    },
}));

vi.mock('./BackgroundMediaComp', () => ({
    default: (props: any) => {
        state.mediaProps = props;
        const filePath = 'music/track.mp3';
        return (
            <div>
                <div
                    data-testid="audio-row"
                    data-file-item-file-src="file:///music/track.mp3"
                    onClick={props.onClick}
                >
                    <button data-testid="track-name">Morning song</button>
                    {props.rendChild(filePath, [], 300, 100)}
                </div>
                <button data-testid="outside-row">Outside the row</button>
            </div>
        );
    },
}));

vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { BACKGROUND_AUDIO: 'audios' },
    dirSourceSettingNames: { BACKGROUND_AUDIO: 'background-audios' },
}));
vi.mock('../helper/mediaControlHelpers', () => ({
    checkAudioPlaying: () => state.audioPlaying,
    showAudioPlayingToast: mocks.showAudioPlayingToast,
    handleAudioPlaying: vi.fn(),
    handleAudioPausing: vi.fn(),
    handleAudioEnding: vi.fn(),
}));
vi.mock('../helper/settingHelpers', () => ({
    useStateSettingBoolean: () => [false, mocks.repeatSetter],
    useStateSettingString: (_name: string, defaultValue: string) => [
        defaultValue,
        vi.fn(),
    ],
}));
vi.mock('../helper/appHooks', () => ({
    useAppCurrentRef: (target: unknown) => ({ current: target }),
    useAppEffect: () => {},
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: vi.fn(),
}));
vi.mock('../helper/extra-bin/extraBinErrors', () => ({
    checkIsExtraBinMissingError: () => false,
}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { generateMD5: () => 'track-hash' } },
}));
vi.mock('../server/fileHelpers', () => ({
    getFileMetaData: () =>
        state.fileMetaType === null
            ? null
            : { appMimetype: { mimetypeName: state.fileMetaType } },
    fsMove: vi.fn(),
    getTempPath: () => 'C:/temp',
}));
vi.mock('../server/appHelpers', () => ({
    downloadVideoOrAudio: vi.fn(),
}));
vi.mock('../server/updatingAppHelpers', () => ({
    checkIsVersionOutdated: () => false,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (label: string) => ({ widgetName: label }),
}));
vi.mock('../toast/toastHelpers', () => ({
    createSimpleToastUpdater: () => vi.fn(),
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));
vi.mock('./downloadHelper', () => ({
    genDownloadContextMenuItems: () => [],
    toDownloadFailureMessage: () => 'Download failed',
}));
vi.mock('./VaryAppDocumentAudiosComp', () => ({
    default: () => <div>Document audio</div>,
}));
vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: () => <div>Resize actor</div>,
}));
vi.mock('./backgroundHelpers', () => ({
    useAppDocumentAudioData: () => state.appDocumentAudioData,
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: any) => {
        state.sessionOptions = options;
        return {
            activeId: 'session-1',
            element: <div>Session chips</div>,
            dirSourceSettingName: 'background-audios',
        };
    },
}));
vi.mock('../helper/mediaHelpers', () => ({
    playMediaElement: mocks.playMediaElement,
    releaseMediaElementWhenDetached: mocks.releaseMediaElementWhenDetached,
}));
vi.mock('./videoPosterHelpers', () => ({
    useVideoPoster: () => state.posterDataUrl,
}));

import BackgroundAudiosComp from './BackgroundAudiosComp';
import BackgroundViewModeComp from './BackgroundViewModeComp';
import VideoTilePreviewComp from './VideoTilePreviewComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    state.appDocumentAudioData = null;
    state.audioPlaying = false;
    state.fileMetaType = null;
    state.mediaProps = null;
    state.posterDataUrl = null;
    state.sessionOptions = null;
    mocks.repeatSetter.mockClear();
    mocks.playMediaElement.mockClear();
    mocks.releaseMediaElementWhenDetached.mockClear();
    mocks.showAudioPlayingToast.mockClear();
    mocks.showSimpleToast.mockClear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

test('audio rows expand into persistent full controls and keep row clicks distinct', async () => {
    await act(async () => root.render(<BackgroundAudiosComp />));
    expect(host.querySelector('audio')).toBeNull();
    expect(state.mediaProps).toMatchObject({
        defaultFolderName: 'audios',
        extraMimetypeNames: ['video'],
        isNameOnTop: true,
        isSingleColumn: true,
        isVirtualizationEnabled: false,
        shouldHideFooter: true,
    });

    await act(async () => {
        (
            host.querySelector('[data-testid="track-name"]') as HTMLElement
        ).click();
    });
    const audio = host.querySelector('audio') as HTMLAudioElement;
    expect(audio).not.toBeNull();
    expect(audio.preload).toBe('none');
    expect(audio.controls).toBe(true);
    const repeatButton = host.querySelector('[role="button"]') as HTMLElement;
    expect(repeatButton.getAttribute('aria-label')).toBe(
        'Repeat this audio: track.mp3',
    );
    expect(repeatButton.getAttribute('aria-pressed')).toBe('false');

    await act(async () => audio.click());
    expect(host.querySelector('audio')).toBe(audio);
    await act(async () => repeatButton.click());
    expect(mocks.repeatSetter).toHaveBeenCalledWith(true);
    expect(host.querySelector('audio')).toBe(audio);

    Object.defineProperty(audio, 'paused', {
        configurable: true,
        value: false,
    });
    await act(async () => {
        (
            host.querySelector('[data-testid="track-name"]') as HTMLElement
        ).click();
    });
    expect(mocks.showAudioPlayingToast).toHaveBeenCalledOnce();
    expect(host.querySelector('audio')).toBe(audio);

    await act(async () => {
        (
            host.querySelector('[data-testid="outside-row"]') as HTMLElement
        ).click();
    });
    expect(host.querySelector('audio')).toBe(audio);
});

test('session changes are refused while audio plays and allowed after it stops', async () => {
    await act(async () => root.render(<BackgroundAudiosComp />));
    expect(state.sessionOptions.target).toBe('background-audio');
    expect(state.sessionOptions.checkCanChangeSession()).toBe(true);

    state.audioPlaying = true;
    expect(state.sessionOptions.checkCanChangeSession()).toBe(false);
    expect(mocks.showSimpleToast).toHaveBeenCalledWith(
        'Audio playing',
        'Please stop the audio before switching session.',
    );

    state.audioPlaying = false;
    expect(state.sessionOptions.checkCanChangeSession()).toBe(true);
});

test('video files in the audio list carry the video marker and inactive rows stay collapsed', async () => {
    state.fileMetaType = 'video';
    await act(async () => root.render(<BackgroundAudiosComp />));
    expect(host.querySelector('.bi-film')).not.toBeNull();
    expect(host.querySelector('audio')).toBeNull();
});

test('video tiles show a poster at rest and release the player after hover', async () => {
    const onDurationRead = vi.fn();
    await act(async () =>
        root.render(
            <VideoTilePreviewComp
                src="file:///clip.mp4"
                isHovering={false}
                onDurationRead={onDurationRead}
            />,
        ),
    );
    expect(host.querySelector('video')).toBeNull();
    expect(host.querySelector('img')).toBeNull();

    state.posterDataUrl = 'data:image/png;base64,poster';
    await act(async () =>
        root.render(
            <VideoTilePreviewComp
                src="file:///clip.mp4"
                isHovering={false}
                onDurationRead={onDurationRead}
            />,
        ),
    );
    const poster = host.querySelector('img') as HTMLImageElement;
    expect(poster.src).toBe('data:image/png;base64,poster');
    expect(poster.alt).toBe('');
    expect(poster.draggable).toBe(false);

    await act(async () =>
        root.render(
            <VideoTilePreviewComp
                src="file:///clip.mp4"
                isHovering={true}
                onDurationRead={onDurationRead}
            />,
        ),
    );
    const player = host.querySelector('video') as HTMLVideoElement;
    expect(player.src).toBe('file:///clip.mp4');
    expect(player.poster).toBe('data:image/png;base64,poster');
    expect(player.loop).toBe(true);
    expect(player.muted).toBe(true);
    expect(mocks.playMediaElement).toHaveBeenCalledWith(player);

    Object.defineProperty(player, 'duration', {
        configurable: true,
        value: 42,
    });
    await act(async () => {
        player.dispatchEvent(new Event('loadedmetadata', { bubbles: true }));
    });
    expect(onDurationRead).toHaveBeenCalledWith(42);

    await act(async () => root.render(null));
    expect(mocks.releaseMediaElementWhenDetached).toHaveBeenCalledWith(player);
});

test('view-mode buttons expose and change the active mode', async () => {
    const setViewMode = vi.fn();
    await act(async () =>
        root.render(
            <BackgroundViewModeComp
                viewMode="thumbnail"
                setViewMode={setViewMode}
            />,
        ),
    );
    const gridButton = host.querySelector(
        '[title="Thumbnail View"]',
    ) as HTMLButtonElement;
    const listButton = host.querySelector(
        '[title="List View"]',
    ) as HTMLButtonElement;
    expect(gridButton.disabled).toBe(true);
    expect(listButton.disabled).toBe(false);
    await act(async () => listButton.click());
    expect(setViewMode).toHaveBeenCalledWith('list');

    await act(async () =>
        root.render(
            <BackgroundViewModeComp
                viewMode="list"
                setViewMode={setViewMode}
            />,
        ),
    );
    expect(
        (host.querySelector('[title="List View"]') as HTMLButtonElement)
            .disabled,
    ).toBe(true);
});
