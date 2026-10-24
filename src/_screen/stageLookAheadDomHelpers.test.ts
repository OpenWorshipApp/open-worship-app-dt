// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const { genSlideHtmlMock } = vi.hoisted(() => ({
    genSlideHtmlMock: vi.fn((canvasItems: { type: string }[]) => {
        const div = document.createElement('div');
        div.dataset.types = canvasItems.map((item) => item.type).join(',');
        return div;
    }),
}));

// The md5 is the preload's; any one-to-one stand-in tells two slides apart.
vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { generateMD5: (text: string) => `md5(${text})` },
    },
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

import {
    moveStageLookAhead,
    STAGE_MOVE_MILLISECOND,
    wrapWithStageLookAhead,
} from './stageLookAheadDomHelpers';

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

// Slide `id` of a three-slide deck, as the presented slide and as a coming one.
function genSlideJson(id: number, types = ['text']) {
    return {
        id,
        type: 'slide',
        metadata: { width: 1920, height: 1080 },
        canvasItems: types.map((type, i) => ({ id: i, type })),
    } as any;
}

function genSide(id: number, types?: string[]) {
    return { offset: 1, itemJson: genSlideJson(id, types), label: `${id}/3` };
}

function genStage(id: number, nextId: number | null, nextTypes?: string[]) {
    return {
        stage: 2,
        label: `${id}/3`,
        sideList: [nextId === null ? null : genSide(nextId, nextTypes)],
    };
}

// The box of the slide whose content was built from `types`.
function findBox(root: HTMLElement, types: string) {
    const content = Array.from(
        root.querySelectorAll<HTMLElement>('[data-types]'),
    ).find((element) => element.dataset.types === types);
    return content?.parentElement?.parentElement ?? null;
}

function toLabels(root: HTMLElement) {
    return Array.from(root.querySelectorAll('.stage-look-ahead-index')).map(
        (label) => label.textContent,
    );
}

describe('moveStageLookAhead', () => {
    beforeEach(() => {
        genSlideHtmlMock.mockClear();
        vi.useFakeTimers();
        document.body.replaceChildren();
    });

    // Slide 1 presented with slide 2 coming, on screen.
    function genRoot(nextTypes?: string[]) {
        const root = wrapWithStageLookAhead(
            genContent(),
            1920,
            1080,
            genStage(1, 2, nextTypes),
            1920,
            1080,
            genSlideJson(1),
        )!;
        document.body.appendChild(root);
        genSlideHtmlMock.mockClear();
        return root;
    }

    function move(
        root: HTMLElement,
        content: HTMLElement | null,
        id: number,
        nextId: number | null,
        types?: string[],
    ) {
        return moveStageLookAhead(
            root,
            content,
            1920,
            1080,
            genStage(id, nextId),
            1920,
            1080,
            genSlideJson(id, types),
        );
    }

    test('the coming slide becomes the presented one by a change of style alone', () => {
        const root = genRoot();
        const comingBox = findBox(root, 'text')!;
        const comingContent = comingBox.querySelector('[data-types]');
        const smallWidth = Number.parseInt(comingBox.style.width);
        expect(comingBox.style.transition).toContain('all');

        expect(move(root, null, 2, 3)).toBe(true);

        // The very same elements, now where the presented slide sits.
        expect(findBox(root, 'text')).toBe(comingBox);
        expect(comingBox.querySelector('[data-types]')).toBe(comingContent);
        expect(comingBox.style.top).toBe('0px');
        expect(Number.parseInt(comingBox.style.width)).toBeGreaterThan(
            smallWidth,
        );
        // Nothing was drawn for it.
        expect(genSlideHtmlMock).not.toHaveBeenCalled();
    });

    // What a slide is told from another by, on the element itself: a slide
    // keeps its id from one layout to the next, and no two parts share one.
    test('everything drawn carries the md5 of its data as its id', () => {
        const root = genRoot();
        const toIds = () => {
            return Array.from(
                root.querySelectorAll<HTMLElement>('[data-render-id]'),
            ).map((element) => element.dataset.renderId);
        };
        const ids = toIds();
        // Two boxes, two frames, two counts.
        expect(ids).toHaveLength(6);
        expect(new Set(ids).size).toBe(6);
        expect(ids.every((id) => id?.startsWith('md5('))).toBe(true);
        const comingId = findBox(root, 'text')!.dataset.renderId;

        move(root, null, 2, 3);

        expect(findBox(root, 'text')!.dataset.renderId).toBe(comingId);
        expect(toIds()).toHaveLength(3);
    });

    test('what leaves is gone before the move, what comes is added after it', () => {
        const root = genRoot();

        expect(move(root, null, 2, 3)).toBe(true);

        // Slide 1 left at once; slide 3 is not there yet.
        expect(root.querySelector('.current-slide')).toBeNull();
        expect(toLabels(root)).toEqual(['2/3']);
        expect(countFrames(root)).toBe(1);

        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);

        expect(toLabels(root)).toEqual(['2/3', '3/3']);
        expect(countFrames(root)).toBe(2);
        expect(genSlideHtmlMock).toHaveBeenCalledTimes(1);
    });

    test('a second press before the move is over still moves the slide', () => {
        const root = genRoot();
        move(root, null, 2, 3);

        // Slide 3 is due but not added yet -- and it is the one that moves now.
        expect(move(root, null, 3, null)).toBe(true);

        expect(toLabels(root)).toEqual(['3/3']);
        const box = findBox(root, 'text')!;
        expect(box.style.top).toBe('0px');
        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);
        expect(toLabels(root)).toEqual(['3/3']);
    });

    test('a slide that plays something is built when it is presented', () => {
        // Its coming box left the video out, so it is not the same slide.
        const root = genRoot(['text', 'video']);
        const comingBox = findBox(root, 'text')!;

        expect(move(root, null, 2, 3, ['text', 'video'])).toBe(false);
        expect(root.querySelector('.current-slide')).not.toBeNull();

        const content = genContent();
        content.className = 'presented-slide';
        expect(move(root, content, 2, 3, ['text', 'video'])).toBe(true);

        // Still the same box, moved, with the slide as it is presented in it.
        expect(content.parentElement?.parentElement).toBe(comingBox);
        expect(comingBox.style.top).toBe('0px');
        expect(findBox(root, 'text')).toBeNull();
    });

    test('a slide edited since is drawn again in its box', () => {
        const root = genRoot();
        const comingBox = findBox(root, 'text')!;
        const content = genContent();
        content.className = 'edited-slide';

        expect(move(root, content, 2, 3, ['text', 'image'])).toBe(true);

        expect(content.parentElement?.parentElement).toBe(comingBox);
    });

    test('with no slide on screen staying it is left to a cut', () => {
        const root = genRoot();
        const html = root.innerHTML;

        expect(move(root, genContent(), 7, 8)).toBe(false);

        expect(root.innerHTML).toBe(html);
        expect(vi.getTimerCount()).toBe(0);
    });

    test('going back, the presented slide shrinks into the coming box', () => {
        const root = genRoot();
        const presentedBox = root.firstElementChild as HTMLElement;
        const content = genContent();
        content.className = 'previous-slide';

        expect(
            moveStageLookAhead(
                root,
                content,
                1920,
                1080,
                { stage: 2, label: '0/3', sideList: [genSide(1)] },
                1920,
                1080,
                genSlideJson(0),
            ),
        ).toBe(true);

        // Slide 1 keeps its box; slide 2 left; slide 0 comes after the move.
        expect(presentedBox.isConnected).toBe(true);
        expect(Number.parseInt(presentedBox.style.top)).toBeGreaterThan(0);
        expect(findBox(root, 'text')).toBeNull();
        expect(content.isConnected).toBe(false);
        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);
        expect(content.isConnected).toBe(true);
        expect(content.parentElement?.parentElement?.style.top).toBe('0px');
    });

    test('a layout cut away meanwhile is not added to', () => {
        const root = genRoot();
        move(root, null, 2, 3);
        root.remove();

        vi.advanceTimersByTime(STAGE_MOVE_MILLISECOND);

        expect(toLabels(root)).toEqual(['2/3']);
        expect(genSlideHtmlMock).not.toHaveBeenCalled();
    });
});
