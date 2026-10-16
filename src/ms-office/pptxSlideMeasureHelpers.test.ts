// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
    getAttachedBackground: vi.fn(),
    genSlideHtml: vi.fn(),
    fillWebsiteScreenShots: vi.fn(),
    captureVideoFrameDataUrl: vi.fn(),
    fsReadFileBytes: vi.fn(),
    getBibleFontFamily: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../app-document-presenter/items/SlideRendererComp', () => ({
    genSlideHtml: fixture.genSlideHtml,
}));
vi.mock('../app-document-list/appDocumentPrintHelpers', () => ({
    fillWebsiteScreenShots: fixture.fillWebsiteScreenShots,
}));
vi.mock('../helper/mediaHelpers', () => ({
    captureVideoFrameDataUrl: fixture.captureVideoFrameDataUrl,
}));
vi.mock('../others/AttachBackgroundManager', () => ({
    attachBackgroundManager: {
        getAttachedBackground: fixture.getAttachedBackground,
    },
}));
vi.mock('../server/fileHelpers', () => ({
    fsReadFileBytes: fixture.fsReadFileBytes,
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    getBibleFontFamily: fixture.getBibleFontFamily,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: fixture.handleError }));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isWindows: true, isMac: false, isLinux: false } },
}));
vi.mock('./pptxFontHelpers', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./pptxFontHelpers')>()),
    PptxFontResolver: class {
        async init() {}
        splitByFont(text: string, spec: { familyList: string }) {
            return [{ text, fontFamily: spec.familyList || 'Arial' }];
        }
        getMetrics(spec: { size: number }) {
            return { ascent: spec.size * 0.8, descent: spec.size * 0.2 };
        }
    },
}));

import { DragTypeEnum } from '../helper/DragInf';
import { PREVIEW_ONLY_ATTR, WEBSITE_ITEM_ATTR } from '../helper/constants';
import type Slide from '../app-document-list/Slide';
import {
    PptxSlideMeasurer,
    type PptxMediaAdderType,
} from './pptxSlideMeasureHelpers';
import type { PptxMediaType } from './pptxXmlHelpers';

type MeasurerInternals = Pick<PptxSlideMeasurer, 'measureSlide' | 'destroy'> & {
    measureBackground(slide: Slide): Promise<unknown>;
    measurePicture(
        element: Element,
        rect: { x: number; y: number; width: number; height: number },
        style: CSSStyleDeclaration,
        itemJson: { type: string; url?: string },
    ): Promise<unknown>;
    measureItem(
        wrapper: HTMLElement,
        itemJson: { id: number; type: string; rotate?: number },
        origin: DOMRect,
        index: number,
    ): Promise<unknown>;
    measureTextBlocks(
        root: HTMLElement,
        origin: DOMRect,
    ): Array<{
        textBody: {
            lines: Array<{
                runs: Array<{
                    text: string;
                    fontSize: number;
                    color: { hex: string; alpha: number };
                }>;
            }>;
        };
        frame: { x: number; y: number; width: number; height: number };
    }>;
    measureDecorations(
        root: HTMLElement,
        origin: DOMRect,
        name: string,
    ): unknown[];
    genBackdropPicture(
        box: {
            x: number;
            y: number;
            width: number;
            height: number;
            rotation: number;
        },
        geometry: { kind: 'rect' },
        blurRadius: number,
        name: string,
    ): Promise<unknown>;
};

function setRect(
    element: Element,
    x: number,
    y: number,
    width: number,
    height: number,
) {
    element.getBoundingClientRect = () => new DOMRect(x, y, width, height);
}

function mockTextRects(rect: DOMRect) {
    Object.defineProperty(Range.prototype, 'getClientRects', {
        configurable: true,
        value: () => [rect],
    });
}

function mockLoadedImages(width = 800, height = 600) {
    const setter = vi.spyOn(HTMLImageElement.prototype, 'src', 'set');
    setter.mockImplementation(function (this: HTMLImageElement) {
        Object.defineProperty(this, 'naturalWidth', {
            configurable: true,
            value: width,
        });
        Object.defineProperty(this, 'naturalHeight', {
            configurable: true,
            value: height,
        });
        queueMicrotask(() => this.onload?.(new Event('load')));
    });
    return setter;
}

function makeSlide(overrides: Record<string, unknown> = {}): Slide {
    return {
        width: 1920,
        height: 1080,
        filePath: 'Sunday.owa',
        id: 1,
        note: 'speaker note',
        isDisabled: false,
        canvasItemsJson: [],
        getBibleKeys: () => [],
        ...overrides,
    } as unknown as Slide;
}

function makeMeasurer(addMedia: PptxMediaAdderType = async () => null) {
    return new PptxSlideMeasurer(addMedia) as unknown as MeasurerInternals;
}

beforeEach(() => {
    vi.clearAllMocks();
    fixture.genSlideHtml.mockImplementation(() =>
        document.createElement('div'),
    );
    fixture.fillWebsiteScreenShots.mockResolvedValue(undefined);
    fixture.getAttachedBackground.mockResolvedValue(null);
    fixture.getBibleFontFamily.mockResolvedValue('Arial');
    Object.defineProperty(document, 'fonts', {
        configurable: true,
        value: { load: vi.fn(async () => []), ready: Promise.resolve() },
    });
});

afterEach(() => {
    document.body.replaceChildren();
    delete (Range.prototype as unknown as { getClientRects?: unknown })
        .getClientRects;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('PowerPoint slide measurement', () => {
    it('renders a slide in a hidden host and removes it after export', async () => {
        const measurer = makeMeasurer();
        const host = document.querySelector('[aria-hidden="true"]');
        expect(host).not.toBeNull();
        const model = await measurer.measureSlide(makeSlide());
        expect(model).toMatchObject({
            width: 1920,
            height: 1080,
            background: null,
            elements: [],
            note: 'speaker note',
            isHidden: false,
        });
        expect(fixture.genSlideHtml).toHaveBeenCalledWith([]);
        expect(host?.shadowRoot?.querySelector('div')?.childElementCount).toBe(
            0,
        );
        measurer.destroy();
        expect(document.body.contains(host)).toBe(false);
    });

    it('carries a previous screen color through ordinary slides but not disabled ones', async () => {
        const attached = new Map<number, string>([
            [1, '#804020'],
            [3, '#008000'],
        ]);
        fixture.getAttachedBackground.mockImplementation(
            async (_path: string, id?: number) => {
                const color = id === undefined ? undefined : attached.get(id);
                return color === undefined
                    ? null
                    : { type: DragTypeEnum.BACKGROUND_COLOR, item: color };
            },
        );
        const measurer = makeMeasurer();
        const first = await measurer.measureSlide(makeSlide({ id: 1 }));
        const carried = await measurer.measureSlide(makeSlide({ id: 2 }));
        const disabled = await measurer.measureSlide(
            makeSlide({ id: 3, isDisabled: true }),
        );
        const afterDisabled = await measurer.measureSlide(makeSlide({ id: 4 }));
        expect(first.background).toEqual({
            kind: 'color',
            color: { hex: '804020', alpha: 1 },
        });
        expect(carried.background).toEqual(first.background);
        expect(disabled.background).toEqual({
            kind: 'color',
            color: { hex: '008000', alpha: 1 },
        });
        expect(afterDisabled.background).toEqual(first.background);
        measurer.destroy();
    });

    it('lets a document background replace the previously carried color', async () => {
        fixture.getAttachedBackground.mockImplementation(
            async (path: string, id?: number) => {
                if (id === 1)
                    return {
                        type: DragTypeEnum.BACKGROUND_COLOR,
                        item: '#FF0000',
                    };
                if (path === 'Second.owa' && id === undefined) {
                    return {
                        type: DragTypeEnum.BACKGROUND_COLOR,
                        item: '#0000FF',
                    };
                }
                return null;
            },
        );
        const measurer = makeMeasurer();
        await measurer.measureSlide(makeSlide({ id: 1 }));
        const second = await measurer.measureSlide(
            makeSlide({ id: 2, filePath: 'Second.owa' }),
        );
        const third = await measurer.measureSlide(
            makeSlide({ id: 3, filePath: 'Third.owa' }),
        );
        expect(second.background).toEqual({
            kind: 'color',
            color: { hex: '0000FF', alpha: 1 },
        });
        expect(third.background).toEqual(second.background);
        measurer.destroy();
    });

    it('rejects a malformed background color without dropping slide content', async () => {
        fixture.getAttachedBackground.mockResolvedValue({
            type: DragTypeEnum.BACKGROUND_COLOR,
            item: 'invalid',
        });
        const measurer = makeMeasurer();
        const model = await measurer.measureSlide(makeSlide());
        expect(model.background).toBeNull();
        expect(model.elements).toEqual([]);
        measurer.destroy();
    });

    it('exports a decoded PNG image as an editable picture reference', async () => {
        const loads: unknown[] = [];
        const media = { id: 7 } as unknown as PptxMediaType;
        const addMedia = vi.fn(
            async (_key: string, load: () => Promise<unknown>) => {
                loads.push(await load());
                return media;
            },
        );
        const measurer = makeMeasurer(addMedia);
        const image = document.createElement('img');
        image.src = 'data:image/png;base64,iVBORw0K';
        Object.defineProperty(image, 'naturalWidth', { value: 800 });
        Object.defineProperty(image, 'naturalHeight', { value: 600 });
        const picture = await measurer.measurePicture(
            image,
            { x: 30, y: 40, width: 400, height: 200 },
            getComputedStyle(image),
            { type: 'image' },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            name: 'image picture',
        });
        expect(addMedia).toHaveBeenCalledWith(image.src, expect.any(Function));
        expect(loads[0]).toMatchObject({ extension: 'png' });
        expect(
            Array.from((loads[0] as { bytes: Uint8Array }).bytes).slice(0, 4),
        ).toEqual([0x89, 0x50, 0x4e, 0x47]);
        measurer.destroy();
    });

    it('keeps a text item background and rotation as one editable shape', async () => {
        const measurer = makeMeasurer();
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = 'rgb(32, 64, 128)';
        setRect(wrapper, 50, 70, 300, 120);
        const shape = await measurer.measureItem(
            wrapper,
            { id: 9, type: 'text', rotate: 27 },
            new DOMRect(10, 20, 1920, 1080),
            0,
        );
        expect(shape).toMatchObject({
            kind: 'shape',
            name: 'text 1',
            box: { x: 40, y: 50, width: 300, height: 120, rotation: 27 },
            fill: { hex: '204080', alpha: 1 },
        });
        measurer.destroy();
    });

    it('groups a smaller picture with its box and keeps the picture editable', async () => {
        const media = { id: 8 } as unknown as PptxMediaType;
        const measurer = makeMeasurer(vi.fn(async () => media));
        const wrapper = document.createElement('div');
        wrapper.style.backgroundColor = '#FFFFFF';
        setRect(wrapper, 0, 0, 300, 200);
        const image = document.createElement('img');
        image.src = 'data:image/png;base64,iVBORw0K';
        Object.defineProperty(image, 'naturalWidth', { value: 100 });
        Object.defineProperty(image, 'naturalHeight', { value: 100 });
        setRect(image, 10, 20, 100, 100);
        wrapper.appendChild(image);
        const group = await measurer.measureItem(
            wrapper,
            { id: 1, type: 'image', rotate: 45 },
            new DOMRect(0, 0, 1920, 1080),
            0,
        );
        expect(group).toMatchObject({
            kind: 'group',
            box: { rotation: 45 },
            children: [
                { kind: 'shape', fill: { hex: 'FFFFFF' } },
                {
                    kind: 'picture',
                    media,
                    box: { x: 10, y: 20, width: 100, height: 100 },
                },
            ],
        });
        measurer.destroy();
    });

    it('reads visible text as an editable run with its color, size and opacity', () => {
        const measurer = makeMeasurer();
        const wrapper = document.createElement('div');
        wrapper.style.cssText =
            'font-size: 24px; line-height: 32px; color: rgb(200, 0, 0); opacity: 0.5;';
        wrapper.textContent = 'Look up John 3:16';
        setRect(wrapper, 20, 30, 280, 100);
        mockTextRects(new DOMRect(20, 30, 170, 24));
        const blocks = measurer.measureTextBlocks(
            wrapper,
            new DOMRect(0, 0, 1920, 1080),
        );
        expect(blocks).toHaveLength(1);
        expect(blocks[0].textBody.lines[0].runs).toMatchObject([
            {
                text: 'Look up John 3:16',
                fontSize: 24,
                color: { hex: 'C80000', alpha: 0.5 },
            },
        ]);
        expect(blocks[0].frame).toMatchObject({ x: 20, width: 280 });
        measurer.destroy();
    });

    it('keeps loose flex text runs and block children as separate editable blocks', () => {
        const measurer = makeMeasurer();
        const wrapper = document.createElement('div');
        wrapper.style.cssText =
            'display: flex; font-size: 20px; line-height: 24px;';
        setRect(wrapper, 0, 0, 300, 80);
        wrapper.append('First', document.createElement('br'), 'Second');
        const child = document.createElement('div');
        child.style.cssText =
            'display: block; font-size: 20px; line-height: 24px;';
        child.textContent = 'Inside';
        setRect(child, 100, 0, 80, 40);
        wrapper.append(child, 'Last');
        mockTextRects(new DOMRect(10, 10, 60, 20));

        const blocks = measurer.measureTextBlocks(
            wrapper,
            new DOMRect(0, 0, 1920, 1080),
        );
        expect(blocks).toHaveLength(3);
        expect(
            blocks.map((block) =>
                block.textBody.lines.map((line) =>
                    line.runs.map((run) => run.text).join(''),
                ),
            ),
        ).toEqual([['First', 'Second'], ['Inside'], ['Last']]);
        expect(blocks[0].frame.width).toBe(60);
        expect(blocks[2].frame.width).toBe(60);
        measurer.destroy();
    });

    it('exports two positioned text blocks as separately editable shapes', async () => {
        const measurer = makeMeasurer();
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'font-size: 20px; line-height: 24px;';
        setRect(wrapper, 0, 0, 300, 100);
        const left = document.createElement('div');
        left.style.cssText =
            'display: block; font-size: 20px; line-height: 24px;';
        left.textContent = 'Left';
        setRect(left, 10, 10, 80, 40);
        const right = document.createElement('div');
        right.style.cssText =
            'display: block; font-size: 20px; line-height: 24px;';
        right.textContent = 'Right';
        setRect(right, 160, 10, 80, 40);
        wrapper.append(left, right);
        Object.defineProperty(Range.prototype, 'getClientRects', {
            configurable: true,
            value: function (this: Range) {
                const rect =
                    this.startContainer.parentElement === left
                        ? new DOMRect(10, 10, 40, 20)
                        : new DOMRect(160, 10, 50, 20);
                return [rect];
            },
        });

        const result = await measurer.measureItem(
            wrapper,
            { id: 1, type: 'html' },
            new DOMRect(0, 0, 1920, 1080),
            0,
        );
        expect(result).toMatchObject({
            kind: 'group',
            children: [
                { kind: 'shape', name: 'html 1 text', box: { x: 10 } },
                { kind: 'shape', name: 'html 1 text', box: { x: 160 } },
            ],
        });
        measurer.destroy();
    });

    it('keeps centered and right-aligned text in the measured alignment band', () => {
        const measurer = makeMeasurer();
        const origin = new DOMRect(0, 0, 1920, 1080);
        const measure = (align: 'center' | 'right', x: number) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `font-size: 20px; line-height: 24px; text-align: ${align};`;
            wrapper.textContent = 'Aligned';
            setRect(wrapper, 0, 0, 200, 80);
            mockTextRects(new DOMRect(x, 10, 50, 20));
            return measurer.measureTextBlocks(wrapper, origin)[0];
        };

        expect(measure('center', 75).frame).toMatchObject({
            x: 0,
            width: 200,
        });
        expect(measure('center', 20).frame).toMatchObject({
            x: 20,
            width: 50,
        });
        expect(measure('right', 150).frame).toMatchObject({
            x: 0,
            width: 200,
        });
        expect(measure('right', 20).frame).toMatchObject({
            x: 0,
            width: 70,
        });
        measurer.destroy();
    });

    it('caches a decoded background still across slides and exports its crop', async () => {
        const imageLoads = mockLoadedImages(800, 600);
        const source = 'data:image/png;base64,iVBORw0K';
        fixture.getAttachedBackground.mockResolvedValue({
            type: DragTypeEnum.BACKGROUND_IMAGE,
            item: { src: source },
        });
        const media = { id: 3 } as unknown as PptxMediaType;
        const loaded: unknown[] = [];
        const addMedia = vi.fn(
            async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return media;
            },
        );
        const measurer = makeMeasurer(addMedia);
        const first = await measurer.measureSlide(makeSlide({ id: 1 }));
        const second = await measurer.measureSlide(makeSlide({ id: 2 }));
        expect(first.background).toMatchObject({ kind: 'picture', media });
        expect(second.background).toEqual(first.background);
        expect(imageLoads).toHaveBeenCalledTimes(1);
        expect(loaded).toHaveLength(2);
        expect(loaded[0]).toMatchObject({ extension: 'png' });
        measurer.destroy();
    });

    it('captures a video background only once for repeated slides', async () => {
        mockLoadedImages(1280, 720);
        fixture.captureVideoFrameDataUrl.mockResolvedValue(
            'data:image/jpeg;base64,/9j/',
        );
        fixture.getAttachedBackground.mockResolvedValue({
            type: DragTypeEnum.BACKGROUND_VIDEO,
            item: { src: 'file:///clip.mp4' },
        });
        const media = { id: 4 } as unknown as PptxMediaType;
        const measurer = makeMeasurer(vi.fn(async () => media));
        expect(
            (await measurer.measureSlide(makeSlide({ id: 1 }))).background,
        ).toMatchObject({ kind: 'picture', media });
        expect(
            (await measurer.measureSlide(makeSlide({ id: 2 }))).background,
        ).toMatchObject({ kind: 'picture', media });
        expect(fixture.captureVideoFrameDataUrl).toHaveBeenCalledTimes(1);
        measurer.destroy();
    });

    it('exports a local JPEG using its bytes without re-encoding it', async () => {
        fixture.fsReadFileBytes.mockResolvedValue(
            new Uint8Array([0xff, 0xd8, 0xff]),
        );
        const media = { id: 5 } as unknown as PptxMediaType;
        const loaded: unknown[] = [];
        const addMedia = vi.fn(
            async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return media;
            },
        );
        const measurer = makeMeasurer(addMedia);
        const image = document.createElement('img');
        image.src = 'file:///C:/Pictures/sunday.jpg';
        Object.defineProperty(image, 'naturalWidth', { value: 640 });
        Object.defineProperty(image, 'naturalHeight', { value: 480 });
        const picture = await measurer.measurePicture(
            image,
            { x: 0, y: 0, width: 640, height: 480 },
            getComputedStyle(image),
            { type: 'image' },
        );
        expect(picture).toMatchObject({ kind: 'picture', media });
        expect(fixture.fsReadFileBytes).toHaveBeenCalledWith(
            'C:/Pictures/sunday.jpg',
        );
        expect(loaded).toEqual([
            { extension: 'jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff]) },
        ]);
        measurer.destroy();
    });

    it('turns a browser line wrap into two editable PowerPoint lines', () => {
        const measurer = makeMeasurer();
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'font-size: 20px; line-height: 28px;';
        wrapper.textContent = 'First Second';
        setRect(wrapper, 0, 0, 200, 80);
        Object.defineProperty(Range.prototype, 'getClientRects', {
            configurable: true,
            value: function (this: Range) {
                if (this.endOffset - this.startOffset > 1) {
                    return [
                        new DOMRect(0, 0, 50, 20),
                        new DOMRect(0, 40, 60, 20),
                    ];
                }
                if (this.startOffset === 5) return [];
                const secondLine = this.startOffset >= 6;
                return [
                    new DOMRect(
                        secondLine
                            ? (this.startOffset - 6) * 10
                            : this.startOffset * 10,
                        secondLine ? 40 : 0,
                        10,
                        20,
                    ),
                ];
            },
        });
        const blocks = measurer.measureTextBlocks(
            wrapper,
            new DOMRect(0, 0, 1920, 1080),
        );
        expect(blocks).toHaveLength(1);
        expect(
            blocks[0].textBody.lines.map((line) =>
                line.runs.map((run) => run.text).join(''),
            ),
        ).toEqual(['First', 'Second']);
        measurer.destroy();
    });

    it('preserves translucent panel fill and border after measuring opacity', () => {
        const measurer = makeMeasurer();
        const root = document.createElement('div');
        root.style.opacity = '0.5';
        const panel = document.createElement('div');
        panel.style.cssText =
            'opacity: 0.8; background: rgb(0, 0, 255); border: 4px solid rgb(255, 0, 0);';
        setRect(panel, 10, 20, 100, 50);
        root.appendChild(panel);
        const shapes = measurer.measureDecorations(
            root,
            new DOMRect(0, 0, 1920, 1080),
            'html 1',
        );
        expect(shapes).toMatchObject([
            {
                kind: 'shape',
                name: 'html 1 panel',
                box: { x: 12, y: 22, width: 96, height: 46 },
                fill: { hex: '0000FF', alpha: 0.4 },
                line: { width: 4, color: { hex: 'FF0000', alpha: 0.4 } },
            },
        ]);
        measurer.destroy();
    });

    it('skips one broken item while keeping the next item and clearing preview markup', async () => {
        const measurer = makeMeasurer();
        let rendered: HTMLElement | null = null;
        let badge: HTMLSpanElement | null = null;
        fixture.genSlideHtml.mockImplementation(() => {
            const slideDiv = document.createElement('div');
            const broken = document.createElement('div');
            setRect(broken, 0, 0, 100, 100);
            broken.getBoundingClientRect = () => {
                throw new Error('bad item');
            };
            const good = document.createElement('div');
            good.style.backgroundColor = '#228844';
            setRect(good, 100, 0, 100, 100);
            const website = document.createElement('div');
            website.setAttribute(WEBSITE_ITEM_ATTR, 'true');
            const websiteFrame = document.createElement('div');
            websiteFrame.setAttribute(PREVIEW_ONLY_ATTR, 'true');
            website.appendChild(websiteFrame);
            good.appendChild(website);
            badge = document.createElement('span');
            badge.setAttribute(PREVIEW_ONLY_ATTR, 'true');
            good.appendChild(badge);
            slideDiv.append(broken, good);
            rendered = slideDiv;
            return slideDiv;
        });
        const model = await measurer.measureSlide(
            makeSlide({
                canvasItemsJson: [
                    { id: 1, type: 'text' },
                    { id: 2, type: 'text' },
                ],
                getBibleKeys: () => ['KJV'],
            }),
        );
        expect(model.elements).toHaveLength(1);
        expect(model.elements[0]).toMatchObject({
            kind: 'shape',
            fill: { hex: '228844' },
        });
        expect(fixture.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'bad item' }),
        );
        expect(fixture.getBibleFontFamily).toHaveBeenCalledWith('KJV');
        expect(
            (rendered as HTMLElement | null)?.querySelector(
                `[${WEBSITE_ITEM_ATTR}] [${PREVIEW_ONLY_ATTR}]`,
            ),
        ).toBeNull();
        expect((badge as HTMLSpanElement | null)?.style.display).toBe('none');
        expect((rendered as HTMLElement | null)?.parentElement).toBeNull();
        measurer.destroy();
    });

    it('uses a video poster frame as the still picture in a slide', async () => {
        mockLoadedImages(1280, 720);
        fixture.captureVideoFrameDataUrl.mockResolvedValue(
            'data:image/jpeg;base64,/9j/',
        );
        const media = { id: 11 } as unknown as PptxMediaType;
        const measurer = makeMeasurer(vi.fn(async () => media));
        const video = document.createElement('video');
        video.src = 'file:///sunday.mp4';
        const picture = await measurer.measurePicture(
            video,
            { x: 0, y: 0, width: 640, height: 360 },
            getComputedStyle(video),
            { type: 'video' },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            name: 'video picture',
        });
        expect(fixture.captureVideoFrameDataUrl).toHaveBeenCalledWith(
            video.src,
        );
        measurer.destroy();
    });

    it('serializes a canvas to PNG and keeps its intrinsic size', async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const loaded: unknown[] = [];
        const media = { id: 12 } as unknown as PptxMediaType;
        const measurer = makeMeasurer(
            vi.fn(async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return media;
            }),
        );
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        canvas.toBlob = (callback) =>
            callback({ arrayBuffer: async () => bytes.buffer } as Blob);
        const picture = await measurer.measurePicture(
            canvas,
            { x: 0, y: 0, width: 640, height: 480 },
            getComputedStyle(canvas),
            { type: 'canvas' },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            box: { width: 640, height: 480 },
        });
        expect(loaded).toEqual([{ bytes, extension: 'png' }]);
        measurer.destroy();
    });

    it('uses a YouTube thumbnail URL only for a valid video item', async () => {
        mockLoadedImages(480, 360);
        const media = { id: 13 } as unknown as PptxMediaType;
        const addMedia = vi.fn(async (_key: string) => media);
        const measurer = makeMeasurer(addMedia);
        const iframe = document.createElement('iframe');
        const box = { x: 10, y: 20, width: 480, height: 270 };
        expect(
            await measurer.measurePicture(
                iframe,
                box,
                getComputedStyle(iframe),
                { type: 'website', url: 'https://example.org' },
            ),
        ).toBeNull();
        const picture = await measurer.measurePicture(
            iframe,
            box,
            getComputedStyle(iframe),
            {
                type: 'youtube',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            name: 'youtube picture',
        });
        expect(addMedia.mock.calls[0][0]).toContain(
            '/dQw4w9WgXcQ/hqdefault.jpg',
        );
        measurer.destroy();
    });

    it('keeps web-served PNG bytes when the response includes a MIME parameter', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            headers: { get: () => 'image/png; charset=binary' },
            arrayBuffer: async () =>
                new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
        }));
        vi.stubGlobal('fetch', fetchMock);
        const loaded: unknown[] = [];
        const measurer = makeMeasurer(
            vi.fn(async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return { id: 14 } as unknown as PptxMediaType;
            }),
        );
        const image = document.createElement('img');
        image.src = 'https://example.org/slide.png';
        Object.defineProperty(image, 'naturalWidth', { value: 320 });
        Object.defineProperty(image, 'naturalHeight', { value: 200 });
        const picture = await measurer.measurePicture(
            image,
            { x: 0, y: 0, width: 320, height: 200 },
            getComputedStyle(image),
            { type: 'image' },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            name: 'image picture',
        });
        expect(fetchMock).toHaveBeenCalledWith('https://example.org/slide.png');
        expect(loaded).toEqual([
            {
                bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
                extension: 'png',
            },
        ]);
        measurer.destroy();
    });

    it('rasterizes WebP pictures to PNG while preserving their slide dimensions', async () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage,
        } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback) =>
                callback({ arrayBuffer: async () => bytes.buffer } as Blob),
        );
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                headers: { get: () => 'image/webp' },
                arrayBuffer: async () => bytes.buffer,
            })),
        );
        const image = document.createElement('img');
        image.src = 'https://example.org/slide.webp';
        Object.defineProperty(image, 'naturalWidth', { value: 200 });
        Object.defineProperty(image, 'naturalHeight', { value: 100 });
        const loaded: unknown[] = [];
        const media = { id: 15 } as unknown as PptxMediaType;
        const measurer = makeMeasurer(
            vi.fn(async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return media;
            }),
        );
        const picture = await measurer.measurePicture(
            image,
            { x: 10, y: 20, width: 400, height: 200 },
            getComputedStyle(image),
            { type: 'image' },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            box: { x: 10, y: 20, width: 400, height: 200 },
        });
        expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 200, 100);
        expect(loaded).toEqual([{ bytes, extension: 'png' }]);
        measurer.destroy();
    });

    it('rasterizes an inline SVG at twice its slide dimensions with its color', async () => {
        mockLoadedImages(160, 80);
        const bytes = new Uint8Array([4, 5, 6]);
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            drawImage,
        } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback) =>
                callback({ arrayBuffer: async () => bytes.buffer } as Blob),
        );
        const loaded: unknown[] = [];
        const media = { id: 16 } as unknown as PptxMediaType;
        const measurer = makeMeasurer(
            vi.fn(async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return media;
            }),
        );
        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );
        svg.style.color = 'rgb(10, 20, 30)';
        const picture = await measurer.measurePicture(
            svg,
            { x: 5, y: 10, width: 160, height: 80 },
            getComputedStyle(svg),
            { type: 'bible' },
        );
        expect(picture).toMatchObject({
            kind: 'picture',
            media,
            box: { x: 5, y: 10, width: 160, height: 80 },
        });
        expect(drawImage).toHaveBeenCalledWith(
            expect.any(HTMLImageElement),
            0,
            0,
            320,
            160,
        );
        expect(loaded).toEqual([{ bytes, extension: 'png' }]);
        measurer.destroy();
    });

    it('bakes a blurred background behind an item as a separate JPEG picture', async () => {
        mockLoadedImages(800, 600);
        fixture.getAttachedBackground.mockResolvedValue({
            type: DragTypeEnum.BACKGROUND_IMAGE,
            item: { src: 'data:image/png;base64,iVBORw0K' },
        });
        const context = {
            scale: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            drawImage: vi.fn(),
            filter: '',
        };
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            context as unknown as CanvasRenderingContext2D,
        );
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback) => {
                callback({
                    arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer,
                } as Blob);
            },
        );
        const media = { id: 15 } as unknown as PptxMediaType;
        const loaded: unknown[] = [];
        const addMedia = vi.fn(
            async (_key: string, load: () => Promise<unknown>) => {
                loaded.push(await load());
                return media;
            },
        );
        const measurer = makeMeasurer(addMedia);
        await measurer.measureBackground(makeSlide());
        const box = { x: 20, y: 30, width: 100, height: 60, rotation: 15 };
        const blurred = await measurer.genBackdropPicture(
            box,
            { kind: 'rect' },
            4,
            'text 1',
        );
        expect(blurred).toMatchObject({
            kind: 'picture',
            name: 'text 1 blur',
            media,
            box: { ...box, rotation: 0 },
        });
        expect(addMedia.mock.calls[1][0]).toBe('backdrop:0');
        expect(loaded[1]).toEqual({
            bytes: new Uint8Array([7, 8, 9]),
            extension: 'jpeg',
        });
        expect(context.filter).toBe('blur(4px)');
        expect(context.drawImage).toHaveBeenCalled();
        measurer.destroy();
    });
});
