// @vitest-environment jsdom

import { act, use, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    rendered: [] as { kind: string; props: Record<string, any> }[],
}));

vi.mock('../items/SlideRendererComp', async () => {
    const { SlideThumbnailContext } =
        await import('../../slide-editor/canvas/box/slideThumbnailContext');
    return {
        default: function SlideRendererMockComp(props: Record<string, any>) {
            mocks.rendered.push({
                kind: 'slide',
                props: { ...props, isThumbnail: use(SlideThumbnailContext) },
            });
            return <div className="slide-content" />;
        },
    };
});
vi.mock('../items/PdfSlideRenderComp', () => ({
    PdfSlideRenderContentComp: (props: Record<string, any>) => {
        mocks.rendered.push({ kind: 'pdf', props });
        return <div className="pdf-content" />;
    },
}));
vi.mock('../items/PptxSlideRenderComp', () => ({
    PptxSlideRenderContentComp: (props: Record<string, any>) => {
        mocks.rendered.push({ kind: 'pptx', props });
        return <div className="pptx-content" />;
    },
}));
vi.mock('../items/DocxSlideRenderComp', () => ({
    DocxSlideRenderContentComp: (props: Record<string, any>) => {
        mocks.rendered.push({ kind: 'docx', props });
        return <div className="docx-content" />;
    },
}));

// What the real slide models reach for.
vi.mock('../../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../../helper/FileSource', () => ({ default: {} }));
vi.mock('../../server/fileHelpers', () => ({ pathJoin: vi.fn() }));
vi.mock('../../_screen/managers/screenHelpers', () => ({
    getDefaultScreenDisplay: vi.fn(),
}));
vi.mock('../../server/fontHelpers', () => ({ getFontFamilies: vi.fn() }));
vi.mock('../../helper/errorHelpers', () => ({ handleError: vi.fn() }));

import DocxSlide from '../../app-document-list/DocxSlide';
import PdfSlide from '../../app-document-list/PdfSlide';
import PptxSlide from '../../app-document-list/PptxSlide';
import Slide from '../../app-document-list/Slide';
import VarySlideSideContentComp from './VarySlideSideContentComp';

const metadata = { width: 1280, height: 720 };

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.rendered = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('VarySlideSideContentComp', () => {
    test('an Open Worship slide keeps only the items that do not play', async () => {
        const uuid = (n: number) => `10000000-0000-4000-8000-00000000000${n}`;
        const slide = new Slide('/docs/a.ows', {
            id: 1,
            metadata,
            canvasItems: [
                { id: 1, uuid: uuid(1), type: 'text' },
                { id: 2, uuid: uuid(2), type: 'video' },
                { id: 3, uuid: uuid(3), type: 'image' },
                { id: 4, uuid: uuid(4), type: 'youtube' },
                { id: 5, uuid: uuid(5), type: 'bible' },
                { id: 6, uuid: uuid(6), type: 'html' },
                { id: 7, uuid: uuid(7), type: 'audio' },
            ] as any,
            type: 'slide',
        });

        await render(<VarySlideSideContentComp varySlide={slide} />);

        expect(mocks.rendered).toHaveLength(1);
        const { kind, props } = mocks.rendered[0];
        expect(kind).toBe('slide');
        expect(props.canvasItemsJson.map((item: any) => item.type)).toEqual([
            'text',
            'image',
            'bible',
            'html',
        ]);
        expect(props).toMatchObject({
            width: '1280px',
            height: '720px',
            isThumbnail: true,
        });
    });

    test('a PDF page draws its page image', async () => {
        const pdfSlide = new PdfSlide('/docs/a.pdf', {
            id: 1,
            imagePreviewSrc: 'file:///p/0.png',
            pdfPageNumber: 0,
            metadata,
            type: 'pdf-slide',
        });

        await render(<VarySlideSideContentComp varySlide={pdfSlide} />);

        expect(mocks.rendered).toEqual([
            { kind: 'pdf', props: { pdfImageSrc: 'file:///p/0.png' } },
        ]);
    });

    test('a PDF page with no image draws nothing', async () => {
        const pdfSlide = new PdfSlide('/docs/a.pdf', {
            id: 1,
            pdfPageNumber: 0,
            metadata,
            type: 'pdf-slide',
        } as any);

        await render(<VarySlideSideContentComp varySlide={pdfSlide} />);

        expect(mocks.rendered).toEqual([]);
        expect(container.innerHTML).toBe('');
    });

    test('a PowerPoint slide draws its html at its size', async () => {
        const pptxSlide = new PptxSlide('/docs/a.pptx', {
            id: 1,
            htmlFilePath: '/p/slide.html',
            html: '<section>Hi</section>',
            subHtmlFilePaths: [],
            isDisabled: false,
            note: null,
            metadata,
            images: [],
            videos: [],
            audios: [],
            type: 'pptx-slide',
        });

        await render(<VarySlideSideContentComp varySlide={pptxSlide} />);

        expect(mocks.rendered).toEqual([
            {
                kind: 'pptx',
                props: {
                    html: '<section>Hi</section>',
                    htmlFilePath: '/p/slide.html',
                    width: 1280,
                    height: 720,
                },
            },
        ]);
    });

    test('a Word page draws its html in a box of its size', async () => {
        const docxSlide = new DocxSlide('/docs/a.docx', {
            id: 1,
            htmlFilePath: '/p/page.html',
            html: '<p>Page</p>',
            metadata: { width: 800, height: 1100 },
            type: 'docx-slide',
        });

        await render(<VarySlideSideContentComp varySlide={docxSlide} />);

        expect(mocks.rendered).toEqual([
            {
                kind: 'docx',
                props: {
                    html: '<p>Page</p>',
                    htmlFilePath: '/p/page.html',
                    width: 800,
                    height: 1100,
                },
            },
        ]);
        const box = container.querySelector<HTMLDivElement>(
            'div:has(> .docx-content)',
        )!;
        expect([box.style.width, box.style.height]).toEqual([
            '800px',
            '1100px',
        ]);
    });
});
