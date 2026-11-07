// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';

// One mock surface for the Background folder's small components. The
// Cameras tab runs on the REAL `useCameraInfoList`: the browser's camera API
// is stubbed below, before `cameraHelpers` reads `navigator.mediaDevices` at
// module load.
const h = vi.hoisted(() => {
    const state = {
        originalMediaDevices: Object.getOwnPropertyDescriptor(
            globalThis.navigator,
            'mediaDevices',
        ),
        deviceChangeListeners: new Set<() => void>(),
        enumerateDevices: vi.fn(),
        getUserMedia: vi.fn(),
        electronSendAsync: vi.fn(),
        sendDataSync: vi.fn(),
        sendData: vi.fn(),
        listenForData: vi.fn(),
        removeListener: vi.fn(),
        handleError: vi.fn(),
        handleBackgroundSelecting: vi.fn(),
        handleSelecting: vi.fn(),
        handleDragStart: vi.fn(),
        cameraDragSerialize: vi.fn(),
        showAppContextMenu: vi.fn(),
        handleAutoHide: vi.fn(),
        settingWrites: [] as [string, unknown][],
        settingNames: [] as string[],
        zoomRegistrations: [] as { ref: any; options: any }[],
        screenEventNames: [] as string[][],
        onScreen: {} as Record<string, string[]>,
        initialThumbnailWidth: 160,
    };
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        configurable: true,
        value: {
            enumerateDevices: () => state.enumerateDevices(),
            getUserMedia: (constraints: unknown) =>
                state.getUserMedia(constraints),
            addEventListener: (name: string, listener: () => void) => {
                if (name === 'devicechange') {
                    state.deviceChangeListeners.add(listener);
                }
            },
            removeEventListener: (name: string, listener: () => void) => {
                if (name === 'devicechange') {
                    state.deviceChangeListeners.delete(listener);
                }
            },
        },
    });
    return state;
});

vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffectAsync: (
            effect: (methods: any) => Promise<unknown>,
            deps: unknown[],
            methods?: Record<string, unknown>,
        ) => {
            react.useEffect(
                () => {
                    const cleanup = effect({ ...methods }).catch(
                        (error: unknown) => h.handleError(error),
                    );
                    return () => {
                        void cleanup.then((resolved) => {
                            if (typeof resolved === 'function') {
                                resolved();
                            }
                        });
                    };
                },
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [...deps, ...Object.values(methods ?? {})],
            );
        },
    };
});
vi.mock('../helper/settingHelpers', async () => {
    const react = await import('react');
    const useSetting = (name: string, defaultValue: unknown) => {
        h.settingNames.push(name);
        const [value, setValue] = react.useState(defaultValue);
        return [
            value,
            (newValue: unknown) => {
                h.settingWrites.push([name, newValue]);
                setValue(newValue);
            },
        ];
    };
    return {
        useStateSettingBoolean: useSetting,
        useStateSettingString: useSetting,
    };
});
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: (channel: string) => h.electronSendAsync(channel),
}));
vi.mock('../server/appProvider', () => ({
    default: {
        messageUtils: {
            sendDataSync: (channel: string) => h.sendDataSync(channel),
            sendData: (channel: string, data: unknown) =>
                h.sendData(channel, data),
            listenForData: (channel: string, listener: unknown) =>
                h.listenForData(channel, listener),
            removeListener: (channel: string, listener: unknown) =>
                h.removeListener(channel, listener),
        },
    },
}));
vi.mock('../screen-mirror/mirrorCameraTransport', () => ({
    getMirrorCameraStream: () => Promise.reject(new Error('unused')),
    releaseMirrorCameraStream: () => {},
}));
vi.mock('../virtual-display/viewerCameraTransport', () => ({
    checkIsViewerCameraId: () => false,
    createViewerCameraView: () => null,
    getViewerCameraStream: () => Promise.reject(new Error('unused')),
    listenViewerCameraLive: () => () => {},
    releaseViewerCameraStream: () => {},
}));
vi.mock('../helper/mediaHelpers', () => ({ playMediaElement: () => {} }));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (error: unknown) => h.handleError(error),
}));
vi.mock('./BackgroundMediaComp', async () => {
    const react = await import('react');
    return {
        useThumbnailWidthSetting: () => react.useState(h.initialThumbnailWidth),
    };
});
vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title, setValue, defaultSize }: any) => (
        <input
            type="range"
            aria-label={title}
            value={value}
            min={defaultSize.min}
            max={defaultSize.max}
            step={defaultSize.step}
            onChange={(event) => setValue(Number(event.target.value))}
        />
    ),
    useZoomingRegistering: (ref: any, options: any) => {
        h.zoomRegistrations.push({ ref, options });
    },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: (eventNames: string[]) => {
        h.screenEventNames.push(eventNames);
    },
}));
vi.mock('../_screen/managers/ScreenBackgroundManager', () => ({
    BACKGROUND_VIDEO_FADING_SETTING_NAME: 'video-fading-at-the-end-setting',
    default: {
        handleBackgroundSelecting: (...args: unknown[]) =>
            h.handleBackgroundSelecting(...args),
    },
}));
vi.mock('./backgroundHelpers', () => ({
    genBackgroundMediaItemData: (
        titlePrefix: string,
        src: string,
        _dragType: string,
    ) => {
        const screenKeys = h.onScreen[src] ?? [];
        const isInScreen = screenKeys.length > 0;
        return {
            selectedCN: isInScreen ? 'app-highlight-selected animation' : '',
            title:
                titlePrefix +
                (isInScreen
                    ? ` \nShow in presents:${screenKeys.join(',')}`
                    : ''),
            handleSelecting: (event: unknown, isForceChoosing = false) =>
                h.handleSelecting(event, src, isForceChoosing),
            backgroundType: 'camera',
            isInScreen,
            selectedBackgroundSrcList: screenKeys.map((key) => [
                key,
                { type: 'camera', src },
            ]),
        };
    },
    cameraDragSerialize: (cameraInfo: unknown) =>
        h.cameraDragSerialize(cameraInfo),
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: (event: unknown, target: unknown) =>
        h.handleDragStart(event, target),
}));
vi.mock('../others/FileItemHandlerComp', () => ({
    genShowOnScreensContextMenu: (onSelect: (event: any) => void) => [
        { menuElement: 'Show on Screens', onSelect },
    ],
}));
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: (event: unknown, items: unknown) =>
        h.showAppContextMenu(event, items),
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ onOpening, isCorner }: any) => (
        <button
            type="button"
            data-dots={isCorner ? 'corner' : 'inline'}
            onClick={(event) => {
                event.stopPropagation();
                onOpening(event);
            }}
        >
            More Options
        </button>
    ),
}));
vi.mock('./RenderCameraVideoComp', () => ({
    default: ({ deviceId, width }: { deviceId: string; width: number }) => (
        <div data-camera-video={deviceId} data-width={width} />
    ),
}));
vi.mock('./backgroundTransitionMenuHelpers', () => ({
    genBackgroundItemTransitionMenuItems: (type: string, src: string) => [
        { menuElement: `Transition (${type} ${src})` },
    ],
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: ({ screenId }: { screenId: number }) => (
        <span data-screen-id={screenId} />
    ),
}));
vi.mock('../helper/domHelpers', () => ({
    handleAutoHide: (element: unknown) => h.handleAutoHide(element),
}));
vi.mock('./AudioBodyComp', () => ({
    default: ({ filePath }: { filePath: string }) => (
        <div data-audio-body={filePath} />
    ),
}));
vi.mock('../app-document-presenter/items/RenderSlideIndexComp', () => ({
    default: ({ viewIndex, dataKey, title }: any) => (
        <span data-slide-index={viewIndex} data-key={dataKey} title={title} />
    ),
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    toKeyByFilePath: (filePath: string, id: number) => `${filePath}<>${id}`,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));

import EventHandler from '../event/EventHandler';
import BackgroundCamerasComp from './BackgroundCamerasComp';
import BackgroundFooterComp, { defaultRangeSize } from './BackgroundFooterComp';
import BackgroundViewModeComp, {
    toBackgroundViewModeSettingName,
    useBackgroundViewModeSetting,
    type BackgroundViewModeType,
} from './BackgroundViewModeComp';
import RenderBackgroundScreenIdsComp from './RenderBackgroundScreenIdsComp';
import VaryAppDocumentAudiosComp from './VaryAppDocumentAudiosComp';
import VideoHeaderSettingComp from './VideoHeaderSettingComp';
import {
    OPEN_BACKGROUND_AUDIO_TAB_EVENT,
    openBackgroundAudioTab,
} from './backgroundAudioTabHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const cam1 = {
    deviceId: 'cam-1',
    groupId: 'g1',
    kind: 'videoinput',
    label: 'Front camera',
};
const mic = {
    deviceId: 'mic-1',
    groupId: 'g1',
    kind: 'audioinput',
    label: 'Microphone',
};
const cam2 = {
    deviceId: 'cam-2',
    groupId: 'g2',
    kind: 'videoinput',
    label: 'Stage camera',
};
const remoteCam = {
    deviceId: 'mirror-camera:pc2:x',
    groupId: 'remote',
    label: 'a1: Lobby camera',
};

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function changeRange(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tileLabels() {
    return [...host.querySelectorAll('.camera-thumbnail .card-header')].map(
        (element) => element.textContent,
    );
}

beforeEach(() => {
    h.deviceChangeListeners.clear();
    h.settingWrites.length = 0;
    h.settingNames.length = 0;
    h.zoomRegistrations.length = 0;
    h.screenEventNames.length = 0;
    h.onScreen = {};
    h.initialThumbnailWidth = 160;
    h.electronSendAsync.mockResolvedValue(true);
    h.enumerateDevices.mockResolvedValue([cam1, mic, cam2]);
    h.sendDataSync.mockReturnValue([]);
    h.cameraDragSerialize.mockImplementation((cameraInfo: any) => ({
        type: 'bg-camera',
        data: cameraInfo.deviceId,
    }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

afterAll(() => {
    if (h.originalMediaDevices === undefined) {
        delete (globalThis.navigator as any).mediaDevices;
    } else {
        Object.defineProperty(
            globalThis.navigator,
            'mediaDevices',
            h.originalMediaDevices,
        );
    }
});

describe('Cameras tab', () => {
    test('lists every video input plus the shared cameras once access is granted', async () => {
        h.sendDataSync.mockImplementation((channel: string) =>
            channel === 'mirror:cameras' ? [remoteCam] : undefined,
        );
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();

        expect(h.electronSendAsync).toHaveBeenCalledWith(
            'main:app:ask-camera-access',
        );
        // The microphone is not a camera.
        expect(tileLabels()).toEqual([
            'Front camera',
            'Stage camera',
            'a1: Lobby camera',
        ]);
        expect(
            [...host.querySelectorAll('[data-camera-video]')].map((element) =>
                element.getAttribute('data-camera-video'),
            ),
        ).toEqual(['cam-1', 'cam-2', 'mirror-camera:pc2:x']);
        // This computer's own cameras are offered to the mirror.
        expect(h.sendData).toHaveBeenCalledWith('mirror:physical-cameras', [
            { deviceId: 'cam-1', label: 'Front camera', groupId: 'g1' },
            { deviceId: 'cam-2', label: 'Stage camera', groupId: 'g2' },
        ]);
        expect(h.screenEventNames[0]).toEqual(['update']);
        // 16:9 under the shared thumbnail size, plus the 30px title.
        const tile = host.querySelector<HTMLElement>('.camera-thumbnail')!;
        expect(tile.style.width).toBe('160px');
        expect(tile.style.height).toBe(`${Math.round((160 * 9) / 16) + 30}px`);
        expect(tile.draggable).toBe(true);
        // The footer's size slider, and no view-mode switch on this tab.
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).not.toBeNull();
        expect(host.querySelector('[title="List View"]')).toBeNull();
    });

    test('shows only the shared cameras when camera access is denied', async () => {
        h.electronSendAsync.mockResolvedValue(false);
        h.sendDataSync.mockImplementation((channel: string) =>
            channel === 'mirror:cameras' ? [remoteCam] : undefined,
        );
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();

        expect(h.enumerateDevices).not.toHaveBeenCalled();
        expect(tileLabels()).toEqual(['a1: Lobby camera']);
    });

    test('shows no tile at all with access denied and nothing shared', async () => {
        h.electronSendAsync.mockResolvedValue(false);
        h.sendDataSync.mockReturnValue(undefined);
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();

        expect(host.querySelectorAll('.camera-thumbnail')).toHaveLength(0);
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).not.toBeNull();
    });

    test('re-reads the cameras when one is plugged out, and stops listening on unmount', async () => {
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();
        expect(tileLabels()).toEqual(['Front camera', 'Stage camera']);
        expect(h.deviceChangeListeners.size).toBe(1);

        h.enumerateDevices.mockResolvedValue([cam2]);
        await act(async () => {
            for (const listener of h.deviceChangeListeners) {
                listener();
            }
        });
        await flush();
        expect(tileLabels()).toEqual(['Stage camera']);

        act(() => root.unmount());
        await flush();
        expect(h.deviceChangeListeners.size).toBe(0);
        expect(h.removeListener).toHaveBeenCalledWith(
            'mirror:devices-changed',
            expect.any(Function),
        );
        root = createRoot(host);
    });

    test('resizes every tile with the size slider and with zooming', async () => {
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();
        const registration = h.zoomRegistrations.at(-1)!;
        expect(registration.options).toMatchObject({
            value: 160,
            defaultSize: defaultRangeSize,
        });
        expect(registration.ref.current).toBe(
            host.querySelector('.card.app-zero-border-radius'),
        );

        const range = host.querySelector<HTMLInputElement>(
            'input[aria-label="Thumbnail Size"]',
        )!;
        await act(async () => changeRange(range, '320'));
        const tiles = [
            ...host.querySelectorAll<HTMLElement>('.camera-thumbnail'),
        ];
        expect(tiles.map((tile) => tile.style.width)).toEqual([
            '320px',
            '320px',
        ]);
        expect(tiles[0].style.height).toBe('210px');
        expect(
            host
                .querySelector('[data-camera-video="cam-1"]')
                ?.getAttribute('data-width'),
        ).toBe('320');

        await act(async () => h.zoomRegistrations.at(-1)!.options.setValue(80));
        expect(
            host.querySelector<HTMLElement>('.camera-thumbnail')!.style.width,
        ).toBe('80px');
    });

    test('a camera on a screen is marked, named in its title and shows its screen', async () => {
        h.onScreen = { 'cam-2': ['2'] };
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();
        const [first, second] = [
            ...host.querySelectorAll<HTMLElement>('.camera-thumbnail'),
        ];
        expect(first.className).toBe('camera-thumbnail card ');
        expect(first.querySelector('[data-screen-id]')).toBeNull();
        expect(second.className).toBe(
            'camera-thumbnail card app-highlight-selected animation',
        );
        expect(second.title).toBe('Stage camera \nShow in presents:2');
        expect(
            second
                .querySelector('[data-screen-id]')
                ?.getAttribute('data-screen-id'),
        ).toBe('2');
        expect(
            second.querySelector('.card-header')?.getAttribute('title'),
        ).toBe('Stage camera');
    });

    test('a click shows the camera, the menu offers screens and its transition, a drag carries the device', async () => {
        await act(async () => root.render(<BackgroundCamerasComp />));
        await flush();
        const tile = host.querySelector<HTMLElement>('.camera-thumbnail')!;

        await act(async () => tile.click());
        expect(h.handleBackgroundSelecting).toHaveBeenCalledWith(
            expect.anything(),
            'camera',
            { src: 'cam-1' },
            false,
        );

        await act(async () => {
            tile.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        const [, items] = h.showAppContextMenu.mock.calls[0] as [any, any[]];
        expect(items.map((item) => item.menuElement)).toEqual([
            'Show on Screens',
            'Transition (camera cam-1)',
        ]);
        items[0].onSelect('choose-event');
        expect(h.handleSelecting).toHaveBeenCalledWith(
            'choose-event',
            'cam-1',
            true,
        );

        // The corner dots open the same menu without also selecting.
        h.handleBackgroundSelecting.mockClear();
        const dots = tile.querySelector<HTMLElement>('[data-dots="corner"]')!;
        await act(async () => dots.click());
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(2);
        expect(h.handleBackgroundSelecting).not.toHaveBeenCalled();

        await act(async () => {
            tile.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        const [, dragTarget] = h.handleDragStart.mock.calls[0] as [any, any];
        expect(dragTarget.dragSerialize()).toEqual({
            type: 'bg-camera',
            data: 'cam-1',
        });
        expect(h.cameraDragSerialize).toHaveBeenCalledWith(
            expect.objectContaining({
                deviceId: 'cam-1',
                label: 'Front camera',
            }),
        );
    });
});

describe('Background footer and view mode', () => {
    test('the footer auto-hides and carries the size slider alone without a view mode', async () => {
        const setThumbnailWidth = vi.fn();
        await act(async () =>
            root.render(
                <BackgroundFooterComp
                    thumbnailWidth={140}
                    setThumbnailWidth={setThumbnailWidth}
                />,
            ),
        );
        const footer = host.querySelector('.card-footer');
        expect(h.handleAutoHide).toHaveBeenCalledWith(footer);
        const range = host.querySelector<HTMLInputElement>(
            'input[aria-label="Thumbnail Size"]',
        )!;
        expect(range.value).toBe('140');
        expect([range.min, range.max, range.step]).toEqual(['50', '500', '10']);
        await act(async () => changeRange(range, '250'));
        expect(setThumbnailWidth).toHaveBeenCalledWith(250);
        expect(host.querySelector('[role="group"]')).toBeNull();
    });

    test('list view drops the size slider and keeps the view-mode switch', async () => {
        function FooterProbeComp() {
            const [viewMode, setViewMode] =
                useState<BackgroundViewModeType>('thumbnail');
            return (
                <BackgroundFooterComp
                    thumbnailWidth={100}
                    setThumbnailWidth={() => {}}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
            );
        }
        await act(async () => root.render(<FooterProbeComp />));
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).not.toBeNull();
        const listButton = host.querySelector<HTMLButtonElement>(
            '[title="List View"]',
        )!;
        expect(listButton.className).toBe('btn btn-sm btn-secondary');
        await act(async () => listButton.click());
        expect(
            host.querySelector('input[aria-label="Thumbnail Size"]'),
        ).toBeNull();
        expect(
            host.querySelector<HTMLButtonElement>('[title="List View"]')!
                .className,
        ).toBe('btn btn-sm btn-info');
        expect(
            host.querySelector<HTMLButtonElement>('[title="Thumbnail View"]')!
                .disabled,
        ).toBe(false);
    });

    test('each folder keeps its own view-mode setting, a grid until changed', async () => {
        expect(toBackgroundViewModeSettingName('select-dir-image-bg')).toBe(
            'bg-view-mode-select-dir-image-bg',
        );
        let setViewMode: ((mode: BackgroundViewModeType) => void) | null = null;
        function ViewModeProbeComp() {
            const [viewMode, setMode] = useBackgroundViewModeSetting(
                'select-dir-video-bg-session-2',
            );
            setViewMode = setMode;
            return (
                <BackgroundViewModeComp
                    viewMode={viewMode}
                    setViewMode={setMode}
                />
            );
        }
        await act(async () => root.render(<ViewModeProbeComp />));
        expect(h.settingNames).toContain(
            'bg-view-mode-select-dir-video-bg-session-2',
        );
        expect(
            host.querySelector<HTMLButtonElement>('[title="Thumbnail View"]')!
                .disabled,
        ).toBe(true);
        await act(async () => setViewMode!('list'));
        expect(h.settingWrites).toEqual([
            ['bg-view-mode-select-dir-video-bg-session-2', 'list'],
        ]);
        expect(
            host.querySelector<HTMLButtonElement>('[title="List View"]')!
                .disabled,
        ).toBe(true);
    });
});

describe('Background bits', () => {
    test('screen ids render one screen icon each, in order', async () => {
        await act(async () =>
            root.render(<RenderBackgroundScreenIdsComp screenIds={[3, 1]} />),
        );
        expect(
            [...host.querySelectorAll('[data-screen-id]')].map((element) =>
                element.getAttribute('data-screen-id'),
            ),
        ).toEqual(['3', '1']);
        await act(async () =>
            root.render(<RenderBackgroundScreenIdsComp screenIds={[]} />),
        );
        expect(host.querySelectorAll('[data-screen-id]')).toHaveLength(0);
    });

    test('the document audios list every track under its slide and skip empty documents', async () => {
        await act(async () =>
            root.render(
                <VaryAppDocumentAudiosComp
                    appDocumentAudioData={{
                        'Easter.pptx': [
                            {
                                slideIndex: 0,
                                slideId: 11,
                                filePaths: ['/a/intro.mp3', '/a/bell.mp3'],
                                slideFilePath: '/docs/Easter.pptx',
                            },
                            {
                                slideIndex: 4,
                                slideId: 15,
                                filePaths: ['/a/outro.mp3'],
                                slideFilePath: '/docs/Easter.pptx',
                            },
                        ],
                        'Empty.pptx': [],
                    }}
                />,
            ),
        );
        expect(host.querySelector('.card-header')?.textContent).toBe(
            'Document Audios',
        );
        expect(host.textContent).toContain('Easter.pptx');
        expect(host.textContent).not.toContain('Empty.pptx');
        expect(host.querySelectorAll('hr')).toHaveLength(1);
        expect(
            [...host.querySelectorAll('[data-audio-body]')].map((element) =>
                element.getAttribute('data-audio-body'),
            ),
        ).toEqual(['/a/intro.mp3', '/a/bell.mp3', '/a/outro.mp3']);
        expect(
            [...host.querySelectorAll('[data-slide-index]')].map((element) => [
                element.getAttribute('data-slide-index'),
                element.getAttribute('data-key'),
                element.getAttribute('title'),
            ]),
        ).toEqual([
            ['1', '/docs/Easter.pptx<>11', '1'],
            ['1', '/docs/Easter.pptx<>11', '1'],
            ['5', '/docs/Easter.pptx<>15', '5'],
        ]);
    });

    test('the video header switch reads and writes the fading-at-the-end setting, on by default', async () => {
        await act(async () => root.render(<VideoHeaderSettingComp />));
        expect(h.settingNames).toContain('video-fading-at-the-end-setting');
        expect(host.textContent).toContain('Fading at the End:');
        const checkbox = host.querySelector<HTMLInputElement>(
            'input[type="checkbox"]',
        )!;
        expect(checkbox.checked).toBe(true);
        await act(async () => checkbox.click());
        expect(h.settingWrites).toEqual([
            ['video-fading-at-the-end-setting', false],
        ]);
        expect(checkbox.checked).toBe(false);
        await act(async () => checkbox.click());
        expect(h.settingWrites.at(-1)).toEqual([
            'video-fading-at-the-end-setting',
            true,
        ]);
    });

    test('asking for the audio tab reaches a listener on its event', async () => {
        const listener = vi.fn();
        const registered = EventHandler.registerEventListener(
            [OPEN_BACKGROUND_AUDIO_TAB_EVENT],
            listener,
        );
        try {
            openBackgroundAudioTab();
            await flush();
            expect(OPEN_BACKGROUND_AUDIO_TAB_EVENT).toBe(
                'open-background-audio-tab',
            );
            expect(listener).toHaveBeenCalledTimes(1);
        } finally {
            EventHandler.unregisterEventListener(registered);
        }
        openBackgroundAudioTab();
        await flush();
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
