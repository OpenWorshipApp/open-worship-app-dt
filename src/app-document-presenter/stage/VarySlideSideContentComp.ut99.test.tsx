// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A slide drawn small beside the one on a stage: the right renderer for each
// kind of slide, and a plain slide drawn as a thumbnail without anything that
// plays.

const { mocks, PdfSlideMock, PptxSlideMock, DocxSlideMock } = vi.hoisted(() => {
    class PdfSlideMock {
        constructor(public pdfPreviewSrc: string | null) {}
        static checkIsThisType(item: unknown) {
            return item instanceof this;
        }
    }
    class OfficeSlideMock {
        html = '<p>page</p>';
        htmlFilePath = '/cache/page.html';
        width = 640;
        height = 360;
        static checkIsThisType(item: unknown) {
            return item instanceof this;
        }
    }
    class PptxSlideMock extends OfficeSlideMock {}
    class DocxSlideMock extends OfficeSlideMock {}
    return {
        PdfSlideMock,
        PptxSlideMock,
        DocxSlideMock,
        mocks: { filter: vi.fn() },
    };
});

vi.mock('../../app-document-list/PdfSlide', () => ({ default: PdfSlideMock }));
vi.mock('../../app-document-list/PptxSlide', () => ({
    default: PptxSlideMock,
}));
vi.mock('../../app-document-list/DocxSlide', () => ({
    default: DocxSlideMock,
}));
vi.mock('./documentStageHelpers', () => ({
    filterSideCanvasItems: mocks.filter,
}));
vi.mock('../items/SlideRendererComp', async () => {
    const { SlideThumbnailContext } =
        await import('../../slide-editor/canvas/box/slideThumbnailContext');
    return {
        default: function SlideRendererMockComp({
            canvasItemsJson,
            width,
            height,
        }: any) {
            const isThumbnail = use(SlideThumbnailContext);
            return (
                <span
                    data-testid="slide"
                    data-size={`${width}/${height}`}
                    data-thumbnail={String(isThumbnail)}
                >
                    {canvasItemsJson.map((item: any) => item.type).join(',')}
                </span>
            );
        },
    };
});
vi.mock('../items/PdfSlideRenderComp', () => ({
    PdfSlideRenderContentComp: ({ pdfImageSrc }: any) => (
        <img data-testid="pdf" src={pdfImageSrc} alt="" />
    ),
}));
vi.mock('../items/PptxSlideRenderComp', () => ({
    PptxSlideRenderContentComp: ({
        html,
        htmlFilePath,
        width,
        height,
    }: any) => (
        <span
            data-testid="pptx"
            data-file={htmlFilePath}
            data-size={`${width}/${height}`}
        >
            {html}
        </span>
    ),
}));
vi.mock('../items/DocxSlideRenderComp', () => ({
    DocxSlideRenderContentComp: ({
        html,
        htmlFilePath,
        width,
        height,
    }: any) => (
        <span
            data-testid="docx"
            data-file={htmlFilePath}
            data-size={`${width}/${height}`}
        >
            {html}
        </span>
    ),
}));

import VarySlideSideContentComp from './VarySlideSideContentComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render(varySlide: any) {
    await act(async () => {
        root.render(<VarySlideSideContentComp varySlide={varySlide} />);
    });
}

function find(testId: string) {
    return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

beforeEach(() => {
    mocks.filter.mockImplementation((items: any[]) =>
        items.filter((item) => item.type !== 'video'),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('VarySlideSideContentComp', () => {
    test('a PDF page shows its preview image, or nothing before it exists', async () => {
        await render(new PdfSlideMock('file:///cache/page-1.png'));
        expect(find('pdf')?.getAttribute('src')).toBe(
            'file:///cache/page-1.png',
        );
        await render(new PdfSlideMock(null));
        expect(container.innerHTML).toBe('');
    });

    test('a PPTX slide is drawn from its HTML at its own size', async () => {
        await render(new PptxSlideMock());
        expect(find('pptx')?.textContent).toBe('<p>page</p>');
        expect(find('pptx')?.dataset.file).toBe('/cache/page.html');
        expect(find('pptx')?.dataset.size).toBe('640/360');
    });

    test('a DOCX page is drawn from its HTML inside a box of its size', async () => {
        await render(new DocxSlideMock());
        const docx = find('docx')!;
        expect(docx.dataset.size).toBe('640/360');
        const box = docx.parentElement!;
        expect(box.style.width).toBe('640px');
        expect(box.style.height).toBe('360px');
    });

    test('a plain slide is a thumbnail without what plays, filtered once per change', async () => {
        const canvasItemsJson = [
            { type: 'text' },
            { type: 'video' },
            { type: 'image' },
        ];
        const slide = { canvasItemsJson, width: 1920, height: 1080 };
        await render(slide);
        const drawn = find('slide')!;
        expect(drawn.textContent).toBe('text,image');
        expect(drawn.dataset.size).toBe('1920px/1080px');
        expect(drawn.dataset.thumbnail).toBe('true');
        expect(mocks.filter).toHaveBeenCalledExactlyOnceWith(canvasItemsJson);

        await render({ ...slide });
        expect(mocks.filter).toHaveBeenCalledOnce();
        await render({ ...slide, canvasItemsJson: [{ type: 'video' }] });
        expect(mocks.filter).toHaveBeenCalledTimes(2);
        expect(find('slide')?.textContent).toBe('');
    });
});
