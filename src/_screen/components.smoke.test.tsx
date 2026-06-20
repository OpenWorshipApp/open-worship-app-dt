// @vitest-environment jsdom

import { createContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const handleCtrlWheelMock = vi.fn();
const hideMock = vi.fn();
const sendScreenMessageMock = vi.fn();
const showAppContextMenuMock = vi.fn();
const createRootRenderMock = vi.fn();
const getSettingMock = vi.fn();
const setPreviewScaleMock = vi.fn();

const effectManagerStub = {
    effectType: 'fade',
    styleAnimList: {
        fade: { styleText: '.fade{}' },
        zoom: { styleText: '.zoom{}' },
    },
};

const screenManagerMock: any = {
    screenId: 1,
    key: '1',
    displayId: 2,
    width: 1280,
    height: 720,
    isSelected: true,
    isShowing: true,
    isLocked: false,
    stageNumber: 2,
    hide: hideMock,
    clear: vi.fn(),
    fireRefreshEvent: vi.fn(),
    receiveScreenDropped: vi.fn(),
    registerEventListener: vi.fn(() => []),
    unregisterEventListener: vi.fn(),
    sendScreenMessage: sendScreenMessageMock,
    getElementsByDomSelector: vi.fn(() => []),
    screenBackgroundManager: {
        render: vi.fn(),
        rootContainer: null,
        containerStyle: { position: 'absolute', width: '100%', height: '100%' },
        backgroundSrc: { type: 'video', src: '/video.mp4' },
        isShowing: true,
        clear: vi.fn(),
        setBackgroundVideoCurrentTimeForce: vi.fn(),
    },
    screenVaryAppDocumentManager: {
        render: vi.fn(),
        div: null,
        containerStyle: { position: 'absolute', width: '100%', height: '100%' },
        isShowing: true,
        clear: vi.fn(),
    },
    screenBibleManager: {
        render: vi.fn(),
        div: null,
        containerStyle: { position: 'absolute', width: '100%', height: '100%' },
        isShowing: true,
        clear: vi.fn(),
        screenViewData: { type: 'bible-item' },
        isLineSync: false,
        handleScreenVersesHighlighting: vi.fn(),
        handleBibleViewVersesHighlighting: vi.fn(),
        applyBibleViewData: vi.fn(),
    },
    screenForegroundManager: {
        render: vi.fn(),
        div: null,
        containerStyle: { position: 'absolute', width: '100%', height: '100%' },
        isShowing: true,
        clear: vi.fn(),
    },
    backgroundEffectManager: effectManagerStub,
    varyAppDocumentEffectManager: effectManagerStub,
    foregroundEffectManager: effectManagerStub,
};

vi.mock('../server/appProvider', () => ({
    default: {
        isPageScreen: true,
    },
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffect: vi.fn(),
    useAppEffectAsync: vi.fn(),
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: getSettingMock,
    useStateSettingNumber: vi.fn(() => [9, setPreviewScaleMock]),
}));

vi.mock('../helper/domHelpers', () => ({
    checkIsZoomed: () => false,
    handleAutoHide: vi.fn(),
}));

vi.mock('../others/AppRangeComp', () => ({
    default: ({ value, title }: any) => (
        <div data-range-title={title}>{value}</div>
    ),
    handleCtrlWheel: handleCtrlWheelMock,
    useZoomingRegistering: () => {},
}));

vi.mock('../others/themeHelpers', () => ({
    checkIsDarkMode: () => false,
    getColorParts: () => ({ colorPart: '#111111', invertColorPart: '#eeeeee' }),
}));

vi.mock('../others/color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
}));

vi.mock('../helper/cameraHelpers', () => ({
    getCameraStream: vi.fn(async () => ({ getTracks: () => [] })),
}));

vi.mock('../helper/audioControlHelpers', () => ({
    handleAudioPlaying: vi.fn(),
    handleAudioPausing: vi.fn(),
    handleAudioEnding: vi.fn(),
}));

vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: showAppContextMenuMock,
}));

vi.mock('../event/KeyboardEventListener', () => ({
    toShortcutKey: vi.fn(() => 'F5'),
    useKeyboardRegistering: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('../others/ItemColorNoteComp', () => ({
    default: () => <div>ColorNote</div>,
}));

vi.mock('../others/AppSuspenseComp', () => ({
    default: ({ children }: any) => <>{children}</>,
}));

vi.mock('../helper/colorNoteHelpers', () => ({
    genColorBar: (color: string) => <div key={color}>bar-{color}</div>,
    genColorMap: (items: any[]) => ({ none: items }),
    genColorNoteDataList: () => ['none'],
}));

vi.mock('../bible-reader/BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => ({
        nestedBibleItems: [],
        appendBibleItem: vi.fn(),
        handleVersesHighlighting: vi.fn(),
        handleScreenBibleVersesHighlighting: vi.fn(),
    }),
}));

vi.mock('../bible-list/BibleItem', () => ({
    default: class BibleItem {
        static fromJson(json: any) {
            return json;
        }
    },
}));

vi.mock('../helper/dragHelpers', () => ({
    dragStore: { onDropped: vi.fn() },
    extractDropData: vi.fn(() => null),
}));

vi.mock('react-dom/client', () => ({
    createRoot: vi.fn(() => ({
        render: createRootRenderMock,
    })),
}));

vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: vi.fn(() => (func: () => void) => func()),
}));

vi.mock('./screenHelpers', () => ({
    calMediaSizes: vi.fn(() => ({
        width: 100,
        height: 50,
        offsetH: 1,
        offsetV: 2,
    })),
    genVideoIDFromSrc: vi.fn(() => 'video-md5'),
    getAllDisplays: vi.fn(() => ({
        primaryDisplay: {
            id: 1,
            bounds: { x: 0, y: 0, width: 1920, height: 1080 },
            label: 'Main',
        },
        displays: [
            {
                id: 1,
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                label: 'Main',
            },
            {
                id: 2,
                bounds: { x: 0, y: 0, width: 1280, height: 720 },
                label: 'Projector',
            },
        ],
    })),
    hideScreen: hideMock,
}));

vi.mock('./managers/ScreenManager', () => ({
    default: class ScreenManager {
        static readonly initReceiveScreenMessage = vi.fn();
    },
}));

vi.mock('./managers/screenManagerHelpers', () => ({
    createScreenManager: vi.fn(() => screenManagerMock),
    genNewScreenManagerBase: vi.fn(),
    getAllScreenManagers: vi.fn(() => [screenManagerMock]),
    getScreenManagersFromSetting: vi.fn(() => [screenManagerMock]),
    getScreenManagerByScreenId: vi.fn(() => screenManagerMock),
}));

vi.mock('./managers/screenManagerBaseHelpers', () => ({
    getScreenManagerBase: vi.fn(() => screenManagerMock),
    getSelectedScreenManagerBases: vi.fn(() => [screenManagerMock]),
    getValidOnScreen: vi.fn((data: any) => data),
}));

vi.mock('./managers/screenEventHelpers', () => ({
    useScreenBackgroundManagerEvents: vi.fn(),
    useScreenBibleManagerEvents: vi.fn(),
    useScreenForegroundManagerEvents: vi.fn(),
    useScreenEvents: vi.fn(),
    useScreenVaryAppDocumentManagerEvents: vi.fn(),
}));

vi.mock('./managers/ScreenBibleManager', () => ({
    default: class ScreenBibleManager {
        static readonly textStyleTextColor = '#ffffff';
        static readonly textStyleTextFontSize = 64;
    },
}));

vi.mock('./managers/screenManagerHooks', async () => {
    const ScreenManagerBaseContext = createContext<any>(screenManagerMock);
    return {
        ScreenManagerBaseContext,
        useScreenManagerBaseContext: () => screenManagerMock,
        useScreenManagerContext: () => screenManagerMock,
        useScreenManagerEvents: vi.fn(),
        useScreenUpdateEvents: vi.fn(),
        useScreenVideoSources: vi.fn(() => [['/video.mp4', 'video-md5']]),
    };
});

vi.mock('./preview/MiniScreenAudioHandlersComp', async () => {
    const actual = (await vi.importActual(
        './preview/MiniScreenAudioHandlersComp',
    )) as any;
    return actual;
});

vi.mock('../app-document-list/Slide', () => ({
    default: class Slide {
        static readonly validate = vi.fn();
    },
}));

vi.mock('../app-document-list/PdfSlide', () => ({
    default: class PdfSlide {
        static readonly tryValidate = vi.fn(
            (item: any) => item?.kind === 'pdf',
        );
    },
}));

vi.mock('../app-document-list/PptxSlide', () => ({
    default: class PptxSlide {
        static readonly tryValidate = vi.fn(
            (item: any) => item?.kind === 'pptx',
        );
    },
}));

vi.mock('../app-document-list/DocxSlide', () => ({
    default: class DocxSlide {
        static readonly tryValidate = vi.fn(
            (item: any) => item?.kind === 'docx',
        );
    },
}));

describe('screen component smoke tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        globalThis.history.replaceState({}, '', '?screenId=1');
        Object.defineProperty(document.body, 'innerHTML', {
            configurable: true,
            writable: true,
            value: '',
        });
        getSettingMock.mockImplementation((key: string) => {
            if (key.toLowerCase().includes('vary')) {
                return JSON.stringify({
                    1: {
                        filePath: '/slides/test.slide',
                        itemJson: {
                            kind: 'slide',
                            id: 7,
                            metadata: {},
                            canvasItems: [],
                        },
                    },
                });
            }
            return undefined;
        });
    });

    test('renders root screen components with mocked screen manager context', async () => {
        const { default: ScreenBackgroundColorComp } =
            await import('./ScreenBackgroundColorComp');
        const { default: ScreenBackgroundImageComp } =
            await import('./ScreenBackgroundImageComp');
        const { default: ScreenBackgroundVideoComp } =
            await import('./ScreenBackgroundVideoComp');
        const { default: ScreenBackgroundComp } =
            await import('./ScreenBackgroundComp');
        const { default: ScreenBibleComp } = await import('./ScreenBibleComp');
        const { default: ScreenForegroundComp } =
            await import('./ScreenForegroundComp');
        const { default: ScreenSlideComp } =
            await import('./ScreenVaryAppDocumentComp');
        const { default: ScreenCloseButtonComp } =
            await import('./ScreenCloseButtonComp');
        const { default: RenderTransitionEffectComp } =
            await import('./RenderTransitionEffectComp');
        const { default: ScreenEffectControlComp } =
            await import('./preview/ScreenEffectControlComp');
        const { default: ScreenAppComp } = await import('./ScreenAppComp');

        expect(
            renderToStaticMarkup(<ScreenBackgroundColorComp color="#123456" />),
        ).toContain('background-color:#123456');
        expect(
            renderToStaticMarkup(
                <ScreenBackgroundImageComp
                    backgroundSrc={{ type: 'image', src: '/image.png' } as any}
                />,
            ),
        ).toContain('/image.png');
        expect(
            renderToStaticMarkup(
                <ScreenBackgroundVideoComp
                    backgroundSrc={{ type: 'video', src: '/video.mp4' } as any}
                />,
            ),
        ).toContain('video-md5');
        expect(renderToStaticMarkup(<ScreenBackgroundComp />)).toContain(
            'id="background"',
        );
        expect(renderToStaticMarkup(<ScreenBibleComp />)).toContain(
            'id="bible-screen-view"',
        );
        expect(renderToStaticMarkup(<ScreenForegroundComp />)).toContain(
            'id="foreground"',
        );
        expect(renderToStaticMarkup(<ScreenSlideComp />)).toContain(
            'id="slide"',
        );
        expect(renderToStaticMarkup(<ScreenCloseButtonComp />)).toContain('❌');
        expect(
            renderToStaticMarkup(
                <RenderTransitionEffectComp
                    title="Slide"
                    domTitle="Slide transition"
                    screenEffectManager={effectManagerStub as any}
                />,
            ),
        ).toContain('Slide');
        expect(renderToStaticMarkup(<ScreenEffectControlComp />)).toContain(
            'Transition',
        );

        const appHtml = renderToStaticMarkup(<ScreenAppComp />);
        expect(appHtml).toContain('id="background"');
        expect(appHtml).toContain('id="foreground"');
        expect(sendScreenMessageMock).toHaveBeenCalledWith(
            {
                screenId: 1,
                type: 'init',
                data: null,
            },
            true,
        );
    });

    test('renders background video sizing and playback attributes', async () => {
        const { default: ScreenBackgroundVideoComp } =
            await import('./ScreenBackgroundVideoComp');

        const html = renderToStaticMarkup(
            <ScreenBackgroundVideoComp
                backgroundSrc={{ type: 'video', src: '/background.mp4' } as any}
            />,
        );
        const normalizedHtml = html.toLowerCase();

        expect(html).toContain('src="/background.mp4"');
        expect(html).toContain('width:100px');
        expect(html).toContain('height:50px');
        expect(html).toContain('translate(1px, 2px)');
        expect(normalizedHtml).toContain('autoplay=""');
        expect(normalizedHtml).toContain('loop=""');
        expect(normalizedHtml).toContain('muted=""');
        expect(normalizedHtml).toContain('playsinline=""');
    });

    test('renders preview components and preview helpers', async () => {
        const { default: MiniScreenFooterComp } =
            await import('./preview/MiniScreenFooterComp');
        const { default: MiniScreenBodyComp } =
            await import('./preview/MiniScreenBodyComp');
        const { default: MiniScreenAppComp, genStyleRendering } =
            await import('./preview/MiniScreenAppComp');
        const { default: MiniScreenComp } =
            await import('./preview/MiniScreenComp');
        const { default: ScreenPreviewerHeaderComp } =
            await import('./preview/ScreenPreviewerHeaderComp');
        const { default: ScreenPreviewerFooterComp } =
            await import('./preview/ScreenPreviewerFooterComp');
        const { default: ScreenPreviewerItemComp } =
            await import('./preview/ScreenPreviewerItemComp');
        const { default: MiniScreenClearControlComp } =
            await import('./preview/MiniScreenClearControlComp');
        const { default: ShowHideScreen } =
            await import('./preview/ShowHideScreen');
        const { default: DisplayControl } =
            await import('./preview/DisplayControl');
        const { default: MiniScreenAudioHandlersComp } =
            await import('./preview/MiniScreenAudioHandlersComp');
        const { default: ShowingScreenIcon } =
            await import('./preview/ShowingScreenIcon');
        const previewHelpers = await import('./preview/screenPreviewerHelpers');

        expect(
            renderToStaticMarkup(
                <MiniScreenFooterComp
                    previewSizeScale={9}
                    setPreviewSizeScale={setPreviewScaleMock}
                />,
            ),
        ).toContain('Preview Size Scale');
        expect(
            renderToStaticMarkup(<MiniScreenBodyComp previewScale={2} />),
        ).toContain('mini-screen-previewer-custom-html');
        expect(
            renderToStaticMarkup(<MiniScreenAppComp screenId={1} />),
        ).toContain('background-image');
        expect(renderToStaticMarkup(<MiniScreenComp />)).toContain(
            'card-footer',
        );
        expect(renderToStaticMarkup(<ScreenPreviewerHeaderComp />)).toContain(
            'ColorNote',
        );
        expect(renderToStaticMarkup(<ScreenPreviewerFooterComp />)).toContain(
            'Stage',
        );
        expect(
            renderToStaticMarkup(<ScreenPreviewerItemComp width={200} />),
        ).toContain('mini-screen-previewer-custom-html');
        expect(renderToStaticMarkup(<MiniScreenClearControlComp />)).toContain(
            'Clear All',
        );
        expect(renderToStaticMarkup(<ShowHideScreen />)).toContain(
            'Toggle showing screen',
        );
        expect(renderToStaticMarkup(<DisplayControl />)).toContain('Projector');
        expect(
            renderToStaticMarkup(
                <MiniScreenAudioHandlersComp
                    src="https%3A%2F%2Fexample.com%2Faudio.mp3"
                    videoId="video-md5"
                />,
            ),
        ).toContain('audio.mp3');
        expect(
            renderToStaticMarkup(<ShowingScreenIcon screenId={1} />),
        ).toContain('Screen: 1');

        expect(genStyleRendering(effectManagerStub as any)).toHaveLength(2);

        previewHelpers.openContextMenu(
            new MouseEvent('contextmenu'),
            screenManagerMock,
        );
        expect(showAppContextMenuMock).toHaveBeenCalledOnce();
        expect(previewHelpers.getAppDocumentListOnScreenSetting()).toEqual({
            1: {
                filePath: '/slides/test.slide',
                itemJson: {
                    kind: 'slide',
                    id: 7,
                    metadata: {},
                    canvasItems: [],
                },
            },
        });
    });

    test('mounts the custom preview element into shadow DOM', async () => {
        await import('./preview/CustomHTMLScreenPreviewer');

        const wrapper = document.createElement('div');
        Object.defineProperty(wrapper, 'clientWidth', {
            configurable: true,
            value: 640,
        });
        document.body.appendChild(wrapper);

        const element = document.createElement(
            'mini-screen-previewer-custom-html',
        ) as HTMLElement & {
            screenId?: number;
            mountPoint?: HTMLElement;
        };
        (element as any).screenId = 1;
        wrapper.appendChild(element);

        expect(element.shadowRoot).not.toBeNull();
        expect(createRootRenderMock).toHaveBeenCalledOnce();
        expect((element as any).mountPoint.style.transform).toBe('scale(0.5)');
    });
});
