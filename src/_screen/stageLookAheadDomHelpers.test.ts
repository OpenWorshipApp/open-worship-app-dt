// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { genSlideHtmlMock } = vi.hoisted(() => ({
    genSlideHtmlMock: vi.fn((canvasItems: { type: string }[]) => {
        const div = document.createElement('div');
        div.dataset.types = canvasItems.map((item) => item.type).join(',');
        return div;
    }),
}));

// The real renderers reach the canvas, the file system and the schemas; the
// layout around them is what is under test.
vi.mock('../app-document-list/PdfSlide', () => ({
    default: { tryValidate: (json: any) => json.type === 'pdf-slide' },
}));
vi.mock('../app-document-list/PptxSlide', () => ({
    default: { tryValidate: (json: any) => json.type === 'pptx-slide' },
}));
vi.mock('../app-document-list/DocxSlide', () => ({
    default: { tryValidate: (json: any) => json.type === 'docx-slide' },
}));
vi.mock('../app-document-presenter/items/PdfSlideRenderComp', () => ({
    genPdfSlide: (src: string) => {
        const img = document.createElement('img');
        img.setAttribute('src', src);
        return img;
    },
}));
vi.mock('../app-document-presenter/items/PptxSlideRenderComp', () => ({
    genPptxSlide: () => {
        const div = document.createElement('div');
        div.innerHTML = '<p>pptx</p><video></video><audio></audio>';
        return div;
    },
}));
vi.mock('../app-document-presenter/items/DocxSlideRenderComp', () => ({
    genDocxSlide: () => document.createElement('div'),
}));
vi.mock('../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: genSlideHtmlMock,
}));

import { wrapWithStageLookAhead } from './stageLookAheadDomHelpers';

function genContent() {
    const content = document.createElement('div');
    content.className = 'current-slide';
    return content;
}

function genCanvasSide(offset: number) {
    return {
        offset,
        itemJson: {
            id: 2,
            type: 'slide',
            metadata: { width: 1920, height: 1080 },
            canvasItems: [
                { id: 0, type: 'text' },
                { id: 1, type: 'video' },
            ],
        },
    } as any;
}

function countFrames(root: HTMLElement) {
    return Array.from(root.children).filter((child) => {
        return (child as HTMLElement).style.borderRadius !== '';
    }).length;
}

describe('wrapWithStageLookAhead', () => {
    beforeEach(() => {
        genSlideHtmlMock.mockClear();
    });

    test('stage 0 draws the slide as it is', () => {
        expect(
            wrapWithStageLookAhead(genContent(), 1920, 1080, {
                stage: 0,
                label: null,
                sideList: [],
            }),
        ).toBeNull();
    });

    test('a slide with no size is left alone', () => {
        expect(
            wrapWithStageLookAhead(genContent(), 0, 0, {
                stage: 1,
                label: '1/2',
                sideList: [],
            }),
        ).toBeNull();
    });

    test('stage 1 keeps the slide full size with the count', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 1,
            label: 'Welcome · 2/5',
            sideList: [],
        })!;
        expect(root.querySelector('.current-slide')).not.toBeNull();
        expect(root.querySelector('.stage-look-ahead-index')?.textContent).toBe(
            'Welcome · 2/5',
        );
        expect(countFrames(root)).toBe(0);
        const currentBox = root.firstElementChild as HTMLElement;
        expect(currentBox.style.width).toBe('1920px');
    });

    test('stage 2 puts the next slide, at full opacity and without its media, under it', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 2,
            label: '1/3',
            sideList: [genCanvasSide(1)],
        })!;
        expect(genSlideHtmlMock).toHaveBeenCalledTimes(1);
        const sideContent = root.querySelector('[data-types]') as HTMLElement;
        expect(sideContent.dataset.types).toBe('text');
        const sideBox = sideContent.parentElement!.parentElement!;
        expect(sideBox.style.opacity).toBe('');
        // The current slide's frame and the next one's.
        expect(countFrames(root)).toBe(2);
        expect(root.querySelector('.stage-look-ahead-index')).not.toBeNull();
        const currentBox = root.firstElementChild as HTMLElement;
        expect(Number.parseInt(currentBox.style.width)).toBeLessThan(1920);
    });

    test('on a whole screen the layout fills it', () => {
        const root = wrapWithStageLookAhead(
            genContent(),
            1280,
            720,
            { stage: 2, label: '1/3', sideList: [genCanvasSide(1)] },
            1494,
            934,
        )!;
        expect(root.style.width).toBe('1494px');
        expect(root.style.height).toBe('934px');
        const currentBox = root.firstElementChild as HTMLElement;
        expect(currentBox.style.top).toBe('0px');
        expect(currentBox.style.left).toBe('0px');
    });

    test('nothing next at the end of the document: no frame for it', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 2,
            label: '3/3',
            sideList: [null],
        })!;
        expect(countFrames(root)).toBe(1);
        expect(genSlideHtmlMock).not.toHaveBeenCalled();
    });

    test('every coming slide carries its own count', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 3,
            label: '1/3',
            sideList: [
                { ...genCanvasSide(1), label: '2/3' },
                { ...genCanvasSide(2), label: '3/3' },
            ],
        })!;
        expect(
            Array.from(root.querySelectorAll('.stage-look-ahead-index')).map(
                (label) => label.textContent,
            ),
        ).toEqual(['1/3', '2/3', '3/3']);
    });

    test('stage 4 has no count', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 4,
            label: '1/3',
            sideList: [genCanvasSide(1)],
        })!;
        expect(root.querySelector('.stage-look-ahead-index')).toBeNull();
    });

    test('a PowerPoint side slide plays nothing', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 5,
            label: '2/3',
            sideList: [
                null,
                {
                    offset: 1,
                    itemJson: {
                        id: 3,
                        type: 'pptx-slide',
                        metadata: { width: 1920, height: 1080 },
                    } as any,
                },
            ],
        })!;
        expect(root.textContent).toContain('pptx');
        expect(root.querySelector('video, audio')).toBeNull();
        // Stage 5 is full contrast.
        const sideBox = root.querySelector('p')!.parentElement!.parentElement!
            .parentElement as HTMLElement;
        expect(sideBox.style.opacity).toBe('');
    });

    test('a PDF side page is its image', () => {
        const root = wrapWithStageLookAhead(genContent(), 1920, 1080, {
            stage: 2,
            label: '1/2',
            sideList: [
                {
                    offset: 1,
                    itemJson: {
                        id: 2,
                        type: 'pdf-slide',
                        imagePreviewSrc: '/page-2.png',
                        metadata: { width: 800, height: 1100 },
                    } as any,
                },
            ],
        })!;
        expect(root.querySelector('img')?.getAttribute('src')).toBe(
            '/page-2.png',
        );
    });
});
