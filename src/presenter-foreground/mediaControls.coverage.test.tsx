// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { extractDictionary } from '../../tools/owa-devtools-mcp/tran.mjs';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        files: ['/b.png', '/a.png'] as string[] | null,
        displayedFiles: null as string[] | null,
        activeId: 'a',
        sessions: new Map<string, any[]>(),
        screens: [] as [number, any][],
        grids: new Map<string, any>(),
        sessionProps: new Map<string, any>(),
        props: new Map<string, any>(),
        runners: [] as any[],
        dropManager: null as any,
        dragStore: { onDropped: null as any },
        sound: { isSoundOn: false, soundVolume: 40 },
        dictionaries: [] as Record<string, string>[],
        dirFiles: ['/b.png', '/a.png'] as string[] | null,
    },
    mocks: {
        setData: vi.fn(),
        setList: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        manager: vi.fn(),
        removeSession: vi.fn(),
        drag: vi.fn(),
        displayOrder: vi.fn(),
        reconcile: vi.fn(),
        videoDuration: vi.fn(),
        dir: vi.fn(),
        persist: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined)
                throw new Error(`Missing translation: ${key}`);
        }
        return key;
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useRef, useEffect } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: any) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
        mocks.persist(name, value);
    },
}));
vi.mock('../helper/helpers', () => ({
    HIGHLIGHT_SELECTED_CLASSNAME: 'selected',
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            src: `file://${filePath}`,
            name: filePath.split('/').at(-1),
            fullName: filePath.split('/').at(-1),
        }),
    },
}));
vi.mock('../helper/DirSource', () => ({ default: { getInstance: mocks.dir } }));
vi.mock('../helper/dragHelpers', () => ({
    dragStore: state.dragStore,
    handleDragStart: mocks.drag,
}));
vi.mock('./foregroundDragHelpers', () => ({
    genForegroundDragInf: (kind: string, getData: () => unknown) => ({
        kind,
        getData,
    }),
}));
vi.mock('../helper/dirSourceHelpers', async () => {
    const { createContext } = await import('react');
    return { FilePathLoadedContext: createContext<any>(null) };
});
vi.mock('../background/backgroundHelpers', () => ({
    backgroundTypeMapper: {
        'bg-video': 'video',
        'bg-image': 'image',
        'bg-web': 'web',
    },
}));
vi.mock('../background/BackgroundMediaComp', async () => {
    const { useContext, useEffect } = await import('react');
    const { FilePathLoadedContext } =
        await import('../helper/dirSourceHelpers');
    return {
        sortMediaFilePaths: (files: string[]) => files.slice().sort(),
        default: (props: any) => {
            const context = useContext<any>(FilePathLoadedContext);
            state.grids.set(props.dragType, props);
            useEffect(() => {
                context.onLoaded(state.files);
            }, [state.files]);
            props.useLayerEvents();
            return (
                <div data-layer-marker={props.genLayerMarker()}>
                    {(state.files ?? []).map((path) => {
                        const data = props.genItemData(path, props.dragType);
                        return (
                            <button
                                key={path}
                                data-media-path={path}
                                title={data.title}
                                className={data.selectedCN}
                                onClick={data.handleSelecting}
                                onContextMenu={(event) =>
                                    data.handleSelecting(event, true)
                                }
                                draggable
                                onDragStart={data.handleDragStart}
                            >
                                {props.rendChild(
                                    path,
                                    data.selectedBackgroundSrcList,
                                    100,
                                    60,
                                    <span>Tile extra</span>,
                                )}
                            </button>
                        );
                    })}
                </div>
            );
        },
    };
});
vi.mock('../background/RenderBackgroundScreenIdsComp', () => ({
    default: ({ screenIds }: any) => (
        <span data-screen-ids={screenIds.join(',')} />
    ),
}));
vi.mock('../background/VideoTilePreviewComp', () => ({
    HOVER_PLAY_DELAY: 200,
    default: ({ src, isHovering }: any) => (
        <span data-video-src={src}>{isHovering ? 'playing' : 'poster'}</span>
    ),
}));
vi.mock('../background/BackgroundWebChildComp', () => ({
    RenderWebChildComp: ({ fileOrUrlSource }: any) => (
        <span data-web-name={fileOrUrlSource.fullName} />
    ),
}));
vi.mock('../slide-auto-play/SlideAutoPlayComp', () => ({
    default: ({ onNext, onStateChange }: any) => (
        <>
            <button
                onClick={() =>
                    onNext({
                        isNext: true,
                        options: {
                            seconds: 5,
                            maxSeconds: 0,
                            repeatKind: 'all',
                            step: 1,
                            isUntilMediaEnd: false,
                        },
                    })
                }
            >
                Next media
            </button>
            <button onClick={onStateChange}>Refresh play state</button>
        </>
    ),
}));
vi.mock('../others/fileListFilterHelpers', () => ({
    toDisplayedFilePaths: mocks.displayOrder,
}));
vi.mock('../slide-auto-play/autoPlayRunnerHelpers', () => ({
    applyAutoPlayRunners: mocks.reconcile,
    getRunningAutoPlayKeys: () => state.runners.map((runner) => runner.key),
}));
vi.mock('../helper/videoDurationHelpers', () => ({
    getVideoDurationSeconds: mocks.videoDuration,
}));
vi.mock('./ForegroundSoundControlComp', () => ({
    default: ({ onChange }: any) => (
        <button onClick={onChange}>Refresh sound</button>
    ),
    getForegroundSoundData: () => state.sound,
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        predicate: (value: any) => boolean,
    ) => state.screens.filter(([, data]) => predicate(data)),
    getScreenForegroundManagerByDropped: () => state.dropManager,
    getScreenForegroundManagerInstances: (
        id: number,
        callback: (value: any) => void,
    ) => {
        mocks.manager(id);
        const foregroundData =
            state.screens.find(([screenId]) => screenId === id)?.[1] ?? {};
        callback({
            foregroundData,
            setVideoDataList: mocks.setList,
            setImageDataList: mocks.setList,
            setWebDataList: mocks.setList,
            addVideoData: mocks.add,
            addImageData: mocks.add,
            addWebData: mocks.add,
            removeVideoData: mocks.remove,
            removeImageData: mocks.remove,
            removeWebData: mocks.remove,
        });
    },
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: { setData: mocks.setData },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => {},
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('./ScreensRendererComp', () => ({
    default: ({
        showingScreenIdDataList,
        buttonText,
        handleForegroundHiding,
        genTitle,
    }: any) => (
        <>
            {showingScreenIdDataList.map(
                ([id, data]: [number, any], index: number) => (
                    <button
                        key={`${id}-${index}`}
                        title={genTitle(data)}
                        onClick={() => handleForegroundHiding(id, data)}
                    >
                        {buttonText}
                    </button>
                ),
            )}
        </>
    ),
}));
vi.mock('./foregroundSessionHelpers', () => ({
    checkIsSessionData: (data: any, id: string) => data.id === id,
    genForegroundPropsSettingNames: (prefix: string) => [
        `properties-${prefix}`,
    ],
}));
vi.mock('./propertiesSettingHelpers', () => ({
    genForegroundExtraStyle: () => ({ color: 'red' }),
    getForegroundIsBehind: () => true,
    getForegroundWidthScale: () => 80,
    useForegroundPropsSetting: (props: any) => {
        state.props.set(props.prefix, props);
        return {
            genStyle: () => ({ color: 'red' }),
            getWidthScale: () => 80,
            element: props.extraControls ?? null,
        };
    },
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: () => 'fade',
}));
vi.mock('../media-sessions/MediaSessionsComp', () => ({
    readSessions: (target: string) => state.sessions.get(target) ?? [],
    toSessionSuffix: (id: string) => (id ? `-${id}` : ''),
    useMediaSessionAutoPlayRefresh: () => {},
    useMediaSessions: (target: string) => ({
        sessions: state.sessions.get(target) ?? [{ id: 'a' }, { id: 'b' }],
        activeId: state.activeId,
        setActiveId: () => {},
        addSession: () => {},
        renameSession: () => {},
        removeSession: mocks.removeSession,
    }),
    default: (props: any) => {
        state.sessionProps.set(props.target, props);
        return (
            <button onClick={() => props.onRemove(props.activeId)}>
                Remove media session
            </button>
        );
    },
}));

import ForegroundMediaComp from './ForegroundMediaComp';
import { dirSourceSettingNames } from '../helper/constants';

let container: HTMLDivElement;
let root: Root;
const dictionaries = ['km', 'fr'].map((code) =>
    extractDictionary(readFileSync(`src/lang/data/${code}/index.ts`, 'utf8')),
);
const mediaData = (kind: string, data: any[] = []) => ({
    videoDataList: [],
    imageDataList: [],
    webDataList: [],
    [`${kind}DataList`]: data,
});

beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.settings.clear();
    state.sessions.clear();
    state.grids.clear();
    state.sessionProps.clear();
    state.props.clear();
    state.files = ['/b.png', '/a.png'];
    state.dirFiles = ['/b.png', '/a.png'];
    state.displayedFiles = null;
    state.activeId = 'a';
    state.screens = [];
    state.runners = [];
    state.dropManager = null;
    state.dragStore.onDropped = null;
    state.sound = { isSoundOn: false, soundVolume: 40 };
    state.dictionaries = dictionaries;
    mocks.displayOrder.mockImplementation(
        (_key: string, files: string[]) =>
            state.displayedFiles ?? files.slice().sort(),
    );
    mocks.reconcile.mockImplementation((runners: any[]) => {
        state.runners = runners;
    });
    mocks.dir.mockResolvedValue({ getFilePaths: async () => state.dirFiles });
    mocks.videoDuration.mockResolvedValue(17.5);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});
async function render(kind: 'video' | 'image' | 'web') {
    await act(async () => root.render(<ForegroundMediaComp kind={kind} />));
}
async function click(text: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === text,
    )!;
    expect(button, text).toBeDefined();
    await act(async () => button.click());
}
function tile(path: string) {
    return container.querySelector(
        `[data-media-path="${path}"]`,
    ) as HTMLButtonElement;
}
function runnerSetting(kind: string, suffix: string, value: string) {
    state.settings.set(`foreground-${kind}-a-slide-auto-play-${suffix}`, value);
}

describe('foreground media widgets', () => {
    test.each(['video', 'image', 'web'] as const)(
        '%s replaces only its own session and toggles a shown file off',
        async (kind) => {
            const old = { id: 'a', filePath: '/old.png' },
                other = { id: 'b', filePath: '/other.png' };
            state.screens = [[1, mediaData(kind, [old, other])]];
            await render(kind);
            await act(async () => tile('/a.png').click());
            expect(mocks.setData).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Function),
                false,
            );
            mocks.setData.mock.calls.at(-1)?.[1]({
                foregroundData: state.screens[0][1],
                setVideoDataList: mocks.setList,
                setImageDataList: mocks.setList,
                setWebDataList: mocks.setList,
            });
            const shown = mocks.setList.mock.calls.at(-1)?.[0];
            expect(shown[0]).toBe(other);
            expect(shown[1]).toMatchObject({
                id: 'a',
                filePath: '/a.png',
                extraStyle: { color: 'red' },
                isBehind: true,
                transitionEffect: 'fade',
            });
            if (kind === 'video') expect(shown[1]).toMatchObject(state.sound);
            if (kind === 'web')
                expect(shown[1]).toMatchObject({
                    widthScale: 0.8,
                    heightScale: 0.45,
                });
            state.screens[0][1][`${kind}DataList`] = shown;
            await render(kind);
            expect(tile('/a.png').className).toContain('selected');
            expect(
                container
                    .querySelector('[data-layer-marker]')
                    ?.getAttribute('data-layer-marker'),
            ).toBe('1:/a.png');
            await act(async () => tile('/a.png').click());
            expect(mocks.remove).toHaveBeenCalledWith(shown[1]);
            await act(async () =>
                tile('/a.png').dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                ),
            );
            expect(mocks.setData.mock.calls.at(-1)?.[2]).toBe(true);
        },
    );

    test.each(['video', 'image', 'web'] as const)(
        '%s drag adds to only a valid drop target and preserves datum fields',
        async (kind) => {
            await render(kind);
            await act(async () =>
                tile('/a.png').dispatchEvent(
                    new Event('dragstart', { bubbles: true }),
                ),
            );
            const payload = mocks.drag.mock.calls.at(-1)?.[1];
            expect(payload.kind).toBe(kind);
            expect(payload.getData()).toMatchObject({
                id: 'a',
                filePath: '/a.png',
                isBehind: true,
            });
            state.dragStore.onDropped({});
            expect(mocks.add).not.toHaveBeenCalled();
            state.dropManager = {
                addVideoData: mocks.add,
                addImageData: mocks.add,
                addWebData: mocks.add,
            };
            state.dragStore.onDropped({});
            expect(mocks.add).toHaveBeenCalledWith(payload.getData());
        },
    );

    test('video hover waits, cancels on leave and image tiles decode lazily', async () => {
        await render('video');
        const body = tile('/a.png').querySelector('.card-body')!;
        await act(async () => {
            body.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            await vi.advanceTimersByTimeAsync(199);
        });
        expect(tile('/a.png').textContent).toContain('poster');
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(tile('/a.png').textContent).toContain('playing');
        await act(async () =>
            body.dispatchEvent(
                new MouseEvent('mouseout', {
                    bubbles: true,
                    relatedTarget: document.body,
                }),
            ),
        );
        expect(tile('/a.png').textContent).toContain('poster');
        await render('image');
        const image = tile('/a.png').querySelector('img')!;
        expect(image.getAttribute('loading')).toBe('lazy');
        expect(image.getAttribute('decoding')).toBe('async');
        expect(image.alt).toBe('a.png');
    });

    test('removing a media session hides its overlays before deleting its settings', async () => {
        const own = { id: 'a', filePath: '/a.png' };
        state.screens = [
            [1, mediaData('image', [own, { id: 'b', filePath: '/b.png' }])],
        ];
        await render('image');
        await click('Remove media session');
        expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(own);
        expect(mocks.removeSession).toHaveBeenCalledWith('a');
        expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.removeSession.mock.invocationCallOrder[0],
        );
        const props = state.sessionProps.get('foreground-image');
        expect(props.genRemovedSettingNames('a')).toEqual([
            'properties-image-show-a',
            `${dirSourceSettingNames.FOREGROUND_IMAGE}-a`,
        ]);
        expect(props.genSessionState('a')).toEqual({
            isOnScreen: true,
            isAutoPlaying: false,
        });
        expect(props.genSessionState('missing').isOnScreen).toBe(false);
        await click('Hide Image');
        expect(mocks.remove).toHaveBeenCalledTimes(2);
    });

    test('property and sound refreshes preserve other sessions while replacing the current datum', async () => {
        const own = { id: 'a', filePath: '/a.png', soundVolume: 10 },
            other = { id: 'b', filePath: '/b.png' };
        state.screens = [[1, mediaData('video', [own, other])]];
        await render('video');
        await act(async () => {
            state.props.get('video-show-a').onChange({ color: 'blue' }, false);
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(mocks.setList).toHaveBeenLastCalledWith([
            other,
            { ...own, extraStyle: { color: 'blue' } },
        ]);
        state.sound = { isSoundOn: true, soundVolume: 70 };
        await click('Refresh sound');
        await act(async () => vi.advanceTimersByTimeAsync(500));
        expect(mocks.setList).toHaveBeenLastCalledWith([
            other,
            { ...own, ...state.sound },
        ]);
    });

    test('manual next follows displayed order and staggers updates across screens', async () => {
        state.files = ['/a.png', '/b.png', '/c.png'];
        state.displayedFiles = ['/c.png', '/a.png', '/b.png'];
        state.screens = [
            [1, mediaData('image', [{ id: 'a', filePath: '/c.png' }])],
            [2, mediaData('image', [{ id: 'a', filePath: '/c.png' }])],
        ];
        await render('image');
        await click('Next media');
        expect(mocks.setList).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(0));
        expect(
            mocks.setList.mock.calls.map(([list]) => list[0].filePath),
        ).toEqual(['/a.png']);
        await act(async () => vi.advanceTimersByTimeAsync(100));
        expect(mocks.manager.mock.calls).toEqual([[1], [2]]);
        expect(
            mocks.setList.mock.calls.map(([list]) => list[0].filePath),
        ).toEqual(['/a.png', '/a.png']);
        expect(mocks.displayOrder).toHaveBeenCalledWith(
            `${dirSourceSettingNames.FOREGROUND_IMAGE}-a`,
            state.files,
            expect.any(Function),
        );
    });

    test('an empty displayed list or a shown file absent from it causes no presentation', async () => {
        state.screens = [
            [1, mediaData('image', [{ id: 'a', filePath: '/gone.png' }])],
        ];
        await render('image');
        await click('Next media');
        await act(async () => vi.advanceTimersByTimeAsync(100));
        expect(mocks.setList).not.toHaveBeenCalled();
        state.displayedFiles = [];
        await click('Next media');
        expect(mocks.setList).not.toHaveBeenCalled();
        state.files = [];
        await render('image');
        await click('Next media');
        expect(mocks.setList).not.toHaveBeenCalled();
    });
});

describe('foreground media autoplay', () => {
    function seedRunner(kind: 'video' | 'image', filePath = '/a.png') {
        state.sessions.set(`foreground-${kind}`, [{ id: 'a' }]);
        state.screens = [[1, mediaData(kind, [{ id: 'a', filePath }])]];
        runnerSetting(kind, 'playing', 'true');
    }

    test('the runner advances a session with its panel closed and stops at a non-repeating end', async () => {
        seedRunner('image');
        runnerSetting('image', 'repeat', 'none');
        await render('image');
        const runner = state.runners[0];
        expect(runner.key).toBe('foreground-image-a');
        expect(
            state.sessionProps.get('foreground-image').genSessionState('a')
                .isAutoPlaying,
        ).toBe(true);
        expect(await runner.getDelaySeconds()).toBe(5);
        expect(await runner.tick()).toBe(true);
        await act(async () => vi.advanceTimersByTimeAsync(0));
        expect(mocks.setList.mock.calls.at(-1)?.[0][0].filePath).toBe('/b.png');
        state.screens[0][1].imageDataList = [{ id: 'a', filePath: '/b.png' }];
        expect(await runner.tick()).toBe(false);
        runner.onEnded();
        expect(
            state.settings.get('foreground-image-a-slide-auto-play-playing'),
        ).toBe('false');
        const owns = mocks.reconcile.mock.calls.at(-1)?.[1];
        expect(owns('foreground-image-a')).toBe(true);
        expect(owns('background-image-a')).toBe(false);
    });

    test('a video can wait until media ends with no seconds set, and falls back if duration is unreadable', async () => {
        seedRunner('video');
        runnerSetting('video', 'timer-seconds', '0');
        runnerSetting('video', 'until-media-end', 'true');
        await render('video');
        const runner = state.runners[0];
        expect(runner).toBeDefined();
        expect(await runner.getDelaySeconds()).toBe(17.5);
        expect(mocks.videoDuration).toHaveBeenCalledWith('file:///a.png');
        mocks.videoDuration.mockResolvedValueOnce(null);
        expect(await runner.getDelaySeconds()).toBe(0);
        state.screens = [];
        expect(await runner.getDelaySeconds()).toBe(0);
        expect(await runner.tick()).toBe(false);
    });

    test('no timer starts for stopped sessions, sessions without shown items or zero waits', async () => {
        seedRunner('image');
        runnerSetting('image', 'timer-seconds', '0');
        await render('image');
        expect(state.runners).toEqual([]);
        runnerSetting('image', 'timer-seconds', '5');
        runnerSetting('image', 'playing', 'false');
        await click('Refresh play state');
        expect(state.runners).toEqual([]);
        runnerSetting('image', 'playing', 'true');
        state.screens = [];
        await render('image');
        expect(state.runners).toEqual([]);
    });

    test('a runner stops when its folder has no usable file list', async () => {
        seedRunner('image');
        await render('image');
        const runner = state.runners[0];
        state.dirFiles = null;
        expect(await runner.tick()).toBe(false);
        state.dirFiles = [];
        expect(await runner.tick()).toBe(false);
    });
});
