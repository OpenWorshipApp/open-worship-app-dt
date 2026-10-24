// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
    state: {
        cameraList: [] as { deviceId: string; label: string }[],
        // What the real `getCameraAndShowMedia` does with a device it cannot
        // open: says so through `onUnavailable`, then hands back a release.
        openCamera: vi.fn(async (_options: any) => () => {}),
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: false,
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        messageUtils: { listenForData: vi.fn(), sendData: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/LoadingComp', () => ({
    default: () => <span data-testid="loading">Loading</span>,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => null,
}));
vi.mock('../_screen/managers/ScreenForegroundManager', () => ({
    default: { addCameraData: vi.fn() },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenForegroundManagerEvents: () => {},
}));
vi.mock('./foregroundHelpers', () => ({
    getScreenForegroundManagerInstances: vi.fn(),
    getForegroundShowingScreenIdDataList: () => [],
    getScreenForegroundManagerByDropped: () => null,
}));
vi.mock('./ScreensRendererComp', () => ({ default: () => null }));
vi.mock('./propertiesSettingHelpers', () => ({
    getForegroundIsBehind: () => false,
    useForegroundPropsSetting: () => ({
        genStyle: () => ({}),
        element: null,
    }),
}));
vi.mock('./foregroundTransitionHelpers', () => ({
    resolveForegroundTransition: () => undefined,
}));
vi.mock('./ForegroundLayoutComp', () => ({
    default: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../helper/dragHelpers', () => ({
    dragStore: {},
    handleDragStart: vi.fn(),
}));
vi.mock('./foregroundDragHelpers', () => ({
    genForegroundDragInf: vi.fn(),
}));
vi.mock('../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: state.openCamera,
    useCameraInfoList: () => state.cameraList,
}));

import ForegroundCameraComp from './ForegroundCameraComp';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    state.openCamera.mockClear();
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe('ForegroundCameraComp', () => {
    test('a camera that cannot be started says so instead of spinning for good', async () => {
        state.cameraList = [{ deviceId: 'obs', label: 'OBS Virtual Camera' }];
        state.openCamera.mockImplementationOnce(async (options: any) => {
            options.onUnavailable(options.label);
            return () => {};
        });
        await act(async () => root.render(<ForegroundCameraComp />));
        expect(state.openCamera).toHaveBeenCalledOnce();
        expect(container.querySelector('[data-testid="loading"]')).toBeNull();
        expect(container.textContent).toContain(
            'This camera could not be started. Another app may be using it.',
        );
    });

    test('a camera that opens keeps its tile for the picture', async () => {
        state.cameraList = [{ deviceId: 'hp', label: 'HP 5MP Camera' }];
        await act(async () => root.render(<ForegroundCameraComp />));
        expect(container.textContent).not.toContain('could not be started');
    });
});
