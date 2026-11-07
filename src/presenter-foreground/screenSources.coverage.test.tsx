// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readLangPackageDictionaries } from '../test-setup/langPackageDirs';

// Screen Show and Camera Show: one card per source (a screen, a camera), shown
// by a click, forced to a screen chooser by the menu, dragged to a screen, and
// restyled on every screen it is on once its Properties stop changing. Both
// share this mock surface; the real `appHooks`, `withForegroundLayer`,
// `toTransitionPart`, `genTimeoutAttempt` and screen colours are used.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        dictionaries: [] as Record<string, string>[],
        // [screenId, foregroundData] -- what each screen holds.
        screens: [] as [number, any][],
        // Every screen the app has, and the size each manager knows.
        screenIds: [] as number[],
        screenSizes: new Map<number, { width: number; height: number }>(),
        cameraList: [] as { deviceId: string; label: string }[],
        dropManager: null as any,
        dragStore: { onDropped: null as any },
        propsOptions: new Map<string, any>(),
        behindPrefixes: new Set<string>(),
        transitions: new Map<string, string>(),
        styleWidth: '40%',
    },
    mocks: {
        addScreenData: vi.fn(),
        addCameraData: vi.fn(),
        manager: vi.fn(),
        drag: vi.fn(),
        openCamera: vi.fn(),
        releaseCamera: vi.fn(),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: { listenForData: () => {}, sendData: () => {} },
        appUtils: { handleError: () => {} },
    },
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined) {
                throw new Error(`Missing translation: ${key}`);
            }
        }
        return key;
    },
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span data-loading="true">Loading</span>,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ label, onOpening }: any) => (
        <button type="button" aria-label={label} onClick={onOpening} />
    ),
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: {
        addScreenData: mocks.addScreenData,
        addCameraData: mocks.addCameraData,
    },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => {},
}));
vi.mock('../_screen/managers/screenManagerHooks', () => ({
    useScreenManagerEvents: () => {},
}));
vi.mock('../_screen/managers/screenManagerBaseHelpers', () => ({
    getAllScreenManagerBases: () => {
        return state.screenIds.map((screenId) => {
            return { screenId };
        });
    },
    getScreenManagerBase: (screenId: number) => {
        return state.screenSizes.get(screenId) ?? null;
    },
}));
// One fake manager per screen, recording what is done to it.
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        predicate: (data: any) => boolean,
    ) => {
        return state.screens.filter(([, data]) => {
            return predicate(data);
        });
    },
    getScreenForegroundManagerInstances: (
        screenId: number,
        callback: (manager: any) => void,
    ) => {
        callback({
            addScreenData: (data: any) => {
                mocks.manager(screenId, 'addScreenData', data);
            },
            removeScreenData: (data: any) => {
                mocks.manager(screenId, 'removeScreenData', data);
            },
            addCameraData: (data: any) => {
                mocks.manager(screenId, 'addCameraData', data);
            },
            removeCameraData: (data: any) => {
                mocks.manager(screenId, 'removeCameraData', data);
            },
        });
    },
    getScreenForegroundManagerByDropped: () => {
        return state.dropManager;
    },
}));
vi.mock('./ScreensRendererComp', () => ({
    default: ({
        showingScreenIdDataList,
        buttonText,
        genTitle,
        handleForegroundHiding,
    }: any) => (
        <>
            {showingScreenIdDataList.map(
                ([screenId, data]: [number, any], index: number) => (
                    <button
                        type="button"
                        key={`${screenId}-${index}`}
                        className="fg-hide"
                        aria-label={`${buttonText} ${screenId}`}
                        title={genTitle(data)}
                        onClick={() => {
                            handleForegroundHiding(screenId, data);
                        }}
                    />
                ),
            )}
        </>
    ),
}));
vi.mock('./propertiesSettingHelpers', () => ({
    getForegroundIsBehind: (prefix: string) => {
        return state.behindPrefixes.has(prefix);
    },
    useForegroundPropsSetting: (options: any) => {
        state.propsOptions.set(options.prefix, options);
        return {
            genStyle: () => {
                return { width: state.styleWidth };
            },
            element: <span data-props={options.prefix} />,
        };
    },
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: (widgetKey: string, prefix: string) => {
        return state.transitions.get(`${widgetKey}:${prefix}`);
    },
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ target, children }: any) => (
        <div data-layout={target}>{children}</div>
    ),
}));
vi.mock('../helper/dragHelpers', () => ({
    dragStore: state.dragStore,
    handleDragStart: mocks.drag,
}));
vi.mock('./foregroundDragHelpers', () => ({
    genForegroundDragInf: (kind: string, getData: () => unknown) => {
        return { kind, getData };
    },
}));
vi.mock('../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: mocks.openCamera,
    useCameraInfoList: () => {
        return state.cameraList;
    },
}));

import ForegroundScreenComp from './ForegroundScreenComp';
import ForegroundCameraComp from './ForegroundCameraComp';

const dictionaries = readLangPackageDictionaries();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.dictionaries = dictionaries;
    state.screens = [];
    state.screenIds = [];
    state.screenSizes.clear();
    state.cameraList = [];
    state.dropManager = null;
    state.dragStore.onDropped = null;
    state.propsOptions.clear();
    state.behindPrefixes.clear();
    state.transitions.clear();
    state.styleWidth = '40%';
    mocks.openCamera.mockImplementation(async () => {
        return mocks.releaseCamera;
    });
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

async function render(element: React.ReactElement) {
    await act(async () => {
        root.render(element);
    });
}

function getCardBody(index = 0) {
    const body = container.querySelectorAll<HTMLElement>('.card-body')[index];
    if (body === undefined) {
        throw new Error(`no card ${index}`);
    }
    return body;
}

async function fire(element: Element, type: string) {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true });
    await act(async () => {
        element.dispatchEvent(event);
    });
    return event;
}

async function pressLabel(label: string, index = 0) {
    const button = container.querySelectorAll<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
    )[index];
    if (button === undefined) {
        throw new Error(`no button "${label}" #${index}`);
    }
    await act(async () => {
        button.click();
    });
}

function managerCalls(method: string) {
    return mocks.manager.mock.calls
        .filter(([, name]) => {
            return name === method;
        })
        .map(([screenId, , data]) => {
            return [screenId, data];
        });
}

describe('Screen Show', () => {
    test('a card per screen, drawn in that screen colour and shape', async () => {
        state.screenIds = [1, 2];
        state.screenSizes.set(1, { width: 1280, height: 1024 });
        await render(<ForegroundScreenComp />);
        expect(
            Array.from(container.querySelectorAll('.card-header')).map(
                (header) => {
                    return header.getAttribute('title');
                },
            ),
        ).toEqual(['Screen: 1', 'Screen: 2']);
        const pictures =
            container.querySelectorAll<HTMLElement>('.card-body > div');
        expect(pictures[0].style.aspectRatio).toBe('1280 / 1024');
        // A screen whose manager is not known yet is drawn 16:9.
        expect(pictures[1].style.aspectRatio).toBe('16 / 9');
        expect(pictures[0].style.backgroundColor).not.toBe(
            pictures[1].style.backgroundColor,
        );
        expect(pictures[1].textContent).toBe('2');
        // Each card keeps its own Properties, never the screen's own keys.
        expect(
            Array.from(container.querySelectorAll('[data-props]')).map(
                (element) => {
                    return element.getAttribute('data-props');
                },
            ),
        ).toEqual(['screen-show-1', 'screen-show-2']);
        expect(state.propsOptions.get('screen-show-1')).toMatchObject({
            isCommonStyle: false,
            isBlendMode: true,
            widgetKey: 'screen',
        });
        // Nothing is up yet, so there is nothing to take down.
        expect(container.querySelector('.fg-actions')).toBeNull();
    });

    test('a press shows it; the menu and a right-click choose the screens', async () => {
        state.screenIds = [3];
        state.transitions.set('screen:screen-show-3', 'zoom');
        await render(<ForegroundScreenComp />);
        await fire(getCardBody(), 'click');
        expect(mocks.addScreenData).toHaveBeenCalledTimes(1);
        expect(mocks.addScreenData.mock.calls[0][1]).toEqual({
            id: 3,
            extraStyle: { width: '40%' },
            transitionEffect: 'zoom',
        });
        expect(mocks.addScreenData.mock.calls[0][2]).toBe(false);

        state.behindPrefixes.add('screen-show-3');
        state.styleWidth = '90%';
        await fire(getCardBody(), 'contextmenu');
        expect(mocks.addScreenData.mock.calls[1][1]).toEqual({
            id: 3,
            extraStyle: { width: '90%' },
            transitionEffect: 'zoom',
            isBehind: true,
        });
        expect(mocks.addScreenData.mock.calls[1][2]).toBe(true);

        await pressLabel('Show on Screens');
        expect(mocks.addScreenData).toHaveBeenCalledTimes(3);
        expect(mocks.addScreenData.mock.calls[2][2]).toBe(true);
    });

    test('a drag carries the show and lands on the screen it is dropped on', async () => {
        state.screenIds = [2];
        await render(<ForegroundScreenComp />);
        await fire(getCardBody(), 'dragstart');
        expect(mocks.drag).toHaveBeenCalledTimes(1);
        const dragInf = mocks.drag.mock.calls[0][1];
        expect(dragInf.kind).toBe('screen');
        // Built when it is DROPPED, from the style as it is then.
        state.styleWidth = '15%';
        expect(dragInf.getData()).toEqual({
            id: 2,
            extraStyle: { width: '15%' },
        });

        // Dropped on nothing that takes it.
        state.dragStore.onDropped({});
        const dropManager = { addScreenData: vi.fn() };
        state.dropManager = dropManager;
        state.dragStore.onDropped({});
        expect(dropManager.addScreenData).toHaveBeenCalledTimes(1);
        expect(dropManager.addScreenData).toHaveBeenCalledWith({
            id: 2,
            extraStyle: { width: '15%' },
        });
    });

    test('its chips take one show down, and Properties restyle every show of it', async () => {
        state.screenIds = [1, 2];
        state.screens = [
            [0, { screenDataList: [{ id: 1, extraStyle: {} }] }],
            [
                5,
                {
                    screenDataList: [
                        { id: 1, extraStyle: {}, isBehind: true },
                        { id: 2, extraStyle: {} },
                    ],
                },
            ],
            [6, { screenDataList: [] }],
        ];
        await render(<ForegroundScreenComp />);
        const chips = Array.from(
            container.querySelectorAll<HTMLButtonElement>('.fg-hide'),
        );
        // Screen 1 is shown on screens 0 and 5; screen 2 on screen 5 only.
        expect(
            chips.map((chip) => {
                return `${chip.getAttribute('aria-label')}|${chip.title}`;
            }),
        ).toEqual([
            'Hide Screen Show 0|Screen: 1',
            'Hide Screen Show 5|Screen: 1',
            'Hide Screen Show 5|Screen: 2',
        ]);
        await act(async () => {
            chips[1].click();
        });
        expect(managerCalls('removeScreenData')).toEqual([
            [5, { id: 1, extraStyle: {}, isBehind: true }],
        ]);

        // Both cards adjusted inside the same half second: each its own timer.
        const style = { width: '10%' };
        state.propsOptions.get('screen-show-1').onChange(style, false);
        state.propsOptions.get('screen-show-1').onChange(style, false);
        state.propsOptions.get('screen-show-2').onChange(style, true);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(managerCalls('addScreenData')).toEqual([]);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        expect(managerCalls('addScreenData')).toEqual([
            // The layer key comes off a show put in front again.
            [0, { id: 1, extraStyle: style }],
            [5, { id: 1, extraStyle: style }],
            [5, { id: 2, extraStyle: style, isBehind: true }],
        ]);
    });
});

describe('Camera Show', () => {
    test('opens each camera into its own card and lets it go on unmount', async () => {
        state.cameraList = [
            { deviceId: 'cam-a', label: 'Front Camera' },
            { deviceId: 'cam-b', label: 'Back Camera' },
        ];
        await render(<ForegroundCameraComp />);
        await act(async () => {
            await Promise.resolve();
        });
        expect(mocks.openCamera).toHaveBeenCalledTimes(2);
        expect(mocks.openCamera.mock.calls[0][0]).toMatchObject({
            id: 'cam-a',
            label: 'Front Camera',
            width: 300,
        });
        expect(mocks.openCamera.mock.calls[0][0].parentContainer).toBe(
            getCardBody(0),
        );
        expect(
            Array.from(container.querySelectorAll('[data-layout]')).map(
                (element) => {
                    return element.getAttribute('data-layout');
                },
            ),
        ).toEqual(['camera', 'camera-cam-a', 'camera-cam-b']);
        expect(state.propsOptions.get('camera-cam-a')).toMatchObject({
            isBlendMode: true,
            widgetKey: 'camera',
        });
        expect(container.querySelectorAll('[data-loading]')).toHaveLength(2);

        act(() => root.unmount());
        await act(async () => {
            await Promise.resolve();
        });
        expect(mocks.releaseCamera).toHaveBeenCalledTimes(2);
        root = createRoot(container);
    });

    test('a press shows the camera with its name; the menu chooses the screens', async () => {
        state.cameraList = [{ deviceId: 'cam-a', label: 'Front Camera' }];
        state.transitions.set('camera:camera-cam-a', 'fade');
        await render(<ForegroundCameraComp />);
        await fire(getCardBody(), 'click');
        expect(mocks.addCameraData.mock.calls[0].slice(1)).toEqual([
            {
                id: 'cam-a',
                label: 'Front Camera',
                extraStyle: { width: '40%' },
                transitionEffect: 'fade',
            },
            false,
        ]);
        state.behindPrefixes.add('camera-cam-a');
        await fire(getCardBody(), 'contextmenu');
        expect(mocks.addCameraData.mock.calls[1].slice(1)).toEqual([
            {
                id: 'cam-a',
                label: 'Front Camera',
                extraStyle: { width: '40%' },
                transitionEffect: 'fade',
                isBehind: true,
            },
            true,
        ]);
        await pressLabel('Show on Screens');
        expect(mocks.addCameraData).toHaveBeenCalledTimes(3);
        expect(mocks.addCameraData.mock.calls[2][2]).toBe(true);
    });

    test('a dragged camera is built at drop time and lands where it is dropped', async () => {
        state.cameraList = [{ deviceId: 'cam-a', label: 'Front Camera' }];
        await render(<ForegroundCameraComp />);
        await fire(getCardBody(), 'dragstart');
        const dragInf = mocks.drag.mock.calls[0][1];
        expect(dragInf.kind).toBe('camera');
        state.behindPrefixes.add('camera-cam-a');
        state.styleWidth = '25%';
        expect(dragInf.getData()).toEqual({
            id: 'cam-a',
            label: 'Front Camera',
            extraStyle: { width: '25%' },
            isBehind: true,
        });

        state.dragStore.onDropped({});
        const dropManager = { addCameraData: vi.fn() };
        state.dropManager = dropManager;
        state.dragStore.onDropped({});
        expect(dropManager.addCameraData).toHaveBeenCalledWith({
            id: 'cam-a',
            label: 'Front Camera',
            extraStyle: { width: '25%' },
            isBehind: true,
        });
    });

    test('its chips name the camera, and Properties replace it on every screen', async () => {
        state.cameraList = [
            { deviceId: 'cam-a', label: 'Front Camera' },
            { deviceId: 'cam-b', label: '' },
        ];
        state.screens = [
            [
                1,
                {
                    cameraDataList: [
                        { id: 'cam-a', label: 'Front Camera', extraStyle: {} },
                        { id: 'cam-b', label: '', extraStyle: {} },
                    ],
                },
            ],
            [2, { cameraDataList: [] }],
        ];
        await render(<ForegroundCameraComp />);
        const chips = Array.from(
            container.querySelectorAll<HTMLButtonElement>('.fg-hide'),
        );
        // A camera with no name is called by its id rather than by nothing.
        expect(
            chips.map((chip) => {
                return `${chip.getAttribute('aria-label')}|${chip.title}`;
            }),
        ).toEqual(['Hide Camera 1|Front Camera', 'Hide Camera 1|cam-b']);
        await act(async () => {
            chips[1].click();
        });
        expect(managerCalls('removeCameraData')).toEqual([
            [1, { id: 'cam-b', label: '', extraStyle: {} }],
        ]);

        mocks.manager.mockClear();
        const style = { width: '33%' };
        state.propsOptions.get('camera-cam-a').onChange(style, true);
        state.propsOptions.get('camera-cam-b').onChange(style, false);
        await act(async () => {
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(
            mocks.manager.mock.calls.map(([screenId, name, data]) => {
                return [screenId, name, data];
            }),
        ).toEqual([
            [
                1,
                'removeCameraData',
                { id: 'cam-a', label: 'Front Camera', extraStyle: {} },
            ],
            [
                1,
                'addCameraData',
                {
                    id: 'cam-a',
                    label: 'Front Camera',
                    extraStyle: style,
                    isBehind: true,
                },
            ],
            [1, 'removeCameraData', { id: 'cam-b', label: '', extraStyle: {} }],
            [1, 'addCameraData', { id: 'cam-b', label: '', extraStyle: style }],
        ]);
    });
});
