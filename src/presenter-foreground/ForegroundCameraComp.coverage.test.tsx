// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Camera Show: one card per camera device -- show it, drag it onto a screen,
// restyle it where it is up, take it down. Whether a device opens at all is
// in `ForegroundCameraComp.test.tsx`.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        cameraList: [] as { deviceId: string; label: string }[],
        screens: [] as [number, any][],
        propsOptions: new Map<string, any>(),
        isBehind: new Map<string, boolean>(),
        transitions: new Map<string, string>(),
        dropManager: null as any,
        dragStore: { onDropped: null as any },
    },
    mocks: {
        openCamera: vi.fn(),
        releaseCamera: vi.fn(),
        addCameraData: vi.fn(),
        managerAdd: vi.fn(),
        managerRemove: vi.fn(),
        drag: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffectAsync: (
            effect: () => Promise<(() => void) | void>,
            deps: unknown[],
        ) => {
            useEffect(() => {
                const done = effect();
                return () => {
                    done.then((cleanup) => {
                        if (typeof cleanup === 'function') {
                            cleanup();
                        }
                    });
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../others/LoadingComp', () => ({
    default: () => <span data-testid="loading" />,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ label, onOpening }: any) => (
        <button type="button" aria-label={label} onClick={onOpening} />
    ),
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: { addCameraData: mocks.addCameraData },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => {},
}));
vi.mock('./foregroundHelpers', () => ({
    getForegroundShowingScreenIdDataList: (
        predicate: (value: any) => boolean,
    ) => state.screens.filter(([, data]) => predicate(data)),
    getScreenForegroundManagerInstances: (
        screenId: number,
        callback: (value: any) => void,
    ) => {
        callback({
            addCameraData: (data: any) => mocks.managerAdd(screenId, data),
            removeCameraData: (data: any) =>
                mocks.managerRemove(screenId, data),
        });
    },
    getScreenForegroundManagerByDropped: () => state.dropManager,
}));
vi.mock('../_screen/preview/ShowingScreenIcon', () => ({
    default: () => <i />,
}));
vi.mock('./propertiesSettingHelpers', () => ({
    getForegroundIsBehind: (prefix: string) =>
        state.isBehind.get(prefix) ?? false,
    useForegroundPropsSetting: (options: any) => {
        state.propsOptions.set(options.prefix, options);
        return { genStyle: () => ({ opacity: 0.7 }), element: null };
    },
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: (_widgetKey: string, prefix: string) =>
        state.transitions.get(prefix),
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ target, children }: any) => (
        <div data-layout-target={target}>{children}</div>
    ),
}));
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
vi.mock('../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: async (options: any) => {
        mocks.openCamera(options);
        return mocks.releaseCamera;
    },
    useCameraInfoList: () => state.cameraList,
}));

import ForegroundCameraComp from './ForegroundCameraComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.cameraList = [
        { deviceId: 'cam-a', label: 'Front Camera' },
        { deviceId: 'cam-b', label: '' },
    ];
    state.screens = [];
    state.propsOptions.clear();
    state.isBehind.clear();
    state.transitions.clear();
    state.dropManager = null;
    state.dragStore.onDropped = null;
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
        root.render(<ForegroundCameraComp />);
    });
}
function getCardBody(index: number) {
    return container.querySelectorAll('.card-body')[index] as HTMLElement;
}

describe('a camera card', () => {
    test('opens its device into the card, and releases it when the card goes', async () => {
        await render();
        expect(mocks.openCamera).toHaveBeenCalledTimes(2);
        expect(mocks.openCamera.mock.calls[0][0]).toMatchObject({
            id: 'cam-a',
            label: 'Front Camera',
            width: 300,
            parentContainer: getCardBody(0),
        });
        expect(
            (container.querySelector('.card-header') as HTMLElement).title,
        ).toBe('Front Camera');
        expect(state.propsOptions.get('camera-cam-a')).toMatchObject({
            isBlendMode: true,
            widgetKey: 'camera',
        });
        await act(async () => root.render(null));
        expect(mocks.releaseCamera).toHaveBeenCalledTimes(2);
    });

    test('a click shows it, a right click or the dots ask where', async () => {
        state.transitions.set('camera-cam-a', 'fade');
        state.isBehind.set('camera-cam-a', true);
        await render();
        await act(async () => getCardBody(0).click());
        expect(mocks.addCameraData).toHaveBeenLastCalledWith(
            expect.anything(),
            {
                id: 'cam-a',
                label: 'Front Camera',
                extraStyle: { opacity: 0.7 },
                transitionEffect: 'fade',
                isBehind: true,
            },
            false,
        );
        await act(async () => {
            getCardBody(1).dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            );
        });
        expect(mocks.addCameraData).toHaveBeenLastCalledWith(
            expect.anything(),
            { id: 'cam-b', label: '', extraStyle: { opacity: 0.7 } },
            true,
        );
        const dots = container.querySelectorAll(
            'button[aria-label="Show on Screens"]',
        );
        await act(async () => (dots[0] as HTMLButtonElement).click());
        expect(mocks.addCameraData.mock.calls.at(-1)?.[2]).toBe(true);
    });

    test('a drag carries the camera, and only a screen takes the drop', async () => {
        await render();
        await act(async () => {
            getCardBody(0).dispatchEvent(
                new Event('dragstart', { bubbles: true }),
            );
        });
        const dragData = mocks.drag.mock.calls.at(-1)?.[1];
        expect(dragData.kind).toBe('camera');
        state.transitions.set('camera-cam-a', 'zoom');
        expect(dragData.getData()).toEqual({
            id: 'cam-a',
            label: 'Front Camera',
            extraStyle: { opacity: 0.7 },
            transitionEffect: 'zoom',
        });
        await act(async () => state.dragStore.onDropped({}));
        const dropAdd = vi.fn();
        state.dropManager = { addCameraData: dropAdd };
        state.isBehind.set('camera-cam-a', true);
        await act(async () => state.dragStore.onDropped({}));
        expect(dropAdd).toHaveBeenCalledExactlyOnceWith({
            id: 'cam-a',
            label: 'Front Camera',
            extraStyle: { opacity: 0.7 },
            transitionEffect: 'zoom',
            isBehind: true,
        });
        expect(mocks.managerAdd).not.toHaveBeenCalled();
    });
});

describe('a camera on the screens', () => {
    test('is listed under its own card by its name, and comes down from one screen', async () => {
        const frontOnScreen = { id: 'cam-a', label: 'Front Camera' };
        const unnamedOnScreen = { id: 'cam-b', label: '' };
        state.screens = [
            [1, { cameraDataList: [frontOnScreen, unnamedOnScreen] }],
            [2, { cameraDataList: [] }],
        ];
        await render();
        const hideButtons = Array.from(
            container.querySelectorAll('button.fg-hide'),
        ) as HTMLButtonElement[];
        // The NAME, and the id only for a device with none.
        expect(hideButtons.map((button) => button.title)).toEqual([
            'Front Camera',
            'cam-b',
        ]);
        await act(async () => hideButtons[1].click());
        expect(mocks.managerRemove).toHaveBeenCalledExactlyOnceWith(
            1,
            unnamedOnScreen,
        );
    });

    test('a Properties change replaces it on every screen once the hand stops', async () => {
        const frontOnScreen = { id: 'cam-a', label: 'Front Camera' };
        state.screens = [
            [1, { cameraDataList: [frontOnScreen] }],
            [3, { cameraDataList: [frontOnScreen] }],
        ];
        await render();
        await act(async () => {
            state.propsOptions
                .get('camera-cam-a')
                .onChange({ opacity: 0.1 }, true);
            await vi.advanceTimersByTimeAsync(499);
        });
        expect(mocks.managerAdd).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(mocks.managerRemove.mock.calls).toEqual([
            [1, frontOnScreen],
            [3, frontOnScreen],
        ]);
        expect(mocks.managerAdd.mock.calls).toEqual([
            [
                1,
                {
                    ...frontOnScreen,
                    extraStyle: { opacity: 0.1 },
                    isBehind: true,
                },
            ],
            [
                3,
                {
                    ...frontOnScreen,
                    extraStyle: { opacity: 0.1 },
                    isBehind: true,
                },
            ],
        ]);
    });

    test('two cameras changed together are both refreshed', async () => {
        const front = { id: 'cam-a', label: 'Front Camera' };
        const back = { id: 'cam-b', label: '' };
        state.screens = [[1, { cameraDataList: [front, back] }]];
        await render();
        await act(async () => {
            state.propsOptions.get('camera-cam-a').onChange({ top: 1 }, false);
            state.propsOptions.get('camera-cam-b').onChange({ top: 2 }, false);
            await vi.advanceTimersByTimeAsync(500);
        });
        expect(mocks.managerAdd.mock.calls).toEqual([
            [1, { ...front, extraStyle: { top: 1 } }],
            [1, { ...back, extraStyle: { top: 2 } }],
        ]);
    });
});
