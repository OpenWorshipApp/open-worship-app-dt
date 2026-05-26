// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DragTypeEnum } from '../../helper/DragInf';

const {
    getDataListMock,
    fireUpdateEventMock,
    checkIsVarySlideOnScreenMock,
    getColorNoteFilePathSettingMock,
    setColorNoteFilePathSettingMock,
    chooseColorNoteMock,
    appProviderMock,
    useWebCapturingMock,
} = vi.hoisted(() => ({
    getDataListMock: vi.fn(),
    fireUpdateEventMock: vi.fn(),
    checkIsVarySlideOnScreenMock: vi.fn(),
    getColorNoteFilePathSettingMock: vi.fn(),
    setColorNoteFilePathSettingMock: vi.fn(),
    chooseColorNoteMock: vi.fn(),
    appProviderMock: {
        isPageAppDocumentEditor: false,
    },
    useWebCapturingMock: vi.fn(),
}));

vi.mock('../../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: {
        getDataList: getDataListMock,
        fireUpdateEvent: fireUpdateEventMock,
    },
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    checkIsVarySlideOnScreen: checkIsVarySlideOnScreenMock,
}));

vi.mock('../../background/RenderBackgroundWebIframeComp', () => ({
    default: ({ src, width, height }: any) => (
        <div data-testid="web-iframe">
            {src.src}:{width}:{height}
        </div>
    ),
}));

vi.mock('../../background/RenderCameraVideoComp', () => ({
    default: ({ deviceId, width }: any) => (
        <div data-testid="camera-video">
            {deviceId}:{width}
        </div>
    ),
}));

vi.mock('../../helper/FileSourceMetaManager', () => ({
    getColorNoteFilePathSetting: getColorNoteFilePathSettingMock,
    setColorNoteFilePathSetting: setColorNoteFilePathSettingMock,
}));

vi.mock('../../others/ItemColorNoteComp', () => ({
    chooseColorNote: chooseColorNoteMock,
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('./BackgroundRenderOnHoverComp', () => ({
    default: ({ src, opacity = 0.3, genChildren }: any) => (
        <div data-testid="hover-bg" data-src={src} data-opacity={opacity}>
            {genChildren({ width: 320, height: 180 })}
        </div>
    ),
}));

vi.mock('../../helper/domHelpers', () => ({
    useWebCapturing: useWebCapturingMock,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

async function renderElement(
    element: React.ReactElement,
    root: Root,
    container: HTMLDivElement,
) {
    await act(async () => {
        root.render(element);
        await Promise.resolve();
    });
    return container.firstElementChild as HTMLElement | null;
}

describe('slideItemRenderHelpers', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        getDataListMock.mockReturnValue([['1'], ['2']]);
        checkIsVarySlideOnScreenMock.mockReturnValue(true);
        getColorNoteFilePathSettingMock.mockReturnValue('#123456');
        appProviderMock.isPageAppDocumentEditor = false;
        useWebCapturingMock.mockReturnValue('captured://preview');
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('renders empty, color, camera, and web attached background elements', async () => {
        const {
            DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME,
            genAttachBackgroundComponent,
        } = await import('./slideItemRenderHelpers');

        expect(DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME).toBe(
            '--app-docx-preview-background',
        );

        const emptyElement = genAttachBackgroundComponent(null) as any;
        expect(emptyElement.props.className).toBe('attached-virtual-bg-color');
        expect(emptyElement.props.style.backgroundColor).toContain(
            'var(--app-docx-preview-background, transparent)',
        );

        const colorElement = genAttachBackgroundComponent({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: '#112233',
        } as any) as any;
        expect(colorElement.props.style.backgroundColor).toBe('#112233');

        const cameraElement = genAttachBackgroundComponent({
            type: DragTypeEnum.BACKGROUND_CAMERA,
            item: { src: 'camera-1' },
        } as any) as any;
        expect(cameraElement.props.src).toBe('/assets/background-camera.png');
        expect(
            renderToStaticMarkup(
                cameraElement.props.genChildren({ width: 320, height: 180 }),
            ),
        ).toContain('camera-1:320');

        let webMarkup = renderToStaticMarkup(
            genAttachBackgroundComponent({
                type: DragTypeEnum.BACKGROUND_WEB,
                item: { src: 'https://example.com', fullName: 'example' },
            } as any),
        );
        expect(webMarkup).toContain('data-src="captured://preview"');
        expect(webMarkup).toContain('https://example.com:320:180');

        useWebCapturingMock.mockReturnValue(null);
        webMarkup = renderToStaticMarkup(
            genAttachBackgroundComponent({
                type: DragTypeEnum.BACKGROUND_WEB,
                item: { src: 'https://fallback.example', fullName: 'fallback' },
            } as any),
        );
        expect(webMarkup).toContain('data-src="/assets/background-web.png"');

        expect(
            genAttachBackgroundComponent({ type: DragTypeEnum.UNKNOWN } as any),
        ).toBeNull();
    });

    test('renders image and video backgrounds with runtime fallback handlers', async () => {
        const { genAttachBackgroundComponent } =
            await import('./slideItemRenderHelpers');

        const playMock = vi
            .spyOn(HTMLMediaElement.prototype, 'play')
            .mockImplementation(() => Promise.resolve());
        const pauseMock = vi
            .spyOn(HTMLMediaElement.prototype, 'pause')
            .mockImplementation(() => {});

        try {
            const imageElement = genAttachBackgroundComponent({
                type: DragTypeEnum.BACKGROUND_IMAGE,
                item: { src: '/slides/photo.png' },
            } as any) as any;
            const imageTarget = {
                src: '/slides/photo.png',
            };

            expect(imageElement.props.src).toBe('/slides/photo.png');
            imageElement.props.onError({ currentTarget: imageTarget });

            expect(imageTarget.src).toBe('/assets/broken-image.png');

            const videoElement = genAttachBackgroundComponent({
                type: DragTypeEnum.BACKGROUND_VIDEO,
                item: { src: '/slides/video.mp4' },
            } as any) as any;
            const videoTarget = {
                src: '/slides/video.mp4',
                play: playMock,
                pause: pauseMock,
            };

            expect(videoElement.props.src).toBe('/slides/video.mp4');
            videoElement.props.onMouseOver({ currentTarget: videoTarget });
            videoElement.props.onMouseOut({ currentTarget: videoTarget });
            videoElement.props.onError({ currentTarget: videoTarget });

            expect(playMock).toHaveBeenCalled();
            expect(pauseMock).toHaveBeenCalled();
            expect(videoTarget.src).toBe('/assets/broken-video.mp4');
        } finally {
            playMock.mockRestore();
            pauseMock.mockRestore();
        }
    });

    test('derives active, presenter, and holding highlight classes from selection state', async () => {
        const { toClassNameHighlight } =
            await import('./slideItemRenderHelpers');
        const varySlide = {
            filePath: '/docs/main.ows',
            id: 7,
            checkIsSame(other: any) {
                return other?.id === 7;
            },
        } as any;

        appProviderMock.isPageAppDocumentEditor = true;
        let result = toClassNameHighlight(varySlide, { id: 7 } as any, []);
        expect(result.activeCN).toBe('active');
        expect(result.presenterCN).toBe('');
        expect(result.holdingCN).toBe('');
        expect(result.selectedList).toEqual([['1'], ['2']]);

        appProviderMock.isPageAppDocumentEditor = false;
        checkIsVarySlideOnScreenMock.mockReturnValue(true);
        result = toClassNameHighlight(
            varySlide,
            { id: 99 } as any,
            [{ id: 7 }] as any,
        );
        expect(result.activeCN).toBe('');
        expect(result.presenterCN).toBe('app-highlight-selected animation');
        expect(result.holdingCN).toBe('holding');

        checkIsVarySlideOnScreenMock.mockReturnValue(false);
        result = toClassNameHighlight(varySlide, null, []);
        expect(result.presenterCN).toBe('');
    });

    test('builds color-note menu items and emits updates after a color change', async () => {
        const { genChooseColorNoteOption, getSlideItemShadowingStyle } =
            await import('./slideItemRenderHelpers');

        const [option] = genChooseColorNoteOption('/docs/main.ows', 7);
        const iconMarkup = renderToStaticMarkup(option.childBefore);

        expect(option.menuElement).toBe('Choose Color');
        expect(iconMarkup).toContain('bi-record-circle');
        expect(iconMarkup).toContain('color:#123456');

        option.onSelect?.('menu-event');

        expect(chooseColorNoteMock).toHaveBeenCalledWith(
            '#123456',
            expect.any(Function),
            'menu-event',
        );

        const applyColor = chooseColorNoteMock.mock.calls[0]?.[1] as
            | ((color: string | null) => void)
            | undefined;
        applyColor?.('#654321');

        expect(setColorNoteFilePathSettingMock).toHaveBeenCalledWith(
            '/docs/main.ows',
            7,
            '#654321',
        );
        expect(fireUpdateEventMock).toHaveBeenCalledTimes(1);

        const styleMarkup = renderToStaticMarkup(getSlideItemShadowingStyle());
        expect(styleMarkup).toContain(
            "shadow-blank-bg[data-shadow-theme='dark']",
        );
        expect(styleMarkup).toContain('--color1: #495057');
        expect(styleMarkup).toContain(
            "shadow-blank-bg[data-shadow-theme='light']",
        );
    });
});
