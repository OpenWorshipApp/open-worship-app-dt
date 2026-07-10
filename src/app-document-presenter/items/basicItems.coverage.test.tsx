// @vitest-environment jsdom

import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    useScreenVaryAppDocumentManagerEventsMock,
    useShadowingParentWidthMock,
    canvasItemFromJsonMock,
    genBoxStyleMock,
    sanitizeHtmlMock,
    getHTMLChildMock,
    scaleCanvasItemToSizeMock,
    genMediaItemFromFileMock,
    handleErrorMock,
    SlideMock,
    CanvasItemImageMock,
    CanvasItemVideoMock,
} = vi.hoisted(() => {
    const useScreenVaryAppDocumentManagerEventsMock = vi.fn();
    const useShadowingParentWidthMock = vi.fn();
    const canvasItemFromJsonMock = vi.fn();
    const genBoxStyleMock = vi.fn();
    const sanitizeHtmlMock = vi.fn((html: string) => html);
    const getHTMLChildMock = vi.fn(
        (element: HTMLDivElement) => element.firstElementChild,
    );
    const scaleCanvasItemToSizeMock = vi.fn();
    const genMediaItemFromFileMock = vi.fn();
    const handleErrorMock = vi.fn();

    class SlideMock {
        width = 800;
        height = 600;
        canvasItemsJson: any[] = [];

        constructor(public id = 1) {}
    }

    class CanvasItemMediaMock {
        props: {
            mediaWidth: number;
            mediaHeight: number;
            width: number;
            height: number;
            left: number;
            top: number;
        };
        applyProps = vi.fn(
            (newProps: Partial<CanvasItemMediaMock['props']>) => {
                this.props = { ...this.props, ...newProps };
            },
        );
        toJson = vi.fn(() => ({
            id: 'canvas-item',
            left: this.props.left,
            top: this.props.top,
            width: this.props.width,
            height: this.props.height,
        }));

        constructor(mediaWidth = 400, mediaHeight = 200) {
            this.props = {
                mediaWidth,
                mediaHeight,
                width: mediaWidth / 2,
                height: mediaHeight / 2,
                left: 0,
                top: 0,
            };
        }
    }

    // Siblings, not subclasses, so the helper's per-type `instanceof`
    // checks are each exercised on their own.
    class CanvasItemImageMock extends CanvasItemMediaMock {}
    class CanvasItemVideoMock extends CanvasItemMediaMock {}

    return {
        useScreenVaryAppDocumentManagerEventsMock,
        useShadowingParentWidthMock,
        canvasItemFromJsonMock,
        genBoxStyleMock,
        sanitizeHtmlMock,
        getHTMLChildMock,
        scaleCanvasItemToSizeMock,
        genMediaItemFromFileMock,
        handleErrorMock,
        SlideMock,
        CanvasItemImageMock,
        CanvasItemVideoMock,
    };
});

vi.mock('../../_screen/managers/screenEventHelpers', () => ({
    useScreenVaryAppDocumentManagerEvents:
        useScreenVaryAppDocumentManagerEventsMock,
}));

vi.mock('../../others/ShadowingFillParentWidthComp', () => ({
    useShadowingParentWidth: useShadowingParentWidthMock,
}));

vi.mock('../../slide-editor/CanvasItemRendererComp', () => ({
    default: () => <div data-testid="canvas-item-renderer" />,
}));

vi.mock('../../slide-editor/canvas/CanvasItem', async () => {
    const { createContext } = await import('react');

    return {
        default: {
            genBoxStyle: genBoxStyleMock,
        },
        CanvasItemContext: createContext(null),
    };
});

vi.mock('../../slide-editor/canvas/Canvas', () => ({
    default: {
        canvasItemFromJson: canvasItemFromJsonMock,
    },
}));

vi.mock('../../helper/helpers', () => ({
    getHTMLChild: getHTMLChildMock,
}));

vi.mock('../../helper/sanitizeHelpers', () => ({
    sanitizeHtml: sanitizeHtmlMock,
}));

vi.mock('../../app-document-list/Slide', () => ({
    default: SlideMock,
}));

vi.mock('../../slide-editor/canvas/CanvasController', () => ({
    default: {
        scaleCanvasItemToSize: scaleCanvasItemToSizeMock,
        genMediaItemFromFile: genMediaItemFromFileMock,
    },
}));

vi.mock('../../slide-editor/canvas/CanvasItemImage', () => ({
    default: CanvasItemImageMock,
}));

vi.mock('../../slide-editor/canvas/CanvasItemVideo', () => ({
    default: CanvasItemVideoMock,
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

async function renderIntoRoot(
    element: ReactElement,
    root: Root,
    container: HTMLDivElement,
) {
    await act(async () => {
        root.render(element);
    });
    return container.firstElementChild as HTMLElement | null;
}

describe('presenter item basic coverage', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        vi.clearAllMocks();
        useShadowingParentWidthMock.mockReturnValue(null);
        canvasItemFromJsonMock.mockImplementation((canvasItemJson) => ({
            ...canvasItemJson,
            rendered: true,
        }));
        genBoxStyleMock.mockImplementation((canvasItemJson) => ({
            left: `${canvasItemJson.id}px`,
        }));
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('renders slide index with explicit and fallback titles', async () => {
        const { default: RenderSlideIndexComp } =
            await import('./RenderSlideIndexComp');

        let element = await renderIntoRoot(
            <RenderSlideIndexComp viewIndex={4} />,
            root,
            container,
        );
        expect(element?.textContent).toContain('4');
        expect(element?.getAttribute('title')).toBe('Index: 4');

        element = await renderIntoRoot(
            <RenderSlideIndexComp viewIndex={9} title="Custom title" />,
            root,
            container,
        );
        expect(element?.getAttribute('title')).toBe('Custom title');
    });

    test('shows hover content only while the background preview is active', async () => {
        const { default: BackgroundRenderOnHoverComp } =
            await import('./BackgroundRenderOnHoverComp');
        const genChildren = vi.fn((dim: { width: number; height: number }) => {
            return (
                <div data-testid="hover-child">
                    {dim.width}x{dim.height}
                </div>
            );
        });

        const element = await renderIntoRoot(
            <BackgroundRenderOnHoverComp
                src="/slides/bg.png"
                opacity={0.25}
                genChildren={genChildren}
            />,
            root,
            container,
        );
        if (element === null) {
            throw new Error('Missing hover preview element');
        }
        Object.defineProperty(element, 'clientWidth', {
            configurable: true,
            value: 320,
        });
        Object.defineProperty(element, 'clientHeight', {
            configurable: true,
            value: 180,
        });

        expect(element.style.opacity).toBe('0.25');
        expect(
            container.querySelector('[data-testid="hover-child"]'),
        ).toBeNull();

        await act(async () => {
            element.dispatchEvent(
                new MouseEvent('mouseover', {
                    bubbles: true,
                }),
            );
        });

        expect(genChildren).toHaveBeenCalledWith({ width: 320, height: 180 });
        expect(element.style.opacity).toBe('1');
        expect(container.textContent).toContain('320x180');

        await act(async () => {
            element.dispatchEvent(
                new MouseEvent('mouseout', {
                    bubbles: true,
                }),
            );
        });

        expect(element.style.opacity).toBe('0.25');
        expect(
            container.querySelector('[data-testid="hover-child"]'),
        ).toBeNull();
    });

    test('scales the vary-slide container using parent width or the explicit width fallback', async () => {
        const { default: VaryAppDocumentScaleContainerComp } =
            await import('./VaryAppDocumentScaleContainerComp');
        const varySlide = {
            width: 200,
            height: 100,
        } as any;

        useShadowingParentWidthMock.mockReturnValue(400);
        let element = await renderIntoRoot(
            <VaryAppDocumentScaleContainerComp
                varySlide={varySlide}
                width={300}
                extraStyle={{ border: '1px solid red' }}
            >
                <span data-testid="scale-child">scaled</span>
            </VaryAppDocumentScaleContainerComp>,
            root,
            container,
        );

        expect(useScreenVaryAppDocumentManagerEventsMock).toHaveBeenCalledWith([
            'update',
        ]);
        expect(element?.style.width).toBe('400px');
        expect(element?.style.height).toBe('200px');
        expect(element?.style.transform).toBe('scale(2,2) translate(50%, 50%)');
        expect(element?.style.border).toBe('1px solid red');
        expect(element?.firstElementChild?.textContent).toContain('scaled');

        useShadowingParentWidthMock.mockReturnValue(null);
        element = await renderIntoRoot(
            <VaryAppDocumentScaleContainerComp
                varySlide={varySlide}
                width={300}
            />,
            root,
            container,
        );

        expect(element?.style.width).toBe('300px');
        expect(element?.style.height).toBe('150px');
        expect(element?.style.transform).toBe(
            'scale(1.5,1.5) translate(50%, 50%)',
        );
    });

    test('generates slide HTML using sanitized renderer output', async () => {
        const { genSlideHtml } = await import('./SlideRendererComp');

        const generated = genSlideHtml([
            { id: 'item-1' },
            { id: 'item-2' },
        ] as any);

        expect(sanitizeHtmlMock).toHaveBeenCalledTimes(1);
        expect(getHTMLChildMock).toHaveBeenCalledWith(
            expect.any(HTMLDivElement),
            'div',
        );
        expect(canvasItemFromJsonMock).toHaveBeenCalledTimes(2);
        expect(genBoxStyleMock).toHaveBeenCalledWith({ id: 'item-1' });
        expect(genBoxStyleMock).toHaveBeenCalledWith({ id: 'item-2' });
        expect(
            generated?.querySelectorAll('[data-testid="canvas-item-renderer"]'),
        ).toHaveLength(2);
    });

    test('creates centered slides from dropped media and skips invalid items', async () => {
        const { createNewSlidesFromDroppedData } =
            await import('./appDocumentHelpers');

        const validSlide = new SlideMock(1) as any;
        const videoSlide = new SlideMock(2) as any;
        const invalidSlide = new SlideMock(3) as any;
        const failedSlide = new SlideMock(4) as any;
        const canvasItem = new CanvasItemImageMock();
        const videoCanvasItem = new CanvasItemVideoMock(640, 360);
        const appDocument = {
            genNewSlide: vi
                .fn()
                .mockResolvedValueOnce(validSlide)
                .mockResolvedValueOnce(videoSlide)
                .mockResolvedValueOnce(invalidSlide)
                .mockResolvedValueOnce(failedSlide),
            addSlides: vi.fn(),
        } as any;

        genMediaItemFromFileMock
            .mockResolvedValueOnce(canvasItem)
            .mockResolvedValueOnce(videoCanvasItem)
            .mockResolvedValueOnce({ invalid: true })
            .mockRejectedValueOnce(new Error('undecodable file'));

        await createNewSlidesFromDroppedData(appDocument, [
            new Blob(['a']),
            new Blob(['b'], { type: 'video/mp4' }),
            new Blob(['c']),
            new Blob(['d']),
        ]);

        expect(scaleCanvasItemToSizeMock).toHaveBeenCalledWith(
            canvasItem,
            800,
            600,
            400,
            200,
        );
        expect(canvasItem.applyProps).toHaveBeenCalledWith({
            left: 300,
            top: 250,
        });
        expect(validSlide.canvasItemsJson).toEqual([
            {
                id: 'canvas-item',
                left: 300,
                top: 250,
                width: 200,
                height: 100,
            },
        ]);
        // Video files land as slides too, and a file that fails to decode
        // only skips its own slide instead of rejecting the whole batch.
        expect(scaleCanvasItemToSizeMock).toHaveBeenCalledWith(
            videoCanvasItem,
            800,
            600,
            640,
            360,
        );
        expect(videoSlide.canvasItemsJson).toHaveLength(1);
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
        expect(appDocument.addSlides).toHaveBeenCalledWith([
            validSlide,
            videoSlide,
        ]);
    });

    test('does not add slides when every dropped file resolves to a non-media item', async () => {
        const { createNewSlidesFromDroppedData } =
            await import('./appDocumentHelpers');

        const appDocument = {
            genNewSlide: vi.fn().mockResolvedValue(new SlideMock(3)),
            addSlides: vi.fn(),
        } as any;
        genMediaItemFromFileMock.mockResolvedValue({ invalid: true });

        await createNewSlidesFromDroppedData(appDocument, [new Blob(['x'])]);

        expect(appDocument.addSlides).not.toHaveBeenCalled();
    });
});
