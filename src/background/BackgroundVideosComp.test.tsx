// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Videos tab: its tiles (a poster at rest, a player only under the
// pointer, the fade-at-end mark), its per-file menu and the download error
// paths. `backgroundDownloadFromUrl.test.tsx` holds the successful download.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        mediaProps: null as any,
        fadingMap: new Map<string, boolean>(),
        methodMap: {} as { [src: string]: (value: boolean) => void },
        previewProps: null as any,
        toastUpdates: [] as [string, string][],
        downloadArgs: null as any[] | null,
        isExtraBinMissing: false,
    },
    mocks: {
        setFading: vi.fn(),
        downloadVideoOrAudio: vi.fn(),
        fsMove: vi.fn(),
        handleError: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/FileSource', () => {
    // One instance per path, like the real cache: the tile's effect is
    // keyed by the instance.
    const cache = new Map<string, any>();
    return {
        default: {
            getInstance: (dirPathOrFilePath: string, fileName?: string) => {
                const filePath =
                    fileName === undefined
                        ? dirPathOrFilePath
                        : `${dirPathOrFilePath}/${fileName}`;
                if (!cache.has(filePath)) {
                    cache.set(filePath, {
                        src: `file:///${filePath}`,
                        fullName: filePath.split('/').at(-1),
                        genNextFilePath: async () => `${filePath}.1`,
                    });
                }
                return cache.get(filePath);
            },
        },
    };
});
vi.mock('./BackgroundMediaComp', () => ({
    default: (props: any) => {
        state.mediaProps = props;
        return (
            <div data-testid="grid">
                {props.topBarChild}
                {props.rendChild(
                    'videos/clip.mp4',
                    [
                        ['1', {}],
                        ['4', {}],
                    ],
                    160,
                    90,
                    <span data-extra-child />,
                )}
            </div>
        );
    },
}));
vi.mock('../helper/constants', () => ({
    defaultDataDirNames: { BACKGROUND_VIDEO: 'videos' },
    dirSourceSettingNames: { BACKGROUND_VIDEO: 'background-video' },
}));
vi.mock('./downloadHelper', () => ({
    genDownloadContextMenuItems: async (...args: any[]) => {
        state.downloadArgs = args;
        return [{ menuElement: 'Download From URL' }];
    },
    toDownloadFailureMessage: (message: string, error: any) =>
        `${message}: ${error.message}`,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('./VideoTilePreviewComp', () => ({
    HOVER_PLAY_DELAY: 200,
    default: (props: any) => {
        state.previewProps = props;
        return (
            <span data-preview={props.src}>
                {props.isHovering ? 'playing' : 'poster'}
            </span>
        );
    },
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.showProgressBar,
    hideProgressBar: mocks.hideProgressBar,
}));
vi.mock('../server/appHelpers', () => ({
    downloadVideoOrAudio: mocks.downloadVideoOrAudio,
    timeToTimeString: (seconds: number) => `${seconds}s`,
}));
vi.mock('../server/fileHelpers', () => ({
    fsMove: mocks.fsMove,
    getTempPath: () => '/os-temp',
}));
vi.mock('../toast/toastHelpers', () => ({
    createSimpleToastUpdater: () => (title: string, message: string) => {
        state.toastUpdates.push([title, message]);
    },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('./videoBackgroundHelpers', () => ({
    getIsFadingAtTheEndSetting: (src: string) =>
        state.fadingMap.get(src) ?? true,
    methodMapIsFadingAtTheEnd: state.methodMap,
    setIsFadingAtTheEndSetting: (src: string, value: boolean) => {
        mocks.setFading(src, value);
        state.fadingMap.set(src, value);
        state.methodMap[src]?.(value);
    },
}));
vi.mock('./RenderBackgroundScreenIdsComp', () => ({
    default: ({ screenIds }: { screenIds: number[] }) => (
        <span data-screen-ids={screenIds.join(',')} />
    ),
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: any) => ({
        activeId: 'session-a',
        element: <div data-testid="sessions" />,
        autoPlayPrefix: `${options.autoPlayPrefix}-a`,
        dirSourceSettingName: `${options.dirSourceSettingName}-a`,
    }),
}));
vi.mock('../helper/extra-bin/extraBinErrors', () => ({
    checkIsExtraBinMissingError: () => state.isExtraBinMissing,
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    BackgroundTransitionTileBadgeComp: ({ backgroundType, src }: any) => (
        <span data-badge={`${backgroundType}:${src}`} />
    ),
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition ${type}`, src },
    ],
}));

import BackgroundVideosComp from './BackgroundVideosComp';

const SRC = 'file:///videos/clip.mp4';
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.mediaProps = null;
    state.fadingMap.clear();
    for (const key of Object.keys(state.methodMap)) {
        delete state.methodMap[key];
    }
    state.previewProps = null;
    state.toastUpdates = [];
    state.downloadArgs = null;
    state.isExtraBinMissing = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(<BackgroundVideosComp />);
    });
}
function getTileBody() {
    return container.querySelector('.card-body') as HTMLElement;
}

describe('the Videos tab', () => {
    test('is its session’s media grid of video files', async () => {
        await render();
        expect(state.mediaProps).toMatchObject({
            autoPlayPrefix: 'background-video-a',
            defaultFolderName: 'videos',
            dragType: 'bg-video',
            dirSourceSettingName: 'background-video-a',
        });
        // The session strip sits in the grid's top bar.
        expect(
            container.querySelector(
                '[data-testid="grid"] [data-testid="sessions"]',
            ),
        ).not.toBeNull();
    });
});

describe('a video tile', () => {
    test('marks the screens it is on, its transition and its fade at the end', async () => {
        await render();
        const body = getTileBody();
        expect(body.style.height).toBe('90px');
        expect(
            (body.querySelector('[data-screen-ids]') as HTMLElement).dataset
                .screenIds,
        ).toBe('1,4');
        expect(
            (body.querySelector('[data-badge]') as HTMLElement).dataset.badge,
        ).toBe(`video:${SRC}`);
        expect(body.querySelector('[data-extra-child]')).not.toBeNull();
        const fadeIcon = body.querySelector('.bi-shadows') as HTMLElement;
        expect(fadeIcon.title).toBe(
            'Video will fade at the end while screen rendering.' +
                ' Use *.loop.[extension] file to force auto fading.',
        );
    });

    test('follows the fade setting while mounted, and lets go of it when unmounted', async () => {
        state.fadingMap.set(SRC, false);
        await render();
        expect(getTileBody().querySelector('.bi-shadows')).toBeNull();
        expect(Object.keys(state.methodMap)).toEqual([SRC]);
        await act(async () => state.methodMap[SRC](true));
        expect(getTileBody().querySelector('.bi-shadows')).not.toBeNull();
        await act(async () => root.render(null));
        expect(state.methodMap).toEqual({});
    });

    test('plays only after the pointer rests on it, and stops at once when it leaves', async () => {
        await render();
        const body = getTileBody();
        expect(state.previewProps.src).toBe(SRC);
        expect(body.textContent).toContain('poster');
        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(199);
        });
        expect(body.textContent).toContain('poster');
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(body.textContent).toContain('playing');
        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        expect(body.textContent).toContain('poster');
    });

    test('a pointer passing straight across starts no player', async () => {
        await render();
        const body = getTileBody();
        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(100);
            body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(body.textContent).toContain('poster');
    });

    test('names its length once the player has read it, and only once', async () => {
        await render();
        const body = getTileBody();
        expect(body.title).toBe('');
        await act(async () => state.previewProps.onDurationRead(42));
        expect(body.title).toBe('clip.mp4\n(42s)');
        await act(async () => state.previewProps.onDurationRead(7));
        expect(body.title).toBe('clip.mp4\n(42s)');
    });
});

describe('a video file’s own menu rows', () => {
    test('say which way the fade is set, toggle it, and offer its transition', async () => {
        await render();
        const genItems = state.mediaProps.genExtraItemContextMenuItems;
        let items = genItems('videos/clip.mp4');
        expect(items).toEqual([
            expect.objectContaining({
                childBefore: 'icon:magic',
                menuElement: 'Toggle Fading at End',
                childAfter: 'icon:check2-square',
                title: 'Whether this video fades out as it ends',
            }),
            { menuElement: 'Transition video', src: SRC },
        ]);
        await act(async () => items[0].onSelect());
        expect(mocks.setFading).toHaveBeenLastCalledWith(SRC, false);
        // The tile follows at once.
        expect(getTileBody().querySelector('.bi-shadows')).toBeNull();
        items = genItems('videos/clip.mp4');
        expect(items[0].childAfter).toBe('icon:square');
        await act(async () => items[0].onSelect());
        expect(mocks.setFading).toHaveBeenLastCalledWith(SRC, true);
    });
});

describe('Download From URL failures', () => {
    async function startDownload() {
        await render();
        const dirSource = { dirPath: '/data/videos' };
        await state.mediaProps.genContextMenuItems(dirSource);
        const [texts, passedDirSource, download, folderName] =
            state.downloadArgs!;
        expect(texts).toEqual({
            title: 'Download From URL',
            subTitle: 'Video URL:',
        });
        expect(passedDirSource).toBe(dirSource);
        expect(folderName).toBe('videos');
        await download('https://example.org/v');
    }

    test('a failed download is reported in the same toast, and the bar comes down', async () => {
        const error = new Error('HTTP 404');
        mocks.downloadVideoOrAudio.mockRejectedValueOnce(error);
        await startDownload();
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(state.toastUpdates).toEqual([
            [
                'Download From URL',
                'Error occurred during downloading video: HTTP 404',
            ],
        ]);
        expect(mocks.hideProgressBar).toHaveBeenCalledWith(
            'https://example.org/v',
        );
    });

    test('missing media tools are already a dialog: no toast on top of it', async () => {
        state.isExtraBinMissing = true;
        mocks.downloadVideoOrAudio.mockRejectedValueOnce(new Error('no bin'));
        await startDownload();
        expect(mocks.handleError).not.toHaveBeenCalled();
        expect(state.toastUpdates).toEqual([]);
        expect(mocks.hideProgressBar).toHaveBeenCalledWith(
            'https://example.org/v',
        );
    });

    test('a file that cannot be moved in is a failure too', async () => {
        mocks.downloadVideoOrAudio.mockImplementationOnce(
            async (
                _url: string,
                tempDir: string,
                isVideo: boolean,
                onStart: () => void,
            ) => {
                expect([tempDir, isVideo]).toEqual(['/os-temp', true]);
                onStart();
                return { filePath: '/os-temp/v.webm', fileFullName: 'v.webm' };
            },
        );
        mocks.fsMove.mockRejectedValueOnce(new Error('EPERM'));
        await startDownload();
        expect(mocks.showProgressBar).toHaveBeenCalledWith(
            'https://example.org/v',
        );
        expect(mocks.fsMove).toHaveBeenCalledWith(
            '/os-temp/v.webm',
            '/data/videos/v.webm.1',
        );
        expect(state.toastUpdates.map(([, message]) => message)).toEqual([
            'Downloading video from "https://example.org/v", please wait...',
            'Error occurred during downloading video: EPERM',
        ]);
    });
});
