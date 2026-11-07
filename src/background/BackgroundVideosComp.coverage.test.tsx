// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Videos tab's own tile body and menus. The grid is mocked to draw the
// tab's `rendChild` for each file; the fade-at-the-end setting is the REAL
// helper over an in-memory setting store, so a toggle is seen to reach the
// tile that is on screen.
const h = vi.hoisted(() => ({
    filePaths: [] as string[],
    onScreen: {} as Record<string, string[]>,
    settingStore: {} as Record<string, string>,
    mediaProps: null as any,
    mediaMounts: 0,
    sessionOptions: null as any,
    session: { activeId: 'default' },
    previewProps: {} as Record<string, any>,
    toastUpdates: [] as [string, string][],
    downloadMenuArgs: null as any,
    downloadVideoOrAudio: vi.fn(),
    fsMove: vi.fn(),
    handleError: vi.fn(),
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));

vi.mock('./BackgroundMediaComp', async () => {
    const react = await import('react');
    return {
        default: (props: any) => {
            h.mediaProps = props;
            react.useEffect(() => {
                h.mediaMounts += 1;
            }, []);
            return (
                <div data-media-grid>
                    {props.topBarChild}
                    {h.filePaths.map((filePath) => (
                        <div key={filePath} data-tile={filePath}>
                            {props.rendChild(
                                filePath,
                                (h.onScreen[filePath] ?? []).map((key) => [
                                    key,
                                    {},
                                ]),
                                200,
                                112,
                                <span data-extra-child={filePath} />,
                            )}
                        </div>
                    ))}
                </div>
            );
        },
    };
});
vi.mock('../helper/SettingManager', () => ({
    default: class {
        settingName: string;
        defaultValue: unknown;
        serialize: (value: unknown) => string;
        deserialize: (value: string) => any;
        constructor(options: any) {
            this.settingName = options.settingName;
            this.defaultValue = options.defaultValue;
            this.serialize = options.serialize;
            this.deserialize = options.deserialize;
        }
        getSetting() {
            return this.deserialize(
                h.settingStore[this.settingName] ??
                    this.serialize(this.defaultValue),
            );
        }
        setSetting(value: unknown) {
            h.settingStore[this.settingName] = this.serialize(value);
        }
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (pathOrSrc: string, fileFullName?: string) => {
            const filePath =
                fileFullName === undefined
                    ? pathOrSrc
                    : `${pathOrSrc}/${fileFullName}`;
            const fullName = filePath.split('/').at(-1)!;
            return {
                filePath,
                src: filePath.startsWith('file://')
                    ? filePath
                    : `file://${filePath}`,
                fullName,
                name: fullName.replace(/\.[^.]+$/, ''),
                genNextFilePath: async () =>
                    filePath.replace(/(\.[^.]+)$/, ' (1)$1'),
            };
        },
    },
}));
vi.mock('./backgroundSessionHelpers', () => ({
    useBackgroundSessions: (options: unknown) => {
        h.sessionOptions = options;
        return {
            activeId: h.session.activeId,
            element: <span data-session-chips>{h.session.activeId}</span>,
            dirSourceSettingName: 'select-dir-video-bg',
            autoPlayPrefix: 'background-video',
        };
    },
}));
vi.mock('./VideoTilePreviewComp', () => ({
    HOVER_PLAY_DELAY: 120,
    default: ({ src, isHovering, onDurationRead }: any) => {
        h.previewProps[src] = { isHovering, onDurationRead };
        return <div data-preview={src} data-hovering={String(isHovering)} />;
    },
}));
vi.mock('./downloadHelper', () => ({
    genDownloadContextMenuItems: (
        texts: unknown,
        dirSource: unknown,
        download: (url: string) => Promise<void>,
        sharedKey: string,
    ) => {
        h.downloadMenuArgs = { texts, dirSource, download, sharedKey };
        return [{ menuElement: 'Download From URL' }];
    },
    toDownloadFailureMessage: (message: string, error: any) =>
        `${message}: ${error.message}`,
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    BackgroundTransitionTileBadgeComp: ({ backgroundType, src }: any) => (
        <i data-badge={`${backgroundType} ${src}`} />
    ),
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition (${type} ${src})` },
    ],
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <span data-screen-id={screenId} />
    ),
}));
vi.mock('../server/appHelpers', () => ({
    downloadVideoOrAudio: (...args: unknown[]) =>
        h.downloadVideoOrAudio(...args),
    timeToTimeString: (seconds: number) => `${seconds}s`,
}));
vi.mock('../server/fileHelpers', () => ({
    fsMove: (from: string, to: string) => h.fsMove(from, to),
    getTempPath: () => '/os-temp',
}));
vi.mock('../toast/toastHelpers', () => ({
    createSimpleToastUpdater: () => (title: string, message: string) => {
        h.toastUpdates.push([title, message]);
    },
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: (key: string) => h.showProgressBar(key),
    hideProgressBar: (key: string) => h.hideProgressBar(key),
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.handleError(error),
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import { EXTRA_BIN_MISSING_ERROR_MESSAGE } from '../helper/extra-bin/extraBinErrors';
import BackgroundVideosComp from './BackgroundVideosComp';
import { methodMapIsFadingAtTheEnd } from './videoBackgroundHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const INTRO = '/videos/intro.mp4';
const SNOW = '/videos/snow.loop.mp4';
const FADE_TITLE =
    'Video will fade at the end while screen rendering.' +
    ' Use *.loop.[extension] file to force auto fading.';

let host: HTMLDivElement;
let root: Root;

function tileBody(filePath: string) {
    return host.querySelector<HTMLElement>(
        `[data-tile="${filePath}"] > .card-body`,
    )!;
}

function isHovering(filePath: string) {
    return host
        .querySelector(`[data-preview="file://${filePath}"]`)
        ?.getAttribute('data-hovering');
}

async function renderTab() {
    await act(async () => root.render(<BackgroundVideosComp />));
}

beforeEach(() => {
    vi.useFakeTimers();
    h.filePaths = [INTRO, SNOW];
    h.onScreen = {};
    h.settingStore = {};
    h.mediaProps = null;
    h.mediaMounts = 0;
    h.sessionOptions = null;
    h.session = { activeId: 'default' };
    h.previewProps = {};
    h.toastUpdates = [];
    h.downloadMenuArgs = null;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('Videos tab', () => {
    test('hands the grid this tab’s folder, drag type and session, and remounts per session', async () => {
        await renderTab();
        expect(h.sessionOptions).toEqual({
            target: 'background-video',
            dirSourceSettingName: 'select-dir-video-bg',
            autoPlayPrefix: 'background-video',
        });
        expect(h.mediaProps).toMatchObject({
            defaultFolderName: 'videos',
            dragType: 'bg-video',
            dirSourceSettingName: 'select-dir-video-bg',
            autoPlayPrefix: 'background-video',
        });
        expect(host.querySelector('[data-session-chips]')).not.toBeNull();
        expect(h.mediaMounts).toBe(1);

        await renderTab();
        expect(h.mediaMounts).toBe(1);
        h.session = { activeId: 'session-2' };
        await renderTab();
        expect(h.mediaMounts).toBe(2);
    });

    test('a tile shows its screens, its still and the fade mark; a .loop file never fades', async () => {
        h.onScreen = { [INTRO]: ['1', '4'] };
        await renderTab();
        const intro = tileBody(INTRO);
        expect(intro.style.height).toBe('112px');
        expect(
            [...intro.querySelectorAll('[data-screen-id]')].map((element) =>
                element.getAttribute('data-screen-id'),
            ),
        ).toEqual(['1', '4']);
        expect(isHovering(INTRO)).toBe('false');
        expect(intro.querySelector('.bi-shadows')?.getAttribute('title')).toBe(
            FADE_TITLE,
        );
        expect(
            intro.querySelector('[data-badge]')?.getAttribute('data-badge'),
        ).toBe(`video file://${INTRO}`);
        expect(
            intro.querySelector(`[data-extra-child="${INTRO}"]`),
        ).not.toBeNull();

        const snow = tileBody(SNOW);
        expect(snow.querySelector('.bi-shadows')).toBeNull();
        expect(snow.querySelector('[data-screen-id]')).toBeNull();
    });

    test('a hovered tile plays after the delay, stops at once on leave, and a pass across starts nothing', async () => {
        await renderTab();
        const intro = tileBody(INTRO);
        await act(async () => {
            intro.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        expect(isHovering(INTRO)).toBe('false');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(119);
        });
        expect(isHovering(INTRO)).toBe('false');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(isHovering(INTRO)).toBe('true');

        await act(async () => {
            intro.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        expect(isHovering(INTRO)).toBe('false');

        // The mouse crosses this tile on its way somewhere else.
        await act(async () => {
            intro.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(50);
        });
        await act(async () => {
            intro.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(isHovering(INTRO)).toBe('false');
        // Each tile has its own delay: the neighbour was never touched.
        expect(isHovering(SNOW)).toBe('false');
    });

    test('the first duration read names the tile with its length, and only the first', async () => {
        await renderTab();
        const intro = tileBody(INTRO);
        expect(intro.title).toBe('');
        h.previewProps[`file://${INTRO}`].onDurationRead(65);
        expect(intro.title).toBe('intro.mp4\n(65s)');
        h.previewProps[`file://${INTRO}`].onDurationRead(99);
        expect(intro.title).toBe('intro.mp4\n(65s)');
    });

    test('Toggle Fading at End says which way it is set and flips the tile on screen', async () => {
        await renderTab();
        const items = h.mediaProps.genExtraItemContextMenuItems(INTRO);
        expect(items.map((item: any) => item.menuElement)).toEqual([
            'Toggle Fading at End',
            `Transition (video file://${INTRO})`,
        ]);
        expect(items[0]).toMatchObject({
            childBefore: 'icon:magic',
            childAfter: 'icon:check2-square',
            title: 'Whether this video fades out as it ends',
        });
        expect(
            h.mediaProps.genExtraItemContextMenuItems(SNOW)[0].childAfter,
        ).toBe('icon:square');

        await act(async () => items[0].onSelect());
        expect(tileBody(INTRO).querySelector('.bi-shadows')).toBeNull();
        expect(JSON.parse(h.settingStore['video-fading-at-the-end'])).toEqual({
            [`file://${INTRO}`]: false,
        });
        const reopened = h.mediaProps.genExtraItemContextMenuItems(INTRO);
        expect(reopened[0].childAfter).toBe('icon:square');

        await act(async () => reopened[0].onSelect());
        expect(tileBody(INTRO).querySelector('.bi-shadows')).not.toBeNull();

        // A tile that leaves the page stops listening for the switch.
        expect(Object.keys(methodMapIsFadingAtTheEnd)).toEqual(
            expect.arrayContaining([`file://${INTRO}`, `file://${SNOW}`]),
        );
        h.filePaths = [SNOW];
        await renderTab();
        expect(Object.keys(methodMapIsFadingAtTheEnd)).not.toContain(
            `file://${INTRO}`,
        );
    });

    test('a download that cannot start because the media pack is missing stays silent', async () => {
        await renderTab();
        const dirSource = { dirPath: '/data/videos' };
        expect(await h.mediaProps.genContextMenuItems(dirSource)).toEqual([
            { menuElement: 'Download From URL' },
        ]);
        expect(h.downloadMenuArgs).toMatchObject({
            texts: { title: 'Download From URL', subTitle: 'Video URL:' },
            dirSource,
            sharedKey: 'videos',
        });

        h.downloadVideoOrAudio.mockRejectedValue(
            new Error(EXTRA_BIN_MISSING_ERROR_MESSAGE),
        );
        await h.downloadMenuArgs.download('https://video.example/a');
        expect(h.downloadVideoOrAudio).toHaveBeenCalledWith(
            'https://video.example/a',
            '/os-temp',
            true,
            expect.any(Function),
        );
        // The pack's own dialog was the message: no failure toast on top.
        expect(h.handleError).not.toHaveBeenCalled();
        expect(h.toastUpdates).toEqual([]);
        expect(h.hideProgressBar).toHaveBeenCalledWith(
            'https://video.example/a',
        );
        expect(h.fsMove).not.toHaveBeenCalled();
    });

    test('a failed download is reported with its reason in the same toast', async () => {
        await renderTab();
        await h.mediaProps.genContextMenuItems({ dirPath: '/data/videos' });
        const error = new Error('HTTP Error 403: Forbidden');
        h.downloadVideoOrAudio.mockImplementation(
            async (
                _url: string,
                _dir: string,
                _isVideo: boolean,
                onStart: () => void,
            ) => {
                onStart();
                throw error;
            },
        );
        await h.downloadMenuArgs.download('https://video.example/b');
        expect(h.showProgressBar).toHaveBeenCalledWith(
            'https://video.example/b',
        );
        expect(h.handleError).toHaveBeenCalledWith(error);
        expect(h.toastUpdates).toEqual([
            [
                'Download From URL',
                'Downloading video from "https://video.example/b", please wait...',
            ],
            [
                'Download From URL',
                'Error occurred during downloading video: HTTP Error 403: Forbidden',
            ],
        ]);
        expect(h.hideProgressBar).toHaveBeenCalledWith(
            'https://video.example/b',
        );
    });

    test('a finished download is moved into the folder under a name not taken', async () => {
        await renderTab();
        await h.mediaProps.genContextMenuItems({ dirPath: '/data/videos' });
        h.downloadVideoOrAudio.mockResolvedValue({
            filePath: '/os-temp/clip.webm',
            fileFullName: 'clip.webm',
        });
        await h.downloadMenuArgs.download('https://video.example/c');
        expect(h.fsMove).toHaveBeenCalledWith(
            '/os-temp/clip.webm',
            '/data/videos/clip (1).webm',
        );
        expect(h.toastUpdates.at(-1)).toEqual([
            'Download From URL',
            'Video downloaded successfully, file path: "/data/videos/clip (1).webm"',
        ]);
    });
});
