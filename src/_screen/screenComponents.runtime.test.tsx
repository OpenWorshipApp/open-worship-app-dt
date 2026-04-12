// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const createScreenManagerMock = vi.fn();
const genStyleRenderingMock = vi.fn();
const getScreenManagerBaseMock = vi.fn((screenId: number) => ({ screenId }));
const getCameraStreamMock = vi.fn();
const handleErrorMock = vi.fn();
const showAppAlertMock = vi.fn();
const useScreenManagerEventsMock = vi.fn(
    (_events: string[], _screenManager: unknown, callback?: () => void) => {
        callback?.();
    },
);
const useScreenBibleManagerEventsMock = vi.fn();

const appProviderMock = {
    isPageScreen: false,
};

let screenManager: any;

vi.mock('../helper/debuggerHelpers', async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('./managers/ScreenManager', () => ({
    default: class ScreenManager {
        static readonly initReceiveScreenMessage = vi.fn();
    },
}));

vi.mock('./managers/ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static readonly textStyleTextColor = '#ffffff';
        static readonly textStyleText = 'font-size: 64px;';
    },
}));

vi.mock('./managers/screenManagerHelpers', () => ({
    createScreenManager: createScreenManagerMock,
}));

vi.mock('./preview/MiniScreenAppComp', () => ({
    genStyleRendering: genStyleRenderingMock,
}));

vi.mock('./managers/screenManagerHooks', () => ({
    ScreenManagerBaseContext: ({ children }: any) => {
        return <div data-screen-manager-context="true">{children}</div>;
    },
    useScreenManagerBaseContext: () => screenManager,
    useScreenManagerContext: () => screenManager,
    useScreenManagerEvents: useScreenManagerEventsMock,
}));

vi.mock('./managers/screenEventHelpers', () => ({
    useScreenBibleManagerEvents: useScreenBibleManagerEventsMock,
}));

vi.mock('./managers/screenManagerBaseHelpers', () => ({
    getScreenManagerBase: getScreenManagerBaseMock,
}));

vi.mock('../helper/cameraHelpers', () => ({
    getCameraStream: getCameraStreamMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: showAppAlertMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../others/initHelpers', () => ({
    getColorParts: () => ({
        colorPart: '#111111',
        invertColorPart: '#eeeeee',
    }),
}));

vi.mock('../helper/domHelpers', () => ({
    checkIsZoomed: () => false,
}));

vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));

vi.mock('./ScreenBackgroundColorComp', () => ({
    default: ({ color }: any) => <div data-background="color">{color}</div>,
}));

vi.mock('./ScreenBackgroundImageComp', () => ({
    default: ({ backgroundSrc }: any) => {
        return <div data-background="image">{backgroundSrc.src}</div>;
    },
}));

vi.mock('./ScreenBackgroundVideoComp', () => ({
    default: ({ backgroundSrc }: any) => {
        return <div data-background="video">{backgroundSrc.src}</div>;
    },
}));

function createScreenManagerStub() {
    const hide = vi.fn();
    const sendScreenMessage = vi.fn();
    return {
        hide,
        sendScreenMessage,
        getElementsByDomSelector: vi.fn(() => []),
        screenBackgroundManager: {
            render: vi.fn(),
            rootContainer: null,
            containerStyle: {
                position: 'absolute',
                width: '100%',
                height: '100%',
            },
        },
        screenForegroundManager: {
            render: vi.fn(),
            div: null,
            containerStyle: {
                position: 'absolute',
                width: '100%',
                height: '100%',
            },
        },
        screenVaryAppDocumentManager: {
            render: vi.fn(),
            div: null,
            containerStyle: {
                position: 'absolute',
                width: '100%',
                height: '100%',
            },
        },
        screenBibleManager: {
            render: vi.fn(),
            div: null,
            containerStyle: {
                position: 'absolute',
                width: '100%',
                height: '100%',
            },
        },
        backgroundEffectManager: {
            styleAnimList: {
                fade: { styleText: '.fade{}' },
                zoom: { styleText: '.zoom{}' },
            },
        },
        varyAppDocumentEffectManager: {
            styleAnimList: {
                fade: { styleText: '.fade{}' },
            },
        },
        foregroundEffectManager: {
            styleAnimList: {
                move: { styleText: '.move{}' },
            },
        },
    };
}

describe('screen component runtime behavior', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        screenManager = createScreenManagerStub();
        createScreenManagerMock.mockReset();
        createScreenManagerMock.mockReturnValue(screenManager);
        genStyleRenderingMock.mockReset();
        genStyleRenderingMock.mockImplementation((effectManager: any) => {
            return Object.entries(effectManager.styleAnimList).map(
                ([effectType, styleAnim]: [string, any]) => {
                    return <style key={effectType}>{styleAnim.styleText}</style>;
                },
            );
        });
        useScreenManagerEventsMock.mockClear();
        useScreenBibleManagerEventsMock.mockClear();
        getCameraStreamMock.mockReset();
        handleErrorMock.mockReset();
        showAppAlertMock.mockReset();
        appProviderMock.isPageScreen = false;
        globalThis.history.replaceState({}, '', '?screenId=5');
        Object.defineProperty(globalThis.URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:test'),
        });
        Object.defineProperty(HTMLMediaElement.prototype, 'play', {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        vi.clearAllMocks();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('mounts screen wrappers inside the app and wires manager refs', async () => {
        const { default: ScreenAppComp } = await import('./ScreenAppComp');

        appProviderMock.isPageScreen = true;
        const tracked = document.createElement('div');
        tracked.className = 'tracked-node';
        document.body.appendChild(tracked);

        await act(async () => {
            root.render(<ScreenAppComp />);
        });

        expect(container.querySelector('#background')).not.toBeNull();
        expect(container.querySelector('#slide')).not.toBeNull();
        expect(container.querySelector('#bible-screen-view')).not.toBeNull();
        expect(container.querySelector('#foreground')).not.toBeNull();
        expect(container.querySelector('#close')).not.toBeNull();

        expect(screenManager.screenBackgroundManager.render).toHaveBeenCalledOnce();
        expect(screenManager.screenVaryAppDocumentManager.render).toHaveBeenCalledOnce();
        expect(screenManager.screenBibleManager.render).toHaveBeenCalledOnce();
        expect(screenManager.screenForegroundManager.render).toHaveBeenCalledOnce();
        expect(screenManager.screenBackgroundManager.rootContainer).toBe(
            container.querySelector('#background'),
        );
        expect(screenManager.screenVaryAppDocumentManager.div).toBe(
            container.querySelector('#slide'),
        );
        expect(screenManager.screenBibleManager.div).toBe(
            container.querySelector('#bible-screen-view'),
        );
        expect(screenManager.screenForegroundManager.div).toBe(
            container.querySelector('#foreground'),
        );
        expect(screenManager.sendScreenMessage).toHaveBeenCalledWith(
            {
                screenId: 5,
                type: 'init',
                data: null,
            },
            true,
        );
        expect(screenManager.getElementsByDomSelector('.tracked-node')).toEqual([
            tracked,
        ]);

        await act(async () => {
            container.querySelector('#close')?.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(screenManager.hide).toHaveBeenCalledOnce();

        await act(async () => {
            root.unmount();
        });
        expect(screenManager.getElementsByDomSelector('.tracked-node')).toEqual(
            [],
        );

        tracked.remove();
        root = createRoot(container);
    });

    test('returns null for invalid screen ids and missing screen managers', async () => {
        const { default: ScreenAppComp } = await import('./ScreenAppComp');

        globalThis.history.replaceState({}, '', '?screenId=');
        await act(async () => {
            root.render(<ScreenAppComp />);
        });
        expect(container.innerHTML).toBe('');
        expect(createScreenManagerMock.mock.calls[0]?.[0]).toBeNaN();

        globalThis.history.replaceState({}, '', '?screenId=7');
        createScreenManagerMock.mockReset();
        createScreenManagerMock.mockReturnValue(null);
        await act(async () => {
            root.render(<ScreenAppComp />);
        });
        expect(container.innerHTML).toBe('');
    });

    test('renders background variants and camera streams', async () => {
        const { RenderBackground, genHtmlBackground } = await import(
            './ScreenBackgroundComp'
        );

        expect(
            renderToStaticMarkup(<RenderBackground backgroundSrc={null as any} />),
        ).toContain('position:absolute');
        expect(
            renderToStaticMarkup(
                <RenderBackground
                    backgroundSrc={{ type: 'audio', src: '/audio.mp3' } as any}
                />,
            ),
        ).not.toContain('data-background=');
        expect(
            renderToStaticMarkup(
                <RenderBackground
                    backgroundSrc={{ type: 'image', src: '/image.png' } as any}
                />,
            ),
        ).toContain('data-background="image"');
        expect(
            renderToStaticMarkup(
                <RenderBackground
                    backgroundSrc={{ type: 'video', src: '/video.mp4' } as any}
                />,
            ),
        ).toContain('data-background="video"');
        expect(
            renderToStaticMarkup(
                <RenderBackground
                    backgroundSrc={{ type: 'color', src: '#123456' } as any}
                />,
            ),
        ).toContain('data-background="color"');

        const webBackground = genHtmlBackground(5, {
            type: 'web',
            src: 'https://example.com/embed',
            extraStyle: { opacity: '0.6' },
        } as any);
        expect(webBackground.newDiv.tagName).toBe('IFRAME');
        expect((webBackground.newDiv as HTMLIFrameElement).src).toContain(
            'https://example.com/embed',
        );
        expect(webBackground.newDiv.style.opacity).toBe('0.6');

        const stopTrack = vi.fn();
        getCameraStreamMock.mockResolvedValue({
            getTracks: () => [{ stop: stopTrack }],
        });
        const cameraBackground = genHtmlBackground(5, {
            type: 'camera',
            src: 'camera-1',
            extraStyle: { opacity: '0.5' },
        } as any);
        await act(async () => {
            await Promise.resolve();
        });
        const cameraVideo = cameraBackground.newDiv.querySelector(
            'video',
        ) as HTMLVideoElement | null;
        expect(cameraVideo).not.toBeNull();
        expect(cameraBackground.newDiv.style.opacity).toBe('0.5');
        cameraVideo?.onloadedmetadata?.(new Event('loadedmetadata'));
        const clearTracks = await cameraBackground.promise;
        clearTracks();
        expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
        expect(stopTrack).toHaveBeenCalledOnce();
    });

    test('handles camera background failures with a user-facing alert', async () => {
        const { genHtmlBackground } = await import('./ScreenBackgroundComp');

        getCameraStreamMock.mockRejectedValue(new Error('camera denied'));
        genHtmlBackground(5, {
            type: 'camera',
            src: 'camera-2',
        } as any);

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(handleErrorMock).toHaveBeenCalledOnce();
        expect(showAppAlertMock).toHaveBeenCalledWith(
            'Camera Error',
            'Unable to access the camera for background. Please check your camera settings.',
        );
    });
});
